/**
 * Quality Evaluation Module for Swiss System Pairing
 *
 * This module provides quality criteria evaluation for FIDE Dutch system pairing.
 * Criteria are evaluated in priority order (C5-C21) with lexicographic comparison.
 *
 * Public API:
 * - evaluateQualityCriteria: Evaluate all quality criteria for a pairing candidate
 * - evaluateAbsoluteCriteria: Evaluate absolute criteria (C1-C4)
 * - evaluateBasicAbsoluteCriteria: Evaluate basic absolute criteria (C1-C3)
 * - computeAllBracketIdeals: Compute and cache ideal values for a bracket
 * - isPerfectQuality: Check if quality report meets all ideals
 * - compareQualityReports: Compare two quality reports lexicographically
 * - compareLexicographically: Compare two number arrays lexicographically
 */

// Import dependencies to inject into ideal-computation module
import {
  calculateMinDownfloaters,
  findOptimalDownfloaterScores,
} from './evaluate';
import { injectIdealComputationDependencies } from './ideal-computation';

// Inject dependencies to avoid circular imports between evaluate and ideal-computation
injectIdealComputationDependencies(
  calculateMinDownfloaters,
  findOptimalDownfloaterScores,
);

// Re-export public API from types
export type {
  CachedBracketIdeals,
  CriterionValue,
  QualityCriterion,
} from './types';
export {
  checkCriterionPerfect,
  compareCriterion,
  compareLexicographically,
} from './types';

// Re-export criterion objects and aggregate functions
export {
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
  QUALITY_CRITERIA,
  computeAllBracketIdeals,
  isPerfectQuality,
  compareQualityReports,
} from './criterion-objects';

// Re-export evaluation functions
export {
  evaluateAbsoluteCriteria,
  evaluateBasicAbsoluteCriteria,
  evaluateQualityCriteria,
} from './evaluate';
