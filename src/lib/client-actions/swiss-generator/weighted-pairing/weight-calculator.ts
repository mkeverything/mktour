/**
 * Mixed-radix weight computation for FIDE Swiss pairing criteria.
 *
 * Encodes quality criteria into BigInt edge weights.
 * Higher weight = better pairing.
 */

import type {
  ChessTournamentEntity,
  ColouredEntitiesPair,
} from '@/lib/client-actions/common-generator';
import {
  countC10ViolationsInPair,
  countC11ViolationsInPair,
  countC12ViolationsInPair,
  countC13ViolationsInPair,
} from '@/lib/client-actions/swiss-generator/quality-evaluation/evaluate';
import {
  didDownfloat,
  didUpfloat,
} from '@/lib/client-actions/swiss-generator/quality-evaluation/ideal-computation';
import type { MdpPairingFilterCriterion } from '@/lib/client-actions/swiss-generator/quality-evaluation/types';
import type { WeightContext } from './types';

// ============================================================================
// Edge Type Classification
// ============================================================================

/**
 * Which edge type a criterion applies to.
 */
export enum EdgeType {
  /** Player↔Player edges */
  Regular = 'regular',
  /** Player↔PAB edges */
  Pab = 'pab',
}

// ============================================================================
// Penalty Input Types
// ============================================================================

/**
 * Base input shared by all penalty and weight computations.
 *
 * Contains the tournament context, precomputed multipliers, and
 * precomputed player groups needed for criterion evaluation.
 * Extended by PabPenaltyInput and RegularPenaltyInput which add
 * edge-specific player data.
 */
export interface BasePenaltyInput {
  /** Tournament context with round number, player count, etc. */
  readonly context: WeightContext;

  /** Precomputed multipliers for weight calculation */
  readonly multipliers: CriterionMultipliers;

  /** Precomputed list of topscorers (score > 50% max) for C10-C11 */
  readonly topscorers: readonly ChessTournamentEntity[];
}

/**
 * Input for computing penalty on a PAB (pairing-allocated bye) edge.
 *
 * Used when evaluating whether a player should receive the bye.
 * Only C5 and C9 criteria apply to PAB edges.
 */
export interface PabPenaltyInput extends BasePenaltyInput {
  /** The player who would receive the bye */
  readonly player: ChessTournamentEntity;
}

/**
 * Input for computing penalty on a regular (player vs player) edge.
 *
 * Contains the coloured pair (whiteEntity/blackEntity) for evaluation.
 * All regular edge criteria (SCORE_TIER, C10-C21, RANKING) apply.
 */
export interface RegularPenaltyInput extends BasePenaltyInput {
  /** The coloured pair being evaluated */
  readonly colouredPair: ColouredEntitiesPair;
}

/**
 * Union of all penalty input types.
 *
 * Use isPabPenaltyInput() or isRegularPenaltyInput() to discriminate.
 */
export type PenaltyInput = PabPenaltyInput | RegularPenaltyInput;

/**
 * Type guard for PAB penalty input.
 *
 * Discriminates by presence of 'player' field and absence of 'colouredPair'.
 * PAB inputs have a single player; regular inputs have a colouredPair.
 *
 * @param penaltyInput - The penalty input to check
 * @returns True if penaltyInput is PabPenaltyInput
 */
export function isPabPenaltyInput(
  penaltyInput: PenaltyInput,
): penaltyInput is PabPenaltyInput {
  return 'player' in penaltyInput && !('colouredPair' in penaltyInput);
}

/**
 * Type guard for regular penalty input.
 *
 * Discriminates by presence of 'colouredPair' field.
 * Regular inputs contain a ColouredEntitiesPair for player-vs-player edges.
 *
 * @param penaltyInput - The penalty input to check
 * @returns True if penaltyInput is RegularPenaltyInput
 */
export function isRegularPenaltyInput(
  penaltyInput: PenaltyInput,
): penaltyInput is RegularPenaltyInput {
  return 'colouredPair' in penaltyInput;
}

// ============================================================================
// Criterion Definition
// ============================================================================

/**
 * Definition of a weight criterion with metadata and penalty computation.
 */
export interface CriterionDefinition {
  /** Human-readable name for debugging/logging */
  readonly name: string;

  /** Per-edge maximum violations, computed from context */
  readonly getPerEdgeMax: (context: WeightContext) => number;

  /** Which edge type this criterion applies to */
  readonly appliesTo: EdgeType;

  /** Priority level (0 = highest priority) */
  readonly priority: number;

  /** Computes penalty for this criterion */
  readonly computePenalty: (
    input: PabPenaltyInput | RegularPenaltyInput,
  ) => number;
}

// ============================================================================
// Per-Edge Max Computation Functions
// ============================================================================

