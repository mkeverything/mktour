import { RoundProps } from '@/lib/pairing-generators/common-generator';
import { faker } from '@faker-js/faker';
import { describe, expect, test } from 'bun:test';

import {
  INITIAL_ONGOING_ROUND,
  fillRandomResult,
  generatePlayerModel,
  generateRandomDatabaseTournament,
  updatePlayerScores,
} from '@/lib/pairing-generators/common-generator.test';
import { generateWeightedSwissRound } from '@/lib/pairing-generators/swiss-generator';
import type { PlayerTournamentModel } from '@/server/zod/players';
import { GameModel } from '@/server/zod/tournaments';

/** Starting seed for testing */
const BASE_SEED = 14;

/** Number of different seeds to test */
const SEEDS_TO_TEST = 5;

/**
 * Swiss system player range for testing
 * Fixed at 128 players for consistent testing
 */
const SWISS_PLAYER_NUMBER_FAKEOPTS = {
  min: 32,
  max: 32,
};

/** Smallest player count where mid-tournament withdrawal still produces a real pairing (1 game + 1 PAB). */
const WITHDRAWAL_TEST_PLAYER_COUNT = 4;

/** Index of the player that gets withdrawn in withdrawal scenarios — the last one by pairing number. */
const WITHDRAWN_PLAYER_INDEX = WITHDRAWAL_TEST_PLAYER_COUNT - 1;

/** Round number used when testing withdrawal between two played rounds. */
const SECOND_ONGOING_ROUND = INITIAL_ONGOING_ROUND + 1;

/** Per FIDE C.04.3 §C.5, at most one PAB per round per bracket — and exactly one when the active count is odd. */
const EXPECTED_PAB_COUNT_FOR_ODD_ACTIVE = 1;

/**
 * Generates a complete Swiss tournament with the given seed
 * @param seed - Random seed for deterministic generation
 * @returns Object with tournament results
 */
