/**
 * Evaluation functions for quality criteria
 *
 * Contains:
 * - Absolute criteria (C1-C4) evaluation
 * - Quality criteria (C5-C21) evaluation functions
 * - Helper functions for pairing compatibility and completion checks
 * - evaluateQualityCriteria aggregator function
 */

import {
  ChessColour,
  ChessTournamentEntity,
  ColouredEntitiesPair,
} from '@/lib/client-actions/common-generator';
import { generateCombinations } from '@/lib/client-actions/swiss-generator/alterations';
import { maximumMatching } from '@/lib/client-actions/swiss-generator/matching';
import { compareByScore } from '@/lib/client-actions/swiss-generator/ordering';
import type {
  AbsoluteEvaluationReport,
  BasicAbsoluteEvaluationReport,
  EvaluationContext,
  FutureCriteriaCompliance,
  PairingCandidate,
  QualityEvaluationReport,
} from '@/lib/client-actions/swiss-generator/types';
import Graph from 'graphology';

import {
  didDownfloat,
  didUpfloat,
  willHaveSameColourThreeTimes,
} from './ideal-computation';
import type { MdpPairingFilterCriterion, ViolationChecker } from './types';

// ============================================================================
// Constants
// ============================================================================

/** Constant for colour changes */
const WHITE_COLOUR_CHANGE = 1;
const BLACK_COLOUR_CHANGE = -1;

/** Constant for PAB (Pairing Allocated Bye) node identifier in compatibility graphs */
const PAB_NODE_ID = 'PAB';

// ============================================================================
// Helper Functions for Absolute Criteria
// ============================================================================

/**
 * Checks if two entities have played against each other before
 * @param firstEntity - First chess tournament entity
 * @param secondEntity - Second chess tournament entity
 * @returns true if they have played before, false otherwise
 */
function havePlayedBefore(
  firstEntity: ChessTournamentEntity,
  secondEntity: ChessTournamentEntity,
): boolean {
  return firstEntity.previousGames.some(
    (game) =>
      game.white_id === secondEntity.entityId ||
      game.black_id === secondEntity.entityId,
  );
}

/**
 * Identifies non-topscorers from a list of entities
 * Non-topscorers are those with <= 50% of potential maximum score
 * @param entities - List of chess tournament entities
 * @param roundNumber - Current round number for threshold calculation
 * @returns Array of entities that are not topscorers
 */
function getNonTopscorers(
  entities: ChessTournamentEntity[],
  roundNumber: number,
): ChessTournamentEntity[] {
  const maxPossibleScore = roundNumber - 1;
  const threshold = maxPossibleScore * 0.5;
  return entities.filter((entity) => entity.entityScore <= threshold);
}

/**
 * Identifies topscorers from a list of entities
 * Topscorers are those with > 50% of potential maximum score
 * @param entities - List of chess tournament entities
 * @param roundNumber - Current round number for threshold calculation
 * @returns Array of entities that are topscorers
 */
function getTopscorers(
  entities: ChessTournamentEntity[],
  roundNumber: number,
): ChessTournamentEntity[] {
  const maxPossibleScore = roundNumber - 1;
  const threshold = maxPossibleScore * 0.5;
  return entities.filter((entity) => entity.entityScore > threshold);
}

/**
 * Checks if two entities have the same absolute colour preference
 * Absolute colour preference applies when colour index >= 2 or <= -2
 * @param firstEntity - First chess tournament entity
 * @param secondEntity - Second chess tournament entity
 * @returns true if both have same absolute colour preference sign
 */
function haveSameAbsoluteColourPreference(
  firstEntity: ChessTournamentEntity,
  secondEntity: ChessTournamentEntity,
): boolean {
  const firstPreference = firstEntity.colourIndex;
  const secondPreference = secondEntity.colourIndex;

  // Absolute colour preference applies when |colourIndex| >= 2
  const firstHasAbsolutePreference = Math.abs(firstPreference) >= 2;
  const secondHasAbsolutePreference = Math.abs(secondPreference) >= 2;

  // Both must have absolute preferences and same sign
  return (
    firstHasAbsolutePreference &&
    secondHasAbsolutePreference &&
    Math.sign(firstPreference) === Math.sign(secondPreference)
  );
}

/**
 * Evaluates C3 criterion: Non-topscorers with same absolute colour preference shall not meet
 * @param pairingCandidate - The pairing candidate to evaluate
 * @param roundNumber - Current round number for topscorer threshold
 * @returns true if C3 criterion is satisfied, false otherwise
 */
function evaluateC3ColourPreferenceSeparation(
  pairingCandidate: PairingCandidate,
  roundNumber: number,
): boolean {
  // Unite all pairs (main and remainder) for evaluation
  const allPairs: ColouredEntitiesPair[] = [...pairingCandidate.colouredPairs];
  const allEntities = allPairs.flatMap((pair) => [
    pair.whiteEntity,
    pair.blackEntity,
  ]);

  // Identify non-topscorers
  const nonTopscorers = getNonTopscorers(allEntities, roundNumber);

  // Check each pair for C3 violation
  return allPairs.every((pair) => {
    const whiteIsNonTopscorer = nonTopscorers.includes(pair.whiteEntity);
    const blackIsNonTopscorer = nonTopscorers.includes(pair.blackEntity);

    // If both are non-topscorers, check colour preference compatibility
    if (whiteIsNonTopscorer && blackIsNonTopscorer) {
      return !haveSameAbsoluteColourPreference(
        pair.whiteEntity,
        pair.blackEntity,
      );
    }

    // If only one or neither is non-topscorer, C3 doesn't apply
    return true;
  });
}

