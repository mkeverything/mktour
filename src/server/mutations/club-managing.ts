import { getLichessTeam, getUserLichessTeams } from '@/lib/api/lichess';
import { CACHE_TAGS } from '@/lib/cache-tags';
import { AppError } from '@/lib/errors';
import { normalizePlayerNickname } from '@/lib/player-nickname';
import { newid } from '@/lib/utils';
import { resolveLinkIcon } from '@/server/club-links';
import { db, type Transaction } from '@/server/db';
import { lockClubs } from '@/server/db/locks';
import { clubs, clubs_to_users } from '@/server/db/schema/clubs';
import {
  club_notifications,
  user_notifications,
} from '@/server/db/schema/notifications';
import {
  affiliations,
  player_stats,
  players,
  rating_events,
} from '@/server/db/schema/players';
import { tournaments } from '@/server/db/schema/tournaments';
import { users } from '@/server/db/schema/users';
import {
  publishClubNotification,
  publishUserNotification,
} from '@/server/events';
import { refreshPlayerStats } from '@/server/mutations/player-stats';
import { getEmptyClub } from '@/server/queries/get-empty-club';
import getStatusInClub from '@/server/queries/get-status-in-club';
import { playerExistsInClub } from '@/server/queries/player-exists-in-club';
import {
  ClubEditModel,
  ClubFormModel,
  ClubToUserModel,
} from '@/server/zod/clubs';
import { UserNotificationInsertModel } from '@/server/zod/notifications';
import {
  PlayerEditModel,
  PlayerFormModel,
  playerFormSchema,
} from '@/server/zod/players';
import { UserModel } from '@/server/zod/users';
import { and, asc, desc, eq, inArray, ne, notInArray, or } from 'drizzle-orm';
import { User } from 'lucia';
import { revalidatePath, revalidateTag } from 'next/cache';

import 'server-only';

export const createClub = async (user: User, values: ClubFormModel) => {
  const emptyClub = await getEmptyClub({ userId: user.id });
  if (emptyClub) throw new AppError('EMPTY_CLUB_EXISTS');
  await validateLichessTeamAdmin({
    lichessTeam: values.lichessTeam,
    username: user.username,
  });

  const id = newid();
  const createdAt = new Date();
  const newClub = {
    ...values,
    links: values.links?.map(({ url }) => ({
      url,
      icon: resolveLinkIcon(url),
    })),
    id,
    createdAt,
  };
  const newRelation: ClubToUserModel = {
    clubId: id,
    userId: user.id,
    status: 'co-owner',
    promotedAt: new Date(),
  };
  try {
    const returnedClub = (
      await db.insert(clubs).values(newClub).returning()
    ).at(0);
    await Promise.all([
      db.insert(clubs_to_users).values(newRelation),
      db.update(users).set({ selectedClub: id }).where(eq(users.id, user.id)),
    ]);
    if (!returnedClub) throw new AppError('CLUB_NOT_CREATED');
    return returnedClub;
  } catch (e) {
    throw new AppError('CLUB_NOT_CREATED', { cause: e });
  }
};

export const editClub = async ({
  username,
  clubId,
  ...values
}: ClubEditModel & { username: string }) => {
  await validateLichessTeamAdmin({
    lichessTeam: values.lichessTeam,
    username,
  });

  const newClub = await db
    .update(clubs)
    .set({
      ...values,
      links: values.links?.map(({ url }) => ({
        url,
        icon: resolveLinkIcon(url),
      })),
    })
    .where(eq(clubs.id, clubId))
    .returning();
  revalidateTag(CACHE_TAGS.ALL_CLUBS, 'max');
  return newClub.at(0);
};

async function validateLichessTeamAdmin({
  lichessTeam,
  username,
}: {
  lichessTeam?: string | null;
  username: string;
}) {
  if (!lichessTeam) return;

  const userTeams = await getUserLichessTeams(username);
  const isTeamAdmin = userTeams.find((t) => t.id === lichessTeam);
  if (isTeamAdmin) return;

  const team = await getLichessTeam(lichessTeam);
  if (!team) throw new AppError('LICHESS_TEAM_NOT_FOUND');
  throw new AppError('NOT_LICHESS_TEAM_ADMIN');
}

type ClubDeleteProps = {
  clubId: string;
  userId: string;
  userDeletion: boolean;
};

export const deleteClub = async ({
  clubId,
  userId,
  userDeletion,
}: ClubDeleteProps) => {
  return await deleteClubFunction({ clubId, userId, userDeletion });
};