/**
 * Computes max penalty for C5 (PAB score).
 *
 * The penalty is the player's score - lower is better.
 * Max penalty = highest score any player could have.
 *
 * @param ctx - Weight context with tournament parameters
 * @returns Maximum possible C5 penalty per edge
 */
function getC5PerEdgeMax(ctx: WeightContext): number {
  return ctx.maxPossibleScore;
}

/**
 * Computes max penalty for SCORE_TIER (score difference).
 *
 * The penalty is |score1 - score2|.
 * Max penalty = difference between highest and lowest scores present.
 *
 * Note: Uses maxPossibleScore as upper bound. Could be refined
 * to use actual score range from players for tighter bound.
 *
 * @param ctx - Weight context with tournament parameters
 * @returns Maximum possible score difference per edge
 */
function getScoreTierPerEdgeMax(ctx: WeightContext): number {
  // TODO: Refine to use actual (maxScore - minScore) from players
  return ctx.maxPossibleScore;
}

/**
 * Computes max penalty for C9 (PAB unplayed games).
 *
 * The penalty is (roundNumber - 1) - gamesPlayed.
 * Max penalty = roundNumber - 1 (player has played 0 games).
 *
 * @param ctx - Weight context with tournament parameters
 * @returns Maximum possible C9 penalty per edge
 */
function getC9PerEdgeMax(ctx: WeightContext): number {
  return ctx.roundNumber - 1;
}

/** Max violations per edge for binary criteria (both players can violate) */
const BINARY_CRITERION_MAX_PER_EDGE = 2;

/**
 * Computes max penalty for binary criteria (C10-C17).
 *
 * Binary criteria: each player in the pair can either violate (1) or not (0).
 * Max per edge = 2 (both players violate).
 *
 * @returns Maximum possible penalty per edge
 */
function getBinaryPerEdgeMax(): number {
  return BINARY_CRITERION_MAX_PER_EDGE;
}

/**
 * Computes max penalty for C18-C21 (MDP score differences).
 *
 * The penalty is the score difference between MDP and resident.
 * Max = maxPossibleScore (theoretical max difference).
 *
 * @param ctx - Weight context with tournament parameters
 * @returns Maximum possible score difference per edge
 */
function getMdpScoreDiffPerEdgeMax(ctx: WeightContext): number {
  return ctx.maxPossibleScore;
}

/**
 * Computes max penalty for RANKING (deviation from ideal S1↔S2 difference).
 *
 * The penalty is |actualDiff - idealDiff| where idealDiff = scoregroupSize / 2.
 * Max deviation occurs when actualDiff = 0 or actualDiff = scoregroupSize - 1.
 * Max penalty = floor(maxScoregroupSize / 2) for the largest scoregroup.
 *
 * @param ctx - Weight context with tournament parameters
 * @returns Maximum possible ranking deviation per edge
 */
function getRankingPerEdgeMax(ctx: WeightContext): number {
  const maxScoregroupSize = Math.max(...ctx.scoregroupSizes.values());
  const maxIdealDiff = Math.floor(maxScoregroupSize / 2);
  return maxIdealDiff;
}

// ============================================================================
// Criterion Definitions
// ============================================================================

/**
 * C5: Minimise the score of the PAB (bye) recipient.
 *
 * FIDE C.04.3 Article 5: Among players who could receive PAB, prefer
 * the one with the lowest score to minimise competitive advantage.
 *
 * Applies to: PAB edges only.
 * Priority: Highest (0) - PAB assignment is critical.
 */
export const C5: CriterionDefinition = {
  name: 'C5',
  getPerEdgeMax: getC5PerEdgeMax,
  appliesTo: EdgeType.Pab,
  priority: 0,
  computePenalty: computeC5Penalty,
};

/**
 * SCORE_TIER: Minimise score difference between paired players.
 *
 * This criterion encodes FIDE C6-C8:
 * - C6: Minimise the number of downfloaters
 * - C7: Minimise the scores of downfloaters
 * - C8: Ensure completion of following brackets
 *
 * By prioritising same-score pairings (penalty 0) over cross-score
 * pairings (penalty = score difference), we naturally achieve C6-C8.
 *
 * Applies to: Regular edges only.
 * Priority: 1 - Highest priority for regular edges.
 */
export const SCORE_TIER: CriterionDefinition = {
  name: 'SCORE_TIER',
  getPerEdgeMax: getScoreTierPerEdgeMax,
  appliesTo: EdgeType.Regular,
  priority: 1,
  computePenalty: computeScoreTierPenalty,
};

/**
 * C9: Minimise unplayed games of PAB recipient.
 *
 * FIDE: If PAB must be assigned, prefer players who haven't already
 * missed games (fewer unplayed = fewer missed rounds).
 *
 * Applies to: PAB edges only.
 * Priority: 2 - Below SCORE_TIER but still important for PAB.
 */
