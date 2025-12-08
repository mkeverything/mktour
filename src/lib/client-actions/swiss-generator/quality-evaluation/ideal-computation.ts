/**
 * Theoretical ideal computation functions for quality criteria
 *
 * Contains:
 * - Helper functions for colour imbalance and float history
 * - computeIdeal* functions for C5-C21
 * - C8 future criteria compliance computation
 */

import {
  ChessColour,
  ChessTournamentEntity,
} from '@/lib/client-actions/common-generator';
import { compareNumeric } from '@/lib/client-actions/swiss-generator/ordering';
import { compareByScore } from '@/lib/client-actions/swiss-generator/ordering';
import type { EvaluationContext } from '@/lib/client-actions/swiss-generator/types';

import {
  IDEAL_C8_NO_COMPLICATIONS,
  IDEAL_EMPTY_ARRAY,
  IDEAL_ZERO_VIOLATIONS,
} from './types';
import type { CriterionValue } from './types';

// Forward declaration - these will be imported from evaluate.ts in index.ts
// to avoid circular dependency, we declare them here and they get injected
let calculateMinDownfloatersRef: (
  players: ChessTournamentEntity[],
  roundNumber: number,
  allowPab: boolean,
) => number;

let findOptimalDownfloaterScoresRef: (
  bracketPlayers: ChessTournamentEntity[],
  requiredDownfloaterCount: number,
  roundNumber: number,
  allowPab: boolean,
) => number[] | null;

/**
 * Injects dependencies to avoid circular imports
 * Called from index.ts after all modules are loaded
 */