/**
 * Checks C2 criterion: No player receives PAB twice or multiple point-scoring rounds without playing
 * @param pairingCandidate - The pairing candidate to evaluate
 * @param context - Evaluation context
 * @returns true if C2 criterion is satisfied, false otherwise
 */
function checkUniquePAB(
  pairingCandidate: PairingCandidate,
  context: EvaluationContext,
): boolean {
  const { currentBracketScore, roundNumber, scoregroupsByScore } = context;
  const [lowestScore] = scoregroupsByScore[scoregroupsByScore.length - 1];

  if (
    currentBracketScore !== lowestScore ||
    pairingCandidate.downfloaters.length === 0
  ) {
    // C2 is satisfied if: not lowest bracket OR no downfloaters
    return true;
  } else if (pairingCandidate.downfloaters.length === 1) {
    // We are in the lowest bracket with one downfloater (PAB recipient)
    const expectedGameCount = roundNumber - 1;
    const pabRecipient = pairingCandidate.downfloaters[0];
    return pabRecipient.previousGames.length === expectedGameCount;
  } else {
    // Multiple downfloaters in lowest bracket is invalid
    throw new Error(
      `Invalid state: ${pairingCandidate.downfloaters.length} downfloaters in lowest bracket`,
    );
  }
}

// ============================================================================
// Compatibility Graph Functions
// ============================================================================

/**
 * Collects all remaining players from scoregroups plus downfloaters
 * Note: scoregroupsByScore arrives already sliced to contain only REMAINING scoregroups
 * (processed brackets have been removed by the caller in swiss-generator.ts)
 * @param pairingCandidate - Current pairing candidate with downfloaters
 * @param scoregroupsByScore - REMAINING scoregroups only (sorted descending)
 * @returns Array of all remaining unpaired players
 */
function collectRemainingPlayers(
  pairingCandidate: PairingCandidate,
  scoregroupsByScore: [number, ChessTournamentEntity[]][],
): ChessTournamentEntity[] {
  const remainingPlayers: ChessTournamentEntity[] = [];

  // Collect all players from remaining scoregroups
  for (const [, scoreGroup] of scoregroupsByScore) {
    remainingPlayers.push(...scoreGroup);
  }

  // Add downfloaters from current bracket
  remainingPlayers.push(...pairingCandidate.downfloaters);

  return remainingPlayers;
}

/**
 * Checks if two entities are compatible for pairing based on C3 criterion
 * C3: Non-topscorers with same absolute colour preference shall not meet
 * @param firstEntity - First player
 * @param secondEntity - Second player
 * @param nonTopscorers - Array of non-topscorer entities
 * @returns true if players can be paired (don't violate C3)
 */
function areEntitiesCompatibleByC3(
  firstEntity: ChessTournamentEntity,
  secondEntity: ChessTournamentEntity,
  nonTopscorers: ChessTournamentEntity[],
): boolean {
  const firstIsNonTopscorer = nonTopscorers.includes(firstEntity);
  const secondIsNonTopscorer = nonTopscorers.includes(secondEntity);

  // If both are non-topscorers, check colour preference compatibility
  if (firstIsNonTopscorer && secondIsNonTopscorer) {
    if (haveSameAbsoluteColourPreference(firstEntity, secondEntity)) {
      return false;
    }
  }

  // If only one or neither is non-topscorer, C3 doesn't restrict pairing
  return true;
}

/**
 * Checks if entity can receive PAB based on C2 criterion
 * C2: No player receives PAB twice
 * @param entity - Chess tournament entity
 * @param roundNumber - Current round number
 * @returns true if entity can receive PAB
 */
function canEntityReceivePAB(
  entity: ChessTournamentEntity,
  roundNumber: number,
): boolean {
  const expectedGameCount = roundNumber - 1;
  return entity.previousGames.length === expectedGameCount;
}

/**
 * Builds compatibility graph for remaining players
 *
 * Creates a graphology Graph where:
 * - Nodes are player entity IDs (and optionally PAB node)
 * - Edges represent valid pairings according to C1, C2, C3 criteria
 *
 * @param remainingPlayers - All remaining unpaired players
 * @param roundNumber - Current round number for C2 and C3 checks
 * @param includePab - Whether to include a PAB node
 * @returns Graphology graph with compatibility edges
 */
