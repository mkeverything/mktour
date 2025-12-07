import {
  ChessColour,
  ChessTournamentEntity,
  ColouredEntitiesPair,
} from '@/lib/client-actions/common-generator';
import { generateCombinations } from '@/lib/client-actions/swiss-generator/alterations';
import { maximumMatching } from '@/lib/client-actions/swiss-generator/matching';
import {
  compareByScore,
  compareNumeric,
} from '@/lib/client-actions/swiss-generator/ordering';
import { FloatType } from '@/types/tournaments';
import Graph from 'graphology';
import {
  AbsoluteEvaluationReport,
  BasicAbsoluteEvaluationReport,
  EvaluationContext,
  FutureCriteriaCompliance,
  PairingCandidate,
  QualityEvaluationReport,
} from './types';

// ============================================================================
// Quality Criterion Interface
// ============================================================================

/** Possible value types for quality criteria */
export type CriterionValue =
  | number
  | readonly number[]
  | FutureCriteriaCompliance;

/** Cached ideal values for a bracket - maps criterion ID to computed ideal */
export type CachedBracketIdeals = Map<
  keyof QualityEvaluationReport,
  CriterionValue
>;

/**
 * Interface for a FIDE quality criterion
 *
 * Each criterion implements isPerfect and compare with union type parameters.
 * Internal type guards handle the actual type-specific comparison.
 */
export interface QualityCriterion {
  readonly id: keyof QualityEvaluationReport;

  /** Computes theoretical ideal value for this bracket (cached) */
  computeIdeal(
    bracketPlayers: ChessTournamentEntity[],
    context: EvaluationContext,
  ): CriterionValue;

  /** Checks if value equals ideal - uses internal type guards */
  isPerfect(value: CriterionValue, ideal: CriterionValue): boolean;

  /** Compares two values - negative if first better, positive if second better */
  compare(first: CriterionValue, second: CriterionValue): number;
}

/**
 * Checks if a criterion is perfect for the given report
 * Delegates to criterion.isPerfect()
 */
export function checkCriterionPerfect(
  criterion: QualityCriterion,
  report: QualityEvaluationReport,
  cache: CachedBracketIdeals,
): boolean {
  const value = report[criterion.id];
  const ideal = cache.get(criterion.id);
  if (ideal === undefined) {
    throw new Error(`No cached ideal for criterion ${criterion.id}`);
  }
  return criterion.isPerfect(value, ideal);
}

/**
 * Compares two reports for a specific criterion
 * Delegates to criterion.compare()
 */
export function compareCriterion(
  criterion: QualityCriterion,
  firstReport: QualityEvaluationReport,
  secondReport: QualityEvaluationReport,
): number {
  const firstValue = firstReport[criterion.id];
  const secondValue = secondReport[criterion.id];
  return criterion.compare(firstValue, secondValue);
}

// ============================================================================
// Quality Criteria Objects (C5-C21)
// ============================================================================

// ----------------------------------------------------------------------------
// Constants for Theoretical Ideals
// ----------------------------------------------------------------------------

/** Theoretical ideal for criteria with no violations */
const IDEAL_ZERO_VIOLATIONS = 0;

/** Theoretical ideal for array-based criteria with no entries */
const IDEAL_EMPTY_ARRAY: readonly number[] = [];

// ----------------------------------------------------------------------------
// Helper Functions for Criterion Evaluation
// ----------------------------------------------------------------------------

/**
 * Helper to extract entity score from ChessTournamentEntity
 * @param entity - Tournament entity
 * @returns Entity's score
 */
function getEntityScore(entity: ChessTournamentEntity): number {
  return entity.entityScore;
}

// ----------------------------------------------------------------------------
// Theoretical Ideal Computation Helpers
// ----------------------------------------------------------------------------

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

