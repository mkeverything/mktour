/**
 * Edmonds' Blossom Algorithm - Module Entry Point
 *
 * Provides maximum matching algorithms for undirected graphs:
 * - Maximum cardinality matching (maximumMatching)
 * - Maximum weight matching (maximumWeightMatching)
 *
 * Both algorithms use Edmonds' Blossom algorithm with shared BFS infrastructure.
 */

// Shared BFS infrastructure exports
export {
  bfsSearchForAugmentingPath,
  countMatchedVertices,
  type AddBlossomFunction,
} from './bfs-search';

// Cardinality matching exports
export { maximumMatching } from './cardinality-matching';

// Weighted matching exports
export { maximumWeightMatching } from './weighted-matching';

// Shared type exports
export type { Mate, MatchingResult, VertexKey } from './types';