function buildCompatibilityGraph(
  remainingPlayers: ChessTournamentEntity[],
  roundNumber: number,
  includePab: boolean = true,
): Graph {
  const graph = new Graph({ type: 'undirected' });
  const hasOddPlayers = remainingPlayers.length % 2 === 1;

  // Add player nodes using entity IDs
  for (const player of remainingPlayers) {
    graph.addNode(player.entityId);
  }

  // Add PAB node if needed
  if (hasOddPlayers && includePab) {
    graph.addNode(PAB_NODE_ID);
  }

  // Identify non-topscorers for C3 checks
  const nonTopscorers = getNonTopscorers(remainingPlayers, roundNumber);

  // Add edges between compatible player pairs
  for (
    let firstPlayerIndex = 0;
    firstPlayerIndex < remainingPlayers.length;
    firstPlayerIndex++
  ) {
    for (
      let secondPlayerIndex = firstPlayerIndex + 1;
      secondPlayerIndex < remainingPlayers.length;
      secondPlayerIndex++
    ) {
      const firstPlayer = remainingPlayers[firstPlayerIndex];
      const secondPlayer = remainingPlayers[secondPlayerIndex];

      // Check C1: Haven't played before, and C3: Non-topscorers with compatible colour preferences
      if (
        !havePlayedBefore(firstPlayer, secondPlayer) &&
        areEntitiesCompatibleByC3(firstPlayer, secondPlayer, nonTopscorers)
      ) {
        // Both criteria satisfied - add edge using player entity IDs
        graph.addEdge(firstPlayer.entityId, secondPlayer.entityId);
      }
    }
  }

  // Add edges from PAB node to eligible players (C2 check)
  if (hasOddPlayers && includePab) {
    for (const player of remainingPlayers) {
      if (canEntityReceivePAB(player, roundNumber)) {
        graph.addEdge(PAB_NODE_ID, player.entityId);
      }
    }
  }

  return graph;
}

/**
 * Calculates the minimum number of downfloaters required for a set of players.
 *
 * @param players - List of players to pair
 * @param roundNumber - Current round number
 * @param allowPab - Whether PAB (Bye) is allowed (only for last bracket or global check)
 * @returns Minimum number of downfloaters
 */
export function calculateMinDownfloaters(
  players: ChessTournamentEntity[],
  roundNumber: number,
  allowPab: boolean,
): number {
  if (players.length === 0) return 0;

  // Build compatibility graph, including PAB if allowed and odd number of players
  const includePab = allowPab && players.length % 2 === 1;
  const graph = buildCompatibilityGraph(players, roundNumber, includePab);

  // Find maximum matching using our Edmonds' Blossom implementation
  const matching = maximumMatching(graph);

  // Calculate matched nodes
  // Count how many nodes have a non-null mate
  let matchedNodesCount = 0;
  for (const [, mate] of matching) {
    if (mate !== null) {
      matchedNodesCount++;
    }
  }

  // Calculate unmatched nodes (downfloaters)
  const totalNodes = players.length + (includePab ? 1 : 0);
  // matchedNodesCount counts both ends of each matched edge
  // Unmatched nodes = Total nodes - Matched nodes
  return totalNodes - matchedNodesCount;
}

/**
 * Checks C4 criterion: Completion check.
 * Verifies that downfloaters and remaining players can form valid pairings.
 *
 * @param pairingCandidate - Current pairing candidate with downfloaters
 * @param roundNumber - Current round number
 * @param scoregroupsByScore - REMAINING scoregroups only (sorted descending, already sliced)
 * @returns true if remaining players can be validly paired
 */
function checkC4Completion(
  pairingCandidate: PairingCandidate,
  roundNumber: number,
  scoregroupsByScore: [number, ChessTournamentEntity[]][],
): boolean {
  // We check completion through maximum matching algorithm on a compatibility graph.
  // Nodes represent players (and PAB if odd count). Edges represent valid pairings
  // according to C1 (unique opponents), C2 (unique PAB), and C3 (colour preferences).
  // If maximum matching size equals required pairs, completion is possible.

  // Step 1: Collect all remaining players
  const remainingPlayers = collectRemainingPlayers(
    pairingCandidate,
    scoregroupsByScore,
  );

  // Step 2: Handle trivial case (no remaining players), otherwise build and check
  if (remainingPlayers.length === 0) {
    return true;
  } else {
    // Step 3: Calculate minimum downfloaters
    // For C4 (Completion), we treat the remaining pool as a whole.
    // If odd, one player MUST get PAB. If even, NO ONE gets PAB.
    const allowPab = remainingPlayers.length % 2 !== 0;
    const minDownfloaters = calculateMinDownfloaters(
      remainingPlayers,
      roundNumber,
      allowPab,
    );

    // Step 4: Check if completion is possible
    // If minDownfloaters is 0, it means all players (except potentially one PAB) can be paired.
    return minDownfloaters === 0;
  }
}

// ============================================================================
// Absolute Criteria Evaluation (C1-C4)
// ============================================================================

/**
 * Evaluates basic absolute criteria C1-C3 for a Swiss system pairing candidate
 * @param pairingCandidate - The pairing candidate to evaluate
 * @param context - Evaluation context
 * @returns BasicAbsoluteEvaluationReport with C1-C3 evaluation results
 */
export function evaluateBasicAbsoluteCriteria(
  pairingCandidate: PairingCandidate,
  context: EvaluationContext,
): BasicAbsoluteEvaluationReport {
  const { roundNumber } = context;
  // Unite all pairs (main and remainder) for evaluation
  const allPairs: ColouredEntitiesPair[] = [...pairingCandidate.colouredPairs];

  // C1: Check that no two players play against each other more than once
  const c1UniqueOpponents = allPairs.every(
    (pair) => !havePlayedBefore(pair.whiteEntity, pair.blackEntity),
  );

  // C2: Check that no player receives PAB twice or multiple point-scoring rounds without playing
  const c2UniquePAB = checkUniquePAB(pairingCandidate, context);

  // C3: Check that non-topscorers with same absolute colour preference shall not meet
  const c3ColourPreferenceSeparation = evaluateC3ColourPreferenceSeparation(
    pairingCandidate,
    roundNumber,
  );

  return {
    c1UniqueOpponents,
    c2UniquePAB,
    c3ColourPreferenceSeparation,
  };
}

