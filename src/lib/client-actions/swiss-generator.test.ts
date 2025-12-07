import { describe, test, expect } from 'bun:test';
import { faker } from '@faker-js/faker';
import { RoundProps } from '@/lib/client-actions/common-generator';
import {
  RANDOM_TOURNAMENTS_COUNT,
  PLAYER_NUMBER_FAKEOPTS,
  INITIAL_ONGOING_ROUND,
  generatePlayerModel,
  generateRandomDatabaseTournament,
  fillRandomResult,
  updatePlayerScores,
} from '@/lib/client-actions/common-generator.test';
import { generateSwissRound } from '@/lib/client-actions/swiss-generator';
import { GameModel, PlayerModel } from '@/types/tournaments';

describe('Swiss Generator Black-Box Tests', () => {
  describe('Basic Round Generation', () => {
    for (
      let tournamentNumber = 0;
      tournamentNumber < RANDOM_TOURNAMENTS_COUNT;
      tournamentNumber++
    ) {
      // Generate random player count (2-5 for quick tests)
      const randomPlayerNumber = faker.number.int(PLAYER_NUMBER_FAKEOPTS);

      // Generate players
      const randomPlayers: PlayerModel[] = [];
      for (
        let playerIndex = 0;
        playerIndex < randomPlayerNumber;
        playerIndex++
      ) {
        randomPlayers.push(generatePlayerModel());
      }

      // Assign pairing numbers (0, 1, 2, ...)
      randomPlayers.forEach((player, index) => {
        player.pairingNumber = index;
      });

      // Generate tournament context
      const randomTournament = generateRandomDatabaseTournament();

      // Track games and rounds
      let previousGames: GameModel[] = [];
      let currentRound = INITIAL_ONGOING_ROUND;

      // Maximum rounds to prevent infinite loops
      const MAX_ROUNDS = randomPlayerNumber * 2;

      // Generate rounds until completion or max reached
      while (currentRound <= MAX_ROUNDS) {
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
          break;
        }

        // Fill results randomly
        gamesToInsert.forEach(fillRandomResult);

        // Add to history
        previousGames.push(...gamesToInsert);

        currentRound++;
      }

      // First test: Generated at least one round
      test(`Tournament ${tournamentNumber} (${randomPlayerNumber} players): Generated at least one round`, () => {
        expect(currentRound).toBeGreaterThan(INITIAL_ONGOING_ROUND);
      });
    }
  });
});
