import {
  FloatHistoryItem,
  SwissPlayerModel,
} from '@/lib/client-actions/swiss-generator/types';
import { newid } from '@/lib/utils';
import { GameModel } from '@/server/db/zod/tournaments';

// default set of round properties, may be changed internally
export interface RoundProps {
  /**
   * Current round players
   */
  players: SwissPlayerModel[];

  /**
   * Previously played games, not all round generators require those
   */
  games: GameModel[];

  /**
   * Current round played
   */
  roundNumber: number;

  /**
   * The maternal tournament
   */
  tournamentId: string;
}

// a special type for the number pairs, to enforce the two-foldness of the array
export type NumberPair = [number, number];

// classical shape of a round-generating function
// type RoundGenerator = (roundProps: RoundProps) => GameModel[];

// type of function which generates a set of pairs from initial pairing number list, and the current round info (optional)
type PairsGenerator = (
  pairingNumbers: number[],
  roundNumber?: number,
) => NumberPair[];

/**
 * Type of function which assigns colours to entity pairs based on tournament rules
 * @param uncolouredPair - The pair of entities to assign colours to
 * @param roundNumber - Current round number (optional, some colouring functions don't need it)
 * @returns Coloured pair with white/black assignment
 */
export type ColouringFunction = (
  uncolouredPair: EntitiesPair,
  roundNumber?: number,
) => ColouredEntitiesPair;

/**
 * The type representing entities we are matching inside our algorithms
 * */
export interface ChessTournamentEntity {
  entityId: string;
  colourIndex: number;
  entityRating: number;
  gamesPlayed: number;
  entityNickname: string;
  pairingNumber: number;
  entityTitle: ChessTitle;
  entityScore: number;
  previousGames: GameModel[];
  floatHistory: FloatHistoryItem[];
  byeCount: number;
}

enum ChessTitle {
  CM,
  FM,
  IM,
  GM,
}

export enum ChessColour {
  White = 'white',
  Black = 'black',
}

/**
 * This interface is representing an entiies pair, which is already has colour in it
 */
export interface ColouredEntitiesPair {
  whiteEntity: ChessTournamentEntity;
  blackEntity: ChessTournamentEntity;
}

interface NumberedEntitiesPair extends ColouredEntitiesPair {
  pairNumber: number;
}

/**
 * This is a generic type, which selects only unique properties of `Child`
 */
type OnlyChild<Child, Parent> = Omit<Child, keyof Parent>;

/**
 * First generated type of a round is just a pair of two entities
 */
export type EntitiesPair = [ChessTournamentEntity, ChessTournamentEntity];

/**
 * Calculates the maximum round number from a list of games
 * @param games - Array of games to analyse
 * @returns The highest round number, or 0 if no games
 */
function getMaxRoundNumber(games: GameModel[]): number {
  if (games.length === 0) {
    return 0;
  } else {
    const roundNumbers = games.map((game) => game.roundNumber);
    return Math.max(...roundNumbers);
  }
}

/**
 * Calculates the number of byes a player has received
 * TODO: Verify this bye calculation logic is correct per FIDE rules
 * @param roundsPlayed - Total rounds played in tournament
 * @param playerGameCount - Number of games this player has played
 * @returns Number of byes received (minimum 0)
 */
function calculateByeCount(
  roundsPlayed: number,
  playerGameCount: number,
): number {
  return Math.max(0, roundsPlayed - playerGameCount);
}

/**
 * This simple converter is taking a joined player info and transforms it to a matched entity
 * @param playerModel a joined representation of player
 */