/**
 * Evaluates the absolute criteria of a Swiss system pairing candidate according to FIDE criteria
 * Implements C1-C5 absolute evaluation checks from FIDE Dutch System
 * These criteria cannot be violated and must all be satisfied
 *
 * @param pairingCandidate - The pairing candidate to evaluate
 * @param context - Evaluation context
 * @returns AbsoluteEvaluationReport with evaluation results for C1-C5 criteria
 */
export function evaluateAbsoluteCriteria(
  pairingCandidate: PairingCandidate,
  context: EvaluationContext,
): AbsoluteEvaluationReport {
  const { roundNumber, scoregroupsByScore } = context;
  // Get basic criteria (C1-C3)
  const basicCriteria = evaluateBasicAbsoluteCriteria(
    pairingCandidate,
    context,
  );

  return {
    ...basicCriteria,
    c4PairingCompatibility: checkC4Completion(
      pairingCandidate,
      roundNumber,
      scoregroupsByScore,
    ),
  };
}

// ============================================================================
// Quality Criteria Evaluation (C5-C21)
// ============================================================================

/**
 * Evaluates C5 criterion: Minimise the score of the PAB recipient.
 *
 * @param pairingCandidate - The pairing candidate to evaluate
 * @param context - Evaluation context
 * @returns Score of the PAB recipient, or 0 if no PAB in this bracket
 * @throws Error if multiple downfloaters in lowest bracket (invalid state)
 */
function evaluateC5MinimisePabScore(
  pairingCandidate: PairingCandidate,
  context: EvaluationContext,
): number {
  const { currentBracketScore, scoregroupsByScore } = context;
  const [lowestScore] = scoregroupsByScore[scoregroupsByScore.length - 1];

  if (
    currentBracketScore !== lowestScore ||
    pairingCandidate.downfloaters.length === 0
  ) {
    // C5 is satisfied if: not lowest bracket OR no downfloaters in lowest bracket
    // Return 0 as "no PAB cost"
    return 0;
  } else if (pairingCandidate.downfloaters.length === 1) {
    // We are in the lowest bracket with one downfloater (PAB recipient)
    const pabRecipient = pairingCandidate.downfloaters[0];
    return pabRecipient.entityScore;
  } else {
    // Multiple downfloaters in lowest bracket is invalid
    throw new Error(
      `Invalid state: ${pairingCandidate.downfloaters.length} downfloaters in lowest bracket`,
    );
  }
}

/**
 * Evaluates C6: Minimise the number of downfloaters
 * @param pairingCandidate - The pairing candidate to evaluate
 * @param context - Evaluation context (unused but kept for standard signature)
 * @returns Number of downfloaters
 */
function evaluateC6MinimiseDownfloaters(
  pairingCandidate: PairingCandidate,
  _context: EvaluationContext,
): number {
  return pairingCandidate.downfloaters.length;
}

/**
 * Evaluates C7: Minimise the scores of the downfloaters
 * @param pairingCandidate - The pairing candidate to evaluate
 * @param context - Evaluation context (unused but kept for standard signature)
 * @returns Array of scores of downfloaters, sorted descending
 */
function evaluateC7MinimiseDownfloaterScores(
  pairingCandidate: PairingCandidate,
  _context: EvaluationContext,
): number[] {
  const downfloaters = pairingCandidate.downfloaters;
  const sortedDownfloaters = downfloaters.toSorted(compareByScore);
  const downfloaterScores = sortedDownfloaters.map(
    (downfloater) => downfloater.entityScore,
  );
  return downfloaterScores;
}

/**
 * Finds the optimal set of downfloaters from a bracket
 *
 * WHY extracted: This logic is shared between C8 evaluation and C8 ideal computation.
 * It searches for downfloaters with lowest scores that still allow perfect matching.
 *
 * @param bracketPlayers - All players in the bracket
 * @param requiredDownfloaterCount - Number of downfloaters required
 * @param roundNumber - Current round number
 * @param allowPab - Whether PAB is allowed for remaining players
 * @returns Optimal downfloater scores (sorted descending), or null if not found
 */
export function findOptimalDownfloaterScores(
  bracketPlayers: ChessTournamentEntity[],
  requiredDownfloaterCount: number,
  roundNumber: number,
  allowPab: boolean,
): number[] | null {
  // Sort players by score descending (highest first)
  // generateCombinations yields in order, so first valid = lowest scores
  const sortedPlayers = bracketPlayers.toSorted(compareByScore).reverse();

  const combinationsGenerator = generateCombinations(
    sortedPlayers,
    requiredDownfloaterCount,
  );

  for (const proposedDownfloaters of combinationsGenerator) {
    const remainingPlayers = sortedPlayers.filter(
      (player) => !proposedDownfloaters.includes(player),
    );

    const remainingDownfloatersCount = calculateMinDownfloaters(
      remainingPlayers,
      roundNumber,
      allowPab,
    );
    const isPerfectMatching = remainingDownfloatersCount === 0;

    if (isPerfectMatching) {
      // Found optimal set - return scores sorted descending
      const scores = proposedDownfloaters
        .toSorted(compareByScore)
        .map((player) => player.entityScore);
      return scores;
    }
  }

  return null;
}

