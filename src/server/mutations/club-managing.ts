'use server';

import { emptyClubCheck } from '@/app/clubs/create/empty-club-check';
import { getUserLichessTeams } from '@/lib/api/lichess';
import { CACHE_TAGS } from '@/lib/cache-tags';
import { newid } from '@/lib/utils';
import { validateLichessTeam } from '@/lib/zod/new-club-validation-action';
import { db } from '@/server/db';
import { clubs, clubs_to_users } from '@/server/db/schema/clubs';
import {
  club_notifications,
  user_notifications,
} from '@/server/db/schema/notifications';
import { affiliations, players } from '@/server/db/schema/players';
import {
  games,
  players_to_tournaments,
  tournaments,
} from '@/server/db/schema/tournaments';
import { users } from '@/server/db/schema/users';
import {
  ClubEditModel,
  ClubFormModel,
  ClubToUserModel,
} from '@/server/db/zod/clubs';
import { UserNotificationInsertModel } from '@/server/db/zod/notifications';
import { PlayerEditModel, PlayerFormModel } from '@/server/db/zod/players';
import { UserModel } from '@/server/db/zod/users';
import getStatusInClub from '@/server/queries/get-status-in-club';
import { and, eq, ne } from 'drizzle-orm';
import { User } from 'lucia';
import { revalidatePath, revalidateTag } from 'next/cache';

export const createClub = async (user: User, values: ClubFormModel) => {
  const emptyClub = await emptyClubCheck({ user });
  if (emptyClub) throw new Error('EMPTY_CLUB_EXISTS');

  const id = newid();
  const createdAt = new Date();
  const newClub = {
    ...values,
    id,
    createdAt,
  };
  const newRelation: ClubToUserModel = {
    id: `${user.id}=${id}`,
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
    if (!returnedClub) throw new Error('CLUB_NOT_CREATED');
    return returnedClub;
  } catch (e) {
    throw new Error(`CLUB_NOT_CREATED: ${e}`);
  }
};

export const editClub = async ({
  clubId,
  values,
  username,
}: {
  clubId: string;
  values: ClubEditModel;
  username: string;
}) => {
  if (values.lichessTeam) {
    const userTeams = await getUserLichessTeams(username);
    const isTeamAdmin = userTeams.find((t) => t.id === values.lichessTeam);
    if (!isTeamAdmin) throw new Error('NOT_LICHESS_TEAM_ADMIN');

    const existingClub = await validateLichessTeam({
      lichessTeam: values.lichessTeam,
    });
    if (existingClub && existingClub.id !== clubId)
      throw new Error('LICHESS_TEAM_ALREADY_LINKED');
  }

  const newClub = await db
    .update(clubs)
    .set(values)
    .where(eq(clubs.id, clubId))
    .returning();
  revalidateTag(CACHE_TAGS.ALL_CLUBS, 'max');
  return newClub.at(0);
};

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

export const createPlayer = async (player: PlayerFormModel) => {
  const newPlayer = (
    await db
      .insert(players)
      .values({
        ...player,
        lastSeenAt: new Date(),
        id: newid(),
        ratingPeak: null,
      })
      .returning()
  ).at(0);

  if (!newPlayer) throw new Error('PLAYER_NOT_CREATED');
  return newPlayer;
};

// FIXME
export const deletePlayer = async ({ playerId }: { playerId: string }) => {
  const [playerTournament] = await db
    .select({ tournamentId: players_to_tournaments.tournamentId })
    .from(players_to_tournaments)
    .where(eq(players_to_tournaments.playerId, playerId))
    .limit(1);

  if (playerTournament) {
    throw new Error('PLAYER_HAS_TOURNAMENTS');
  }

  await db.transaction(async (tx) => {
    await tx.delete(players).where(eq(players.id, playerId));
  });
};

export const editPlayer = async ({
  values,
  user,
}: {
  values: PlayerEditModel;
  user: User;
}) => {
  const [playerClub] = await db
    .select({ clubId: players.clubId })
    .from(players)
    .where(eq(players.id, values.id));

  const status = await getStatusInClub({
    userId: user.id,
    clubId: playerClub.clubId,
  });
  if (!status) throw new Error('NOT_ADMIN');
  const result = (
    await db
      .update(players)
      .set(values)
      .where(eq(players.id, values.id))
      .returning()
  ).at(0);
  revalidatePath(`/player/${values.id}`);

  if (!result) throw new Error('PLAYER_NOT_EDITED');
  return result;
};