// ----------------------------------------------------------------------------
// Theoretical Ideal Computation Functions
// ----------------------------------------------------------------------------

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
function computeIdealC5PabScore(
  bracketPlayers: ChessTournamentEntity[],
  context: EvaluationContext,
): number {
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
function computeIdealC6DownfloatersCount(
  bracketPlayers: ChessTournamentEntity[],
  context: EvaluationContext,
): number {
  const { roundNumber } = context;

  const allowPab = false;
  const theoreticalMinimum = calculateMinDownfloaters(
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
function computeIdealC7DownfloaterScores(
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
 * Computes theoretical ideal C9 value (PAB unplayed games)
 *
 * WHY: If PAB is unavoidable (lowest bracket with downfloaters), theoretical ideal
 * is assigning PAB to the player with fewest unplayed games.
 *
 * @param bracketPlayers - All players in bracket
 * @param context - Evaluation context
 * @returns Theoretical ideal PAB unplayed games count
 */
function computeIdealC9PabUnplayed(
  bracketPlayers: ChessTournamentEntity[],
  context: EvaluationContext,
): number {
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
function computeIdealC10ColourDiffViolation(
  bracketPlayers: ChessTournamentEntity[],
): number {
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
function computeIdealC11SameColourThreeTimes(
  bracketPlayers: ChessTournamentEntity[],
): number {
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
function computeIdealC12ColourPrefViolation(
  bracketPlayers: ChessTournamentEntity[],
): number {
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
function computeIdealC13StrongColourPrefViolation(
  bracketPlayers: ChessTournamentEntity[],
): number {
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
function computeIdealC14ResidentDownfloaterPrev(
  bracketPlayers: ChessTournamentEntity[],
  idealDownfloatersCount: number,
  context: EvaluationContext,
): number {
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
function computeIdealC15MdpOpponentUpfloatPrev(
  bracketPlayers: ChessTournamentEntity[],
  mdpCount: number,
  context: EvaluationContext,
): number {
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
function computeIdealC16ResidentDownfloaterPrev2(
  bracketPlayers: ChessTournamentEntity[],
  idealDownfloatersCount: number,
  context: EvaluationContext,
): number {
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
function computeIdealC17MdpOpponentUpfloatPrev2(
  bracketPlayers: ChessTournamentEntity[],
  mdpCount: number,
  context: EvaluationContext,
): number {
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

/**
 * Computes theoretical ideal C18 value (MDP score diffs, downfloat 1 round ago)
 */
function computeIdealC18MdpScoreDiffPrev(
  bracketPlayers: ChessTournamentEntity[],
  context: EvaluationContext,
): readonly number[] {
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
function computeIdealC19MdpOpponentScoreDiffPrev(
  bracketPlayers: ChessTournamentEntity[],
  context: EvaluationContext,
): readonly number[] {
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
function computeIdealC20MdpScoreDiffPrev2(
  bracketPlayers: ChessTournamentEntity[],
  context: EvaluationContext,
): readonly number[] {
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
function computeIdealC21MdpOpponentScoreDiffPrev2(
  bracketPlayers: ChessTournamentEntity[],
  context: EvaluationContext,
): readonly number[] {
  return computeMdpScoreDiffsWithFloatHistory(
    bracketPlayers,
    2,
    false,
    didUpfloat,
    context,
  );
}

// ----------------------------------------------------------------------------
// isPerfect and compare Functions (with type guards for CriterionValue)
// ----------------------------------------------------------------------------

/**
 * Checks if a numeric criterion value equals its ideal
 * Type guard ensures both values are numbers
 */
function isNumericPerfect(
  value: CriterionValue,
  ideal: CriterionValue,
): boolean {
  if (typeof value !== 'number' || typeof ideal !== 'number') {
    throw new Error('isNumericPerfect: expected numeric values');
  }
  return value === ideal;
}

/**
 * Compares two numeric criterion values
 * Type guard ensures both values are numbers
 */
function compareNumericValues(
  first: CriterionValue,
  second: CriterionValue,
): number {
  if (typeof first !== 'number' || typeof second !== 'number') {
    throw new Error('compareNumericValues: expected numeric values');
  }
  return first - second;
}

/**
 * Checks if an array criterion value equals its ideal
 * Type guard ensures both values are arrays
 */
function isArrayPerfect(value: CriterionValue, ideal: CriterionValue): boolean {
  if (!Array.isArray(value) || !Array.isArray(ideal)) {
    throw new Error('isArrayPerfect: expected array values');
  }
  if (value.length !== ideal.length) {
    return false;
  }
  return value.every((element, index) => element === ideal[index]);
}

/**
 * Compares two array criterion values lexicographically
 * Type guard ensures both values are arrays
 */
function compareArrayValues(
  first: CriterionValue,
  second: CriterionValue,
): number {
  if (!Array.isArray(first) || !Array.isArray(second)) {
    throw new Error('compareArrayValues: expected array values');
  }
  return compareLexicographically(first, second);
}

// ----------------------------------------------------------------------------
// C8 Future Criteria Compliance - Helper Functions
// ----------------------------------------------------------------------------

/** Ideal C8: No future complications (no PAB needed, no downfloaters required) */
const IDEAL_C8_NO_COMPLICATIONS: FutureCriteriaCompliance = {
  pabScore: 0,
  downfloaterCount: 0,
  downfloaterScores: [],
};

/** Type guard for FutureCriteriaCompliance */
function isFutureCriteriaCompliance(
  value: CriterionValue,
): value is FutureCriteriaCompliance {
  return typeof value === 'object' && !Array.isArray(value);
}

/**
 * Checks if a C8 criterion value equals its ideal
 * Type guard ensures both values are FutureCriteriaCompliance
 */
function isC8Perfect(value: CriterionValue, ideal: CriterionValue): boolean {
  if (
    !isFutureCriteriaCompliance(value) ||
    !isFutureCriteriaCompliance(ideal)
  ) {
    throw new Error('isC8Perfect: expected FutureCriteriaCompliance values');
  }

  if (value.pabScore !== ideal.pabScore) {
    return false;
  }

  if (value.downfloaterCount !== ideal.downfloaterCount) {
    return false;
  }

  return isArrayPerfect(value.downfloaterScores, ideal.downfloaterScores);
}

/**
 * Compares two C8 criterion values
 * Type guard ensures both values are FutureCriteriaCompliance
 *
 * Comparison order per FIDE: pabScore → downfloaterCount → downfloaterScores
 */
function compareC8Values(
  first: CriterionValue,
  second: CriterionValue,
): number {
  if (
    !isFutureCriteriaCompliance(first) ||
    !isFutureCriteriaCompliance(second)
  ) {
    throw new Error(
      'compareC8Values: expected FutureCriteriaCompliance values',
    );
  }

  const pabScoreDiff = first.pabScore - second.pabScore;
  if (pabScoreDiff !== 0) {
    return pabScoreDiff;
  }

  const countDiff = first.downfloaterCount - second.downfloaterCount;
  if (countDiff !== 0) {
    return countDiff;
  }

  return compareArrayValues(first.downfloaterScores, second.downfloaterScores);
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
function computeIdealC8FutureCriteriaCompliance(
  bracketPlayers: ChessTournamentEntity[],
  context: EvaluationContext,
): FutureCriteriaCompliance {
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
  );

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
  const nextBracketMinDownfloaterCount = calculateMinDownfloaters(
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
  const optimalNextBracketDownfloaterScores = findOptimalDownfloaterScores(
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

// ----------------------------------------------------------------------------
// Criterion Objects (C5-C21)
// ----------------------------------------------------------------------------

/**
 * C5: Minimise PAB score
 * Ideal: Lowest score if PAB needed, else 0
 */
export const C5_MINIMISE_PAB_SCORE: QualityCriterion = {
  id: 'c5MinimisePabScore',
  computeIdeal: computeIdealC5PabScore,
  isPerfect: isNumericPerfect,
  compare: compareNumericValues,
};

/**
 * C6: Minimise downfloaters
 * Ideal: Theoretical minimum via maximum matching
 */
export const C6_MINIMISE_DOWNFLOATERS: QualityCriterion = {
  id: 'c6MinimiseDownfloaters',
  computeIdeal: computeIdealC6DownfloatersCount,
  isPerfect: isNumericPerfect,
  compare: compareNumericValues,
};

/**
 * C7: Minimise downfloater scores
 * Ideal: N lowest scores (where N = C6 ideal)
 */
export const C7_MINIMISE_DOWNFLOATER_SCORES: QualityCriterion = {
  id: 'c7MinimiseDownfloaterScores',
  computeIdeal(
    bracketPlayers: ChessTournamentEntity[],
    context: EvaluationContext,
  ) {
    const c6Ideal = computeIdealC6DownfloatersCount(bracketPlayers, context);
    return [...computeIdealC7DownfloaterScores(bracketPlayers, c6Ideal)];
  },
  isPerfect: isArrayPerfect,
  compare: compareArrayValues,
};

/**
 * C8: Future criteria compliance
 * Ideal: Best achievable future compliance given ideal downfloaters
 */
export const C8_FUTURE_CRITERIA_COMPLIANCE: QualityCriterion = {
  id: 'c8FutureCriteriaCompliance',
  computeIdeal: computeIdealC8FutureCriteriaCompliance,
  isPerfect: isC8Perfect,
  compare: compareC8Values,
};

/** C9: Minimise PAB unplayed games */
export const C9_MINIMISE_PAB_UNPLAYED: QualityCriterion = {
  id: 'c9MinimisePabUnplayed',
  computeIdeal: computeIdealC9PabUnplayed,
  isPerfect: isNumericPerfect,
  compare: compareNumericValues,
};

/** C10: Minimise colour difference violations */
export const C10_MINIMISE_COLOUR_DIFF_VIOLATION: QualityCriterion = {
  id: 'c10MinimiseColourDiffViolation',
  computeIdeal: computeIdealC10ColourDiffViolation,
  isPerfect: isNumericPerfect,
  compare: compareNumericValues,
};

/** C11: Minimise same colour three times violations */
export const C11_MINIMISE_SAME_COLOUR_THREE_TIMES: QualityCriterion = {
  id: 'c11MinimiseSameColourThreeTimes',
  computeIdeal: computeIdealC11SameColourThreeTimes,
  isPerfect: isNumericPerfect,
  compare: compareNumericValues,
};

/** C12: Minimise colour preference violations */
export const C12_MINIMISE_COLOUR_PREF_VIOLATION: QualityCriterion = {
  id: 'c12MinimiseColourPrefViolation',
  computeIdeal: computeIdealC12ColourPrefViolation,
  isPerfect: isNumericPerfect,
  compare: compareNumericValues,
};

/** C13: Minimise strong colour preference violations */
export const C13_MINIMISE_STRONG_COLOUR_PREF_VIOLATION: QualityCriterion = {
  id: 'c13MinimiseStrongColourPrefViolation',
  computeIdeal: computeIdealC13StrongColourPrefViolation,
  isPerfect: isNumericPerfect,
  compare: compareNumericValues,
};

/** C14: Minimise resident downfloaters from previous round */
export const C14_MINIMISE_RESIDENT_DOWNFLOATER_PREV: QualityCriterion = {
  id: 'c14MinimiseResidentDownfloaterPrev',
  computeIdeal(
    bracketPlayers: ChessTournamentEntity[],
    context: EvaluationContext,
  ) {
    const c6Ideal = computeIdealC6DownfloatersCount(bracketPlayers, context);
    return computeIdealC14ResidentDownfloaterPrev(
      bracketPlayers,
      c6Ideal,
      context,
    );
  },
  isPerfect: isNumericPerfect,
  compare: compareNumericValues,
};

/** C15: Minimise MDP opponent upfloats from previous round */
export const C15_MINIMISE_MDP_OPPONENT_UPFLOAT_PREV: QualityCriterion = {
  id: 'c15MinimiseMdpOpponentUpfloatPrev',
  computeIdeal(
    bracketPlayers: ChessTournamentEntity[],
    context: EvaluationContext,
  ) {
    const mdpCount = bracketPlayers.filter(
      (entity) => entity.entityScore > context.currentBracketScore,
    ).length;
    return computeIdealC15MdpOpponentUpfloatPrev(
      bracketPlayers,
      mdpCount,
      context,
    );
  },
  isPerfect: isNumericPerfect,
  compare: compareNumericValues,
};

/** C16: Minimise resident downfloaters from 2 rounds ago */
export const C16_MINIMISE_RESIDENT_DOWNFLOATER_PREV2: QualityCriterion = {
  id: 'c16MinimiseResidentDownfloaterPrev2',
  computeIdeal(
    bracketPlayers: ChessTournamentEntity[],
    context: EvaluationContext,
  ) {
    const c6Ideal = computeIdealC6DownfloatersCount(bracketPlayers, context);
    return computeIdealC16ResidentDownfloaterPrev2(
      bracketPlayers,
      c6Ideal,
      context,
    );
  },
  isPerfect: isNumericPerfect,
  compare: compareNumericValues,
};

/** C17: Minimise MDP opponent upfloats from 2 rounds ago */
export const C17_MINIMISE_MDP_OPPONENT_UPFLOAT_PREV2: QualityCriterion = {
  id: 'c17MinimiseMdpOpponentUpfloatPrev2',
  computeIdeal(
    bracketPlayers: ChessTournamentEntity[],
    context: EvaluationContext,
  ) {
    const mdpCount = bracketPlayers.filter(
      (entity) => entity.entityScore > context.currentBracketScore,
    ).length;
    return computeIdealC17MdpOpponentUpfloatPrev2(
      bracketPlayers,
      mdpCount,
      context,
    );
  },
  isPerfect: isNumericPerfect,
  compare: compareNumericValues,
};

/** C18: Minimise MDP score differences (downfloat 1 round ago) */
export const C18_MINIMISE_MDP_SCORE_DIFF_PREV: QualityCriterion = {
  id: 'c18MinimiseMdpScoreDiffPrev',
  computeIdeal(
    bracketPlayers: ChessTournamentEntity[],
    context: EvaluationContext,
  ) {
    return [...computeIdealC18MdpScoreDiffPrev(bracketPlayers, context)];
  },
  isPerfect: isArrayPerfect,
  compare: compareArrayValues,
};

/** C19: Minimise MDP opponent score differences (upfloat 1 round ago) */
export const C19_MINIMISE_MDP_OPPONENT_SCORE_DIFF_PREV: QualityCriterion = {
  id: 'c19MinimiseMdpOpponentScoreDiffPrev',
  computeIdeal(
    bracketPlayers: ChessTournamentEntity[],
    context: EvaluationContext,
  ) {
    return [
      ...computeIdealC19MdpOpponentScoreDiffPrev(bracketPlayers, context),
    ];
  },
  isPerfect: isArrayPerfect,
  compare: compareArrayValues,
};

/** C20: Minimise MDP score differences (downfloat 2 rounds ago) */
export const C20_MINIMISE_MDP_SCORE_DIFF_PREV2: QualityCriterion = {
  id: 'c20MinimiseMdpScoreDiffPrev2',
  computeIdeal(
    bracketPlayers: ChessTournamentEntity[],
    context: EvaluationContext,
  ) {
    return [...computeIdealC20MdpScoreDiffPrev2(bracketPlayers, context)];
  },
  isPerfect: isArrayPerfect,
  compare: compareArrayValues,
};

/** C21: Minimise MDP opponent score differences (upfloat 2 rounds ago) */
export const C21_MINIMISE_MDP_OPPONENT_SCORE_DIFF_PREV2: QualityCriterion = {
  id: 'c21MinimiseMdpOpponentScoreDiffPrev2',
  computeIdeal(
    bracketPlayers: ChessTournamentEntity[],
    context: EvaluationContext,
  ) {
    return [
      ...computeIdealC21MdpOpponentScoreDiffPrev2(bracketPlayers, context),
    ];
  },
  isPerfect: isArrayPerfect,
  compare: compareArrayValues,
};

// ----------------------------------------------------------------------------
// Quality Criteria Array and Aggregate Functions
// ----------------------------------------------------------------------------

/**
 * All quality criteria in FIDE priority order (C5-C21)
 *
 * WHY array order matters: FIDE Dutch system evaluates criteria lexicographically.
 * A candidate with better C5 always beats one with worse C5, regardless of C6-C21.
 */
export const QUALITY_CRITERIA: readonly QualityCriterion[] = [
  C5_MINIMISE_PAB_SCORE,
  C6_MINIMISE_DOWNFLOATERS,
  C7_MINIMISE_DOWNFLOATER_SCORES,
  C8_FUTURE_CRITERIA_COMPLIANCE,
  C9_MINIMISE_PAB_UNPLAYED,
  C10_MINIMISE_COLOUR_DIFF_VIOLATION,
  C11_MINIMISE_SAME_COLOUR_THREE_TIMES,
  C12_MINIMISE_COLOUR_PREF_VIOLATION,
  C13_MINIMISE_STRONG_COLOUR_PREF_VIOLATION,
  C14_MINIMISE_RESIDENT_DOWNFLOATER_PREV,
  C15_MINIMISE_MDP_OPPONENT_UPFLOAT_PREV,
  C16_MINIMISE_RESIDENT_DOWNFLOATER_PREV2,
  C17_MINIMISE_MDP_OPPONENT_UPFLOAT_PREV2,
  C18_MINIMISE_MDP_SCORE_DIFF_PREV,
  C19_MINIMISE_MDP_OPPONENT_SCORE_DIFF_PREV,
  C20_MINIMISE_MDP_SCORE_DIFF_PREV2,
  C21_MINIMISE_MDP_OPPONENT_SCORE_DIFF_PREV2,
];

/**
 * Computes and caches all bracket ideals for quality criteria
 *
 * WHY cache: Ideal values depend only on bracket composition, not candidate.
 * Computing once per bracket avoids redundant work across all candidates.
 *
 * @param bracketPlayers - All players in the bracket
 * @param context - Evaluation context (round, scoregroups)
 * @returns Map of criterion ID to computed ideal value
 */
export function computeAllBracketIdeals(
  bracketPlayers: ChessTournamentEntity[],
  context: EvaluationContext,
): CachedBracketIdeals {
  const cache: CachedBracketIdeals = new Map();

  for (const criterion of QUALITY_CRITERIA) {
    const ideal = criterion.computeIdeal(bracketPlayers, context);
    cache.set(criterion.id, ideal);
  }

  return cache;
}

/**
 * Checks if a quality report is perfect (all criteria at ideal values)
 *
 * WHY: Perfect quality means no further optimisation needed for this bracket.
 * Early termination when perfect saves candidate generation work.
 *
 * @param report - Quality evaluation report for a candidate
 * @param cache - Cached ideal values for the bracket
 * @returns true if all criteria are at their ideal values
 */
export function isPerfectQuality(
  report: QualityEvaluationReport,
  cache: CachedBracketIdeals,
): boolean {
  return QUALITY_CRITERIA.every((criterion) =>
    checkCriterionPerfect(criterion, report, cache),
  );
}

/**
 * Compares two quality reports lexicographically by FIDE criteria order
 *
 * WHY lexicographic: FIDE Dutch system uses strict priority. Better C5 beats
 * any C6-C21 combination. Only if C5 equal do we compare C6, and so on.
 *
 * @param firstReport - First quality report
 * @param secondReport - Second quality report
 * @returns Negative if first better, positive if second better, 0 if equal
 */
export function compareQualityReports(
  firstReport: QualityEvaluationReport,
  secondReport: QualityEvaluationReport,
): number {
  for (const criterion of QUALITY_CRITERIA) {
    const comparison = compareCriterion(criterion, firstReport, secondReport);
    if (comparison !== 0) {
      return comparison;
    }
  }
  return 0;
}

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
 * Non-topscorers are those with ≤50% of potential maximum score
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
 * Topscorers are those with >50% of potential maximum score
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
 * Absolute colour preference applies when colour index ≥ 2 or ≤ -2
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

/**
 * Evaluates C5 criterion: Minimise the score of the PAB recipient
 * @param pairingCandidate - The pairing candidate to evaluate
 * @param currentBracketScore - Score of the current bracket being evaluated
 * @param scoregroupsByScore - Sorted array of [score, scoregroup] pairs
 * @returns Score of the PAB recipient, or 0 if no PAB in this bracket
 * @throws Error if multiple downfloaters in lowest bracket (invalid state)
 */
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
 * Constants for colour changes
 */
const WHITE_COLOUR_CHANGE = 1;
const BLACK_COLOUR_CHANGE = -1;

/**
 * Constant for PAB (Pairing Allocated Bye) node identifier in compatibility graphs
 */
const PAB_NODE_ID = 'PAB';

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
function calculateMinDownfloaters(
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
function findOptimalDownfloaterScores(
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
 * @param roundNumber - Current round number
 * @param scoregroupsByScore - Remaining scoregroups
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

/**
 * Helper to compare two arrays of numbers lexicographically (dictionary order).
 * It compares elements at the same index one by one.
 * If a difference is found, the array with the smaller element is considered smaller.
 * If one array is a prefix of the other, the shorter array is considered smaller.
 *
 * @param firstArray - First array of numbers to compare
 * @param secondArray - Second array of numbers to compare
 * @returns negative number if firstArray comes before secondArray,
 *          positive number if firstArray comes after secondArray,
 *          0 if they are equal
 */
export function compareLexicographically(
  firstArray: number[],
  secondArray: number[],
): number {
  const minLength = Math.min(firstArray.length, secondArray.length);

  // Iterate through both arrays up to the length of the shorter one
  for (let elementIndex = 0; elementIndex < minLength; elementIndex++) {
    const firstValue = firstArray[elementIndex];
    const secondValue = secondArray[elementIndex];

    // If values at the current index differ, their difference determines the order
    if (firstValue !== secondValue) {
      return firstValue - secondValue;
    }
  }

  // If all compared elements are equal, the shorter array comes first
  return firstArray.length - secondArray.length;
}

/**
 * Type definition for violation checker callback.
 * Returns the number of violations found in the pair.
 */
type ViolationChecker = (pair: ColouredEntitiesPair) => number;

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
 * Checks if assigning a new colour to an entity would result in 3 consecutive games with the same colour.
 * @param entity - The entity to check
 * @param newColour - The new colour being assigned
 * @returns true if the entity would have the same colour 3 times in a row
 */
function willHaveSameColourThreeTimes(
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

const FLOAT_DOWN: FloatType = 'down';
const FLOAT_UP: FloatType = 'up';

/**
 * Helper to check if a player downfloated in a specific round
 * @param entity - The player to check
 * @param roundNumber - The round number to check for downfloat
 * @returns true if the player downfloated in the specified round
 */
function didDownfloat(
  entity: ChessTournamentEntity,
  roundNumber: number,
): boolean {
  const hadDownfloat = entity.floatHistory.some((historyItem) => {
    const isRoundMatch = historyItem.roundNumber === roundNumber;
    const isDownFloat = historyItem.floatType === FLOAT_DOWN;
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
function didUpfloat(
  entity: ChessTournamentEntity,
  roundNumber: number,
): boolean {
  const hadUpfloat = entity.floatHistory.some((historyItem) => {
    const isRoundMatch = historyItem.roundNumber === roundNumber;
    const isUpFloat = historyItem.floatType === FLOAT_UP;
    return isRoundMatch && isUpFloat;
  });
  return hadUpfloat;
}

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

/**
 * Type definition for the criterion used to filter MDP pairings.
 * Returns true if the pair should be included in the score difference calculation.
 */
type MdpPairingFilterCriterion = (
  mdp: ChessTournamentEntity,
  resident: ChessTournamentEntity,
) => boolean;

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

/**
 * Aggregates all quality criteria evaluations into a report
 * @param pairingCandidate - The pairing candidate to evaluate
 * @param roundNumber - Current round number
 * @param scoregroupsByScore - Remaining scoregroups
 * @param incomingMDPs - List of players who moved down into this bracket
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
