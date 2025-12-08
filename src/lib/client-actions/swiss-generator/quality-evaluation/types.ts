/**
 * Types, interfaces, and comparison utilities for quality evaluation
 *
 * Contains:
 * - CriterionValue union type
 * - QualityCriterion interface
 * - Comparison utility functions for different value types
 * - Sentinel constants for theoretical ideals
 */

import type {
  ChessTournamentEntity,
  ColouredEntitiesPair,
} from '@/lib/client-actions/common-generator';
import type {
  EvaluationContext,
  FutureCriteriaCompliance,
  QualityEvaluationReport,
} from '@/lib/client-actions/swiss-generator/types';

// ============================================================================
// Core Types
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

/** Type definition for violation checker callback */
export type ViolationChecker = (pair: ColouredEntitiesPair) => number;

/**
 * Type definition for the criterion used to filter MDP pairings.
 * Returns true if the pair should be included in the score difference calculation.
 */
export type MdpPairingFilterCriterion = (
  mdp: ChessTournamentEntity,
  resident: ChessTournamentEntity,
) => boolean;

// ============================================================================
// Constants for Theoretical Ideals
// ============================================================================

/** Theoretical ideal for criteria with no violations */
export const IDEAL_ZERO_VIOLATIONS = 0;

/** Theoretical ideal for array-based criteria with no entries */
export const IDEAL_EMPTY_ARRAY: readonly number[] = [];

/** Ideal C8: No future complications (no PAB needed, no downfloaters required) */
export const IDEAL_C8_NO_COMPLICATIONS: FutureCriteriaCompliance = {
  pabScore: 0,
  downfloaterCount: 0,
  downfloaterScores: [],
};

// ============================================================================
// Criterion Check and Compare Helpers
// ============================================================================

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
// isPerfect and compare Functions (with type guards for CriterionValue)
// ============================================================================

/**
 * Checks if a numeric criterion value equals its ideal
 * Type guard ensures both values are numbers
 */
export function isNumericPerfect(
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
export function compareNumericValues(
  first: CriterionValue,
  second: CriterionValue,
): number {
  if (typeof first !== 'number' || typeof second !== 'number') {
    throw new Error('compareNumericValues: expected numeric values');
  }
  return first - second;
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
 * Checks if an array criterion value equals its ideal
 * Type guard ensures both values are arrays
 */
export function isArrayPerfect(
  value: CriterionValue,
  ideal: CriterionValue,
): boolean {
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
export function compareArrayValues(
  first: CriterionValue,
  second: CriterionValue,
): number {
  if (!Array.isArray(first) || !Array.isArray(second)) {
    throw new Error('compareArrayValues: expected array values');
  }
  return compareLexicographically(first, second);
}

// ============================================================================
// C8 Future Criteria Compliance - Type Guards and Comparison
// ============================================================================

/** Type guard for FutureCriteriaCompliance */
export function isFutureCriteriaCompliance(
  value: CriterionValue,
): value is FutureCriteriaCompliance {
  return typeof value === 'object' && !Array.isArray(value);
}

/**
 * Checks if a C8 criterion value equals its ideal
 * Type guard ensures both values are FutureCriteriaCompliance
 */
export function isC8Perfect(
  value: CriterionValue,
  ideal: CriterionValue,
): boolean {
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
 * Comparison order per FIDE: pabScore -> downfloaterCount -> downfloaterScores
 */
export function compareC8Values(
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
