import {
  ChessColour,
  ChessTournamentEntity,
  ColouredEntitiesPair,
  EntitiesPair,
  RoundProps,
  convertPlayerToEntity,
  getGameToInsert,
  getNumberedPair,
} from '@/lib/client-actions/common-generator';
import { shuffle } from '@/lib/utils';
import { GameModel } from '@/types/tournaments';

/**
 * Checks if both players' colour preferences can be respected
 * Cases: different signs, one neutral, or both neutral
 */
function canRespectBothColourPreferences(
  firstEntity: ChessTournamentEntity,
  secondEntity: ChessTournamentEntity,
): boolean {
  const firstColourIndex = firstEntity.colourIndex;
  const secondColourIndex = secondEntity.colourIndex;

  return (
    (firstColourIndex > 0 && secondColourIndex < 0) ||
    (firstColourIndex < 0 && secondColourIndex > 0) ||
    firstColourIndex === 0 ||
    secondColourIndex === 0
  );
}

/**
 * Creates a coloured pair with random colour assignment
 */
function createRandomColouredPair(
  uncolouredPair: EntitiesPair,
): ColouredEntitiesPair {
  const [whiteEntity, blackEntity] = shuffle(uncolouredPair);
  return { whiteEntity, blackEntity };
}

/**
 * Compares two games by round number for sorting
 * @param a - First game
 * @param b - Second game
 * @returns Comparison result for sorting
 */
function compareGamesByRound(a: GameModel, b: GameModel): number {
  return a.round_number - b.round_number;
}

/**
 * Attempts to create a coloured pair based on alternating from last different colour round
 * @param firstEntity - First player entity
 * @param secondEntity - Second player entity
 * @returns Coloured pair with alternated colours, or null if no different colour history found
 */
function tryAlternateFromLastDifferentColours(
  firstEntity: ChessTournamentEntity,
  secondEntity: ChessTournamentEntity,
): ColouredEntitiesPair | null {
  // Sort both players' game histories by round number for parallel iteration
  const firstEntityGames =
    firstEntity.previousGames.toSorted(compareGamesByRound);
  const secondEntityGames =
    secondEntity.previousGames.toSorted(compareGamesByRound);

  // Iterate through both arrays simultaneously until one is exhausted
  const minLength = Math.min(firstEntityGames.length, secondEntityGames.length);
  let alternatedPair: ColouredEntitiesPair | null = null;

  for (let i = 0; i < minLength; i++) {
    const firstGame = firstEntityGames[i];
    const secondGame = secondEntityGames[i];

    // Determine what colour each entity played in this round
    const firstEntityWasWhite = firstGame.white_id === firstEntity.entityId;
    const secondEntityWasWhite = secondGame.white_id === secondEntity.entityId;

    // Check if they played different colours in this round
    if (firstEntityWasWhite !== secondEntityWasWhite) {
      // Apply alternation: assign opposite colours from last different-colour round
      if (firstEntityWasWhite) {
        // First entity was white before, so now gets black
        alternatedPair = {
          whiteEntity: secondEntity,
          blackEntity: firstEntity,
        };
      } else {
        // First entity was black before, so now gets white
        alternatedPair = {
          whiteEntity: firstEntity,
          blackEntity: secondEntity,
        };
      }
    }
    // Continue loop to find the MOST RECENT round where they had different colours
  }

  return alternatedPair;
}

/**
 * Gets the initial colour an entity played in their first game
 * @param entity - Chess tournament entity with previous games
 * @returns ChessColour indicating what colour the entity played first
 * @throws Error if entity has no previous games
 */
function getEntityInitialColour(entity: ChessTournamentEntity): ChessColour {
  if (entity.previousGames.length === 0) {
    throw new Error('Entity has no previous games to determine initial colour');
  }

  const sortedGames = entity.previousGames.toSorted(compareGamesByRound);
  const firstGame = sortedGames[0];

  return firstGame.white_id === entity.entityId
    ? ChessColour.White
    : ChessColour.Black;
}

/**
 * Interface for ranked entities pair
 */
interface RankedEntities {
  higherRankedEntity: ChessTournamentEntity;
  lowerRankedEntity: ChessTournamentEntity;
}

/**
 * Gets the higher and lower ranked entities from a pair
 * @param firstEntity - First player entity
 * @param secondEntity - Second player entity
 * @returns Object with higher and lower ranked entities
 */
function getRankedEntities(
  firstEntity: ChessTournamentEntity,
  secondEntity: ChessTournamentEntity,
): RankedEntities {
  if (firstEntity.entityRating > secondEntity.entityRating) {
    return { higherRankedEntity: firstEntity, lowerRankedEntity: secondEntity };
  } else {
    return { higherRankedEntity: secondEntity, lowerRankedEntity: firstEntity };
  }
}