export const C9: CriterionDefinition = {
  name: 'C9',
  getPerEdgeMax: getC9PerEdgeMax,
  appliesTo: EdgeType.Pab,
  priority: 2,
  computePenalty: computeC9Penalty,
};

/**
 * C10: Minimise topscorer colour difference violations.
 *
 * FIDE: Topscorers (score > 50% max) should not have |colourIndex| > 2
 * after colour assignment.
 *
 * Applies to: Regular edges only.
 * Priority: 3.
 */
export const C10: CriterionDefinition = {
  name: 'C10',
  getPerEdgeMax: getBinaryPerEdgeMax,
  appliesTo: EdgeType.Regular,
  priority: 3,
  computePenalty: computeC10Penalty,
};

/**
 * C11: Minimise topscorers receiving same colour three times.
 *
 * FIDE: Topscorers should not play the same colour three times in a row.
 *
 * Applies to: Regular edges only.
 * Priority: 4.
 */
export const C11: CriterionDefinition = {
  name: 'C11',
  getPerEdgeMax: getBinaryPerEdgeMax,
  appliesTo: EdgeType.Regular,
  priority: 4,
  computePenalty: computeC11Penalty,
};

/**
 * C12: Minimise colour preference violations.
 *
 * FIDE: Players should receive their preferred colour when possible.
 * Preference determined by colourIndex sign.
 *
 * Applies to: Regular edges only.
 * Priority: 5.
 */
export const C12: CriterionDefinition = {
  name: 'C12',
  getPerEdgeMax: getBinaryPerEdgeMax,
  appliesTo: EdgeType.Regular,
  priority: 5,
  computePenalty: computeC12Penalty,
};

/**
 * C13: Minimise strong colour preference violations.
 *
 * FIDE: Players with |colourIndex| >= 1 have strong preference.
 * Violating strong preference is worse than mild preference.
 *
 * Applies to: Regular edges only.
 * Priority: 6.
 */
export const C13: CriterionDefinition = {
  name: 'C13',
  getPerEdgeMax: getBinaryPerEdgeMax,
  appliesTo: EdgeType.Regular,
  priority: 6,
  computePenalty: computeC13Penalty,
};

/**
 * C14: Minimise downfloaters from previous round.
 *
 * FIDE: Players who downfloated in round N-1 should not downfloat again.
 *
 * Applies to: Regular edges only.
 * Priority: 7.
 */
export const C14: CriterionDefinition = {
  name: 'C14',
  getPerEdgeMax: getBinaryPerEdgeMax,
  appliesTo: EdgeType.Regular,
  priority: 7,
  computePenalty: computeC14Penalty,
};

/**
 * C15: Minimise MDP opponents who upfloated previous round.
 *
 * FIDE: Residents paired with MDPs should not have upfloated in round N-1.
 *
 * Applies to: Regular edges only.
 * Priority: 8.
 */
export const C15: CriterionDefinition = {
  name: 'C15',
  getPerEdgeMax: getBinaryPerEdgeMax,
  appliesTo: EdgeType.Regular,
  priority: 8,
  computePenalty: computeC15Penalty,
};

/**
 * C16: Minimise downfloaters from two rounds ago.
 *
 * FIDE: Players who downfloated in round N-2 should not downfloat again.
 *
 * Applies to: Regular edges only.
 * Priority: 9.
 */
export const C16: CriterionDefinition = {
  name: 'C16',
  getPerEdgeMax: getBinaryPerEdgeMax,
  appliesTo: EdgeType.Regular,
  priority: 9,
  computePenalty: computeC16Penalty,
};

/**
 * C17: Minimise MDP opponents who upfloated two rounds ago.
 *
 * FIDE: Residents paired with MDPs should not have upfloated in round N-2.
 *
 * Applies to: Regular edges only.
 * Priority: 10.
 */
export const C17: CriterionDefinition = {
  name: 'C17',
  getPerEdgeMax: getBinaryPerEdgeMax,
  appliesTo: EdgeType.Regular,
  priority: 10,
  computePenalty: computeC17Penalty,
};

/**
 * C18: Minimise MDP score difference (MDP downfloated previous round).
 *
 * FIDE: When MDP downfloated in round N-1, minimise score difference
 * with their current opponent.
 *
 * Applies to: Regular edges only.
 * Priority: 11.
 */
export const C18: CriterionDefinition = {
  name: 'C18',
  getPerEdgeMax: getMdpScoreDiffPerEdgeMax,
  appliesTo: EdgeType.Regular,
  priority: 11,
  computePenalty: computeC18Penalty,
};

/**
 * C19: Minimise opponent score difference (opponent upfloated previous round).
 *
 * FIDE: When resident upfloated in round N-1, minimise score difference
 * with their current MDP opponent.
 *
 * Applies to: Regular edges only.
 * Priority: 12.
 */