/**
 * Evaluates C8: Future criteria compliance.
 * Checks if the set of downfloaters allows for a valid pairing in the following bracket.
 *
 * @param pairingCandidate - The pairing candidate to evaluate
 * @param context - Evaluation context
 * @returns Future criteria compliance result
 */
function evaluateC8FutureCriteriaCompliance(
  pairingCandidate: PairingCandidate,
  context: EvaluationContext,
): FutureCriteriaCompliance {
  const { roundNumber, scoregroupsByScore } = context;
  const hasFutureBracket = scoregroupsByScore.length > 0;

  if (!hasFutureBracket) {
    return { pabScore: 0, downfloaterCount: 0, downfloaterScores: [] };
  }

  // Identify players for the next bracket
  const nextScoreGroup = scoregroupsByScore[0][1];
  const currentDownfloaters = pairingCandidate.downfloaters;
  const nextBracketPlayers = [...nextScoreGroup, ...currentDownfloaters];

  // PAB is only allowed if this is the last bracket
  const isLastBracket = scoregroupsByScore.length === 1;
  const minDownfloaterCount = calculateMinDownfloaters(
    nextBracketPlayers,
    roundNumber,
    isLastBracket,
  );

  if (minDownfloaterCount === 0) {
    return { pabScore: 0, downfloaterCount: 0, downfloaterScores: [] };
  }

  // Find optimal downfloater set
  const optimalScores = findOptimalDownfloaterScores(
    nextBracketPlayers,
    minDownfloaterCount,
    roundNumber,
    isLastBracket,
  );

  if (optimalScores === null) {
    throw new Error(
      `Failed to find a valid set of ${minDownfloaterCount} downfloaters for C8 compliance`,
    );
  }

  // PAB score is lowest downfloater score if last bracket
  const pabScore = isLastBracket ? optimalScores[0] : 0;

  return {
    pabScore,
    downfloaterCount: minDownfloaterCount,
    downfloaterScores: optimalScores,
  };
}

/**
 * Evaluates C9: Minimise the number of unplayed games of the PAB assignee
 * Applies when the downfloater ends up receiving the PAB (single downfloater in last bracket).
 * @param pairingCandidate - The pairing candidate to evaluate
 * @param context - Evaluation context
 * @returns Number of unplayed games of PAB assignee (0 if no PAB)
 */
function evaluateC9MinimisePabUnplayed(
  pairingCandidate: PairingCandidate,
  context: EvaluationContext,
): number {
  const { roundNumber, scoregroupsByScore } = context;
  // If there are no remaining scoregroups, the downfloaters form the final bracket.
  // If there is exactly one downfloater, they receive the PAB.
  if (
    scoregroupsByScore.length === 0 &&
    pairingCandidate.downfloaters.length === 1
  ) {
    const pabRecipient = pairingCandidate.downfloaters[0];
    const playedGames = pabRecipient.previousGames.length;
    const expectedGames = roundNumber - 1;
    return expectedGames - playedGames;
  } else {
    return 0;
  }
}

// ============================================================================
// Colour Violation Evaluation (C10-C13)
// ============================================================================

/**
 * Helper to count violations in a pairing.
 * Generic helper for C10, C11, C12, C13.
 *
 * @param pairingCandidate - The pairing candidate to evaluate
 * @param countViolationsInPair - Callback to count violations in a pair
 * @returns Total number of violations
 */
function countPairingViolations(
  pairingCandidate: PairingCandidate,
  countViolationsInPair: ViolationChecker,
): number {
  const allPairs: ColouredEntitiesPair[] = [...pairingCandidate.colouredPairs];

  let violations = 0;
  for (const pair of allPairs) {
    violations += countViolationsInPair(pair);
  }
  return violations;
}

/**
 * Helper to check if a player's colour difference would be violated by a new colour assignment
 * @param entity - The player entity
 * @param colourChange - +1 for White, -1 for Black
 * @returns true if the new colour difference is invalid (>2 or <-2)
 */
function isColourDiffViolated(
  entity: ChessTournamentEntity,
  colourChange: number,
): boolean {
  const newColourDiff = entity.colourIndex + colourChange;
  return newColourDiff > 2 || newColourDiff < -2;
}

/**
 * Checks for C10 violations in a pair (colour difference for topscorers).
 * @param pair - The pair to check
 * @param topscorers - List of topscorers
 * @returns Number of violations (0, 1, or 2)
 */
function countC10ViolationsInPair(
  pair: ColouredEntitiesPair,
  topscorers: ChessTournamentEntity[],
): number {
  let violations = 0;
  // Check White player
  if (
    topscorers.includes(pair.whiteEntity) &&
    isColourDiffViolated(pair.whiteEntity, WHITE_COLOUR_CHANGE)
  ) {
    violations++;
  }
  // Check Black player
  if (
    topscorers.includes(pair.blackEntity) &&
    isColourDiffViolated(pair.blackEntity, BLACK_COLOUR_CHANGE)
  ) {
    violations++;
  }
  return violations;
}

/**
 * Evaluates C10: Minimise colour difference violations for topscorers.
 *
 * @param pairingCandidate - The pairing candidate to evaluate
 * @param context - Evaluation context
 * @returns Number of violations
 */