/**
 * Assigns colours based on highest ranked player's colour preference
 * @param rankedEntities - Higher and lower ranked entities
 * @returns Coloured pair with highest ranked player getting their preferred colour
 */
function assignColourByPreference(
  rankedEntities: RankedEntities,
): ColouredEntitiesPair {
  const { higherRankedEntity, lowerRankedEntity } = rankedEntities;

  // Give highest ranked player their colour preference
  // Negative colour index means prefers white, positive means prefers black
  if (higherRankedEntity.colourIndex <= 0) {
    // Higher ranked player prefers white (or neutral)
    return { whiteEntity: higherRankedEntity, blackEntity: lowerRankedEntity };
  } else {
    // Higher ranked player prefers black
    return { whiteEntity: lowerRankedEntity, blackEntity: higherRankedEntity };
  }
}

/**
 * Assigns colours based on initial colour rule for highest ranked player
 * If highest ranked player has odd pairing number, they get their initial colour
 * Otherwise they get opposite to their initial colour
 * @param rankedEntities - Higher and lower ranked entities
 * @returns Coloured pair based on initial colour rule
 */
function assignColourByInitialRule(
  rankedEntities: RankedEntities,
): ColouredEntitiesPair {
  const { higherRankedEntity, lowerRankedEntity } = rankedEntities;
  const higherInitialColour = getEntityInitialColour(higherRankedEntity);
  const hasOddPairingNumber = higherRankedEntity.pairingNumber % 2 === 1;

  if (hasOddPairingNumber) {
    // Odd pairing number: give initial colour
    if (higherInitialColour === ChessColour.White) {
      return {
        whiteEntity: higherRankedEntity,
        blackEntity: lowerRankedEntity,
      };
    } else {
      return {
        whiteEntity: lowerRankedEntity,
        blackEntity: higherRankedEntity,
      };
    }
  } else {
    // Even pairing number: give opposite to initial colour
    if (higherInitialColour === ChessColour.White) {
      return {
        whiteEntity: lowerRankedEntity,
        blackEntity: higherRankedEntity,
      };
    } else {
      return {
        whiteEntity: higherRankedEntity,
        blackEntity: lowerRankedEntity,
      };
    }
  }
}

/**
 * Swiss system colour allocation function following FIDE rules
 * Implements the complete colour assignment logic according to FIDE Dutch system:
 * 1. Different colour indices: player with smaller index gets white
 * 2. Equal colour indices: try to alternate based on last round they had different colours
 * 3. If no alternation possible and higher ranked player has colour preference: give preference
 * 4. If no alternation possible and higher ranked player neutral: use initial colour rule
 * @param uncolouredPair - Pair of entities to assign colours to
 * @returns ColouredEntitiesPair with white/black assignment
 */
function getSwissColouredPair(
  uncolouredPair: EntitiesPair,
): ColouredEntitiesPair {
  let colouredPair: ColouredEntitiesPair;
  const [firstEntity, secondEntity] = uncolouredPair;

  if (firstEntity.colourIndex != secondEntity.colourIndex) {
    // Different colour indices: player with higher colour index (more colour imbalance) gets black
    // This helps balance colour distribution across the tournament
    if (firstEntity.colourIndex < secondEntity.colourIndex) {
      colouredPair = { whiteEntity: firstEntity, blackEntity: secondEntity };
    } else {
      colouredPair = { whiteEntity: secondEntity, blackEntity: firstEntity };
    }
  } else {
    // Equal colour indices: apply FIDE rule for alternating based on game history
    // Find last round where these players had different colours and assign opposite colours
    const alternatedPair = tryAlternateFromLastDifferentColours(
      firstEntity,
      secondEntity,
    );

    if (alternatedPair) {
      // History found: use alternated colour assignment
      colouredPair = alternatedPair;
    } else {
      // No alternation possible: use ranking-based rules
      const rankedEntities = getRankedEntities(firstEntity, secondEntity);

      if (rankedEntities.higherRankedEntity.colourIndex !== 0) {
        // Higher ranked player has colour preference: use preference rule (FIDE rule 4)
        colouredPair = assignColourByPreference(rankedEntities);
      } else {
        // Higher ranked player has neutral colour preference: use initial colour rule (FIDE rule 5)
        colouredPair = assignColourByInitialRule(rankedEntities);
      }
    }
  }

  return colouredPair;
}

/**
 * This function gets a list of entities as an input, and then prepares the ordering by FIDE dutch system rules
 * @param matchedEntities listlike of chess entities with the nickname, title, and rating set
 * @returns an ordered list of entities
 */
