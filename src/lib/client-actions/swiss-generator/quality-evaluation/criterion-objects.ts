/**
 * Quality criterion objects and aggregate functions
 *
 * Contains:
 * - C5-C21 criterion object definitions
 * - QUALITY_CRITERIA array (FIDE priority order)
 * - computeAllBracketIdeals, isPerfectQuality, compareQualityReports
 */

import type { ChessTournamentEntity } from '@/lib/client-actions/common-generator';
import type {
  EvaluationContext,
  QualityEvaluationReport,
} from '@/lib/client-actions/swiss-generator/types';

import {
  computeIdealC5PabScore,
  computeIdealC6DownfloatersCount,
  computeIdealC7DownfloaterScores,
  computeIdealC8FutureCriteriaCompliance,
  computeIdealC9PabUnplayed,
  computeIdealC10ColourDiffViolation,
  computeIdealC11SameColourThreeTimes,
  computeIdealC12ColourPrefViolation,
  computeIdealC13StrongColourPrefViolation,
  computeIdealC14ResidentDownfloaterPrev,
  computeIdealC15MdpOpponentUpfloatPrev,
  computeIdealC16ResidentDownfloaterPrev2,
  computeIdealC17MdpOpponentUpfloatPrev2,
  computeIdealC18MdpScoreDiffPrev,
  computeIdealC19MdpOpponentScoreDiffPrev,
  computeIdealC20MdpScoreDiffPrev2,
  computeIdealC21MdpOpponentScoreDiffPrev2,
} from './ideal-computation';
import type {
  CachedBracketIdeals,
  CriterionValue,
  QualityCriterion,
} from './types';
import {
  checkCriterionPerfect,
  compareArrayValues,
  compareC8Values,
  compareNumericValues,
  compareCriterion,
  isArrayPerfect,
  isC8Perfect,
  isNumericPerfect,
} from './types';

// ============================================================================
// Criterion Objects (C5-C21)
// ============================================================================

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
  ): CriterionValue {
    const c6Ideal = computeIdealC6DownfloatersCount(
      bracketPlayers,
      context,
    ) as number;
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
  ): CriterionValue {
    const c6Ideal = computeIdealC6DownfloatersCount(
      bracketPlayers,
      context,
    ) as number;
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
  ): CriterionValue {
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
  ): CriterionValue {
    const c6Ideal = computeIdealC6DownfloatersCount(
      bracketPlayers,
      context,
    ) as number;
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
  ): CriterionValue {
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
  ): CriterionValue {
    return [
      ...(computeIdealC18MdpScoreDiffPrev(bracketPlayers, context) as number[]),
    ];
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
  ): CriterionValue {
    return [
      ...(computeIdealC19MdpOpponentScoreDiffPrev(
        bracketPlayers,
        context,
      ) as number[]),
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
  ): CriterionValue {
    return [
      ...(computeIdealC20MdpScoreDiffPrev2(
        bracketPlayers,
        context,
      ) as number[]),
    ];
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
  ): CriterionValue {
    return [
      ...(computeIdealC21MdpOpponentScoreDiffPrev2(
        bracketPlayers,
        context,
      ) as number[]),
    ];
  },
  isPerfect: isArrayPerfect,
  compare: compareArrayValues,
};

// ============================================================================
// Quality Criteria Array and Aggregate Functions
// ============================================================================

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