export const createPlayer = async (
  player: PlayerFormModel,
  options: {
    database?: Transaction;
    id?: string;
  } = {},
) => {
  const nickname = normalizePlayerNickname(player.nickname);
  const taken = await playerExistsInClub({
    nickname,
    clubId: player.clubId,
  });
  if (taken) {
    throw new AppError('PLAYER_EXISTS_ERROR');
  }

  const insertPlayerWithStartingEvent = async (database: Transaction) => {
    const createdAt = new Date();
    const newPlayer = (
      await database
        .insert(players)
        .values({
          ...playerFormSchema.parse(player),
          nickname,
          id: options.id ?? newid(),
          ratingPeak: null,
          ratingLastUpdateAt: createdAt,
          lastSeenAt: createdAt,
        })
        .returning()
    ).at(0);
    if (!newPlayer) throw new AppError('PLAYER_NOT_CREATED');

    await database.insert(rating_events).values({
      id: newid(),
      playerId: newPlayer.id,
      sourceTournamentId: null,
      publishedAt: createdAt,
      rating: newPlayer.rating,
      ratingDeviation: newPlayer.ratingDeviation,
      isStarting: true,
    });
    await database.insert(player_stats).values({ playerId: newPlayer.id });
    return newPlayer;
  };

  return options.database
    ? await insertPlayerWithStartingEvent(options.database)
    : await db.transaction(insertPlayerWithStartingEvent);
};

export const deletePlayer = async ({
  playerId,
  clubId,
}: {
  playerId: string;
  clubId: string;
}) => {
  await db.transaction(async (tx) => {
    await lockClubs(tx, [clubId]);
    const [player] = await tx
      .select({ id: players.id })
      .from(players)
      .where(eq(players.id, playerId))
      .for('update');
    if (!player) return;
    const unitMember = await tx.query.players_to_units.findFirst({
      where: { playerId },
      columns: { unitId: true },
    });
    if (unitMember) throw new AppError('PLAYER_HAS_TOURNAMENTS');

    const stats = await tx.query.player_stats.findFirst({
      where: { playerId },
      columns: { ratingRank: true },
    });
    await tx.delete(players).where(eq(players.id, playerId));
    if (stats && stats.ratingRank !== null) {
      await refreshPlayerStats(tx, { clubId, playerIds: [] });
    }
  });
};

export const editPlayer = async ({
  values,
  user,
}: {
  values: PlayerEditModel;
  user: User;
}) => {
  const { playerId, ...updates } = values;
  const [player] = await db
    .select({ clubId: players.clubId, userId: players.userId })
    .from(players)
    .where(eq(players.id, playerId));

  if (!player) throw new AppError('PLAYER_NOT_FOUND');

  const isAffiliated = player.userId === user.id;
  const isClubAdmin = await getStatusInClub({
    userId: user.id,
    clubId: player.clubId,
  });

  if (!isAffiliated && !isClubAdmin) throw new AppError('FORBIDDEN');
  if (!isClubAdmin && updates.realname !== undefined) {
    throw new AppError('FORBIDDEN');
  }

  const payload = isClubAdmin
    ? updates
    : {
        nickname: updates.nickname,
      };

  if (payload.nickname !== undefined) {
    payload.nickname = normalizePlayerNickname(payload.nickname);
    const conflict = await playerExistsInClub({
      nickname: payload.nickname,
      clubId: player.clubId,
      excludePlayerId: playerId,
    });
    if (conflict) {
      throw new AppError('PLAYER_EXISTS_ERROR');
    }
  }

  const hasAtLeastOneField = Object.values(payload).some(
    (value) => value !== undefined,
  );
  if (!hasAtLeastOneField) {
    const [currentPlayer] = await db
      .select()
      .from(players)
      .where(eq(players.id, playerId));
    if (!currentPlayer) throw new AppError('PLAYER_NOT_EDITED');
    return currentPlayer;
  }

  const result = (
    await db
      .update(players)
      .set(payload)
      .where(eq(players.id, playerId))
      .returning()
  ).at(0);
  revalidatePath(`/player/${playerId}`);

  if (!result) throw new AppError('PLAYER_NOT_EDITED');
  return result;
};

export default async function getAllClubManagers(clubId: string) {
  return await db
    .select({
      userId: clubs_to_users.userId,
      username: users.username,
      status: clubs_to_users.status,
      promotedAt: clubs_to_users.promotedAt,
    })
    .from(clubs_to_users)
    .where(eq(clubs_to_users.clubId, clubId))
    .innerJoin(users, eq(clubs_to_users.userId, users.id));
}

