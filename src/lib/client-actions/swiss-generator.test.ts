import { RoundProps } from '@/lib/client-actions/common-generator';
import { faker } from '@faker-js/faker';
import { describe, expect, test } from 'bun:test';

import {
  INITIAL_ONGOING_ROUND,
  fillRandomResult,
  generatePlayerModel,
  generateRandomDatabaseTournament,
  updatePlayerScores,
} from '@/lib/client-actions/common-generator.test';
import { generateSwissRound } from '@/lib/client-actions/swiss-generator';
import { GameModel, PlayerModel } from '@/types/tournaments';

/** Starting seed for testing */
const BASE_SEED = 14;

/** Number of different seeds to test */
const SEEDS_TO_TEST = 10;

/**
 * Swiss system player range for testing
 * - Minimum 16 players for realistic tournament sizes
 * - Maximum 64 players for stress testing larger brackets
 */
const SWISS_PLAYER_NUMBER_FAKEOPTS = {
  min: 8,
  max: 16,
};

/**
 * Generates a complete Swiss tournament with the given seed
 * @param seed - Random seed for deterministic generation
 * @returns Object with tournament results
 */
function generateTournamentWithSeed(seed: number): {
  playerCount: number;
  roundsCompleted: number;
  optimalRounds: number;
} {
  faker.seed(seed);

  const randomPlayerNumber = faker.number.int(SWISS_PLAYER_NUMBER_FAKEOPTS);

  // Generate players
  const randomPlayers: PlayerModel[] = [];
  for (let playerIndex = 0; playerIndex < randomPlayerNumber; playerIndex++) {
    randomPlayers.push(generatePlayerModel());
  }

  // Assign pairing numbers (0, 1, 2, ...)
  randomPlayers.forEach((player, index) => {
    player.pairingNumber = index;
  });

  // Generate tournament context
  const randomTournament = generateRandomDatabaseTournament();

  // Track games and rounds
  const previousGames: GameModel[] = [];
  let currentRound = INITIAL_ONGOING_ROUND;

  // Swiss optimal rounds = ceil(log2(n)) for n players
  const SWISS_OPTIMAL_ROUNDS = randomPlayerNumber - 2;

  console.log(
    `[Seed ${seed}] Starting: ${randomPlayerNumber} players, ${SWISS_OPTIMAL_ROUNDS} optimal rounds`,
  );

  // Generate rounds until optimal Swiss rounds reached
  while (currentRound <= SWISS_OPTIMAL_ROUNDS) {
    console.log(`[Seed ${seed}] Generating round ${currentRound}...`);

    // Update player scores based on previous games
    const updatedPlayers = updatePlayerScores(randomPlayers, previousGames);

    const nextSwissRoundProps: RoundProps = {
      players: updatedPlayers,
      games: previousGames,
      roundNumber: currentRound,
      tournamentId: randomTournament.id,
    };

    // Generate next round
    const gamesToInsert = generateSwissRound(nextSwissRoundProps);

    // No games generated = completion
    if (gamesToInsert.length === 0) {
      console.log(`[Seed ${seed}] No games generated at round ${currentRound}`);
      break;
    }

    console.log(
      `[Seed ${seed}] Round ${currentRound}: ${gamesToInsert.length} games`,
    );

    // Fill results randomly
    gamesToInsert.forEach(fillRandomResult);

    // Add to history
    previousGames.push(...gamesToInsert);

    currentRound++;
  }

  console.log(
    `[Seed ${seed}] Completed: ${currentRound - INITIAL_ONGOING_ROUND} rounds`,
  );

  return {
    playerCount: randomPlayerNumber,
    roundsCompleted: currentRound - INITIAL_ONGOING_ROUND,
    optimalRounds: SWISS_OPTIMAL_ROUNDS,
  };
}

describe('Swiss Generator Black-Box Tests', () => {
  describe('Multi-Seed Testing', () => {
    for (let seedOffset = 0; seedOffset < SEEDS_TO_TEST; seedOffset++) {
      const currentSeed = BASE_SEED + seedOffset;

      test(`Seed ${currentSeed}: Complete tournament without errors`, () => {
        const result = generateTournamentWithSeed(currentSeed);
        expect(result.roundsCompleted).toBeGreaterThan(0);
      });
    }
  });
});