export function convertPlayerToEntity(
  playerModel: SwissPlayerModel,
  allGames: GameModel[],
) {
  if (playerModel.pairingNumber === null) {
    throw new TypeError('PAIRING_NUMBER_IS_NULL');
  }
  //TODO: Add floathistory calculation for 2 rounds
  //TODO: after that, purge the swissplayermodel everywhere, whilst ensuring that
  // the floathistory is correctyl propagated to the CEM.

  // Filter games involving this player (either as white or black)
  const previousGames = allGames.filter(
    (game) =>
      game.whiteId === playerModel.id || game.blackId === playerModel.id,
  );

  // Calculate bye count (rounds where player didn't play = received PAB)
  const roundsPlayed = getMaxRoundNumber(allGames);
  const byeCount = calculateByeCount(roundsPlayed, previousGames.length);

  // Calculate tournament score:
  // - 1 point per win
  // - 0.5 points per draw
  // - 1 point per bye (FIDE rules: PAB recipients get full point)
  const scoreFromGames = playerModel.wins + playerModel.draws * 0.5;
  const entityScore = scoreFromGames + byeCount;

  // #TODO: ADDD THE TITLE LOGIC HERE
  const tournamentEntity: ChessTournamentEntity = {
    entityId: playerModel.id,
    entityNickname: playerModel.nickname,
    colourIndex: playerModel.colorIndex,
    entityRating: playerModel.rating,
    gamesPlayed: playerModel.draws + playerModel.wins + playerModel.losses,
    pairingNumber: playerModel.pairingNumber,
    entityTitle: ChessTitle.GM,
    entityScore,
    previousGames,
    floatHistory: playerModel.floatHistory || [],
    byeCount,
  };
  return tournamentEntity;
}

/**
 * This function by the finalized numbered match generates an entry for the drizzle database game
 * @param finalizedMatch finalized match, ready to be fed to the
 * @param tournamentId stringlike id of the tournament, needs to be in the game obj
 * @param roundNumber same motivation as for the tournament id, a number, showing what round a game will be played
 * @returns GameModel
 */
export function getGameToInsert(
  finalizedMatch: NumberedEntitiesPair,
  tournamentId: string,
  roundNumber: number,
): GameModel {
  // generating new id for the game
  const gameId = newid();

  // conversion to the game format
  const whiteId = finalizedMatch.whiteEntity.entityId;
  const blackId = finalizedMatch.blackEntity.entityId;

  const gameToInsert: GameModel = {
    id: gameId,
    whiteId: whiteId,
    blackId: blackId,
    whiteNickname: finalizedMatch.whiteEntity.entityNickname,
    blackNickname: finalizedMatch.blackEntity.entityNickname,
    tournamentId: tournamentId,
    roundNumber: roundNumber,
    gameNumber: finalizedMatch.pairNumber,
    // all those fields are set to null here, maybe will rethink that later
    roundName: null, // TODO: can be equal to round number in R&R
    whitePrevGameId: null, // TODO: fill the gaps in prev ids
    blackPrevGameId: null,
    result: null,
    finishedAt: null,
  };
  return gameToInsert;
}

/**
 * This function gets a coloured entities pair, and assigns them a provided number, judging by the offset.
 * @param colouredPair a coloured pair
 * @param pairNumber a number to number a pair with
 * @param offset an offset, which is being added to provided pair number
 */
export function getNumberedPair(
  colouredPair: ColouredEntitiesPair,
  pairNumber: number,
  offset: number,
): NumberedEntitiesPair {
  // getting the number offset of a current pair
  const pairNumberOffseted = pairNumber + offset;

  // constructing the additional properties of numbered pair
  const partialNumberedPair: OnlyChild<
    NumberedEntitiesPair,
    ColouredEntitiesPair
  > = { pairNumber: pairNumberOffseted };

  // merging coloured ones, and the new ones together
  const numberedPair: NumberedEntitiesPair = Object.assign(
    partialNumberedPair,
    colouredPair,
  );

  return numberedPair;
}

/**
 * This function gets a pair, and colours it according to the colour index
 * @param uncolouredPair the pair of two entities, array like
 * @returns a promise of a coloured pair object
 */
export function getColouredPair(
  uncolouredPair: EntitiesPair,
): ColouredEntitiesPair {
  let [whiteEntity, blackEntity] = uncolouredPair;

  // reversing the white and black, if the white colour index is bigger
  // (that means that current white has played more whites, than black player)
  // or if the colour is the same, then if the white rating is bigger, then we also reverse
  if (
    whiteEntity.colourIndex > blackEntity.colourIndex ||
    (whiteEntity.colourIndex === blackEntity.colourIndex &&
      whiteEntity.entityRating > blackEntity.entityRating)
  ) {
    [whiteEntity, blackEntity] = [blackEntity, whiteEntity];
  }
  const colouredPair: ColouredEntitiesPair = { whiteEntity, blackEntity };

  return colouredPair;
}

