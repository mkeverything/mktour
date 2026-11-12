import { AppError } from '@/lib/errors';
import { caseWhen } from '@/lib/sql-case-when';
import { db } from '@/server/db';
import {
  player_stats,
  players,
  rating_events,
} from '@/server/db/schema/players';
import {
  games,
  players_to_units,
  tournament_units,
  tournaments,
} from '@/server/db/schema/tournaments';
import { PlayerAuthStatsModel, PlayerStatsModel } from '@/server/zod/players';
import { and, asc, count, desc, eq, getColumns, or, sql } from 'drizzle-orm';

// returns the last 5 tournaments a player participated in
export async function getPlayersTournamentsInfinite(
  playerId: string,
  limit: number = 5,
  offset: number = 0,
) {
  return await db
    .select({
      ...getColumns(tournaments),
    })
    .from(players_to_units)
    .innerJoin(tournaments, eq(players_to_units.tournamentId, tournaments.id))
    .where(eq(players_to_units.playerId, playerId))
    .orderBy(desc(tournaments.createdAt))
    .limit(limit)
    .offset(offset);
}

/** the player's tournaments, newest first, each with their unit's result and the size of the field */
export async function getPlayerResults(
  playerId: string,
  limit: number,
  cursor?: number | null,
) {
  const offset = cursor ?? 0;
  const results = await db
    .select({
      tournament: getColumns(tournaments),
      unit: {
        place: tournament_units.place,
        wins: tournament_units.wins,
        draws: tournament_units.draws,
        losses: tournament_units.losses,
      },
      unitsCount: db.$count(
        tournament_units,
        eq(tournament_units.tournamentId, tournaments.id),
      ),
    })
    .from(players_to_units)
    .innerJoin(tournaments, eq(players_to_units.tournamentId, tournaments.id))
    .innerJoin(
      tournament_units,
      eq(players_to_units.unitId, tournament_units.id),
    )
    .where(eq(players_to_units.playerId, playerId))
    .orderBy(
      desc(tournaments.date),
      desc(tournaments.createdAt),
      desc(tournaments.id),
    )
    .offset(offset)
    .limit(limit + 1);

  return {
    results: results.slice(0, limit),
    nextCursor: results.length > limit ? offset + limit : null,
  };
}

/** the player's published ratings, oldest first: the starting one, then one per rated tournament */
export async function getPlayerRatingHistory(playerId: string) {
  return await db
    .select({
      id: rating_events.id,
      publishedAt: rating_events.publishedAt,
      rating: rating_events.rating,
      ratingDeviation: rating_events.ratingDeviation,
      isStarting: rating_events.isStarting,
      tournament: {
        id: tournaments.id,
        title: tournaments.title,
        format: tournaments.format,
        date: tournaments.date,
      },
    })
    .from(rating_events)
    .leftJoin(tournaments, eq(rating_events.sourceTournamentId, tournaments.id))
    .where(eq(rating_events.playerId, playerId))
    .orderBy(asc(rating_events.publishedAt), asc(rating_events.id));
}

export async function getPlayerStats(
  playerId: string,
): Promise<PlayerStatsModel> {
  const { playerId: _, ...statsColumns } = getColumns(player_stats);
  const stats = await db
    .select(statsColumns)
    .from(player_stats)
    .where(eq(player_stats.playerId, playerId))
    .then((rows) => rows.at(0));

  if (!stats) throw new AppError('PLAYER_NOT_FOUND');
  return stats;
}

export async function getPlayerAuthStats({
  playerId,
  userId,
}: {
  playerId: string;
  userId: string;
}): Promise<PlayerAuthStatsModel | null> {
  const player = await db
    .select({
      clubId: players.clubId,
    })
    .from(players)
    .where(eq(players.id, playerId))
    .then((rows) => rows.at(0));
  if (!player) return null;

  const authPlayer = await db
    .select({ id: players.id, nickname: players.nickname })
    .from(players)
    .where(and(eq(players.userId, userId), eq(players.clubId, player.clubId)))
    .then((rows) => rows.at(0));

  if (!authPlayer) return null;
  const authPlayerId = authPlayer.id;
  if (playerId === authPlayerId) return null;

  const headToHeadCondition = or(
    and(
      eq(games.whitePlayerId, playerId),
      eq(games.blackPlayerId, authPlayerId),
    ),
    and(
      eq(games.whitePlayerId, authPlayerId),
      eq(games.blackPlayerId, playerId),
    ),
  );

  const headToHead = await db
    .select({
      playerWins: count(
        caseWhen(
          or(
            and(eq(games.whitePlayerId, playerId), eq(games.result, '1-0')),
            and(eq(games.blackPlayerId, playerId), eq(games.result, '0-1')),
          ),
          1,
        ).elseNull(),
      ),
      userWins: count(
        caseWhen(
          or(
            and(eq(games.whitePlayerId, authPlayerId), eq(games.result, '1-0')),
            and(eq(games.blackPlayerId, authPlayerId), eq(games.result, '0-1')),
          ),
          1,
        ).elseNull(),
      ),
      draws: count(caseWhen(eq(games.result, '1/2-1/2'), 1).elseNull()),
      totalGames: count(games.id),
    })
    .from(games)
    .where(headToHeadCondition)
    .then((rows) => rows.at(0));

  // Return null if no games exist between these players
  if (!headToHead || headToHead.totalGames === 0) return null;

  const mostRecentGame = await db
    .select({ tournamentId: games.tournamentId })
    .from(games)
    .where(headToHeadCondition)
    .orderBy(sql`${desc(games.finishedAt)} nulls last`)
    .limit(1)
    .then((rows) => rows.at(0));

  const lastTournament = mostRecentGame
    ? await db
        .select()
        .from(tournaments)
        .where(eq(tournaments.id, mostRecentGame.tournamentId))
        .then((rows) => rows.at(0))
    : null;

  return {
    playerWins: headToHead?.playerWins ?? 0,
    userWins: headToHead?.userWins ?? 0,
    draws: headToHead?.draws ?? 0,
    userPlayerNickname: authPlayer.nickname,
    lastTournament: lastTournament ?? null,
  };
}
