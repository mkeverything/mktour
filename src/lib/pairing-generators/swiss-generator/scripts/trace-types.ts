/**
 * Types for tournament trace script.
 *
 * Uses semantic type aliases following graphology patterns.
 * Graph structures use entity IDs (VertexKey) throughout.
 * Display names (nicknames) are stored separately for output formatting.
 */

import { VertexKey } from '@/lib/pairing-generators/swiss-generator/matching/types';

// ============================================================================
// Graph Types (following graphology patterns)
// ============================================================================

/** Edge between two vertices, represented by their entity IDs */
export type EdgePair = [VertexKey, VertexKey];

/** Array of entity IDs representing a connected component */
export type ConnectedComponent = VertexKey[];

// ============================================================================
// Display Mapping
// ============================================================================

/** Maps entity ID to display name (nickname) */
export type EntityDisplayMap = Map<VertexKey, string>;

// ============================================================================
// Trace Types
// ============================================================================

/**
 * Trace of a single round including graph state and matching.
 *
 * @property roundNumber - The round number (1-indexed)
 * @property graphBeforePairing - Compatibility graph before pairing was computed
 * @property selectedMatching - Edges selected as the matching (the actual pairings)
 */
export interface RoundTrace {
  roundNumber: number;
  graphBeforePairing: GraphAnalysis;
  selectedMatching: EdgePair[];
}

/**
 * Analysis of the graph structure at a given round.
 *
 * @property vertexCount - Number of vertices (players) in the graph
 * @property edgeCount - Number of edges (valid pairings) in the graph
 * @property edges - Array of valid pairing edges as entity ID pairs
 * @property components - Array of connected components as entity IDs
 * @property isConnected - Whether the graph has a single component
 * @property maxPossibleMatching - Maximum matchable vertices
 */
export interface GraphAnalysis {
  vertexCount: number;
  edgeCount: number;
  edges: EdgePair[];
  components: ConnectedComponent[];
  isConnected: boolean;
  maxPossibleMatching: number;
}

/**
 * Complete tournament trace result.
 *
 * @property seed - Random seed for tournament generation
 * @property playerCount - Number of players
 * @property entityNames - Map from entity ID to nickname for display
 * @property rounds - Array of round traces
 * @property finalGraphAnalysis - Graph analysis at final round
 */
export interface TournamentTraceResult {
  seed: number;
  playerCount: number;
  entityNames: EntityDisplayMap;
  rounds: RoundTrace[];
  finalGraphAnalysis: GraphAnalysis;
}