export function injectIdealComputationDependencies(
  calculateMinDownfloaters: (
    players: ChessTournamentEntity[],
    roundNumber: number,
    allowPab: boolean,
  ) => number,
  findOptimalDownfloaterScores: (
    bracketPlayers: ChessTournamentEntity[],
    requiredDownfloaterCount: number,
    roundNumber: number,
    allowPab: boolean,
  ) => number[] | null,
): void {
  calculateMinDownfloatersRef = calculateMinDownfloaters;
  findOptimalDownfloaterScoresRef = findOptimalDownfloaterScores;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Helper to extract entity score from ChessTournamentEntity
 * @param entity - Tournament entity
 * @returns Entity's score
 */
function getEntityScore(entity: ChessTournamentEntity): number {
  return entity.entityScore;
}

/**
 * Generic helper to compute colour imbalance violations
 *
 * WHY: Many colour criteria follow the same pattern - count players wanting
 * white vs black, return imbalance.
 *
 * @param bracketPlayers - All players in bracket
 * @param wantsWhite - Predicate for players wanting white
 * @param wantsBlack - Predicate for players wanting black
 * @returns Imbalance (minimum violations)
 */
function computeColourImbalance(
  bracketPlayers: ChessTournamentEntity[],
  wantsWhite: (entity: ChessTournamentEntity) => boolean,
  wantsBlack: (entity: ChessTournamentEntity) => boolean,
): number {
  const playersWantingWhite = bracketPlayers.filter(wantsWhite).length;
  const playersWantingBlack = bracketPlayers.filter(wantsBlack).length;
  const imbalance = Math.abs(playersWantingWhite - playersWantingBlack);
  return imbalance;
}

/**
 * Generic helper to compute float history violations
 *
 * WHY: C14-C17 follow the same pattern - check if we have enough players
 * without recent float history.
 *
 * @param bracketPlayers - All players in bracket
 * @param requiredCount - Number of players needed (downfloaters or MDP count)
 * @param roundOffset - How many rounds ago to check (1 or 2)
 * @param floatCheck - Function to check if entity had float in round
 * @param currentBracketScore - Current bracket score
 * @param context - Evaluation context
 * @returns Unavoidable violations
 */
function computeFloatHistoryViolations(
  bracketPlayers: ChessTournamentEntity[],
  requiredCount: number,
  roundOffset: number,
  floatCheck: (entity: ChessTournamentEntity, roundNumber: number) => boolean,
  currentBracketScore: number,
  context: EvaluationContext,
): number {
  const { roundNumber } = context;
  const targetRound = roundNumber - roundOffset;

  const residents = bracketPlayers.filter(
    (entity) => entity.entityScore === currentBracketScore,
  );

  const residentsWithoutRecentFloat = residents.filter(
    (resident) => !floatCheck(resident, targetRound),
  );

  const unavoidableViolations = Math.max(
    0,
    requiredCount - residentsWithoutRecentFloat.length,
  );

  return unavoidableViolations;
}

/**
 * Checks if assigning a new colour to an entity would result in 3 consecutive games with the same colour.
 * @param entity - The entity to check
 * @param newColour - The new colour being assigned
 * @returns true if the entity would have the same colour 3 times in a row
 */
export function willHaveSameColourThreeTimes(
  entity: ChessTournamentEntity,
  newColour: ChessColour,
): boolean {
  const lastTwoGames = entity.previousGames.slice(-2);

  // If fewer than 2 games played, impossible to have 3 in a row
  if (lastTwoGames.length < 2) {
    return false;
  } else if (newColour === ChessColour.White) {
    return lastTwoGames.every((game) => game.white_id === entity.entityId);
  } else {
    return lastTwoGames.every((game) => game.black_id === entity.entityId);
  }
}

/**
 * Helper to check if a player downfloated in a specific round
 * @param entity - The player to check
 * @param roundNumber - The round number to check for downfloat
 * @returns true if the player downfloated in the specified round
 */
export function didDownfloat(
  entity: ChessTournamentEntity,
  roundNumber: number,
): boolean {
  const hadDownfloat = entity.floatHistory.some((historyItem) => {
    const isRoundMatch = historyItem.roundNumber === roundNumber;
    const isDownFloat = historyItem.floatType === 'down';
    return isRoundMatch && isDownFloat;
  });
  return hadDownfloat;
}

/**
 * Helper to check if a player upfloated in a specific round
 * @param entity - The player to check
 * @param roundNumber - The round number to check for upfloat
 * @returns true if the player upfloated in the specified round
 */
export function didUpfloat(
  entity: ChessTournamentEntity,
  roundNumber: number,
): boolean {
  const hadUpfloat = entity.floatHistory.some((historyItem) => {
    const isRoundMatch = historyItem.roundNumber === roundNumber;
    const isUpFloat = historyItem.floatType === 'up';
    return isRoundMatch && isUpFloat;
  });
  return hadUpfloat;
}

/**
 * Extracts resident entities from bracket players
 *
 * @param bracketPlayers - All players in bracket
 * @param currentBracketScore - Score of current bracket
 * @returns Resident entities
 */
function extractResidents(
  bracketPlayers: ChessTournamentEntity[],
  currentBracketScore: number,
): ChessTournamentEntity[] {
  return bracketPlayers.filter(
    (entity) => entity.entityScore === currentBracketScore,
  );
}

/**
 * Helper to compute optimal MDP score differences
 *
 * WHY: Optimal pairing minimizes score differences by pairing similar scores.
 * Sort both arrays and pair by index (lowest with lowest, etc.).
 *
 * @param mdps - MDPs to pair
 * @param residents - Residents to pair with
 * @returns Sorted score differences (descending), or IDEAL_EMPTY_ARRAY if no MDPs
 */
function computeOptimalMdpScoreDiffs(
  mdps: ChessTournamentEntity[],
  residents: ChessTournamentEntity[],
): readonly number[] {
  if (mdps.length === 0) {
    return IDEAL_EMPTY_ARRAY;
  }

  const pairableCount = Math.min(mdps.length, residents.length);

  const mdpScoresSorted = mdps.map(getEntityScore).sort(compareNumeric);
  const residentScoresSorted = residents
    .map(getEntityScore)
    .sort(compareNumeric);

  const scoreDiffs: number[] = [];

  for (let pairIndex = 0; pairIndex < pairableCount; pairIndex++) {
    const mdpScore = mdpScoresSorted[pairIndex];
    const residentScore = residentScoresSorted[pairIndex];
    const scoreDiff = Math.abs(mdpScore - residentScore);
    scoreDiffs.push(scoreDiff);
  }

  const sortedDescending = scoreDiffs.sort((firstDiff, secondDiff) =>
    compareNumeric(secondDiff, firstDiff),
  );

  return sortedDescending;
}

/**
 * Generic helper for C18-C21: Computes ideal MDP score differences with float history filtering
 *
 * WHY: C18-C21 follow the same pattern - filter either MDPs or residents by float history,
 * then compute optimal score differences.
 *
 * @param bracketPlayers - All players in bracket
 * @param roundOffset - How many rounds ago to check (1 or 2)
 * @param filterMdps - If true, filter MDPs; if false, filter residents
 * @param floatCheck - Float check function (didDownfloat or didUpfloat)
 * @param context - Evaluation context
 * @returns Theoretical ideal score differences
 */
function computeMdpScoreDiffsWithFloatHistory(
  bracketPlayers: ChessTournamentEntity[],
  roundOffset: number,
  filterMdps: boolean,
  floatCheck: (entity: ChessTournamentEntity, roundNumber: number) => boolean,
  context: EvaluationContext,
): readonly number[] {
  const { roundNumber, currentBracketScore } = context;
  const targetRound = roundNumber - roundOffset;

  const mdps = bracketPlayers.filter(
    (entity) => entity.entityScore > currentBracketScore,
  );

  const residents = extractResidents(bracketPlayers, currentBracketScore);

  if (filterMdps) {
    const filteredMdps = mdps.filter((mdp) => floatCheck(mdp, targetRound));
    return computeOptimalMdpScoreDiffs(filteredMdps, residents);
  } else {
    const filteredResidents = residents.filter((resident) =>
      floatCheck(resident, targetRound),
    );
    return computeOptimalMdpScoreDiffs(mdps, filteredResidents);
  }
}

// ============================================================================
// Theoretical Ideal Computation Functions
// ============================================================================

/**
 * Computes theoretical ideal C5 value (PAB score)
 *
 * WHY: In lowest bracket with downfloaters, PAB is unavoidable.
 * Theoretical ideal is assigning PAB to the lowest-scored player.
 *
 * @param bracketPlayers - All players in bracket
 * @param context - Evaluation context
 * @returns Theoretical ideal PAB score
 */
export function computeIdealC5PabScore(
  bracketPlayers: ChessTournamentEntity[],
  context: EvaluationContext,
): CriterionValue {
  const { scoregroupsByScore } = context;

  const isLowestBracket = scoregroupsByScore.length === 0;

  if (!isLowestBracket || bracketPlayers.length === 0) {
    return IDEAL_ZERO_VIOLATIONS;
  }

  // Lowest bracket - PAB goes to lowest-scored player
  const allScores = bracketPlayers.map(getEntityScore);
  const lowestScore = Math.min(...allScores);

  return lowestScore;
}

/**
 * Computes theoretical ideal C6 value (downfloaters count)
 *
 * WHY: Uses maximum matching to find minimum possible downfloaters
 * given C1, C2, C3 constraints.
 *
 * @param bracketPlayers - All players in bracket
 * @param context - Evaluation context
 * @returns Theoretical ideal downfloaters count
 */
export function computeIdealC6DownfloatersCount(
  bracketPlayers: ChessTournamentEntity[],
  context: EvaluationContext,
): CriterionValue {
  const { roundNumber } = context;

  const allowPab = false;
  const theoreticalMinimum = calculateMinDownfloatersRef(
    bracketPlayers,
    roundNumber,
    allowPab,
  );

  return theoreticalMinimum;
}

/**
 * Computes theoretical ideal C7 value (downfloater scores)
 *
 * WHY: If N downfloaters are required, theoretical ideal is the N lowest scores.
 *
 * @param bracketPlayers - All players in bracket
 * @param idealDownfloatersCount - Ideal downfloaters count from C6
 * @returns Theoretical ideal downfloater scores (sorted descending)
 */
export function computeIdealC7DownfloaterScores(
  bracketPlayers: ChessTournamentEntity[],
  idealDownfloatersCount: number,
): readonly number[] {
  if (idealDownfloatersCount === 0) {
    return IDEAL_EMPTY_ARRAY;
  }

  const allScoresSortedAscending = bracketPlayers
    .map(getEntityScore)
    .sort(compareNumeric);

  const lowestScores = allScoresSortedAscending.slice(
    0,
    idealDownfloatersCount,
  );

  const sortedDescending = lowestScores.sort((firstScore, secondScore) =>
    compareNumeric(secondScore, firstScore),
  );

  return sortedDescending;
}

/**
 * Computes theoretical ideal C8 value (future criteria compliance)
 *
 * WHY: C8 evaluates impact on the NEXT bracket. The ideal depends on:
 * 1. How many downfloaters we must send from current bracket (C6 ideal)
 * 2. Which players become downfloaters (C7 ideal - lowest scores)
 * 3. How those combine with the next scoregroup
 *
 * The ideal C8 is computed by simulating what happens when we send the
 * ideal downfloaters (from C6/C7) to the next bracket.
 *
 * @param bracketPlayers - All players in bracket
 * @param context - Evaluation context
 * @returns Ideal future criteria compliance
 */
export function computeIdealC8FutureCriteriaCompliance(
  bracketPlayers: ChessTournamentEntity[],
  context: EvaluationContext,
): CriterionValue {
  const { roundNumber, scoregroupsByScore } = context;

  // Check if there's a future bracket to evaluate
  const hasFutureBracket = scoregroupsByScore.length > 0;
  if (!hasFutureBracket) {
    // No future bracket - ideal is no complications
    return IDEAL_C8_NO_COMPLICATIONS;
  }

  // Step 1: Get ideal downfloater count for current bracket (from C6)
  const currentBracketIdealDownfloaterCount = computeIdealC6DownfloatersCount(
    bracketPlayers,
    context,
  ) as number;

  if (currentBracketIdealDownfloaterCount === 0) {
    // No downfloaters from current bracket - ideal future is no complications
    return IDEAL_C8_NO_COMPLICATIONS;
  }

  // Step 2: Find the ideal downfloaters (lowest scored players per C7)
  // Sorting ascending puts lowest scores first
  const playersSortedByScoreAscending = bracketPlayers.toSorted(compareByScore);
  const idealDownfloatersFromCurrentBracket =
    playersSortedByScoreAscending.slice(0, currentBracketIdealDownfloaterCount);

  // Step 3: Form the next bracket by combining:
  // - Next scoregroup (residents of next bracket)
  // - Ideal downfloaters from current bracket (MDPs for next bracket)
  const nextScoreGroup = scoregroupsByScore[0][1];
  const nextBracketAllPlayers = [
    ...nextScoreGroup,
    ...idealDownfloatersFromCurrentBracket,
  ];

  // Step 4: Compute minimum downfloaters needed in the next bracket
  // PAB is only allowed if the next bracket is the last one
  const isNextBracketLast = scoregroupsByScore.length === 1;
  const nextBracketMinDownfloaterCount = calculateMinDownfloatersRef(
    nextBracketAllPlayers,
    roundNumber,
    isNextBracketLast,
  );

  if (nextBracketMinDownfloaterCount === 0) {
    // Next bracket can pair everyone perfectly - ideal future
    return IDEAL_C8_NO_COMPLICATIONS;
  }

  // Step 5: Find optimal downfloater set for the next bracket
  // This gives us the scores of players who would become future downfloaters
  const optimalNextBracketDownfloaterScores = findOptimalDownfloaterScoresRef(
    nextBracketAllPlayers,
    nextBracketMinDownfloaterCount,
    roundNumber,
    isNextBracketLast,
  );

  if (optimalNextBracketDownfloaterScores === null) {
    throw new Error(
      `Failed to find optimal downfloater set for C8 ideal computation. ` +
        `Expected ${nextBracketMinDownfloaterCount} downfloaters from ${nextBracketAllPlayers.length} players.`,
    );
  }

  // Step 6: Compute PAB score if next bracket is last
  // PAB goes to lowest-scored downfloater (first in sorted array)
  const futurePabScore = isNextBracketLast
    ? optimalNextBracketDownfloaterScores[0]
    : 0;

  return {
    pabScore: futurePabScore,
    downfloaterCount: nextBracketMinDownfloaterCount,
    downfloaterScores: optimalNextBracketDownfloaterScores,
  };
}

/**
 * Computes theoretical ideal C9 value (PAB unplayed games)
 *
 * WHY: If PAB is unavoidable (lowest bracket with downfloaters), theoretical ideal
 * is assigning PAB to the player with fewest unplayed games.
 *
 * @param bracketPlayers - All players in bracket
 * @param context - Evaluation context
 * @returns Theoretical ideal PAB unplayed games count
 */
export function computeIdealC9PabUnplayed(
  bracketPlayers: ChessTournamentEntity[],
  context: EvaluationContext,
): CriterionValue {
  const { scoregroupsByScore, roundNumber } = context;

  const isLowestBracket = scoregroupsByScore.length === 0;

  if (!isLowestBracket || bracketPlayers.length === 0) {
    return IDEAL_ZERO_VIOLATIONS;
  }

  // Lowest bracket - PAB needed for odd bracket, find minimum unplayed games
  const expectedGamesCount = roundNumber - 1;
  const unplayedGamesCounts = bracketPlayers.map(
    (entity) => expectedGamesCount - entity.previousGames.length,
  );

  const minimumUnplayedGames = Math.min(...unplayedGamesCounts);

  return minimumUnplayedGames;
}

/**
 * Computes theoretical ideal C10 value (colour difference violations)
 *
 * WHY: Players with colourIndex = +2 MUST get black (else >2 violation).
 * Players with colourIndex = -2 MUST get white (else <-2 violation).
 *
 * @param bracketPlayers - All players in bracket
 * @returns Theoretical ideal colour diff violations count
 */
export function computeIdealC10ColourDiffViolation(
  bracketPlayers: ChessTournamentEntity[],
): CriterionValue {
  return computeColourImbalance(
    bracketPlayers,
    (entity) => entity.colourIndex === -2,
    (entity) => entity.colourIndex === 2,
  );
}

/**
 * Computes theoretical ideal C11 value (same colour 3 times)
 *
 * WHY: Players with 2 consecutive whites MUST get black next.
 * Players with 2 consecutive blacks MUST get white next.
 *
 * @param bracketPlayers - All players in bracket
 * @returns Theoretical ideal same colour 3 times violations count
 */
export function computeIdealC11SameColourThreeTimes(
  bracketPlayers: ChessTournamentEntity[],
): CriterionValue {
  return computeColourImbalance(
    bracketPlayers,
    (entity) => willHaveSameColourThreeTimes(entity, ChessColour.Black),
    (entity) => willHaveSameColourThreeTimes(entity, ChessColour.White),
  );
}

/**
 * Computes theoretical ideal C12 value (colour preference violations)
 *
 * WHY: Players prefer colours based on colourIndex sign.
 * colourIndex < 0 prefers white, colourIndex > 0 prefers black.
 *
 * @param bracketPlayers - All players in bracket
 * @returns Theoretical ideal colour pref violations count
 */
export function computeIdealC12ColourPrefViolation(
  bracketPlayers: ChessTournamentEntity[],
): CriterionValue {
  return computeColourImbalance(
    bracketPlayers,
    (entity) => entity.colourIndex < 0,
    (entity) => entity.colourIndex > 0,
  );
}

/**
 * Computes theoretical ideal C13 value (strong colour preference violations)
 *
 * WHY: Players with |colourIndex| >= 1 have strong preference (alternating pattern).
 * colourIndex <= -1 strongly prefers white, colourIndex >= 1 strongly prefers black.
 *
 * @param bracketPlayers - All players in bracket
 * @returns Theoretical ideal strong colour pref violations count
 */
export function computeIdealC13StrongColourPrefViolation(
  bracketPlayers: ChessTournamentEntity[],
): CriterionValue {
  return computeColourImbalance(
    bracketPlayers,
    (entity) => entity.colourIndex <= -1,
    (entity) => entity.colourIndex >= 1,
  );
}

/**
 * Computes theoretical ideal C14 value (resident downfloaters from previous round)
 *
 * WHY: If we need N downfloaters and have M residents without recent downfloat,
 * minimum violations = max(0, N - M).
 *
 * @param bracketPlayers - All players in bracket
 * @param idealDownfloatersCount - Ideal downfloaters count from C6
 * @param context - Evaluation context
 * @returns Theoretical ideal C14 violations count
 */
export function computeIdealC14ResidentDownfloaterPrev(
  bracketPlayers: ChessTournamentEntity[],
  idealDownfloatersCount: number,
  context: EvaluationContext,
): CriterionValue {
  return computeFloatHistoryViolations(
    bracketPlayers,
    idealDownfloatersCount,
    1,
    didDownfloat,
    context.currentBracketScore,
    context,
  );
}

/**
 * Computes theoretical ideal C15 value (MDP opponents with upfloat from previous round)
 *
 * WHY: MDPs must be paired with residents. If we have M MDPs and N residents without
 * recent upfloat, minimum violations = max(0, M - N).
 *
 * @param bracketPlayers - All players in bracket
 * @param mdpCount - Number of MDPs in bracket
 * @param context - Evaluation context
 * @returns Theoretical ideal C15 violations count
 */
export function computeIdealC15MdpOpponentUpfloatPrev(
  bracketPlayers: ChessTournamentEntity[],
  mdpCount: number,
  context: EvaluationContext,
): CriterionValue {
  return computeFloatHistoryViolations(
    bracketPlayers,
    mdpCount,
    1,
    didUpfloat,
    context.currentBracketScore,
    context,
  );
}

/**
 * Computes theoretical ideal C16 value (resident downfloaters from 2 rounds ago)
 *
 * @param bracketPlayers - All players in bracket
 * @param idealDownfloatersCount - Ideal downfloaters count from C6
 * @param context - Evaluation context
 * @returns Theoretical ideal C16 violations count
 */
export function computeIdealC16ResidentDownfloaterPrev2(
  bracketPlayers: ChessTournamentEntity[],
  idealDownfloatersCount: number,
  context: EvaluationContext,
): CriterionValue {
  return computeFloatHistoryViolations(
    bracketPlayers,
    idealDownfloatersCount,
    2,
    didDownfloat,
    context.currentBracketScore,
    context,
  );
}

/**
 * Computes theoretical ideal C17 value (MDP opponents with upfloat from 2 rounds ago)
 *
 * @param bracketPlayers - All players in bracket
 * @param mdpCount - Number of MDPs in bracket
 * @param context - Evaluation context
 * @returns Theoretical ideal C17 violations count
 */
export function computeIdealC17MdpOpponentUpfloatPrev2(
  bracketPlayers: ChessTournamentEntity[],
  mdpCount: number,
  context: EvaluationContext,
): CriterionValue {
  return computeFloatHistoryViolations(
    bracketPlayers,
    mdpCount,
    2,
    didUpfloat,
    context.currentBracketScore,
    context,
  );
}

/**
 * Computes theoretical ideal C18 value (MDP score diffs, downfloat 1 round ago)
 */
export function computeIdealC18MdpScoreDiffPrev(
  bracketPlayers: ChessTournamentEntity[],
  context: EvaluationContext,
): CriterionValue {
  return computeMdpScoreDiffsWithFloatHistory(
    bracketPlayers,
    1,
    true,
    didDownfloat,
    context,
  );
}

/**
 * Computes theoretical ideal C19 value (MDP opponent score diffs, upfloat 1 round ago)
 */
export function computeIdealC19MdpOpponentScoreDiffPrev(
  bracketPlayers: ChessTournamentEntity[],
  context: EvaluationContext,
): CriterionValue {
  return computeMdpScoreDiffsWithFloatHistory(
    bracketPlayers,
    1,
    false,
    didUpfloat,
    context,
  );
}

/**
 * Computes theoretical ideal C20 value (MDP score diffs, downfloat 2 rounds ago)
 */
export function computeIdealC20MdpScoreDiffPrev2(
  bracketPlayers: ChessTournamentEntity[],
  context: EvaluationContext,
): CriterionValue {
  return computeMdpScoreDiffsWithFloatHistory(
    bracketPlayers,
    2,
    true,
    didDownfloat,
    context,
  );
}

/**
 * Computes theoretical ideal C21 value (MDP opponent score diffs, upfloat 2 rounds ago)
 */
export function computeIdealC21MdpOpponentScoreDiffPrev2(
  bracketPlayers: ChessTournamentEntity[],
  context: EvaluationContext,
): CriterionValue {
  return computeMdpScoreDiffsWithFloatHistory(
    bracketPlayers,
    2,
    false,
    didUpfloat,
    context,
  );
}
