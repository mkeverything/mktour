import { AppError } from '@/lib/errors';
import {
  getCurrentRatingDeviation,
  glicko2Calculator,
  GlickoGameResult,
  isEstablishedRating,
  RatingUpdate,
} from '@/lib/glicko2';
import { newid } from '@/lib/utils';
import { db } from '@/server/db';
import { players, rating_events } from '@/server/db/schema/players';
import {
  games,
  players_to_units,
  tournament_units,
  tournaments,
} from '@/server/db/schema/tournaments';
import { eq } from 'drizzle-orm';

import type { GameResult } from '@/server/zod/enums';
import type { PlayerRecordModel } from '@/server/zod/players';
import type { GameModel } from '@/server/zod/tournaments';

type Tx = Pick<typeof db, 'select' | 'update' | 'insert'>;
type PlayerRating = Pick<
  PlayerRecordModel,
  'id' | 'rating' | 'ratingDeviation' | 'ratingVolatility'
>;
type TournamentPlayerRating = PlayerRating &
  Pick<PlayerRecordModel, 'ratingPeak' | 'ratingLastUpdateAt'>;
type RatedGameRow = Pick<
  GameModel,
  'id' | 'whitePlayerId' | 'blackPlayerId' | 'result'
>;
type CompletedRatedGameRow = RatedGameRow & {
  whitePlayerId: NonNullable<RatedGameRow['whitePlayerId']>;
  blackPlayerId: NonNullable<RatedGameRow['blackPlayerId']>;
  result: NonNullable<RatedGameRow['result']>;
};
type RatedGame = CompletedRatedGameRow & {
  whiteRating: number;
  whiteRD: number;
  blackRating: number;
  blackRD: number;
};
type PlayerRatingUpdate = {
  player: TournamentPlayerRating;
  update: RatingUpdate;
  newPeak: NonNullable<PlayerRecordModel['ratingPeak']> | null;
};

async function getTournamentGameRows(tournamentId: string, tx: Tx) {
  return tx
    .select({
      id: games.id,
      whitePlayerId: games.whitePlayerId,
      blackPlayerId: games.blackPlayerId,
      result: games.result,
    })
    .from(games)
    .where(eq(games.tournamentId, tournamentId));
}

async function getTournamentPlayerRatings(
  tournamentId: string,
  tx: Tx,
): Promise<TournamentPlayerRating[]> {
  return tx
    .select({
      id: players.id,
      rating: players.rating,
      ratingPeak: players.ratingPeak,
      ratingDeviation: players.ratingDeviation,
      ratingVolatility: players.ratingVolatility,
      ratingLastUpdateAt: players.ratingLastUpdateAt,
    })
    .from(players)
    .innerJoin(players_to_units, eq(players.id, players_to_units.playerId))
    .innerJoin(
      tournament_units,
      eq(players_to_units.unitId, tournament_units.id),
    )
    .where(eq(tournament_units.tournamentId, tournamentId));
}

function mapPlayerRatings(playerRows: PlayerRating[]) {
  return new Map(playerRows.map((player) => [player.id, player]));
}

function isCompletedRatedGameRow(
  game: RatedGameRow,
): game is CompletedRatedGameRow {
  return (
    game.result !== null &&
    game.whitePlayerId !== null &&
    game.blackPlayerId !== null
  );
}

function toRatedGames(
  gameRows: RatedGameRow[],
  playerRatings: Map<PlayerRecordModel['id'], PlayerRating>,
): RatedGame[] {
  const ratedGames: RatedGame[] = [];

  for (const game of gameRows) {
    if (!isCompletedRatedGameRow(game)) continue;

    const whitePlayer = playerRatings.get(game.whitePlayerId);
    const blackPlayer = playerRatings.get(game.blackPlayerId);

    if (!whitePlayer || !blackPlayer) {
      throw new AppError('RATING_CALCULATION_ERROR', {
        cause: `rated game ${game.id} has missing player rating data`,
      });
    }

    ratedGames.push({
      ...game,
      whiteRating: whitePlayer.rating,
      whiteRD: whitePlayer.ratingDeviation,
      blackRating: blackPlayer.rating,
      blackRD: blackPlayer.ratingDeviation,
    });
  }

  return ratedGames;
}