export const C19: CriterionDefinition = {
  name: 'C19',
  getPerEdgeMax: getMdpScoreDiffPerEdgeMax,
  appliesTo: EdgeType.Regular,
  priority: 12,
  computePenalty: computeC19Penalty,
};

/**
 * C20: Minimise MDP score difference (MDP downfloated two rounds ago).
 *
 * FIDE: When MDP downfloated in round N-2, minimise score difference
 * with their current opponent.
 *
 * Applies to: Regular edges only.
 * Priority: 13.
 */
export const C20: CriterionDefinition = {
  name: 'C20',
  getPerEdgeMax: getMdpScoreDiffPerEdgeMax,
  appliesTo: EdgeType.Regular,
  priority: 13,
  computePenalty: computeC20Penalty,
};

/**
 * C21: Minimise opponent score difference (opponent upfloated two rounds ago).
 *
 * FIDE: When resident upfloated in round N-2, minimise score difference
 * with their current MDP opponent.
 *
 * Applies to: Regular edges only.
 * Priority: 14.
 */
export const C21: CriterionDefinition = {
  name: 'C21',
  getPerEdgeMax: getMdpScoreDiffPerEdgeMax,
  appliesTo: EdgeType.Regular,
  priority: 14,
  computePenalty: computeC21Penalty,
};

/**
 * RANKING: Tie-breaker using S1↔S2 pairing order.
 *
 * Prefer natural S1↔S2 pairing order (idealDiff = scoregroupSize / 2).
 * Penalty = |actualDiff - idealDiff| for same-score, maxPenalty for cross-score.
 * This is the lowest priority criterion.
 *
 * Applies to: Regular edges only.
 * Priority: 15 - Lowest priority.
 */
export const RANKING: CriterionDefinition = {
  name: 'RANKING',
  getPerEdgeMax: getRankingPerEdgeMax,
  appliesTo: EdgeType.Regular,
  priority: 15,
  computePenalty: computeRankingPenalty,
};

// ============================================================================
// Criterion Collections
// ============================================================================

/**
 * All criteria sorted by priority (0 = highest).
 */
export const ALL_CRITERIA: readonly CriterionDefinition[] = [
  C5,
  SCORE_TIER,
  C9,
  C10,
  C11,
  C12,
  C13,
  C14,
  C15,
  C16,
  C17,
  C18,
  C19,
  C20,
  C21,
  RANKING,
];

const isRegularCriterion = (criterion: CriterionDefinition): boolean =>
  criterion.appliesTo === EdgeType.Regular;

const isPabCriterion = (criterion: CriterionDefinition): boolean =>
  criterion.appliesTo === EdgeType.Pab;

/** Criteria for regular edges only */
export const REGULAR_CRITERIA: readonly CriterionDefinition[] =
  ALL_CRITERIA.filter(isRegularCriterion);

/** Criteria for PAB edges only */
export const PAB_CRITERIA: readonly CriterionDefinition[] =
  ALL_CRITERIA.filter(isPabCriterion);

// ============================================================================
// Multiplier Computation
// ============================================================================

/**
 * Computed multipliers for a specific set of criteria.
 * All values are bigint for consistent arithmetic.
 */
export interface CriterionMultipliers {
  /** Map from criterion to its BigInt multiplier */
  readonly multipliers: ReadonlyMap<CriterionDefinition, bigint>;

  /** Map from criterion to its base (K × perEdgeMax + 1) */
  readonly bases: ReadonlyMap<CriterionDefinition, bigint>;
}

/**
 * Computes weight multipliers for a set of criteria.
 *
 * For lexicographic ordering, each criterion must outweigh all lower ones:
 *   MULT[i] > SUM(maxViolations[j] × MULT[j]) for all j > i
 *
 * Formula with K edges:
 *   Base[j] = K × perEdgeMax[j] + 1
 *   MULT[i] = ∏(Base[j]) for j = i+1 to n
 *
 * @param criteria - Criteria to compute multipliers for (sorted by priority)
 * @param context - Weight context with tournament parameters
 * @returns CriterionMultipliers with multipliers and bases
 */
export function computeMultipliers(
  criteria: readonly CriterionDefinition[],
  context: WeightContext,
): CriterionMultipliers {
  const edgeCount = BigInt(context.edgeCount);

  // Compute bases: K × perEdgeMax + 1
  const bases = new Map<CriterionDefinition, bigint>();
  for (const criterion of criteria) {
    const perEdgeMax = BigInt(criterion.getPerEdgeMax(context));
    const base = edgeCount * perEdgeMax + 1n;
    bases.set(criterion, base);
  }

  // Compute multipliers right-to-left: MULT[i] = ∏(Base[j]) for j > i
  const multipliers = new Map<CriterionDefinition, bigint>();
  let currentMultiplier = 1n;

  // Process in reverse priority order (lowest priority first)
  const reversedCriteria = [...criteria].reverse();
  for (const criterion of reversedCriteria) {
    multipliers.set(criterion, currentMultiplier);

    const base = bases.get(criterion);
    if (base === undefined) {
      throw new Error(`Base not found for criterion: ${criterion.name}`);
    }
    currentMultiplier = currentMultiplier * base;
  }

  return { multipliers, bases };
}