function getInitialOrdering(matchedEntities: ChessTournamentEntity[]) {
  const nameSortedEntities = matchedEntities.toSorted(
    (firstPlayer, secondPlayer) =>
      firstPlayer.entityNickname.localeCompare(secondPlayer.entityNickname),
  );

  const titleSortedEntities = nameSortedEntities.toSorted(
    (firstPlayer, secondPlayer) =>
      firstPlayer.entityTitle - secondPlayer.entityTitle,
  );
  const rankingSortedEntities = titleSortedEntities.toSorted(
    (firstPlayer, secondPlayer) =>
      firstPlayer.entityRating - secondPlayer.entityRating,
  );

  return rankingSortedEntities;
}

/**
 * This function creates a mapping of scores and the respective entities,
 * making the scoregroups
 * @param matchedEntities a listlike of entities
 * @returns mapping with the scoregroups
 */
function generateEntitiesByScore(matchedEntities: ChessTournamentEntity[]) {
  const entitiesByScore: EntitiesByScore = new Map<
    number,
    ChessTournamentEntity[]
  >();

  // forming the entity score groups
  matchedEntities.forEach(
    /**
     * For every entity we check its score, if the score is already in the mapping,
     * we just add this entity to the group, either we create a list with this entity as the value
     * for the entity score key, effectively separating those to scoregroups
     * @param matchedEntity  one chess entity with a score defined
     */
    (matchedEntity) => {
      const entityScore = matchedEntity.entityScore;
      if (entitiesByScore.has(entityScore)) {
        const entitiesGroup = entitiesByScore.get(matchedEntity.entityScore);
        if (entitiesGroup !== undefined) entitiesGroup.push(matchedEntity);
        else
          // we don't expect that the group could be undefined if the has was signalling. WORKAROUND TILL TS WILL MERGE
          // has typeguards
          throw Error('A HORRIBLE  RUNTIME ERROR HAPPENED!');
      } else {
        entitiesByScore.set(entityScore, [matchedEntity]);
      }
    },
  );

  return entitiesByScore;
}

type EntitiesByScore = Map<number, ChessTournamentEntity[]>;

/**
 * This interface describes the swiss bracket parameters
 * @interface BracketParameters
 * @property {number} mdpCount - Moved down players count in the bracket
 * @property {number} maxPairs - Maximum number of pairs that can be formed in this bracket
 * @property {number} mdpPairingsCount - Number of MDP pairings to be made (min of mdpCount and maxPairs)
 */
interface BracketParameters {
  mdpCount: number;
  maxPairs: number;
  mdpPairingsCount: number;
}

/**
 * This function estimates the needed for bracket forming parameters, and return them in a formatted way
 * @param scoregroup group of matched entities, array-like
 * @param movedDownPlayers  a group of moved down players from previous brackets.
 * @returns bracket parameters object, which contains all relevant information
 */
function getParameters(
  scoregroup: ChessTournamentEntity[],
  movedDownPlayers: ChessTournamentEntity[] = [],
) {
  const mdpCount = movedDownPlayers.length;

  const residentCount = scoregroup.length;
  const totalPlayers = mdpCount + residentCount;

  let maxPairs;
  if (mdpCount <= residentCount) maxPairs = Math.floor(totalPlayers / 2);
  else maxPairs = residentCount;

  const mdpPairingsCount = Math.min(mdpCount, maxPairs);

  const estimatedParameters: BracketParameters = {
    mdpCount,
    maxPairs,
    mdpPairingsCount,
  };

  return estimatedParameters;
}

/**
 * This function provides initial bracket ordering, based on score and pairing numbers
 * @param bracketPlayers array like with entities
 * @returns array like with ordered entities
 */
function getOrderedBracket(bracketPlayers: ChessTournamentEntity[]) {
  const orderedByPairingNumbers = bracketPlayers.toSorted(
    (leftEntity, rightEntity) =>
      leftEntity.pairingNumber - rightEntity.pairingNumber,
  );

  const orderedByScore = orderedByPairingNumbers.toSorted(
    (leftEntity, rightEntity) =>
      leftEntity.entityScore - rightEntity.entityScore,
  );

  return orderedByScore;
}

/**
 * This interface represents the three groups formed when dividing a bracket for Swiss pairing
 * @interface BracketGroups
 * @property {ChessTournamentEntity[]} S1 - Upper half of the bracket (top-ranked players)
 * @property {ChessTournamentEntity[]} S2 - Lower half of the bracket (lower-ranked players)
 * @property {ChessTournamentEntity[]} Limbo - Excess MDP players that cannot be paired in current bracket
 */
