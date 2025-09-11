import { RoundProps } from '@/lib/client-actions/common-generator';
import {
  INITIAL_ONGOING_ROUND,
  PLAYER_NUMBER_FAKEOPTS,
  RANDOM_TOURNAMENTS_COUNT,
  fillRandomResult,
  generatePlayerModel,
  generateRandomDatabaseTournament,
} from '@/lib/client-actions/common-generator.test';
import { generateSwissRound } from '@/lib/client-actions/swiss-generator';
import { GameModel, PlayerModel } from '@/types/tournaments';
import { faker } from '@faker-js/faker';
import { describe } from 'bun:test';

describe('pure swiss test', () => {
  for (
    let tournamentNumber = 0;
    tournamentNumber < RANDOM_TOURNAMENTS_COUNT;
    tournamentNumber++
  ) {
    // initialising the player number for the tournament
    const randomPlayerNumber = faker.number.int(PLAYER_NUMBER_FAKEOPTS);

    // initialising the player list
    const randomPlayers: PlayerModel[] = [];
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

      const gamesToInsert = generateSwissRound(nextRoundRobinProps);

      // simulating round results
      gamesToInsert.forEach(fillRandomResult);

      previousGames.push(...gamesToInsert);
      currentRound++;
    }
  }
});