// ============================================================================
// Penalty Computation - Score Tier
// ============================================================================

/**
 * Computes the score tier penalty for a player pair.
 *
 * Penalty = absolute score difference between the two players.
 * Lower penalty = better pairing (same-score pairings are ideal).
 *
 * @param penaltyInput - Regular penalty input with colouredPair
 * @returns Score tier penalty (0 = same score, higher = worse)
 */
export function computeScoreTierPenalty(penaltyInput: PenaltyInput): number {
  if (!isRegularPenaltyInput(penaltyInput)) {
    throw new Error('SCORE_TIER requires regular penalty input');
  }
  const { whiteEntity, blackEntity } = penaltyInput.colouredPair;
  return Math.abs(whiteEntity.entityScore - blackEntity.entityScore);
}

// ============================================================================
// Penalty Computation - PAB Criteria (C5, C9)
// ============================================================================

/**
 * Computes the C5 penalty for a PAB edge.
 *
 * C5: Minimise PAB score - lower score players are preferred for PAB.
 * Penalty = player's score (lower score = lower penalty = better).
 *
 * @param penaltyInput - PAB penalty input with player and context
 * @returns C5 penalty (player's score)
 */
export function computeC5Penalty(penaltyInput: PenaltyInput): number {
  if (!isPabPenaltyInput(penaltyInput)) {
    throw new Error('C5 requires PAB penalty input');
  }
  return penaltyInput.player.entityScore;
}

/**
 * Computes the C9 penalty for a PAB edge.
 *
 * C9: Minimise unplayed games of PAB recipient.
 * Penalty = (roundNumber - 1) - gamesPlayed = number of missed rounds.
 *
 * @param penaltyInput - PAB penalty input with player and context
 * @returns C9 penalty (number of unplayed games)
 */
export function computeC9Penalty(penaltyInput: PenaltyInput): number {
  if (!isPabPenaltyInput(penaltyInput)) {
    throw new Error('C9 requires PAB penalty input');
  }
  const expectedGames = penaltyInput.context.roundNumber - 1;
  const playedGames = penaltyInput.player.previousGames.length;
  return expectedGames - playedGames;
}

// ============================================================================
// Penalty Computation - Regular Edge Colour Criteria (C10-C13)
// ============================================================================

/**
 * C10: Topscorer colour difference violation penalty.
 *
 * Counts topscorers who would have |colourIndex| > 2 after colour assignment.
 *
 * @param penaltyInput - Regular penalty input with colouredPair and topscorers
 * @returns Number of violations (0, 1, or 2)
 */
export function computeC10Penalty(penaltyInput: PenaltyInput): number {
  if (!isRegularPenaltyInput(penaltyInput)) {
    throw new Error('C10 requires regular penalty input');
  }
  return countC10ViolationsInPair(penaltyInput.colouredPair, [
    ...penaltyInput.topscorers,
  ]);
}

/**
 * C11: Topscorer same colour three times penalty.
 *
 * Counts topscorers who would play the same colour three times in a row.
 *
 * @param penaltyInput - Regular penalty input with colouredPair and topscorers
 * @returns Number of violations (0, 1, or 2)
 */
export function computeC11Penalty(penaltyInput: PenaltyInput): number {
  if (!isRegularPenaltyInput(penaltyInput)) {
    throw new Error('C11 requires regular penalty input');
  }
  return countC11ViolationsInPair(penaltyInput.colouredPair, [
    ...penaltyInput.topscorers,
  ]);
}

/**
 * C12: Colour preference violation penalty.
 *
 * Counts players not receiving their preferred colour (based on colourIndex sign).
 *
 * @param penaltyInput - Regular penalty input with colouredPair
 * @returns Number of violations (0, 1, or 2)
 */
export function computeC12Penalty(penaltyInput: PenaltyInput): number {
  if (!isRegularPenaltyInput(penaltyInput)) {
    throw new Error('C12 requires regular penalty input');
  }
  return countC12ViolationsInPair(penaltyInput.colouredPair);
}

/**
 * C13: Strong colour preference violation penalty.
 *
 * Counts players with |colourIndex| >= 1 not receiving their preferred colour.
 *
 * @param penaltyInput - Regular penalty input with colouredPair
 * @returns Number of violations (0, 1, or 2)
 */