interface BracketGroups {
  S1: ChessTournamentEntity[];
  S2: ChessTournamentEntity[];
  Limbo: ChessTournamentEntity[];
}

/**
 * This functino gets the list of ordered entities (containing the MDPS of the current round), and
 * the set of the bracket parameters. By that information, it compiles a bracket containing of S1-S2 and possible Limbo.
 *
 * @param orderedEntities
 * @param bracketParams
 * @returns
 */
function formBracketGroups(
  orderedEntities: ChessTournamentEntity[],
  bracketParams: BracketParameters,
): BracketGroups {
  // if the bracket is heterogeneous, thus mdp is not zero, then it is mdp parinigs count
  // if it is homogeneous, then it is just maxpairs
  const N1 = bracketParams.mdpCount
    ? bracketParams.mdpPairingsCount
    : bracketParams.maxPairs;

  // getting top players
  const S1 = orderedEntities.slice(0, N1);

  // forming limbo, if present
  let Limbo: ChessTournamentEntity[] = [];
  const excessiveMdpCount =
    bracketParams.mdpCount - bracketParams.mdpPairingsCount;
  if (excessiveMdpCount) Limbo = orderedEntities.slice(N1, excessiveMdpCount);

  // getting the rest players to S2
  const S2 = orderedEntities.slice(
    N1 + excessiveMdpCount,
    orderedEntities.length,
  );

  return {
    S1,
    S2,
    Limbo,
  };
}

/**
 * This interface represents a pairing candidate for homogeneous brackets (brackets with no MDPs)
 * @interface HomoPairingCandidate
 * @property {EntitiesPair[]} mainPairs - Array of entity pairs that will be matched in this bracket
 * @property {ChessTournamentEntity[]} downfloaters - Players who cannot be paired and move to lower scoregroup
 */
interface HomoPairingCandidate {
  mainPairs: EntitiesPair[];
  downfloaters: ChessTournamentEntity[];
}

/**
 * This interface represents a pairing candidate for heterogeneous brackets (brackets with MDPs)
 * Extends HomoPairingCandidate to include remainder pairs after MDP pairing
 * @interface HeteroPairingCandidate
 * @extends HomoPairingCandidate
 * @property {EntitiesPair[]} remainderPairs - Additional pairs formed from remaining resident players after MDP pairing
 */
interface HeteroPairingCandidate extends HomoPairingCandidate {
  remainderPairs: EntitiesPair[];
}

/**
 * @interface PairingCandidate
 * A helper type alias, because semantically both types of einterfaces are similar
 */
type PairingCandidate = HomoPairingCandidate | HeteroPairingCandidate;

/**
 * Quality report interface for evaluating Swiss system pairing candidates
 * Based on FIDE (Dutch) System criteria C1-C5 (absolute) and C6+ (quality)
 */
interface QualityReport {
  // Absolute criteria (C1-C5) - cannot be violated
  /** C1: Two players shall not play against each other more than once */
  c1UniqueOpponents: boolean;

  /** C2: No player receives PAB twice or multiple point-scoring rounds without playing */
  c2UniquePAB: boolean;

  /** C3: Non-topscorers with same absolute colour preference shall not meet */
  c3ColourPreferenceSeparation: boolean;

  /** C4: Downfloaters and players from other groups allow pairing */
  c4PairingCompatibility: boolean;

  /** C5: PAB receiver criterion (minimize PAB receiver score) */
  c5PabMinimization: number;

  // Quality criteria (C6+) - should be optimised in priority order
  /** C6: Minimise number of downfloaters (maximise number of pairs) */
  c6DownfloatersCount: number;

  /** C7: Minimise PSD (Pairing Score Difference) sum */
  c7PsdSum: number;

  /** C8: Lookahead - current downfloaters allow next bracket to comply with C1-C5 */
  c8NextBracketCompliant: boolean;

  /** C9: Minimise unplayed games for PAB receiver */
  c9PabUnplayedGames: number;

  /** C10: Minimise topscorers/opponents with absolute colour difference > 2 */
  c10ExcessiveColourDifferenceCount: number;

  /** C11: Minimise topscorers/opponents with same colour three times in row */
  c11ConsecutiveColourCount: number;

  /** C12: Minimise players not getting their colour preference */
  c12ColourPreferenceViolations: number;

  /** C13: Minimise players not getting their strong colour preference */
  c13StrongColourPreferenceViolations: number;

  /** C14: Minimise players who receive same downfloat as previous round */
  c14RepeatedDownfloatCount: number;

  /** C15: Minimise players who got same upfloat as previous round */
  c15RepeatedUpfloatCount: number;