function evaluateC10MinimiseColourDiffViolation(
  pairingCandidate: PairingCandidate,
  context: EvaluationContext,
): number {
  const { roundNumber } = context;
  const allPairs: ColouredEntitiesPair[] = [...pairingCandidate.colouredPairs];
  const allEntities = allPairs.flatMap((pair) => [
    pair.whiteEntity,
    pair.blackEntity,
  ]);

  // Topscorers are players with > 50% score
  const topscorers = getTopscorers(allEntities, roundNumber);

  // C10 applies to topscorers (score > 50% of max).
  // We check if assigning the new colour results in an absolute colour difference > 2.
  return countPairingViolations(pairingCandidate, (pair) =>
    countC10ViolationsInPair(pair, topscorers),
  );
}

/**
 * Checks for C11 violations in a pair (same colour 3 times for topscorers).
 * @param pair - The pair to check
 * @param topscorers - List of topscorers
 * @returns Number of violations (0, 1, or 2)
 */
function countC11ViolationsInPair(
  pair: ColouredEntitiesPair,
  topscorers: ChessTournamentEntity[],
): number {
  let violations = 0;
  // Check White player
  if (
    topscorers.includes(pair.whiteEntity) &&
    willHaveSameColourThreeTimes(pair.whiteEntity, ChessColour.White)
  ) {
    violations++;
  }
  // Check Black player
  if (
    topscorers.includes(pair.blackEntity) &&
    willHaveSameColourThreeTimes(pair.blackEntity, ChessColour.Black)
  ) {
    violations++;
  }
  return violations;
}

/**
 * Evaluates C11: Minimise same colour 3 times in a row for topscorers.
 *
 * @param pairingCandidate - The pairing candidate to evaluate
 * @param context - Evaluation context
 * @returns Number of violations
 */
function evaluateC11MinimiseSameColourThreeTimes(
  pairingCandidate: PairingCandidate,
  context: EvaluationContext,
): number {
  const { roundNumber } = context;
  const allPairs: ColouredEntitiesPair[] = [...pairingCandidate.colouredPairs];
  const allEntities = allPairs.flatMap((pair) => [
    pair.whiteEntity,
    pair.blackEntity,
  ]);

  // Topscorers are players with > 50% score
  const topscorers = getTopscorers(allEntities, roundNumber);

  // C11: Minimise topscorers receiving the same colour 3 times in a row.
  return countPairingViolations(pairingCandidate, (pair) =>
    countC11ViolationsInPair(pair, topscorers),
  );
}

/**
 * Checks for C12 violations in a pair (colour preference).
 * @param pair - The pair to check
 * @returns Number of violations (0, 1, or 2)
 */
function countC12ViolationsInPair(pair: ColouredEntitiesPair): number {
  let violations = 0;
  // White player: Wants White if colourIndex < 0. Gets White.
  // Violation if colourIndex > 0 (wanted Black).
  if (pair.whiteEntity.colourIndex > 0) violations++;

  // Black player: Wants Black if colourIndex > 0. Gets Black.
  // Violation if colourIndex < 0 (wanted White).
  if (pair.blackEntity.colourIndex < 0) violations++;

  return violations;
}

/**
 * Evaluates C12: Minimise colour preference violations.
 *
 * @param pairingCandidate - The pairing candidate to evaluate
 * @param context - Evaluation context (unused but kept for standard signature)
 * @returns Number of violations
 */
function evaluateC12MinimiseColourPrefViolation(
  pairingCandidate: PairingCandidate,
  _context: EvaluationContext,
): number {
  return countPairingViolations(pairingCandidate, countC12ViolationsInPair);
}

/**
 * Checks for C13 violations in a pair (strong colour preference).
 * @param pair - The pair to check
 * @returns Number of violations (0, 1, or 2)
 */
function countC13ViolationsInPair(pair: ColouredEntitiesPair): number {
  let violations = 0;
  // White player: Gets White. Violation if colourIndex >= 1 (Strongly wants Black).
  if (pair.whiteEntity.colourIndex >= 1) violations++;

  // Black player: Gets Black. Violation if colourIndex <= -1 (Strongly wants White).
  if (pair.blackEntity.colourIndex <= -1) violations++;

  return violations;
}

/**
 * Evaluates C13: Minimise strong colour preference violations.
 *
 * @param pairingCandidate - The pairing candidate to evaluate
 * @param context - Evaluation context (unused but kept for standard signature)
 * @returns Number of violations
 */
function evaluateC13MinimiseStrongColourPrefViolation(
  pairingCandidate: PairingCandidate,
  _context: EvaluationContext,
): number {
  return countPairingViolations(pairingCandidate, countC13ViolationsInPair);
}

// ============================================================================
// Float History Evaluation (C14-C17)
// ============================================================================

/**
 * Helper to get resident downfloaters from a pairing candidate.
 * Resident downfloaters are downfloaters who belong to the current scoregroup (have the current bracket score).
 * @param pairingCandidate - The pairing candidate
 * @param currentBracketScore - The score of the current bracket
 * @returns Array of resident downfloaters
 */
function getResidentDownfloaters(
  pairingCandidate: PairingCandidate,
  currentBracketScore: number,
): ChessTournamentEntity[] {
  return pairingCandidate.downfloaters.filter(
    (downfloater) => downfloater.entityScore === currentBracketScore,
  );
}

/**
 * Helper to get opponents of MDPs in the current pairing.
 * MDPs are paired against residents. The resident in such a pair is the "MDP opponent".
 * @param pairingCandidate - The pairing candidate
 * @param currentBracketScore - The score of the current bracket
 * @returns Array of MDP opponents
 */