export const deleteClubFunction = async ({
  clubId,
  userId,
  userDeletion = false, // true when function is invoked while deleting the user - single owner of a club
}: ClubDeleteProps) => {
  const [otherClubs, otherCoOwners, userStatus] = await Promise.all([
    db
      .select()
      .from(clubs_to_users)
      .where(
        and(
          eq(clubs_to_users.userId, userId),
          ne(clubs_to_users.clubId, clubId),
          eq(clubs_to_users.status, 'co-owner'),
        ),
      )
      .limit(1),
    db
      .select()
      .from(clubs_to_users)
      .where(
        and(
          eq(clubs_to_users.clubId, clubId),
          ne(clubs_to_users.userId, userId),
          eq(clubs_to_users.status, 'co-owner'),
        ),
      )
      .limit(1),
    getStatusInClub({ userId, clubId }),
  ]);
  if (userStatus !== 'co-owner') throw new AppError('UNAUTHENTICATED');
  if (otherCoOwners.length !== 0) throw new AppError('CLUB_HAS_OTHER_CO_OWNER');
  if (otherClubs.length === 0 && !userDeletion)
    throw new AppError('ZERO_CLUBS');

  await db.transaction((tx) => deleteClubRows(tx, clubId));
};

/** everyone who has the club selected, or only the given user, moves to a club they co-own */
const moveSelectionFromClub = (
  tx: Transaction,
  clubId: string,
  userId?: string,
) =>
  tx
    .update(users)
    .set({ selectedClub: clubs_to_users.clubId })
    .from(clubs_to_users)
    .where(
      and(
        eq(users.selectedClub, clubId),
        userId ? eq(users.id, userId) : undefined,
        eq(clubs_to_users.userId, users.id),
        ne(clubs_to_users.clubId, clubId),
        eq(clubs_to_users.status, 'co-owner'),
      ),
    );

// memberships and games keep a player who played from being deleted, and the
// club reaches them through both its players and its tournaments: tournaments go first
export const deleteClubRows = async (tx: Transaction, clubId: string) => {
  await moveSelectionFromClub(tx, clubId);
  await tx.delete(tournaments).where(eq(tournaments.clubId, clubId));
  await tx.delete(clubs).where(eq(clubs.id, clubId));
};

export const getClubAffiliatedUsers = async (clubId: string) => {
  return (
    await db
      .select()
      .from(players)
      .where(eq(players.clubId, clubId))
      .innerJoin(users, eq(players.userId, users.id))
      .orderBy(desc(players.lastSeenAt))
  ).map((el) => el.user);
};

export const addClubManager = async ({
  clubId,
  userId,
  status,
  user,
}: {
  clubId: string;
  userId: string;
  status: 'co-owner' | 'admin';
  user: UserModel;
}) => {
  const authorStatus = await getStatusInClub({
    userId: user.id,
    clubId,
  });
  if (authorStatus === 'admin' && status === 'co-owner')
    throw new AppError('FORBIDDEN');
  const existingRelation = await db
    .select()
    .from(clubs_to_users)
    .where(
      and(eq(clubs_to_users.clubId, clubId), eq(clubs_to_users.userId, userId)),
    );
  if (existingRelation.length > 0) throw new AppError('RELATION_EXISTS');
  const newRelation: ClubToUserModel = {
    clubId: clubId,
    userId: userId,
    status,
    promotedAt: new Date(),
  };

  const userNotification: UserNotificationInsertModel = {
    id: newid(),
    userId: userId,
    event: 'became_club_manager',
    clubId,
    metadata: { role: status },
  };
  await db.transaction(async (tx) => {
    await lockClubs(tx, [clubId]);
    await tx.insert(clubs_to_users).values(newRelation);
    await tx.insert(user_notifications).values(userNotification);

    const [request] = await tx
      .update(affiliations)
      .set({ status: 'approved', updatedAt: new Date() })
      .where(
        and(
          eq(affiliations.userId, userId),
          eq(affiliations.clubId, clubId),
          eq(affiliations.status, 'requested'),
        ),
      )
      .returning({ playerId: affiliations.playerId });
    if (request) {
      await tx
        .update(players)
        .set({ userId })
        .where(eq(players.id, request.playerId));
    }

    if (status !== 'admin') return;

    const targetUser = await tx.query.users.findFirst({
      where: { id: userId },
      columns: {
        selectedClub: true,
      },
    });
    if (!targetUser) return;

    const hasFinishedTournamentsInSelectedClub =
      await tx.query.tournaments.findFirst({
        where: {
          clubId: targetUser.selectedClub,
          closedAt: { isNotNull: true },
        },
        columns: { id: true },
      });

    if (!hasFinishedTournamentsInSelectedClub) {
      await tx
        .update(users)
        .set({ selectedClub: clubId })
        .where(eq(users.id, userId));
    }
  });
  publishUserNotification(userId);
  publishClubNotification(clubId);
};