export default async function getAllClubManagers(clubId: string) {
  return await db
    .select()
    .from(clubs_to_users)
    .where(eq(clubs_to_users.clubId, clubId))
    .innerJoin(users, eq(clubs_to_users.userId, users.id));
}

export const deleteClubFunction = async ({
  clubId,
  userId,
  userDeletion = false, // true when function is invoked while deleting the user - single owner of a club
}: ClubDeleteProps) => {
  const otherClubs = await db
    .select()
    .from(clubs_to_users)
    .where(
      and(
        eq(clubs_to_users.userId, userId),
        ne(clubs_to_users.clubId, clubId),
        eq(clubs_to_users.status, 'co-owner'),
      ),
    )
    .limit(1);

  const userStatus = await getStatusInClub({ userId, clubId });
  if (userStatus !== 'co-owner') throw new Error('UNAUTHORIZED');

  if (otherClubs.length === 0 && !userDeletion) throw new Error('ZERO_CLUBS');
  if (!userDeletion) {
    await db
      .update(users)
      .set({ selectedClub: otherClubs[0].clubId })
      .where(eq(users.id, userId));
  }
  await db.batch([
    db
      .delete(games)
      .where(
        eq(
          games.tournamentId,
          db
            .select({ id: tournaments.id })
            .from(tournaments)
            .where(eq(tournaments.clubId, clubId)),
        ),
      ),
    db
      .delete(players_to_tournaments)
      .where(
        eq(
          players_to_tournaments.tournamentId,
          db
            .select({ id: tournaments.id })
            .from(tournaments)
            .where(eq(tournaments.clubId, clubId)),
        ),
      ),

    db.delete(affiliations).where(eq(affiliations.clubId, clubId)),
    db.delete(club_notifications).where(eq(club_notifications.clubId, clubId)),
    db.delete(players).where(eq(players.clubId, clubId)),
    db.delete(tournaments).where(eq(tournaments.clubId, clubId)),
    db.delete(clubs_to_users).where(eq(clubs_to_users.clubId, clubId)),

    db.delete(clubs).where(eq(clubs.id, clubId)),
  ]);
};

export const getClubAffiliatedUsers = async (clubId: string) => {
  return (
    await db
      .select()
      .from(players)
      .where(eq(players.clubId, clubId))
      .innerJoin(users, eq(players.userId, users.id))
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
    throw new Error('NOT_AUTHORIZED');
  const existingRelation = await db
    .select()
    .from(clubs_to_users)
    .where(
      and(eq(clubs_to_users.clubId, clubId), eq(clubs_to_users.userId, userId)),
    );
  if (existingRelation.length > 0) throw new Error('RELATION_EXISTS');
  const newRelation: ClubToUserModel = {
    id: `${clubId}=${userId}`,
    clubId: clubId,
    userId: userId,
    status,
    promotedAt: new Date(),
  };

  const userNotification: UserNotificationInsertModel = {
    id: newid(),
    userId: userId,
    event: 'became_club_manager',
    isSeen: false,
    createdAt: new Date(),
    metadata: { clubId: clubId, role: status },
  };
  await Promise.all([
    db.insert(clubs_to_users).values(newRelation),
    db.insert(user_notifications).values(userNotification),
  ]);
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
  const authorStatus = await getStatusInClub({
    userId: user.id,
    clubId,
  });
  const targetStatus = await getStatusInClub({
    userId,
    clubId,
  });
  if (targetStatus === 'co-owner') throw new Error('NOT_AUTHORIZED');
  if (authorStatus !== 'co-owner') throw new Error('NOT_AUTHORIZED');
  await db
    .delete(clubs_to_users)
    .where(
      and(eq(clubs_to_users.clubId, clubId), eq(clubs_to_users.userId, userId)),
    );
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
  if (!otherClubId) throw new Error('NO_OTHER_CLUB_CO_OWNER');

  await db.transaction(async (tx) => {
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
      isSeen: false,
      createdAt: new Date(),
      metadata: { userId },
    });
  });
};

export const changeClubNotificationStatus = async ({
  notificationId,
  isSeen,
}: {
  notificationId: string;
  isSeen: boolean;
}) => {
  await db
    .update(club_notifications)
    .set({ isSeen })
    .where(eq(club_notifications.id, notificationId));
};