function getMdpOpponents(
  pairingCandidate: PairingCandidate,
  currentBracketScore: number,
): ChessTournamentEntity[] {
  const allPairs: ColouredEntitiesPair[] = [...pairingCandidate.colouredPairs];

  const mdpOpponents: ChessTournamentEntity[] = [];
  for (const pair of allPairs) {
    const whiteIsMdp = pair.whiteEntity.entityScore > currentBracketScore;
    const blackIsMdp = pair.blackEntity.entityScore > currentBracketScore;

    // XOR check: Exactly one player must be an MDP
    if (whiteIsMdp !== blackIsMdp) {
      const opponent = whiteIsMdp ? pair.blackEntity : pair.whiteEntity;
      mdpOpponents.push(opponent);
    }
  }
  return mdpOpponents;
}

/**
 * Evaluates C14: Minimise resident downfloaters who received a downfloat the previous round
 */
function evaluateC14MinimiseResidentDownfloaterPrev(
  pairingCandidate: PairingCandidate,
  context: EvaluationContext,
): number {
  const { currentBracketScore, roundNumber } = context;
  const prevRound = roundNumber - 1;
  const residentDownfloaters = getResidentDownfloaters(
    pairingCandidate,
    currentBracketScore,
  );
  const downfloatersFromPrevRound = residentDownfloaters.filter((resident) =>
    didDownfloat(resident, prevRound),
  );
  return downfloatersFromPrevRound.length;
}

/**
 * Evaluates C15: Minimise MDP opponents who received an upfloat the previous round
 */
function evaluateC15MinimiseMdpOpponentUpfloatPrev(
  pairingCandidate: PairingCandidate,
  context: EvaluationContext,
): number {
  const { currentBracketScore, roundNumber } = context;
  const prevRound = roundNumber - 1;
  const mdpOpponents = getMdpOpponents(pairingCandidate, currentBracketScore);
  const opponentsUpfloatedPrevRound = mdpOpponents.filter((opponent) =>
    didUpfloat(opponent, prevRound),
  );
  return opponentsUpfloatedPrevRound.length;
}

/**
 * Evaluates C16: Minimise resident downfloaters who received a downfloat two rounds before
 */
function evaluateC16MinimiseResidentDownfloaterPrev2(
  pairingCandidate: PairingCandidate,
  context: EvaluationContext,
): number {
  const { currentBracketScore, roundNumber } = context;
  const twoRoundsAgo = roundNumber - 2;
  const residentDownfloaters = getResidentDownfloaters(
    pairingCandidate,
    currentBracketScore,
  );
  const downfloatersFromTwoRoundsAgo = residentDownfloaters.filter((resident) =>
    didDownfloat(resident, twoRoundsAgo),
  );
  return downfloatersFromTwoRoundsAgo.length;
}

/**
 * Evaluates C17: Minimise MDP opponents who received an upfloat two rounds before
 */
function evaluateC17MinimiseMdpOpponentUpfloatPrev2(
  pairingCandidate: PairingCandidate,
  context: EvaluationContext,
): number {
  const { currentBracketScore, roundNumber } = context;
  const twoRoundsAgo = roundNumber - 2;
  const mdpOpponents = getMdpOpponents(pairingCandidate, currentBracketScore);
  const opponentsUpfloatedTwoRoundsAgo = mdpOpponents.filter((opponent) =>
    didUpfloat(opponent, twoRoundsAgo),
  );
  return opponentsUpfloatedTwoRoundsAgo.length;
}

// ============================================================================
// MDP Score Difference Evaluation (C18-C21)
// ============================================================================

/**
 * Helper to collect score differences for MDP pairings based on a condition.
 *
 * @param pairingCandidate - The pairing candidate
 * @param currentBracketScore - The score of the current bracket
 * @param filteringCriterion - The criterion to filter MDP pairings
 * @returns Sorted array of score differences
 */
function getMdpScoreDiffs(
  pairingCandidate: PairingCandidate,
  currentBracketScore: number,
  filteringCriterion: MdpPairingFilterCriterion,
): number[] {
  // This abstracts the common logic for C18-C21:
  // 1. Iterate all pairs.
  // 2. Identify which player is the MDP (Moved Down Player) and which is the Resident.
  // 3. Apply a filter (e.g., did the MDP downfloat previously?).
  // 4. If filter passes, calculate absolute score difference.
  // 5. Return sorted differences for lexicographical comparison.

  const allPairs: ColouredEntitiesPair[] = [...pairingCandidate.colouredPairs];
  const scoreDifferences: number[] = [];

  for (const pair of allPairs) {
    const whiteIsMdp = pair.whiteEntity.entityScore > currentBracketScore;
    const blackIsMdp = pair.blackEntity.entityScore > currentBracketScore;

    if (whiteIsMdp !== blackIsMdp) {
      const mdpPlayer = whiteIsMdp ? pair.whiteEntity : pair.blackEntity;
      const residentPlayer = whiteIsMdp ? pair.blackEntity : pair.whiteEntity;

      const meetsCriterion = filteringCriterion(mdpPlayer, residentPlayer);

      if (meetsCriterion) {
        const scoreDifference = Math.abs(
          mdpPlayer.entityScore - residentPlayer.entityScore,
        );
        scoreDifferences.push(scoreDifference);
      }
    }
  }

  // Sort differences in descending order (largest difference first)
  const sortedScoreDifferences = scoreDifferences.sort(
    (firstDiff, secondDiff) => secondDiff - firstDiff,
  );

  return sortedScoreDifferences;
}

