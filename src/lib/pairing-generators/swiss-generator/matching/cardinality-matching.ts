/**
 * Edmonds' Blossom Algorithm for Maximum Cardinality Matching
 *
 * Implements simplified Edmonds' blossom algorithm for finding maximum cardinality
 * matching in undirected graphs. This is used for C4 completion checks in Swiss
 * tournament pairing.
 *
 * Time Complexity: O(V³) where V is the number of vertices
 * Space Complexity: O(V + E) where E is the number of edges
 *
 * Note: Uses Oxford English spelling throughout (e.g., "colour", "optimise")
 *
 * References:
 * - Edmonds, J. (1965). "Paths, trees, and flowers". Canadian Journal of Mathematics
 * - NetworkX implementation: networkx/algorithms/matching.py
 * - Wikipedia: https://en.wikipedia.org/wiki/Blossom_algorithm
 */

import Graph from 'graphology';

import { addBlossom } from './blossom';
import {
  bfsSearchForAugmentingPath,
  countMatchedVertices,
  labelFreeVerticesAsRoots,
} from './bfs-search';
import { initialiseState, resetLabels } from './initialization';
import type {
  GraphStatistics,
  IterationCompletionInfo,
  IterationInfo,
  MatchingResultInfo,
  MatchingStateInfo,
} from './matching-logger';
import { IS_MATCHING_DEBUG_ENABLED, matchingLogger } from './matching-logger';
import { scanAndLabelNeighbours } from './tree-operations';
import type { Mate, MatchingResult, MatchingState, VertexKey } from './types';

// Re-export shared BFS types and functions
export {
  bfsSearchForAugmentingPath,
  countMatchedVertices,
  type AddBlossomFunction,
} from './bfs-search';

// Re-export public API types
export type { Mate, MatchingResult, VertexKey } from './types';

/**
 * Builds a snapshot of the current matching state for debug logging
 *
 * Creates a serialisable representation of the matching state including:
 * - Map of each vertex to its current mate (or null if unmatched)
 * - Count of matched vertices (vertices with non-null mates)
 *
 * This function is used for tracing algorithm behaviour during debugging
 * sessions, helping identify where the matching state diverges from expected.
 *
 * @param state - Current matching state to snapshot
 * @returns MatchingStateInfo object suitable for structured logging
 */
function buildMatchingStateInfo(state: MatchingState): MatchingStateInfo {
  // Build record mapping vertex keys to their mates
  // Using Record<VertexKey, Mate> for JSON serialisation compatibility
  const mates: Record<VertexKey, Mate> = {};
  let matchedCount = 0;

  for (const [vertexKey, vertexState] of state.vertices) {
    mates[vertexKey] = vertexState.mate;

    // Count vertices that have a mate assigned
    const isMatched = vertexState.mate !== null;
    if (isMatched) {
      matchedCount++;
    }
  }

  const stateInfo: MatchingStateInfo = { mates, matchedCount };
  return stateInfo;
}

/**
 * Computes a maximum cardinality matching in an undirected graph
 *
 * Implements Edmonds' Blossom algorithm to find a maximum matching.
 * A matching is a set of edges where no two edges share a vertex.
 * Maximum matching has the largest possible number of edges.
 *
 * Algorithm stages:
 * 1. Initialize: Create trivial blossoms, empty matching
 * 2. Search: Find augmenting paths using BFS with alternating trees
 * 3. Augment: Flip edges along augmenting path to increase matching size
 * 4. Repeat stages 2-3 until no augmenting path exists
 *
 * Complexity: O(V²E) where V is vertices and E is edges
 *
 * @param graph - Graphology undirected graph instance
 * @returns Map from vertex key to matched partner (or null if unmatched)
 */
export function maximumMatching(graph: Graph): MatchingResult {
  let iterationNumber = 0;

  if (IS_MATCHING_DEBUG_ENABLED) {
    const graphStats: GraphStatistics = {
      vertexCount: graph.order,
      edgeCount: graph.size,
    };
    matchingLogger
      .withMetadata(graphStats)
      .debug('Starting maximum matching algorithm');
  }

  // Initialize algorithm state
  const state = initialiseState(graph);

  let foundAugmentingPath = true;

  // Main loop: keep searching for augmenting paths until none exist
  while (foundAugmentingPath) {
    iterationNumber++;

    if (IS_MATCHING_DEBUG_ENABLED) {
      const iterationInfo: IterationInfo = { iterationNumber };
      matchingLogger
        .withMetadata(iterationInfo)
        .debug('Starting main loop iteration');

      // Log current matching state at start of each iteration
      const stateInfo = buildMatchingStateInfo(state);
      matchingLogger
        .withMetadata(stateInfo)
        .debug('Matching state at iteration start');
    }

    // Reset labels and queue for new search stage
    resetLabels(state);

    // Label all free vertices as S-roots
    labelFreeVerticesAsRoots(state);

    // BFS search for augmenting path
    foundAugmentingPath = bfsSearchForAugmentingPath(
      state,
      scanAndLabelNeighbours,
      addBlossom,
    );

    if (IS_MATCHING_DEBUG_ENABLED) {
      const completionInfo: IterationCompletionInfo = {
        iterationNumber,
        foundAugmentingPath,
      };
      matchingLogger
        .withMetadata(completionInfo)
        .debug('Main loop iteration completed');
    }
  }

  // Extract final matching from state
  const matching: MatchingResult = new Map();
  for (const [vertexKey, vertexState] of state.vertices) {
    matching.set(vertexKey, vertexState.mate);
  }

  if (IS_MATCHING_DEBUG_ENABLED) {
    const matchedVertexCount = countMatchedVertices(matching);
    const resultInfo: MatchingResultInfo = {
      iterationNumber,
      matchedVertexCount,
    };
    matchingLogger
      .withMetadata(resultInfo)
      .debug('Maximum matching algorithm completed');
  }

  return matching;
}