export function computeC13Penalty(penaltyInput: PenaltyInput): number {
  if (!isRegularPenaltyInput(penaltyInput)) {
    throw new Error('C13 requires regular penalty input');
  }
  return countC13ViolationsInPair(penaltyInput.colouredPair);
}

// ============================================================================
// Penalty Computation - Float Criteria (C14-C17)
// ============================================================================

/** Penalty value when a binary float criterion is violated (one player) */
const SINGLE_FLOAT_VIOLATION = 1;

/** Penalty value when no float violation occurs */
const NO_FLOAT_VIOLATION = 0;

/**
 * Result of MDP/Resident identification in a cross-score pairing.
 */
interface MdpResidentPair {
  readonly mdp: ChessTournamentEntity;
  readonly resident: ChessTournamentEntity;
}

/**
 * Identifies MDP (higher-scored) and resident (lower-scored) in a pair.
 * Returns null if same score (not a cross-score pairing).
 */
function getMdpAndResident(
  colouredPair: ColouredEntitiesPair,
): MdpResidentPair | null {
  const { whiteEntity, blackEntity } = colouredPair;
  const whiteScore = whiteEntity.entityScore;
  const blackScore = blackEntity.entityScore;
  const isSameScore = whiteScore === blackScore;
  const isWhiteHigherScored = whiteScore > blackScore;

  let result: MdpResidentPair | null = null;
  if (isSameScore) {
    result = null;
  } else if (isWhiteHigherScored) {
    result = { mdp: whiteEntity, resident: blackEntity };
  } else {
    result = { mdp: blackEntity, resident: whiteEntity };
  }

  return result;
}

/**
 * C14: Downfloater from previous round penalty.
 *
 * Binary: 1 if MDP downfloated in round N-1, else 0.
 */
export function computeC14Penalty(penaltyInput: PenaltyInput): number {
  if (!isRegularPenaltyInput(penaltyInput)) {
    throw new Error('C14 requires regular penalty input');
  }

  const mdpResident = getMdpAndResident(penaltyInput.colouredPair);
  const isCrossScorePairing = mdpResident !== null;
  const prevRound = penaltyInput.context.roundNumber - 1;

  const hasViolation =
    isCrossScorePairing && didDownfloat(mdpResident.mdp, prevRound);
  const penalty = hasViolation ? SINGLE_FLOAT_VIOLATION : NO_FLOAT_VIOLATION;

  return penalty;
}

/**
 * C15: MDP opponent upfloated previous round penalty.
 *
 * Binary: 1 if resident upfloated in round N-1, else 0.
 */
export function computeC15Penalty(penaltyInput: PenaltyInput): number {
  if (!isRegularPenaltyInput(penaltyInput)) {
    throw new Error('C15 requires regular penalty input');
  }

  const mdpResident = getMdpAndResident(penaltyInput.colouredPair);
  const isCrossScorePairing = mdpResident !== null;
  const prevRound = penaltyInput.context.roundNumber - 1;

  const hasViolation =
    isCrossScorePairing && didUpfloat(mdpResident.resident, prevRound);
  const penalty = hasViolation ? SINGLE_FLOAT_VIOLATION : NO_FLOAT_VIOLATION;

  return penalty;
}

/**
 * C16: Downfloater from two rounds ago penalty.
 *
 * Binary: 1 if MDP downfloated in round N-2, else 0.
 */
export function computeC16Penalty(penaltyInput: PenaltyInput): number {
  if (!isRegularPenaltyInput(penaltyInput)) {
    throw new Error('C16 requires regular penalty input');
  }

  const mdpResident = getMdpAndResident(penaltyInput.colouredPair);
  const isCrossScorePairing = mdpResident !== null;
  const twoRoundsAgo = penaltyInput.context.roundNumber - 2;

  const hasViolation =
    isCrossScorePairing && didDownfloat(mdpResident.mdp, twoRoundsAgo);
  const penalty = hasViolation ? SINGLE_FLOAT_VIOLATION : NO_FLOAT_VIOLATION;

  return penalty;
}

/**
 * C17: MDP opponent upfloated two rounds ago penalty.
 *
 * Binary: 1 if resident upfloated in round N-2, else 0.
 */
export function computeC17Penalty(penaltyInput: PenaltyInput): number {
  if (!isRegularPenaltyInput(penaltyInput)) {
    throw new Error('C17 requires regular penalty input');
  }

  const mdpResident = getMdpAndResident(penaltyInput.colouredPair);
  const isCrossScorePairing = mdpResident !== null;
  const twoRoundsAgo = penaltyInput.context.roundNumber - 2;

  const hasViolation =
    isCrossScorePairing && didUpfloat(mdpResident.resident, twoRoundsAgo);
  const penalty = hasViolation ? SINGLE_FLOAT_VIOLATION : NO_FLOAT_VIOLATION;

  return penalty;
}

