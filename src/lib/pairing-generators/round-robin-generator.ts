import {
  convertPlayerToEntity,
  generateRoundPairs,
  getColouredPair,
  getGameToInsert,
  getNumberedPair,
  makeNumberPairs,
  RoundProps,
} from '@/lib/pairing-generators/common-generator';
import { GameModel } from '@/server/db/zod/tournaments';

const INITIAL_ROUND_NUMBER = 1;

/**
 * This function purposefully generates the bracket round for the round robin tournament. It gets the
 * tournamentId, checks the query for the current list of players, and  gets the games played by them.
 * By using that information, it returns the new games list, which are then published to the respective
 * ws.
 */
export function generateRoundRobinRound({
  players,
  games,
  roundNumber,
  tournamentId,
}: RoundProps): GameModel[] {
  games = games?.filter((game) => game.roundNumber !== roundNumber) ?? [];

  // checking if the set of layers is even, if not, making it even with a smart alg
  const matchedEntities = players.map((player) =>
    convertPlayerToEntity(player, games),
  );

  // generating set of base matches
  const entitiesMatchingsGenerated = generateRoundPairs(
    matchedEntities,
    roundNumber,
    generatePairsCycle,
  );
  // colouring the set of the matcthes
  const colouredMatches = entitiesMatchingsGenerated.map(getColouredPair);

  // numbering each match
  // 1 is added to start game numeration from 1 instead of 0
  const currentOffset = games.length + 1;
  const numberedMatches = colouredMatches.map(
    (colouredMatch, coulouredMatchIndex) =>
      getNumberedPair(colouredMatch, coulouredMatchIndex, currentOffset),
  );

  const gamesToInsert: GameModel[] = numberedMatches.map((numberedMatch) =>
    getGameToInsert(numberedMatch, tournamentId, roundNumber),
  );

  return gamesToInsert;
}

// #TODO: add function signature
function generatePairsCycle(
  pairingNumbersFlat: number[],
  roundNumber: number | undefined,
) {
  // the artifact of the generator functions compatiblity
  if (typeof roundNumber === 'undefined')
    throw new Error("THE ROUND NUMBER WASN'T PASSED");

  // starting shifting process (cycling the circle of players, having one number fixed)
  const constantPairingNumber = pairingNumbersFlat.shift();

  if (typeof constantPairingNumber === 'undefined')
    throw new Error('THE PAIRING NUMBER ARRAY HAS EXHAUSTED, UNEXPECTED!'); // #TODO: create a custom error for that.

  // cycling process, where you just rotate the array
  for (
    let cycleNumber = INITIAL_ROUND_NUMBER;
    cycleNumber < roundNumber;
    cycleNumber++
  ) {
    const lastPairingNumber = pairingNumbersFlat.shift();
    if (lastPairingNumber) pairingNumbersFlat.push(lastPairingNumber);
    else
      throw new Error('THE PAIRING NUMBER ARRAY HAS EXHAUSTED, UNEXEPECTED!');
  }

  // adding the first player, which is always fixed
  pairingNumbersFlat.unshift(constantPairingNumber);

  // generating pair of player numbers in a cyclic fashion
  const pairedPlayerNumbers = makeNumberPairs(pairingNumbersFlat, true);

  return pairedPlayerNumbers;
}