export const deleteClubManager = async ({
  clubId,
  userId,
  user,
}: {
  clubId: string;
  userId: string;
  user: UserModel;
}) => {
  const [authorStatus, targetStatus] = await Promise.all([
    getStatusInClub({ userId: user.id, clubId }),
    getStatusInClub({ userId, clubId }),
  ]);
  if (targetStatus !== 'admin') throw new AppError('FORBIDDEN');
  if (authorStatus !== 'co-owner') throw new AppError('FORBIDDEN');
  await db.transaction(async (tx) => {
    await tx
      .delete(clubs_to_users)
      .where(
        and(
          eq(clubs_to_users.clubId, clubId),
          eq(clubs_to_users.userId, userId),
        ),
      );
    await moveSelectionFromClub(tx, clubId, userId);
    await tx.insert(user_notifications).values({
      id: newid(),
      userId,
      event: 'removed_from_club_managers',
      clubId,
    });
  });
  publishUserNotification(userId);
};

/** in each club the user is leaving with no other co-owner, the longest-serving admin becomes co-owner */
export const promoteSuccessorCoOwners = async (
  tx: Transaction,
  { userId, clubIds }: { userId: string; clubIds: string[] },
) => {
  const clubsWithOtherCoOwner = tx
    .select({ clubId: clubs_to_users.clubId })
    .from(clubs_to_users)
    .where(
      and(
        inArray(clubs_to_users.clubId, clubIds),
        ne(clubs_to_users.userId, userId),
        eq(clubs_to_users.status, 'co-owner'),
      ),
    );
  const admins = await tx
    .select()
    .from(clubs_to_users)
    .where(
      and(
        inArray(clubs_to_users.clubId, clubIds),
        ne(clubs_to_users.userId, userId),
        eq(clubs_to_users.status, 'admin'),
        notInArray(clubs_to_users.clubId, clubsWithOtherCoOwner),
      ),
    )
    .orderBy(asc(clubs_to_users.promotedAt));
  const adminsByClub = Map.groupBy(admins, ({ clubId }) => clubId);
  const successors = [...adminsByClub.values()].map(
    ([oldestAdmin]) => oldestAdmin,
  );
  if (successors.length === 0) return [];

  const promotedAt = new Date();
  await tx
    .update(clubs_to_users)
    .set({ status: 'co-owner', promotedAt })
    .where(
      or(
        ...successors.map(({ clubId, userId }) =>
          and(
            eq(clubs_to_users.clubId, clubId),
            eq(clubs_to_users.userId, userId),
          ),
        ),
      ),
    );
  await tx.insert(user_notifications).values(
    successors.map(({ clubId, userId }): UserNotificationInsertModel => ({
      id: newid(),
      userId,
      event: 'became_club_manager',
      createdAt: promotedAt,
      clubId,
      metadata: { role: 'co-owner' },
    })),
  );
  return successors.map(({ userId }) => userId);
};

export const leaveClub = async ({
  clubId,
  userId,
}: {
  clubId: string;
  userId: string;
}) => {
  const otherClubId = (
    await db
      .select({ clubId: clubs_to_users.clubId })
      .from(clubs_to_users)
      .where(
        and(
          eq(clubs_to_users.userId, userId),
          ne(clubs_to_users.clubId, clubId),
          eq(clubs_to_users.status, 'co-owner'),
        ),
      )
      .limit(1)
  ).at(0)?.clubId;
  if (!otherClubId) throw new AppError('NO_OTHER_CLUB_CO_OWNER');

  const promotedUserIds = await db.transaction(async (tx) => {
    await lockClubs(tx, [clubId]);
    const otherManager = await tx.query.clubs_to_users.findFirst({
      where: { clubId, userId: { ne: userId } },
      columns: { userId: true },
    });
    if (!otherManager) throw new AppError('CANNOT_LEAVE_AS_ONLY_MANAGER');
    const successorIds = await promoteSuccessorCoOwners(tx, {
      userId,
      clubIds: [clubId],
    });

    await tx
      .update(users)
      .set({ selectedClub: otherClubId })
      .where(eq(users.id, userId));
    await tx
      .delete(clubs_to_users)
      .where(
        and(
          eq(clubs_to_users.clubId, clubId),
          eq(clubs_to_users.userId, userId),
        ),
      );
    await tx.insert(club_notifications).values({
      id: newid(),
      clubId,
      event: 'manager_left',
      userId,
    });
    return successorIds;
  });
  for (const promotedUserId of promotedUserIds) {
    publishUserNotification(promotedUserId);
  }
  publishClubNotification(clubId);
};

export const changeClubNotificationStatus = async ({
  notificationId,
  clubId,
  isSeen,
}: {
  notificationId: string;
  clubId: string;
  isSeen: boolean;
}) => {
  await db
    .update(club_notifications)
    .set({ isSeen })
    .where(
      and(
        eq(club_notifications.id, notificationId),
        eq(club_notifications.clubId, clubId),
      ),
    );
};
