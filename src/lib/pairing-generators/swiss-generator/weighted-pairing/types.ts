/**
 * Types for weighted Swiss pairing graph construction.
 *
 * Extends the matching types to add FIDE-specific weight calculation context.
 */

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

  /**
   * Map from an occupied score to its bracket level index, 0 being the highest
   * score. Only occupied scores are levels (FIDE C.04.3 1.3), so the difference
   * of two indices counts the brackets a player exits when floating between
   * them. Iterates top to bottom; its size is the level count.
   */
  readonly levelIndexByScore: ReadonlyMap<number, number>;
}
