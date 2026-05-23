import { AppError, ERRORS } from '@/lib/errors';
import {
  glicko2Calculator,
  GlickoGameResult,
  RatingUpdate,
} from '@/lib/glicko2';
import { db } from '@/server/db';
import { players } from '@/server/db/schema/players';
import {
  games,
  players_to_units,
  tournament_units,
  tournaments,
} from '@/server/db/schema/tournaments';
import { and, asc, eq } from 'drizzle-orm';

import type { GameResult } from '@/server/zod/enums';
import type { PlayerModel } from '@/server/zod/players';
import type { GameModel, PlayerUnitModel } from '@/server/zod/tournaments';

type Tx = Pick<typeof db, 'select' | 'update'>;
type PlayerRating = Pick<
  PlayerModel,
  'id' | 'rating' | 'ratingDeviation' | 'ratingVolatility'
>;
type TournamentPlayerRating = PlayerRating & {
  unitId: PlayerUnitModel['unitId'];
  ratingPeak: PlayerModel['ratingPeak'];
};
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
  unitId: PlayerUnitModel['unitId'];
  playerId: PlayerModel['id'];
  update: RatingUpdate;
  newPeak: NonNullable<PlayerModel['ratingPeak']> | null;
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
      unitId: players_to_units.unitId,
      id: players.id,
      rating: players.rating,
      ratingPeak: players.ratingPeak,
      ratingDeviation: players.ratingDeviation,
      ratingVolatility: players.ratingVolatility,
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
  playerRatings: Map<PlayerModel['id'], PlayerRating>,
): RatedGame[] {
  const ratedGames: RatedGame[] = [];

  for (const game of gameRows) {
    if (!isCompletedRatedGameRow(game)) continue;

    const whitePlayer = playerRatings.get(game.whitePlayerId);
    const blackPlayer = playerRatings.get(game.blackPlayerId);

    if (!whitePlayer || !blackPlayer) {
      throw new AppError(ERRORS.RATING_CALCULATION_ERROR, {
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
      throw new AppError(ERRORS.RATING_CALCULATION_ERROR, {
        cause: `invalid game result: ${result}`,
      });
  }
}

function calculateNewPeak( // returns null only if old peak was null
  currentPeak: PlayerModel['ratingPeak'],
  update: RatingUpdate,
) {
  const isStable =
    update.newRatingDeviation <
    glicko2Calculator.getConstants().STABLE_RD_THRESHOLD;

  if (!isStable) return currentPeak;
  if (currentPeak !== null && update.newRating <= currentPeak) {
    return currentPeak;
  }

  return update.newRating;
}

function calculatePlayerRatingUpdate(
  player: TournamentPlayerRating,
  tournamentGames: RatedGame[],
): PlayerRatingUpdate {
  const currentPlayer = glicko2Calculator.fromDbFormat(
    player.rating,
    player.ratingDeviation,
    player.ratingVolatility,
  );
  const results = collectPlayerResults(player.id, tournamentGames);
  const update = glicko2Calculator.calculateNewRatings(currentPlayer, results);

  return {
    unitId: player.unitId,
    playerId: player.id,
    update,
    newPeak: calculateNewPeak(player.ratingPeak, update),
  };
}

export async function calculateAndApplyGlickoRatings(
  tournamentId: string,
  tx: Tx,
) {
  const tournament = await tx
    .select({ rated: tournaments.rated })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .then((rows) => rows[0]);

  if (!tournament) {
    throw new AppError(ERRORS.TOURNAMENT_NOT_FOUND);
  }

  if (!tournament.rated) {
    console.log(
      `tournament ${tournamentId} is not rated, skipping rating calculations`,
    );
    return;
  }

  const [gameRows, tournamentPlayers] = await Promise.all([
    getTournamentGameRows(tournamentId, tx),
    getTournamentPlayerRatings(tournamentId, tx),
  ]);
  const tournamentGames = toRatedGames(
    gameRows,
    mapPlayerRatings(tournamentPlayers),
  );

  if (tournamentGames.length === 0) {
    console.log(`no completed games found for tournament ${tournamentId}`);
    return;
  }

  const ratingUpdates = tournamentPlayers.map((player) =>
    calculatePlayerRatingUpdate(player, tournamentGames),
  );

  await Promise.all(
    ratingUpdates.flatMap(({ unitId, playerId, update, newPeak }) => [
      tx
        .update(players)
        .set({
          rating: update.newRating,
          ratingPeak: newPeak,
          ratingDeviation: update.newRatingDeviation,
          ratingVolatility: update.newVolatility,
          ratingLastUpdateAt: new Date(),
        })
        .where(eq(players.id, playerId)),
      tx
        .update(players_to_units)
        .set({
          newRating: update.newRating,
          newRatingDeviation: update.newRatingDeviation,
          newVolatility: update.newVolatility,
        })
        .where(
          and(
            eq(players_to_units.playerId, playerId),
            eq(players_to_units.unitId, unitId),
          ),
        ),
    ]),
  );

  console.log(
    `updated ratings for ${ratingUpdates.length}   players in tournament ${tournamentId}`,
  );

  return ratingUpdates;
}

export async function _getPlayerRatingHistory(playerId: string) {
  const history = await db
    .select({
      tournamentId: tournament_units.tournamentId,
      tournamentDate: tournaments.date,
      newRating: players_to_units.newRating,
      newRatingDeviation: players_to_units.newRatingDeviation,
      newVolatility: players_to_units.newVolatility,
    })
    .from(players_to_units)
    .innerJoin(
      tournament_units,
      eq(players_to_units.unitId, tournament_units.id),
    )
    .innerJoin(tournaments, eq(tournament_units.tournamentId, tournaments.id))
    .where(eq(players_to_units.playerId, playerId))
    .orderBy(asc(tournaments.date));

  return history;
}
