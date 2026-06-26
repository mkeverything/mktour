'use server';

import { revalidatePath } from 'next/cache';

import { AppError } from '@/lib/errors';
import { withPostHogServer } from '@/lib/posthog-server';
import { newid } from '@/lib/utils';
import { db } from '@/server/db';
import { club_notifications } from '@/server/db/schema/notifications';
import { affiliations, players } from '@/server/db/schema/players';
import {
  games,
  players_to_units,
  tournament_units,
} from '@/server/db/schema/tournaments';
import type { PlayerMergeInputModel } from '@/server/zod/players';
import { countDistinct, eq, inArray, sql } from 'drizzle-orm';

const pendingStatuses = ['requested_by_user', 'requested_by_club'];

export async function mergePlayers({
  clubId,
  basePlayerId,
  mergedPlayerId,
}: PlayerMergeInputModel & { clubId: string }) {
  if (basePlayerId === mergedPlayerId) {
    throw new AppError('PLAYER_MERGE_SAME_PLAYER');
  }

  const identityInconsistencies = await db.transaction(async (tx) => {
    const playerIds = [basePlayerId, mergedPlayerId];
    const [basePlayer, mergedPlayer, affiliationRows, sharedTournament] =
      await Promise.all([
        tx.select().from(players).where(eq(players.id, basePlayerId)).get(),
        tx.select().from(players).where(eq(players.id, mergedPlayerId)).get(),
        tx
          .select()
          .from(affiliations)
          .where(inArray(affiliations.playerId, playerIds)),
        tx
          .select({ tournamentId: tournament_units.tournamentId })
          .from(players_to_units)
          .innerJoin(
            tournament_units,
            eq(players_to_units.unitId, tournament_units.id),
          )
          .where(inArray(players_to_units.playerId, playerIds))
          .groupBy(tournament_units.tournamentId)
          .having(eq(countDistinct(players_to_units.playerId), 2))
          .get(),
      ]);

    if (!basePlayer || !mergedPlayer) throw new AppError('PLAYER_NOT_FOUND');
    if (basePlayer.clubId !== clubId || mergedPlayer.clubId !== clubId) {
      throw new AppError('PLAYER_NOT_IN_CLUB');
    }
    if (sharedTournament) {
      throw new AppError('PLAYER_MERGE_SHARED_TOURNAMENT', {
        details: sharedTournament.tournamentId,
      });
    }

    // an affiliation is "linked" when it correctly ties a player record to a
    // user account, i.e. its playerId points at a player whose userId matches.
    const activeAffiliations = affiliationRows.filter(
      (a) => a.status === 'active',
    );
    const linkedAffiliations = activeAffiliations.filter((a) => {
      const player = a.playerId === basePlayerId ? basePlayer : mergedPlayer;
      return player.userId === a.userId;
    });

    // both players being properly linked to (different) users is a conflict
    // we can't resolve automatically.
    if (linkedAffiliations.length > 1) {
      throw new AppError('PLAYER_MERGE_BOTH_USER_LINKED');
    }

    const keptAffiliation = linkedAffiliations[0] ?? null;
    const linkedUserId = keptAffiliation?.userId ?? null;

    const pendingAffiliations = affiliationRows.filter((a) =>
      pendingStatuses.includes(a.status),
    );
    const basePlayerHasPending = pendingAffiliations.some(
      (a) => a.playerId === basePlayerId,
    );
    const mergedPlayerHasPending = pendingAffiliations.some(
      (a) => a.playerId === mergedPlayerId,
    );

    // neither player is linked yet, but both have pending requests — also a conflict.
    if (!linkedUserId && basePlayerHasPending && mergedPlayerHasPending) {
      throw new AppError('PLAYER_MERGE_BOTH_PENDING_AFFILIATIONS');
    }

    // any active affiliation other than the one we're keeping is stale and gets removed.
    const orphanedActiveAffiliations = activeAffiliations.filter(
      (a) => a.id !== keptAffiliation?.id,
    );
    const affiliationIdsToDelete = orphanedActiveAffiliations.map((a) => a.id);

    // a confirmed link makes any pending requests redundant.
    if (linkedUserId) {
      affiliationIdsToDelete.push(...pendingAffiliations.map((a) => a.id));
    }

    // affiliations on the merged player that should follow it onto the base player.
    const affiliationIdsToMove: string[] = [];
    if (keptAffiliation?.playerId === mergedPlayerId) {
      affiliationIdsToMove.push(keptAffiliation.id);
    }
    if (!linkedUserId) {
      for (const a of pendingAffiliations) {
        if (a.playerId === mergedPlayerId) affiliationIdsToMove.push(a.id);
      }
    }

    // flag anything we couldn't fully reconcile so it can be reviewed later.
    const identityInconsistencies: Array<{
      playerId: string;
      kind:
        | 'active_affiliation_without_user'
        | 'user_without_active_affiliation';
    }> = [];
    for (const a of orphanedActiveAffiliations) {
      identityInconsistencies.push({
        playerId: a.playerId,
        kind: 'active_affiliation_without_user',
      });
    }
    for (const player of [basePlayer, mergedPlayer]) {
      const hasLinkedAffiliation = linkedAffiliations.some(
        (a) => a.playerId === player.id,
      );
      if (player.userId && !hasLinkedAffiliation) {
        identityInconsistencies.push({
          playerId: player.id,
          kind: 'user_without_active_affiliation',
        });
      }
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
    const now = new Date();

    // free up the userId on the merged player first, otherwise assigning it
    // to the base player below could collide with a uniqueness constraint.
    if (linkedUserId === mergedPlayer.userId && linkedUserId !== null) {
      await tx
        .update(players)
        .set({ userId: null })
        .where(eq(players.id, mergedPlayerId));
    }

    await tx
      .update(players)
      .set({
        userId: linkedUserId,
        ratingPeak,
        lastSeenAt,
        realname: basePlayer.realname ?? mergedPlayer.realname,
      })
      .where(eq(players.id, basePlayerId));

    if (affiliationIdsToDelete.length > 0) {
      await tx.delete(club_notifications).where(
        sql`json_extract(${club_notifications.metadata}, '$.affiliationId') in (${sql.join(
          affiliationIdsToDelete.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      );
      await tx
        .delete(affiliations)
        .where(inArray(affiliations.id, affiliationIdsToDelete));
    }

    if (affiliationIdsToMove.length > 0) {
      await tx
        .update(affiliations)
        .set({ playerId: basePlayerId, updatedAt: now })
        .where(inArray(affiliations.id, affiliationIdsToMove));
    }

    await tx
      .update(players_to_units)
      .set({
        playerId: basePlayerId,
        newRating: null,
        newRatingDeviation: null,
        newVolatility: null,
      })
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
      isSeen: false,
      createdAt: now,
      metadata: {
        playerId: basePlayerId,
        mergedPlayerNickname: mergedPlayer.nickname,
      },
    });
    await tx.delete(players).where(eq(players.id, mergedPlayerId));

    return identityInconsistencies;
  });

  if (identityInconsistencies.length > 0) {
    await withPostHogServer(async (posthog) => {
      for (const inconsistency of identityInconsistencies) {
        posthog.capture({
          distinctId: clubId,
          event: 'player_merge_identity_inconsistency',
          properties: { clubId, ...inconsistency },
        });
      }
    });
  }

  try {
    revalidatePath(`/player/${basePlayerId}`);
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') throw error;
  }
}