/**
 * Evaluates C18: Minimise score differences of MDPs who received a downfloat the previous round
 */
function evaluateC18MinimiseMdpScoreDiffPrev(
  pairingCandidate: PairingCandidate,
  context: EvaluationContext,
): number[] {
  const { currentBracketScore, roundNumber } = context;
  const prevRound = roundNumber - 1;
  return getMdpScoreDiffs(
    pairingCandidate,
    currentBracketScore,
    (mdp, _resident) => didDownfloat(mdp, prevRound),
  );
}

/**
 * Evaluates C19: Minimise score differences of MDP opponents who received an upfloat the previous round
 */
function evaluateC19MinimiseMdpOpponentScoreDiffPrev(
  pairingCandidate: PairingCandidate,
  context: EvaluationContext,
): number[] {
  const { currentBracketScore, roundNumber } = context;
  const prevRound = roundNumber - 1;
  return getMdpScoreDiffs(
    pairingCandidate,
    currentBracketScore,
    (_mdp, resident) => didUpfloat(resident, prevRound),
  );
}

/**
 * Evaluates C20: Minimise score differences of MDPs who received a downfloat two rounds before
 */
function evaluateC20MinimiseMdpScoreDiffPrev2(
  pairingCandidate: PairingCandidate,
  context: EvaluationContext,
): number[] {
  const { currentBracketScore, roundNumber } = context;
  const twoRoundsAgo = roundNumber - 2;
  return getMdpScoreDiffs(
    pairingCandidate,
    currentBracketScore,
    (mdp, _resident) => didDownfloat(mdp, twoRoundsAgo),
  );
}

/**
 * Evaluates C21: Minimise score differences of MDP opponents who received an upfloat two rounds before
 */
function evaluateC21MinimiseMdpOpponentScoreDiffPrev2(
  pairingCandidate: PairingCandidate,
  context: EvaluationContext,
): number[] {
  const { currentBracketScore, roundNumber } = context;
  const twoRoundsAgo = roundNumber - 2;
  return getMdpScoreDiffs(
    pairingCandidate,
    currentBracketScore,
    (_mdp, resident) => didUpfloat(resident, twoRoundsAgo),
  );
}

// ============================================================================
// Main Evaluation Aggregator
// ============================================================================

/**
 * Aggregates all quality criteria evaluations into a report
 * @param pairingCandidate - The pairing candidate to evaluate
 * @param context - Evaluation context
 * @returns QualityEvaluationReport containing all metrics
 */
export function evaluateQualityCriteria(
  pairingCandidate: PairingCandidate,
  context: EvaluationContext,
): QualityEvaluationReport {
  const qualityReport: QualityEvaluationReport = {
    c5MinimisePabScore: evaluateC5MinimisePabScore(pairingCandidate, context),
    c6MinimiseDownfloaters: evaluateC6MinimiseDownfloaters(
      pairingCandidate,
      context,
    ),
    c7MinimiseDownfloaterScores: evaluateC7MinimiseDownfloaterScores(
      pairingCandidate,
      context,
    ),
    c8FutureCriteriaCompliance: evaluateC8FutureCriteriaCompliance(
      pairingCandidate,
      context,
    ),
    c9MinimisePabUnplayed: evaluateC9MinimisePabUnplayed(
      pairingCandidate,
      context,
    ),
    c10MinimiseColourDiffViolation: evaluateC10MinimiseColourDiffViolation(
      pairingCandidate,
      context,
    ),
    c11MinimiseSameColourThreeTimes: evaluateC11MinimiseSameColourThreeTimes(
      pairingCandidate,
      context,
    ),
    c12MinimiseColourPrefViolation: evaluateC12MinimiseColourPrefViolation(
      pairingCandidate,
      context,
    ),
    c13MinimiseStrongColourPrefViolation:
      evaluateC13MinimiseStrongColourPrefViolation(pairingCandidate, context),
    c14MinimiseResidentDownfloaterPrev:
      evaluateC14MinimiseResidentDownfloaterPrev(pairingCandidate, context),
    c15MinimiseMdpOpponentUpfloatPrev:
      evaluateC15MinimiseMdpOpponentUpfloatPrev(pairingCandidate, context),
    c16MinimiseResidentDownfloaterPrev2:
      evaluateC16MinimiseResidentDownfloaterPrev2(pairingCandidate, context),
    c17MinimiseMdpOpponentUpfloatPrev2:
      evaluateC17MinimiseMdpOpponentUpfloatPrev2(pairingCandidate, context),
    c18MinimiseMdpScoreDiffPrev: evaluateC18MinimiseMdpScoreDiffPrev(
      pairingCandidate,
      context,
    ),
    c19MinimiseMdpOpponentScoreDiffPrev:
      evaluateC19MinimiseMdpOpponentScoreDiffPrev(pairingCandidate, context),
    c20MinimiseMdpScoreDiffPrev2: evaluateC20MinimiseMdpScoreDiffPrev2(
      pairingCandidate,
      context,
    ),
    c21MinimiseMdpOpponentScoreDiffPrev2:
      evaluateC21MinimiseMdpOpponentScoreDiffPrev2(pairingCandidate, context),
  };

  return qualityReport;
}