// ============================================================================
// Penalty Computation - MDP Score Diff Criteria (C18-C21)
// ============================================================================

/** No score diff penalty when criterion doesn't apply */
const NO_SCORE_DIFF_PENALTY = 0;

/**
 * Computes absolute score difference between MDP and resident.
 */
function computeMdpResidentScoreDiff(mdpResident: MdpResidentPair): number {
  return Math.abs(
    mdpResident.mdp.entityScore - mdpResident.resident.entityScore,
  );
}

/**
 * C18: MDP score diff when MDP downfloated previous round.
 */
export function computeC18Penalty(penaltyInput: PenaltyInput): number {
  if (!isRegularPenaltyInput(penaltyInput)) {
    throw new Error('C18 requires regular penalty input');
  }

  const prevRound = penaltyInput.context.roundNumber - 1;
  const filterByMdpDownfloatPrev: MdpPairingFilterCriterion = (
    mdp,
    _resident,
  ) => didDownfloat(mdp, prevRound);

  const penalty = computeMdpScoreDiffPenaltyWithCriterion(
    penaltyInput,
    filterByMdpDownfloatPrev,
  );
  return penalty;
}

/**
 * Computes MDP score diff penalty with a filtering criterion.
 *
 * Mirrors getMdpScoreDiffs from evaluate.ts but for a single pair.
 * Returns the score difference if the filter criterion is met, else 0.
 *
 * @param penaltyInput - Regular penalty input with colouredPair
 * @param filterCriterion - Callback (mdp, resident) => boolean to check if pair meets criterion
 * @returns Score difference penalty or 0
 */
function computeMdpScoreDiffPenaltyWithCriterion(
  penaltyInput: RegularPenaltyInput,
  filterCriterion: MdpPairingFilterCriterion,
): number {
  const mdpResident = getMdpAndResident(penaltyInput.colouredPair);

  if (mdpResident === null) {
    return NO_SCORE_DIFF_PENALTY;
  }

  const meetsCriterion = filterCriterion(mdpResident.mdp, mdpResident.resident);

  if (!meetsCriterion) {
    return NO_SCORE_DIFF_PENALTY;
  }

  const penalty = computeMdpResidentScoreDiff(mdpResident);
  return penalty;
}

/** C19: Score diff when resident upfloated previous round. */
export function computeC19Penalty(penaltyInput: PenaltyInput): number {
  if (!isRegularPenaltyInput(penaltyInput)) {
    throw new Error('C19 requires regular penalty input');
  }

  const prevRound = penaltyInput.context.roundNumber - 1;
  const filterByResidentUpfloatPrev: MdpPairingFilterCriterion = (
    _mdp,
    resident,
  ) => didUpfloat(resident, prevRound);

  const penalty = computeMdpScoreDiffPenaltyWithCriterion(
    penaltyInput,
    filterByResidentUpfloatPrev,
  );
  return penalty;
}

/** C20: MDP score diff when MDP downfloated two rounds ago. */
export function computeC20Penalty(penaltyInput: PenaltyInput): number {
  if (!isRegularPenaltyInput(penaltyInput)) {
    throw new Error('C20 requires regular penalty input');
  }

  const twoRoundsAgo = penaltyInput.context.roundNumber - 2;
  const filterByMdpDownfloatPrev2: MdpPairingFilterCriterion = (
    mdp,
    _resident,
  ) => didDownfloat(mdp, twoRoundsAgo);

  const penalty = computeMdpScoreDiffPenaltyWithCriterion(
    penaltyInput,
    filterByMdpDownfloatPrev2,
  );
  return penalty;
}

/** C21: Score diff when resident upfloated two rounds ago. */
export function computeC21Penalty(penaltyInput: PenaltyInput): number {
  if (!isRegularPenaltyInput(penaltyInput)) {
    throw new Error('C21 requires regular penalty input');
  }

  const twoRoundsAgo = penaltyInput.context.roundNumber - 2;
  const filterByResidentUpfloatPrev2: MdpPairingFilterCriterion = (
    _mdp,
    resident,
  ) => didUpfloat(resident, twoRoundsAgo);

  const penalty = computeMdpScoreDiffPenaltyWithCriterion(
    penaltyInput,
    filterByResidentUpfloatPrev2,
  );
  return penalty;
}

// ============================================================================
// Penalty Computation - RANKING (S1↔S2 Deviation)
// ============================================================================

/**
 * RANKING: Deviation from ideal S1↔S2 pairing difference.
 *
 * For same-score pairs: penalty = |actualDiff - idealDiff|
 * where idealDiff = scoregroupSize / 2.
 * For cross-score pairs: penalty = maxPenalty (worst case).
 *
 * @param penaltyInput - Regular penalty input with colouredPair
 * @returns Deviation from ideal pairing difference
 */
