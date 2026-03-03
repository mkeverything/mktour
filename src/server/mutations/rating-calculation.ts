import {
  glicko2Calculator,
  type GameResult,
  type RatingUpdate,
} from '@/lib/glicko2';
import { db } from '@/server/db';
import { players } from '@/server/db/schema/players';
import {
  games,
  players_to_tournaments,
  tournaments,
} from '@/server/db/schema/tournaments';
import type { GameResult as DbGameResult } from '@/server/zod/enums';
import { and, eq } from 'drizzle-orm';

type Tx = typeof db;

/**
 * Get all completed games for a tournament with player ratings
 */
async function getTournamentGamesWithRatings(tournamentId: string, tx: Tx) {
  const tournamentGames = await tx
    .select({
      id: games.id,
      whiteId: games.whiteId,
      blackId: games.blackId,
      result: games.result,
      roundNumber: games.roundNumber,
    })
    .from(games)
    .where(eq(games.tournamentId, tournamentId));

  // Get all players in the tournament with their current ratings
  const tournamentPlayers = await tx
    .select({
      id: players.id,
      rating: players.rating,
      ratingDeviation: players.ratingDeviation,
      ratingVolatility: players.ratingVolatility,
    })
    .from(players)
    .innerJoin(
      players_to_tournaments,
      eq(players.id, players_to_tournaments.playerId),
    )
    .where(eq(players_to_tournaments.tournamentId, tournamentId));

  const playerRatingMap = new Map(
    tournamentPlayers.map((p) => [
      p.id,
      {
        rating: p.rating,
        ratingDeviation: p.ratingDeviation,
        volatility: p.ratingVolatility, // SQLite stores floats directly
      },
    ]),
  );

  // Convert games to results format
  const gameResults: Array<{
    whiteId: string;
    blackId: string;
    result: DbGameResult | null;
    whiteRating: number;
    whiteRD: number;
    blackRating: number;
    blackRD: number;
  }> = [];

  for (const game of tournamentGames) {
    if (!game.result) continue; // Skip unfinished games

    const whitePlayer = playerRatingMap.get(game.whiteId);
    const blackPlayer = playerRatingMap.get(game.blackId);

    if (!whitePlayer || !blackPlayer) {
      console.warn(`Missing rating data for game ${game.id}`);
      continue;
    }

    gameResults.push({
      whiteId: game.whiteId,
      blackId: game.blackId,
      result: game.result,
      whiteRating: whitePlayer.rating,
      whiteRD: whitePlayer.ratingDeviation,
      blackRating: blackPlayer.rating,
      blackRD: blackPlayer.ratingDeviation,
    });
  }

  return gameResults;
}

/**
 * Collect game results for a specific player from tournament games
 */
