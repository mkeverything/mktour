/**
 * Types for weighted Swiss pairing graph construction.
 *
 * Extends the matching types to add FIDE-specific weight calculation context.
 */

// ============================================================================
// Score Group
// ============================================================================

/**
 * A score bracket with its player count.
 *
 * Stored in descending score order within WeightContext.scoreGroups.
 * Used by BRACKET_RANK (bracket index) and RANKING (group size).
 */
export interface ScoreGroup {
  /** The score value for this bracket */
  readonly score: number;

  /** Number of players with this score */
  readonly count: number;
}

// ============================================================================
// Weight Context
// ============================================================================

/**
 * Context required for weight calculation.
 * Computed once per round from the player list.
 */
export interface WeightContext {
  /** Current round number (1-indexed) */
  readonly roundNumber: number;

  /** Total players in tournament (N) */
  readonly playerCount: number;

  /** Maximum edges in matching: K = floor(N/2) */
  readonly edgeCount: number;

  /** Maximum score for topscorer threshold calculation */
  readonly maxPossibleScore: number;

  /** Whether PAB vertex is needed (odd player count) */
  readonly hasOddPlayers: boolean;

  /** Map from score to count of players with that score (for RANKING criterion) */
  readonly scoregroupSizes: ReadonlyMap<number, number>;

  /** Score brackets sorted descending by score (for BRACKET_RANK criterion) */
  readonly scoreGroups: readonly ScoreGroup[];

  /** Number of distinct score brackets: scoreGroups.length */
  readonly numBrackets: number;
}