/**
 * This function takes a list of numbers, splits it in two halves and then creates a list of lists (where latter represent pairs)
 * @param pairSubstrate flat array like object, which consists of the objects which should be translated to pairs
 * @param isCycle this flag optionally reverses the second half, making it a cycle-like pair creation. By default it is matrix like.
 * @returns a list of pairs
 */
export function makeNumberPairs(
  pairSubstrate: number[],
  isCycle = false,
): NumberPair[] {
  // checking if the array is splittable
  if (pairSubstrate.length % 2 != 0)
    throw Error('THIS FUNCTION SUPPORTS ONLY EVENLY SIZED ARRAYS');

  // splitting the array to two halves
  const separationIdx = Math.ceil(pairSubstrate.length / 2);
  const firstElements = pairSubstrate.slice(0, separationIdx);
  const secondElements = pairSubstrate.slice(separationIdx);

  // this optionally makes it cycle-like (0 element will be paired with the N-th)
  if (isCycle) secondElements.reverse();

  // converting those two arrays to the list of pairs
  const pairList = firstElements.map((firstElement, pairNumber) => {
    const secondElement = secondElements[pairNumber];
    const generatedNumberPair: NumberPair = [firstElement, secondElement];
    return generatedNumberPair;
  });

  return pairList;
}

/**
 * This is a helper function, which creates a hashmap for the number - entity relations
 * @param matchedEntities a list-like of entities to match
 * @returns a map-like object of entities linked to their respective pair numbers
 */
export function constructEntityByPairingNumber(
  matchedEntities: ChessTournamentEntity[],
) {
  const entityByPairingNumber = new Map<number, ChessTournamentEntity>();

  // filling the map iterating through entities
  matchedEntities.forEach((chessEntity) => {
    const pairingNumber = chessEntity.pairingNumber;
    entityByPairingNumber.set(pairingNumber, chessEntity);
  });

  return entityByPairingNumber;
}

/**
 * This function gets length of the entities array, and generates the array of pairing numbers, representing those entities
 * @param entitiesNumber
 * @returns
 */
export function generatePairingNumbers(entitiesNumber: number) {
  // generating an initial number array, a flat collection of numbers from 0 to n-1 (where n is number of players)
  const initialPairingEmpty = Array(entitiesNumber);
  const pairingNumbersFlat = Array.from(initialPairingEmpty.keys());

  return pairingNumbersFlat;
}

/**
 * This function takes an entities pool and constructs a next round of games, by any chosen method
 *
 * @param matchedEntities a list like of all the players, converted to the entities already
 * @param roundNumber for correct analysis of the current circle shift, we pass a round number parpmeter
 *
 *
 */
export function generateRoundPairs(
  matchedEntities: ChessTournamentEntity[],
  roundNumber: number,
  generatePairs: PairsGenerator,
) {
  // an empty array for a future generated pair
  const generatedPairs: EntitiesPair[] = [];

  // creating a helper map, which is returning entity by its pairing number
  const entityByPairingNumber = constructEntityByPairingNumber(matchedEntities);

  // constructing dummy index, which is null if the array of entities is even, and is equal to length otehrwise
  let dummyIndex = null;
  if (matchedEntities.length % 2 !== 0) dummyIndex = matchedEntities.length;

  // generating a list of pairing numbers, with an  optional dummy index inside
  const pairingNumbersFlat = generatePairingNumbers(matchedEntities.length);

  // adding the dummy index if it exists
  if (dummyIndex) {
    pairingNumbersFlat.push(dummyIndex);
  }

  // actual pair forming process
  let pairedPlayerNumbers = generatePairs(pairingNumbersFlat, roundNumber);

  // again, if the array is odd, we remove the pair with the dummy index inside
  if (dummyIndex)
    pairedPlayerNumbers = pairedPlayerNumbers.filter(
      (numberPair) => !numberPair.includes(dummyIndex),
    );

  // final mapping of the player numbers to the players together
  for (const numberPair of pairedPlayerNumbers) {
    const entitiesPair = numberPair.map(
      (numberPair) =>
        entityByPairingNumber.get(numberPair) as ChessTournamentEntity,
    ) as EntitiesPair;
    generatedPairs.push(entitiesPair);
  }
  return generatedPairs;
}