function generateTournamentWithSeed(
  seed: number,
  playerCount?: number,
  maxRounds?: number,
): {
  playerCount: number;
  roundsCompleted: number;
  roundsToTest: number;
  optimalRounds: number;
} {
  faker.seed(seed);

  const randomPlayerNumber =
    playerCount ?? faker.number.int(SWISS_PLAYER_NUMBER_FAKEOPTS);

  // Generate players
  const randomPlayers: PlayerTournamentModel[] = [];
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

  // Swiss rounds = n/2 for n players (standard tournament length)
  const SWISS_OPTIMAL_ROUNDS = Math.floor(randomPlayerNumber / 2);
  const roundsToTest = maxRounds ?? SWISS_OPTIMAL_ROUNDS;

  // Generate rounds until test limit reached
  while (currentRound <= roundsToTest) {
    // Update player scores based on previous games
    const updatedPlayers = updatePlayerScores(randomPlayers, previousGames);

    const nextSwissRoundProps: RoundProps = {
      players: updatedPlayers,
      games: previousGames,
      roundNumber: currentRound,
      tournamentId: randomTournament.id,
    };

    // Generate next round using weighted Blossom algorithm
    const gamesToInsert = generateWeightedSwissRound(nextSwissRoundProps);

    // No games generated = completion
    if (gamesToInsert.length === 0) {
      break;
    }

    // Fill results randomly
    gamesToInsert.forEach(fillRandomResult);

    // Add to history
    previousGames.push(...gamesToInsert);

    currentRound++;
  }

  return {
    playerCount: randomPlayerNumber,
    roundsCompleted: currentRound - INITIAL_ONGOING_ROUND,
    roundsToTest,
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

  describe('Specific Seed Regression', () => {
    test('Seed 19: completes all test rounds', () => {
      const result = generateTournamentWithSeed(19);
      expect(result.roundsCompleted).toBe(result.roundsToTest);
    });

    test('withdrawn player is excluded from future pairings', () => {
      const players = Array.from({ length: 4 }, (_, index) => {
        const player = generatePlayerModel();
        player.pairingNumber = index;
        return player;
      });

      const withdrawnPlayer = players[3];
      withdrawnPlayer.isOut = true;

      const round = generateWeightedSwissRound({
        players,
        games: [],
        roundNumber: 1,
        tournamentId: generateRandomDatabaseTournament().id,
      });

      expect(round).toHaveLength(1);
      expect(
        round.some(
          (game) =>
            game.whiteId === withdrawnPlayer.id ||
            game.blackId === withdrawnPlayer.id,
        ),
      ).toBe(false);
    });

    test('odd active count after withdrawal yields exactly one PAB recipient', () => {
      const players = Array.from(
        { length: WITHDRAWAL_TEST_PLAYER_COUNT },
        (_, index) => {
          const player = generatePlayerModel();
          player.pairingNumber = index;
          return player;
        },
      );

      players[WITHDRAWN_PLAYER_INDEX].isOut = true;

      const round = generateWeightedSwissRound({
        players,
        games: [],
        roundNumber: INITIAL_ONGOING_ROUND,
        tournamentId: generateRandomDatabaseTournament().id,
      });

      const activeIds = players
        .filter((player) => !player.isOut)
        .map((player) => player.id);
      const pairedIds = new Set(
        round.flatMap((game) => [game.whiteId, game.blackId]),
      );
      const pabRecipients = activeIds.filter((id) => !pairedIds.has(id));

      expect(pabRecipients).toHaveLength(EXPECTED_PAB_COUNT_FOR_ODD_ACTIVE);
    });

    test('withdrawal between rounds keeps the withdrawn player out of the next pairing', () => {
      const players = Array.from(
        { length: WITHDRAWAL_TEST_PLAYER_COUNT },
        (_, index) => {
          const player = generatePlayerModel();
          player.pairingNumber = index;
          return player;
        },
      );
      const tournamentId = generateRandomDatabaseTournament().id;

      const firstRound = generateWeightedSwissRound({
        players,
        games: [],
        roundNumber: INITIAL_ONGOING_ROUND,
        tournamentId,
      });
      firstRound.forEach(fillRandomResult);

      const withdrawnPlayer = players[WITHDRAWN_PLAYER_INDEX];
      withdrawnPlayer.isOut = true;

      const secondRound = generateWeightedSwissRound({
        players: updatePlayerScores(players, firstRound),
        games: firstRound,
        roundNumber: SECOND_ONGOING_ROUND,
        tournamentId,
      });

      expect(
        secondRound.some(
          (game) =>
            game.whiteId === withdrawnPlayer.id ||
            game.blackId === withdrawnPlayer.id,
        ),
      ).toBe(false);
    });
  });

  describe.skip('Edge Cases: Small Tournament Failure Estimation', () => {
    const EDGE_CASE_SEEDS = 100_000;

    function runFailureEstimation(players: number, rounds: number): void {
      const failedSeeds: number[] = [];
      let successCount = 0;

      for (let seedOffset = 0; seedOffset < EDGE_CASE_SEEDS; seedOffset++) {
        const currentSeed = BASE_SEED + seedOffset;
        try {
          const result = generateTournamentWithSeed(
            currentSeed,
            players,
            rounds,
          );
          if (result.roundsCompleted === result.roundsToTest) {
            successCount++;
          } else {
            failedSeeds.push(currentSeed);
          }
        } catch {
          failedSeeds.push(currentSeed);
        }
      }

      const successRate = (successCount / EDGE_CASE_SEEDS) * 100;
      console.log(
        `[${players}p/${rounds}r] ${successCount}/${EDGE_CASE_SEEDS} completed (${successRate.toFixed(1)}%)`,
      );
      // if (failedSeeds.length > 0) {
      //   console.log(
      //     `[${players}p/${rounds}r] Failed seeds: ${failedSeeds.join(', ')}`,
      //   );
      // }

      // Log-only — no hard assertion on success rate
      expect(true).toBe(true);
    }

    test('10 players, 8 rounds', () => runFailureEstimation(10, 8));
    test('12 players, 8 rounds', () => runFailureEstimation(12, 8));
    test('15 players, 8 rounds', () => runFailureEstimation(15, 8));

    // test('30 players, 28 rounds', () => runFailureEstimation(30, 28));
    // test('40 players, 37 rounds', () => runFailureEstimation(40, 37));

    // test('128 players, 125 rounds', () => runFailureEstimation(50, 48));
  });
});