  /** C16: Minimise players with same downfloat as two rounds ago */
  c16RepeatedDownfloatTwoRoundsCount: number;

  /** C17: Minimise players with same upfloat as two rounds ago */
  c17RepeatedUpfloatTwoRoundsCount: number;

  /** C18: Minimise PSD between downfloaters from one round ago */
  c18DownfloaterPsdOneRound: number;

  /** C19: Minimise PSD between upfloaters from one round ago */
  c19UpfloaterPsdOneRound: number;

  /** C20: Minimise PSD between downfloaters from two rounds ago */
  c20DownfloaterPsdTwoRounds: number;

  /** C21: Minimise PSD between upfloaters from two rounds ago */
  c21UpfloaterPsdTwoRounds: number;
}

/**
 * This function generates provisional pairings for a Swiss system bracket by pairing players from S1 and S2 groups.
 * It implements the basic pairing algorithm where top-ranked players (S1) are matched with lower-ranked players (S2).
 * Handles both heterogeneous brackets (with MDPs) and homogeneous brackets (without MDPs).
 *
 * @param bracketGroups - The bracket groups containing S1, S2, and Limbo players
 * @param bracketParameters - Parameters including MDP count and maximum pairs for this bracket
 * @returns A pairing candidate containing main pairs, possible remainder pairs, and downfloaters
 */
function getPairing(
  bracketGroups: BracketGroups,
  bracketParameters: BracketParameters,
): PairingCandidate {
  let mainPairs, remainderPairs;
  const candidatePairs = [];

  // Create pairs by matching S1 players with S2 players sequentially
  for (
    let pairNumber = 0;
    pairNumber < bracketParameters.maxPairs;
    pairNumber++
  ) {
    const S1Candidate = bracketGroups.S1.shift();
    const S2Candidate = bracketGroups.S2.shift();
    if (S1Candidate && S2Candidate) {
      const candidatePair: EntitiesPair = [S1Candidate, S2Candidate];
      candidatePairs.push(candidatePair);
    } else {
      throw new Error('UNEXPECTED END OF S1 or S2!');
    }
  }

  // Collect all unpaired players as downfloaters for next scoregroup
  const downfloaters = bracketGroups.S1.concat(
    bracketGroups.S2,
    bracketGroups.Limbo,
  );

  let candidatePairing: PairingCandidate;
  // Handle heterogeneous bracket (with MDPs)
  if (bracketParameters.mdpCount) {
    // Main pairs are MDP pairings (top priority)
    mainPairs = candidatePairs.slice(0, bracketParameters.mdpCount);

    // Remainder pairs are formed from remaining resident players
    if (bracketParameters.maxPairs > bracketParameters.mdpCount)
      remainderPairs = candidatePairs.slice(bracketParameters.mdpCount);

    candidatePairing = {
      mainPairs,
      remainderPairs,
      downfloaters,
    };
  } else {
    // Handle homogeneous bracket (no MDPs) - all pairs are main pairs
    mainPairs = candidatePairs.slice(0, bracketParameters.maxPairs);
    candidatePairing = {
      mainPairs,
      downfloaters,
    };
  }

  return candidatePairing;
}

/*
 * This function purposefully generates the bracket round for the round robin tournament. It gets the
 * tournamentId, checks the query for the current list of players, and  gets the games played by them.
 * By using that information, it returns the new games list, which are then published to the respective
 * ws.
 */
export function generateSwissRound({
  players,
  games,
  roundNumber,
  tournamentId,
}: RoundProps): GameModel[] {
  games = games?.filter((game) => game.round_number !== roundNumber) ?? [];

  // checking if the set of layers is even, if not, making it even with a smart alg
  const matchedEntities = players.map(convertPlayerToEntity);

  const sortedEntities = getInitialOrdering(matchedEntities);

  sortedEntities.forEach(
    (matchedEntity, entityOrder) => (matchedEntity.pairingNumber = entityOrder),
  );

  const scoregroupsByScore = generateEntitiesByScore(sortedEntities);

  const currentMovedDownPlayers: ChessTournamentEntity[] = [];

  for (const [score, scoregroup] of scoregroupsByScore.entries()) {
    const bracketParameters = getParameters(
      scoregroup,
      currentMovedDownPlayers,
    );

    const bracketPlayers = scoregroup.concat(currentMovedDownPlayers);

    const orderedBracket = getOrderedBracket(bracketPlayers);

    const bracketGroups = formBracketGroups(orderedBracket, bracketParameters);

    const candidatePairing = getPairing(bracketGroups, bracketParameters);
    console.log(candidatePairing);
  }

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
