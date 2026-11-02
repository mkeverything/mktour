import 'server-only';

import { revalidatePath } from 'next/cache';

import { AppError } from '@/lib/errors';
import { newid } from '@/lib/utils';
import { db } from '@/server/db';
import { lockClubs } from '@/server/db/locks';
import { club_notifications } from '@/server/db/schema/notifications';
import { affiliations, players } from '@/server/db/schema/players';
import { games, players_to_units } from '@/server/db/schema/tournaments';
import { publishClubNotification } from '@/server/events';
import { refreshPlayerStats } from '@/server/mutations/player-stats';
import type { PlayerMergeInputModel } from '@/server/zod/players';
import { openAffiliationStatusEnum } from '@/server/zod/enums';
import { and, asc, countDistinct, eq, inArray } from 'drizzle-orm';

export async function mergePlayers({
  clubId,
  basePlayerId,
  mergedPlayerId,
}: PlayerMergeInputModel & { clubId: string }) {
  if (basePlayerId === mergedPlayerId) {
    throw new AppError('PLAYER_MERGE_SAME_PLAYER');
  }

  await db.transaction(async (tx) => {
    await lockClubs(tx, [clubId]);
    const playerIds = [basePlayerId, mergedPlayerId];
    const playerRows = await tx
      .select()
      .from(players)
      .where(inArray(players.id, playerIds))
      .orderBy(asc(players.id))
      .for('update');
    const basePlayer = playerRows.find(({ id }) => id === basePlayerId);
    const mergedPlayer = playerRows.find(({ id }) => id === mergedPlayerId);
    const openAffiliations = await tx
      .select({ id: affiliations.id })
      .from(affiliations)
      .where(
        and(
          inArray(affiliations.playerId, playerIds),
          inArray(affiliations.status, openAffiliationStatusEnum.options),
        ),
      );
    // react-doctor-disable-next-line react-doctor/server-sequential-independent-await
    const sharedTournament = await tx
      .select({ tournamentId: players_to_units.tournamentId })
      .from(players_to_units)
      .where(inArray(players_to_units.playerId, playerIds))
      .groupBy(players_to_units.tournamentId)
      .having(eq(countDistinct(players_to_units.playerId), 2))
      .limit(1)
      .then((rows) => rows.at(0));

    if (!basePlayer || !mergedPlayer) throw new AppError('PLAYER_NOT_FOUND');
    if (basePlayer.clubId !== clubId || mergedPlayer.clubId !== clubId) {
      throw new AppError('PLAYER_NOT_IN_CLUB');
    }
    if (sharedTournament) {
      throw new AppError('PLAYER_MERGE_SHARED_TOURNAMENT', {
        details: sharedTournament.tournamentId,
      });
    }
    // a player has at most one open affiliation, so two means one on each
    if (openAffiliations.length === 2) {
      throw new AppError('PLAYER_MERGE_BOTH_HAVE_AFFILIATIONS');
    }

    // keep the higher peak rating, treating a missing value as "no peak yet".
    const ratingPeak =
      basePlayer.ratingPeak === null || mergedPlayer.ratingPeak === null
        ? (basePlayer.ratingPeak ?? mergedPlayer.ratingPeak)
        : Math.max(basePlayer.ratingPeak, mergedPlayer.ratingPeak);
    const lastSeenAt =
      basePlayer.lastSeenAt > mergedPlayer.lastSeenAt
        ? basePlayer.lastSeenAt
        : mergedPlayer.lastSeenAt;

    // free up the userId on the merged player first, otherwise assigning it
    // to the base player below could collide with a uniqueness constraint.
    if (mergedPlayer.userId) {
      await tx
        .update(players)
        .set({ userId: null })
        .where(eq(players.id, mergedPlayerId));
    }

    await tx
      .update(players)
      .set({
        userId: basePlayer.userId ?? mergedPlayer.userId,
        ratingPeak,
        lastSeenAt,
        realname: basePlayer.realname ?? mergedPlayer.realname,
      })
      .where(eq(players.id, basePlayerId));

    await tx
      .update(affiliations)
      .set({ playerId: basePlayerId })
      .where(eq(affiliations.playerId, mergedPlayerId));

    await tx
      .update(players_to_units)
      .set({ playerId: basePlayerId })
      .where(eq(players_to_units.playerId, mergedPlayerId));

    await tx
      .update(games)
      .set({ whitePlayerId: basePlayerId })
      .where(eq(games.whitePlayerId, mergedPlayerId));

    await tx
      .update(games)
      .set({ blackPlayerId: basePlayerId })
      .where(eq(games.blackPlayerId, mergedPlayerId));

    await tx.insert(club_notifications).values({
      id: newid(),
      clubId,
      event: 'player_merged',
      playerId: basePlayerId,
      metadata: { mergedPlayerNickname: mergedPlayer.nickname },
    });
    await tx.delete(players).where(eq(players.id, mergedPlayerId));
    await refreshPlayerStats(tx, { clubId, playerIds: [basePlayerId] });
  });
  publishClubNotification(clubId);

  try {
    revalidatePath(`/player/${basePlayerId}`);
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') throw error;
  }
}
