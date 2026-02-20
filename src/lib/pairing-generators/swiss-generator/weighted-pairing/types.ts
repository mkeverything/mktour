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
}
