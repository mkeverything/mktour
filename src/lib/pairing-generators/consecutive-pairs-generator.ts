import { GameModel } from '@/server/zod/tournaments';
import {
  type ColouredEntitiesPair,
  convertPlayerToEntity,
  generateRoundPairs,
  getGameToInsert,
  getNumberedPair,
  NumberPair,
  RoundProps,
} from './common-generator';

export function generateConsecutiveRoundGames(
  roundProps: RoundProps,
): GameModel[] {
  const matchedEntities = roundProps.players.map((player) =>
    convertPlayerToEntity(player, roundProps.games),
  );

  const entitiesMatchingsGenerated = generateRoundPairs(
    matchedEntities,
    roundProps.roundNumber,
    generateConsecutivePairs,
  );

  const colouredMatches = entitiesMatchingsGenerated.map(
    ([whiteEntity, blackEntity]): ColouredEntitiesPair => ({
      whiteEntity,
      blackEntity,
    }),
  );

  const currentOffset = roundProps.games.length + 1;
  const numberedMatches = colouredMatches.map((colouredMatch, matchIndex) =>
    getNumberedPair(colouredMatch, matchIndex, currentOffset),
  );

  return numberedMatches.map((numberedMatch) =>
    getGameToInsert(
      numberedMatch,
      roundProps.tournamentId,
      roundProps.roundNumber,
    ),
  );
}

function generateConsecutivePairs(pairingNumbersFlat: number[]): NumberPair[] {
  const pairedPlayerNumbers: NumberPair[] = [];

  for (let i = 0; i < pairingNumbersFlat.length; i += 2) {
    const firstPairingNumber = pairingNumbersFlat[i];
    const secondPairingNumber = pairingNumbersFlat[i + 1];

    if (firstPairingNumber === undefined || secondPairingNumber === undefined) {
      break;
    }

    pairedPlayerNumbers.push([firstPairingNumber, secondPairingNumber]);
  }

  return pairedPlayerNumbers;
}
