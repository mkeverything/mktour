import {
  ChessTournamentEntity,
  EntitiesPair,
} from '@/lib/client-actions/common-generator';
import { getSwissColouredPair } from '@/lib/client-actions/swiss-generator/colouring';
import type {
  BracketGroups,
  BracketParameters,
  EntitiesByScore,
  PairingCandidate,
} from '@/lib/client-actions/swiss-generator/types';
import { isHeteroBracket } from '@/lib/client-actions/swiss-generator/types';

/**
 * This function estimates the needed for bracket forming parameters, and return them in a formatted way
 * @param scoregroup group of matched entities, array-like
 * @param movedDownPlayers  a group of moved down players from previous brackets.
 * @returns bracket parameters object, which contains all relevant information
 */
export function getParameters(
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
 * This function gets the list of ordered entities (containing the MDPs of the current round), and
 * the set of the bracket parameters. By that information, it compiles a bracket containing of S1-S2 and possible Limbo.
 * For heterogeneous brackets, always populates S1R and S2R (even if empty for semantic correctness).
 *
 * @param orderedEntities - Ordered bracket entities
 * @param bracketParams - Bracket parameters
 * @returns BracketGroups (HomoBracketGroups for homogeneous or HeteroBracketGroups for heterogeneous)
 */
function formBracketGroups(
  orderedEntities: ChessTournamentEntity[],
  bracketParams: BracketParameters,
): BracketGroups {
  // M1 (called N1 in code): if heterogeneous, it's mdpPairingsCount; if homogeneous, it's maxPairs
  const N1 = bracketParams.mdpCount
    ? bracketParams.mdpPairingsCount
    : bracketParams.maxPairs;

  // Getting top N1 players for S1Full (contains MDP + remainder)
  const S1Full = orderedEntities.slice(0, N1);

  // Forming Limbo if there are excess MDPs that cannot be paired
  let Limbo: ChessTournamentEntity[] = [];
  const excessiveMdpCount =
    bracketParams.mdpCount - bracketParams.mdpPairingsCount;
  if (excessiveMdpCount) {
    Limbo = orderedEntities.slice(N1, N1 + excessiveMdpCount);
  }

  // Getting the remaining players for S2Full (contains MDP + remainder)
  const S2Full = orderedEntities.slice(
    N1 + excessiveMdpCount,
    orderedEntities.length,
  );

  // Construct bracket groups based on type
  let bracketGroups: BracketGroups;
  const isHeterogeneous = bracketParams.mdpCount > 0;

  if (isHeterogeneous) {
    // Heterogeneous bracket: split S1Full and S2Full into MDP portion and remainder
    const mdpPairingsCount = bracketParams.mdpPairingsCount;

    // S1: MDP portion only (first mdpPairingsCount from S1Full)
    const S1 = S1Full.slice(0, mdpPairingsCount);
    // S1R: Remainder portion (everything after MDP portion in S1Full)
    const S1R = S1Full.slice(mdpPairingsCount);

    // S2: MDP portion only (first mdpPairingsCount from S2Full)
    const S2 = S2Full.slice(0, mdpPairingsCount);
    // S2R: Remainder portion (everything after MDP portion in S2Full)
    const S2R = S2Full.slice(mdpPairingsCount);

    bracketGroups = {
      S1,
      S2,
      Limbo,
      S1R,
      S2R,
    };
  } else {
    // Homogeneous bracket (no Limbo)
    bracketGroups = {
      S1: S1Full,
      S2: S2Full,
    };
  }

  return bracketGroups;
}
/**
 * Constructs bracket groups for a single scoregroup
 * Handles the process from scoregroup to BracketGroups (S1, S2, Limbo)
 * For heterogeneous brackets with MDPs, also includes S1R and S2R
 * @param scoregroup - Array of entities in this scoregroup
 * @param movedDownPlayers - Players moved down from higher scoregroups
 * @param bracketParameters - Pre-calculated bracket parameters
 * @returns BracketGroups (homogeneous or heterogeneous depending on bracket type)
 */
export function constructBracketGroups(
  scoregroup: ChessTournamentEntity[],
  movedDownPlayers: ChessTournamentEntity[],
  bracketParameters: BracketParameters,
): BracketGroups {
  const bracketPlayers = scoregroup.concat(movedDownPlayers);
  const orderedBracket = getOrderedBracket(bracketPlayers);
  const bracketGroups = formBracketGroups(orderedBracket, bracketParameters);

  return bracketGroups;
}

/**
 * Re-orders bracket groups after alterations
 * Orders S1, S2, and Limbo separately to preserve the alteration effects
 * (which players are in which group) while ensuring proper internal ordering
 * For heterogeneous brackets, also preserves and orders S1R and S2R
 *
 * @param bracketGroups - Bracket groups to re-order
 * @returns Re-ordered BracketGroups with same group membership but ordered entities
 */
export function reorderBracketGroups(
  bracketGroups: BracketGroups,
): BracketGroups {
  // Order each group separately to preserve the alteration
  const orderedS1 = getOrderedBracket(bracketGroups.S1);
  const orderedS2 = getOrderedBracket(bracketGroups.S2);

  // Check if this is a heterogeneous bracket using type guard
  if (isHeteroBracket(bracketGroups)) {
    const orderedLimbo = getOrderedBracket(bracketGroups.Limbo);
    const orderedS1R = getOrderedBracket(bracketGroups.S1R);
    const orderedS2R = getOrderedBracket(bracketGroups.S2R);

    return {
      S1: orderedS1,
      S2: orderedS2,
      Limbo: orderedLimbo,
      S1R: orderedS1R,
      S2R: orderedS2R,
    };
  }

  return {
    S1: orderedS1,
    S2: orderedS2,
  };
}

/**
 * This function generates provisional pairings for a Swiss system bracket by pairing players from S1 and S2 groups.
 * It implements the basic pairing algorithm where top-ranked players (S1) are matched with lower-ranked players (S2).
 * Handles both heterogeneous brackets (with MDPs) and homogeneous brackets (without MDPs).
 * Returns coloured pairs using FIDE-compliant color assignment.
 * This is the common entry point for converting BracketGroups to PairingCandidate.
 *
 * @param bracketGroups - The bracket groups containing S1, S2, and Limbo players (and possibly S1R/S2R)
 * @param bracketParameters - Parameters including MDP count and maximum pairs for this bracket
 * @returns A pairing candidate containing coloured main pairs, possible coloured remainder pairs, and downfloaters
 */
export function getPairing(
  bracketGroups: BracketGroups,
  _bracketParameters: BracketParameters,
): PairingCandidate {
  const candidatePairs: EntitiesPair[] = [];

  // Create working copies to avoid mutating original bracket groups
  const s1Working = [...bracketGroups.S1];
  const s2Working = [...bracketGroups.S2];

  // Pair all S1 with S2 (MDP portion in heterogeneous, all players in homogeneous)
  while (s1Working.length > 0 && s2Working.length > 0) {
    const S1Candidate = s1Working.shift();
    const S2Candidate = s2Working.shift();

    if (S1Candidate && S2Candidate) {
      const candidatePair: EntitiesPair = [S1Candidate, S2Candidate];
      candidatePairs.push(candidatePair);
    }
  }

  // Handle remainder and downfloaters separately for heterogeneous vs homogeneous brackets
  let downfloaters: ChessTournamentEntity[] = [];

  if (isHeteroBracket(bracketGroups)) {
    // Heterogeneous bracket: pair S1R with S2R
    const s1rWorking = [...bracketGroups.S1R];
    const s2rWorking = [...bracketGroups.S2R];

    // Pair S1R with S2R (remainder pairs)
    while (s1rWorking.length > 0 && s2rWorking.length > 0) {
      const S1RCandidate = s1rWorking.shift();
      const S2RCandidate = s2rWorking.shift();

      if (S1RCandidate && S2RCandidate) {
        const candidatePair: EntitiesPair = [S1RCandidate, S2RCandidate];
        candidatePairs.push(candidatePair);
      }
    }

    // Downfloaters: unpaired S1R + unpaired S2R + Limbo
    downfloaters = s1rWorking.concat(s2rWorking, bracketGroups.Limbo);
  } else {
    // Homogeneous bracket: downfloaters are unpaired S1/S2
    downfloaters = s1Working.concat(s2Working);
  }

  // Colour all pairs
  const colouredPairs = candidatePairs.map(getSwissColouredPair);

  return {
    colouredPairs,
    downfloaters,
  };
} /**
 * This function creates a mapping of scores and the respective entities,
 * making the scoregroups
 * @param matchedEntities a listlike of entities
 * @returns mapping with the scoregroups
 */
export function generateEntitiesByScore(
  matchedEntities: ChessTournamentEntity[],
) {
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
