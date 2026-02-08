import { describe, expect, test } from 'bun:test';

import { RoundProps } from '@/lib/client-actions/common-generator';
import {
  INITIAL_ONGOING_ROUND,
  PLAYER_NUMBER_FAKEOPTS,
  RANDOM_TOURNAMENTS_COUNT,
  fillRandomResult,
  generatePlayerModel,
  generateRandomDatabaseTournament,
} from '@/lib/client-actions/common-generator.test';
import { generateRoundRobinRound } from '@/lib/client-actions/round-robin-generator';
import { GameModel } from '@/server/db/zod/tournaments';
import { SwissPlayerModel } from '@/lib/client-actions/swiss-generator/types';
import { faker } from '@faker-js/faker';

describe('pure matching generation test', () => {
  for (
    let tournamentNumber = 0;
    tournamentNumber < RANDOM_TOURNAMENTS_COUNT;
    tournamentNumber++
  ) {
    // initialising the player number for the tournament
    const randomPlayerNumber = faker.number.int(PLAYER_NUMBER_FAKEOPTS);

    // initialising the player list
    const randomPlayers: SwissPlayerModel[] = [];
    for (let playerIdx = 0; playerIdx < randomPlayerNumber; playerIdx++) {
      const generatedPlayer = generatePlayerModel();
      randomPlayers.push(generatedPlayer);
    }

    // simple pairing number rating assignment based on array index
    randomPlayers.forEach((matchedEntity, entityIndex) => {
      matchedEntity.pairingNumber = entityIndex;
    });
    // for the initial case, the previous games are missing
    const previousGames: GameModel[] = [];

    let currentRound = INITIAL_ONGOING_ROUND;

    const gameCount = (randomPlayerNumber / 2) * (randomPlayerNumber - 1);
    // random tournament initialised
    const randomTournament = generateRandomDatabaseTournament();

    while (previousGames.length < gameCount) {
      // generating round info formed
      const nextRoundRobinProps: RoundProps = {
        players: randomPlayers,
        games: previousGames,
        roundNumber: currentRound,
        tournamentId: randomTournament.id,
      };

      const gamesToInsert = generateRoundRobinRound(nextRoundRobinProps);

      // simulating round results
      gamesToInsert.forEach(fillRandomResult);

      previousGames.push(...gamesToInsert);
      currentRound++;
    }

    test(`${tournamentNumber} - game count equality to theoretical`, () => {
      // checking that the game count is equal to theoretical one
      const theoreticalGameCount =
        (randomPlayerNumber / 2) * (randomPlayerNumber - 1);
      expect(previousGames.length).toBe(theoreticalGameCount);
    });
  }
});