function collectPlayerResults(
  playerId: string,
  tournamentGames: RatedGame[],
): GlickoGameResult[] {
  const results: GlickoGameResult[] = [];

  for (const game of tournamentGames) {
    if (game.whitePlayerId === playerId) {
      const score = getScoreFromResult(game.result, 'white');
      results.push({
        opponentRating: game.blackRating,
        opponentRatingDeviation: game.blackRD,
        score,
      });
    } else if (game.blackPlayerId === playerId) {
      const score = getScoreFromResult(game.result, 'black');
      results.push({
        opponentRating: game.whiteRating,
        opponentRatingDeviation: game.whiteRD,
        score,
      });
    }
  }

  return results;
}

function getScoreFromResult(
  result: GameResult,
  perspective: 'white' | 'black',
): number {
  switch (result) {
    case '1-0':
      return perspective === 'white' ? 1 : 0;
    case '0-1':
      return perspective === 'black' ? 1 : 0;
    case '1/2-1/2':
      return 0.5;
    default:
      throw new AppError('RATING_CALCULATION_ERROR', {
        cause: `invalid game result: ${result}`,
      });
  }
}

function calculateNewPeak( // returns null only if old peak was null
  currentPeak: PlayerRecordModel['ratingPeak'],
  update: RatingUpdate,
) {
  if (!isEstablishedRating(update.newRatingDeviation)) return currentPeak;
  if (currentPeak !== null && update.newRating <= currentPeak) {
    return currentPeak;
  }

  return update.newRating;
}

function calculatePlayerRatingUpdate(
  player: TournamentPlayerRating,
  tournamentGames: RatedGame[],
): PlayerRatingUpdate | null {
  const results = collectPlayerResults(player.id, tournamentGames);
  if (results.length === 0) return null;

  const currentPlayer = glicko2Calculator.fromDbFormat(
    player.rating,
    player.ratingDeviation,
    player.ratingVolatility,
  );
  const update = glicko2Calculator.calculateNewRatings(currentPlayer, results);

  return {
    player,
    update,
    newPeak: calculateNewPeak(player.ratingPeak, update),
  };
}

/** publishes rating outcomes for players with at least one completed rated game */
export async function calculateAndApplyGlickoRatings(
  tournamentId: string,
  tx: Tx,
  publishedAt: Date,
): Promise<void> {
  const tournament = await tx
    .select({ rated: tournaments.rated })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .then((rows) => rows[0]);

  if (!tournament) {
    throw new AppError('TOURNAMENT_NOT_FOUND');
  }
  if (!tournament.rated) return;

  const [gameRows, storedPlayers] = await Promise.all([
    getTournamentGameRows(tournamentId, tx),
    getTournamentPlayerRatings(tournamentId, tx),
  ]);
  if (storedPlayers.some((p) => p.ratingLastUpdateAt > publishedAt)) {
    throw new AppError('RATING_CALCULATION_ERROR', {
      cause: 'rating timeline cannot move backwards',
    });
  }
  // bring every participant's uncertainty forward first, so opponents' rd is current too
  const tournamentPlayers = storedPlayers.map((player) => ({
    ...player,
    ratingDeviation: getCurrentRatingDeviation(player, publishedAt),
  }));
  const tournamentGames = toRatedGames(
    gameRows,
    mapPlayerRatings(tournamentPlayers),
  );

  const ratingUpdates = tournamentPlayers.flatMap((player) => {
    const update = calculatePlayerRatingUpdate(player, tournamentGames);
    return update ? [update] : [];
  });
  if (ratingUpdates.length === 0) return;

  await Promise.all(
    ratingUpdates.map(async ({ player, update, newPeak }) => {
      await tx
        .update(players)
        .set({
          rating: update.newRating,
          ratingPeak: newPeak,
          ratingDeviation: update.newRatingDeviation,
          ratingVolatility: update.newVolatility,
          ratingLastUpdateAt: publishedAt,
        })
        .where(eq(players.id, player.id));
    }),
  );

  await tx.insert(rating_events).values(
    ratingUpdates.map(({ player, update }) => ({
      id: newid(),
      playerId: player.id,
      sourceTournamentId: tournamentId,
      publishedAt,
      rating: update.newRating,
      ratingDeviation: update.newRatingDeviation,
      isStarting: false,
    })),
  );
}