export function computeRankingPenalty(penaltyInput: PenaltyInput): number {
  if (!isRegularPenaltyInput(penaltyInput)) {
    throw new Error('RANKING requires regular penalty input');
  }

  const { whiteEntity, blackEntity } = penaltyInput.colouredPair;
  const whiteScore = whiteEntity.entityScore;
  const blackScore = blackEntity.entityScore;
  const isSameScore = whiteScore === blackScore;

  let penalty: number;
  if (isSameScore) {
    const scoregroupSize = penaltyInput.context.scoregroupSizes.get(whiteScore);
    if (scoregroupSize === undefined) {
      throw new Error(`Scoregroup size not found for score: ${whiteScore}`);
    }

    const idealDiff = Math.floor(scoregroupSize / 2);
    const actualDiff = Math.abs(
      whiteEntity.pairingNumber - blackEntity.pairingNumber,
    );
    penalty = Math.abs(actualDiff - idealDiff);
  } else {
    const maxScoregroupSize = Math.max(
      ...penaltyInput.context.scoregroupSizes.values(),
    );
    const maxPenalty = Math.floor(maxScoregroupSize / 2);
    penalty = maxPenalty;
  }

  return penalty;
}

// ============================================================================
// Penalty to Weight Conversion
// ============================================================================

/**
 * Converts a penalty value to a weight contribution.
 *
 * Weight = (maxPenalty - actualPenalty) × multiplier
 * This inverts the penalty so lower penalty = higher weight.
 *
 * @param penalty - The actual penalty value
 * @param maxPenalty - Maximum possible penalty for this criterion
 * @param multiplier - The criterion's multiplier
 * @returns Weight contribution as BigInt
 */
export function penaltyToWeight(
  penalty: number,
  maxPenalty: number,
  multiplier: bigint,
): bigint {
  const invertedPenalty = maxPenalty - penalty;
  // Floor to handle half-point scores (draws give 0.5 points)
  const flooredPenalty = Math.floor(invertedPenalty);
  return BigInt(flooredPenalty) * multiplier;
}

/**
 * Gets multiplier for a criterion, throwing if not found.
 *
 * @param multipliers - The multipliers map
 * @param criterion - The criterion to look up
 * @returns The multiplier value
 * @throws Error if criterion not found
 */
export function getMultiplierOrThrow(
  multipliers: CriterionMultipliers,
  criterion: CriterionDefinition,
): bigint {
  const multiplier = multipliers.multipliers.get(criterion);
  if (multiplier === undefined) {
    throw new Error(`Multiplier not found for criterion: ${criterion.name}`);
  }
  return multiplier;
}

/**
 * Computes single criterion's weight contribution.
 *
 * Calls criterion.computePenalty internally, then converts to weight.
 * Weight = (maxPenalty - actualPenalty) × multiplier
 *
 * @param criterion - The criterion definition
 * @param penaltyInput - Penalty input (PAB or regular), includes multipliers
 * @returns Weight contribution as BigInt
 */
export function computeCriterionWeight(
  criterion: CriterionDefinition,
  penaltyInput: PenaltyInput,
): bigint {
  const penalty = criterion.computePenalty(penaltyInput);
  const maxPenalty = criterion.getPerEdgeMax(penaltyInput.context);
  const multiplier = getMultiplierOrThrow(penaltyInput.multipliers, criterion);
  return penaltyToWeight(penalty, maxPenalty, multiplier);
}

/** Computes PAB edge weight using C5 and C9. */
export function computePabEdgeWeight(
  player: ChessTournamentEntity,
  context: WeightContext,
  multipliers: CriterionMultipliers,
  topscorers: readonly ChessTournamentEntity[],
): bigint {
  const pabInput: PabPenaltyInput = {
    player,
    context,
    multipliers,
    topscorers,
  };
  const c5Weight = computeCriterionWeight(C5, pabInput);
  const c9Weight = computeCriterionWeight(C9, pabInput);
  return c5Weight + c9Weight;
}

/**
 * Computes regular edge weight using all regular criteria.
 *
 * Sums weight contributions from SCORE_TIER, C10-C21, and RANKING.
 */
export function computeRegularEdgeWeight(
  colouredPair: ColouredEntitiesPair,
  context: WeightContext,
  multipliers: CriterionMultipliers,
  topscorers: readonly ChessTournamentEntity[],
): bigint {
  const regularInput: RegularPenaltyInput = {
    colouredPair,
    context,
    multipliers,
    topscorers,
  };

  let totalWeight = 0n;
  for (const criterion of REGULAR_CRITERIA) {
    const criterionWeight = computeCriterionWeight(criterion, regularInput);
    totalWeight = totalWeight + criterionWeight;
  }

  return totalWeight;
}