function collectPlayerResults(
  playerId: string,
  tournamentGames: Array<{
    whiteId: string;
    blackId: string;
    result: DbGameResult | null;
    whiteRating: number;
    whiteRD: number;
    blackRating: number;
    blackRD: number;
  }>,
): GameResult[] {
  const results: GameResult[] = [];

  for (const game of tournamentGames) {
    if (!game.result) continue;

    if (game.whiteId === playerId) {
      // Player is white
      const score = getScoreFromResult(game.result, 'white');
      results.push({
        opponentRating: game.blackRating,
        opponentRatingDeviation: game.blackRD,
        score,
      });
    } else if (game.blackId === playerId) {
      // Player is black
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

/**
 * Convert game result to score (1=win, 0.5=draw, 0=loss)
 */
function getScoreFromResult(
  result: DbGameResult,
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
      throw new Error(`Invalid game result: ${result}`);
  }
}

/**
 * Calculate and apply Glicko-2 ratings for all players in a tournament
 */
export async function calculateAndApplyGlickoRatings(
  tournamentId: string,
  tx: Tx,
) {
  // Get tournament info to verify it's rated
  const tournament = await tx
    .select({ rated: tournaments.rated })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .then((rows) => rows[0]);

  if (!tournament) {
    throw new Error('Tournament not found');
  }

  if (!tournament.rated) {
    console.log(
      `Tournament ${tournamentId} is not rated, skipping rating calculations`,
    );
    return;
  }

  // Get all tournament games with ratings
  const tournamentGames = await getTournamentGamesWithRatings(tournamentId, tx);

  if (tournamentGames.length === 0) {
    console.log(`No completed games found for tournament ${tournamentId}`);
    return;
  }

  // Get all players in the tournament
  const tournamentPlayers = await tx
    .select({
      id: players.id,
      rating: players.rating,
      ratingPeak: players.ratingPeak,
      ratingDeviation: players.ratingDeviation,
      ratingVolatility: players.ratingVolatility,
    })
    .from(players)
    .innerJoin(
      players_to_tournaments,
      eq(players.id, players_to_tournaments.playerId),
    )
    .where(eq(players_to_tournaments.tournamentId, tournamentId));

  // Calculate new ratings for each player
  const ratingUpdates: Array<{
    playerId: string;
    update: RatingUpdate;
    newPeak: number | null;
  }> = [];

  for (const player of tournamentPlayers) {
    // Convert to calculation format
    const currentPlayer = glicko2Calculator.fromDbFormat(
      player.rating,
      player.ratingDeviation,
      player.ratingVolatility,
    );

    // Collect player's results
    const results = collectPlayerResults(player.id, tournamentGames);

    // Calculate new ratings
    const update = glicko2Calculator.calculateNewRatings(
      currentPlayer,
      results,
    );

    let newPeak = player.ratingPeak;
    const isStable =
      update.newRatingDeviation <
      glicko2Calculator.getConstants().STABLE_RD_THRESHOLD;

    if (isStable) {
      if (newPeak === null || update.newRating > newPeak) {
        newPeak = update.newRating;
      }
    }

    ratingUpdates.push({
      playerId: player.id,
      update,
      newPeak,
    });
  }

  // Apply all updates (caller provides the transaction)
  for (const { playerId, update, newPeak } of ratingUpdates) {
    // Update player's main rating
    await tx
      .update(players)
      .set({
        rating: update.newRating,
        ratingPeak: newPeak,
        ratingDeviation: update.newRatingDeviation,
        ratingVolatility: update.newVolatility,
        ratingLastUpdateAt: new Date(),
      })
      .where(eq(players.id, playerId));

    // Update player's tournament record with rating changes
    await tx
      .update(players_to_tournaments)
      .set({
        ratingChange: update.ratingChange,
        ratingDeviationChange: update.ratingDeviationChange,
        volatilityChange: update.volatilityChange,
      })
      .where(
        and(
          eq(players_to_tournaments.tournamentId, tournamentId),
          eq(players_to_tournaments.playerId, playerId),
        ),
      );
  }

  console.log(
    `Updated ratings for ${ratingUpdates.length} players in tournament ${tournamentId}`,
  );

  return ratingUpdates;
}

/**
 * Get rating history for a player across tournaments
 */
export async function getPlayerRatingHistory(playerId: string) {
  const history = await db
    .select({
      tournamentId: players_to_tournaments.tournamentId,
      tournamentTitle: tournaments.title,
      tournamentDate: tournaments.date,
      ratingChange: players_to_tournaments.ratingChange,
      ratingDeviationChange: players_to_tournaments.ratingDeviationChange,
      volatilityChange: players_to_tournaments.volatilityChange,
      place: players_to_tournaments.place,
      wins: players_to_tournaments.wins,
      losses: players_to_tournaments.losses,
      draws: players_to_tournaments.draws,
    })
    .from(players_to_tournaments)
    .innerJoin(
      tournaments,
      eq(players_to_tournaments.tournamentId, tournaments.id),
    )
    .where(eq(players_to_tournaments.playerId, playerId))
    .orderBy(players_to_tournaments.tournamentId);

  return history;
}
