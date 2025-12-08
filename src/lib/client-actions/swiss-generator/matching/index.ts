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

import { addBlossom, augmentMatching } from './blossom';
import { initialiseState, resetLabels } from './initialization';
import type {
  AugmentingPathInfo,
  BFSSearchStartInfo,
  BlossomCreationInfo,
  EdgeFoundInfo,
  GraphStatistics,
  IterationCompletionInfo,
  IterationInfo,
  MatchingResultInfo,
  QueueProcessingInfo,
} from './matching-logger';
import { IS_MATCHING_DEBUG_ENABLED, matchingLogger } from './matching-logger';
import {
  assignLabel,
  findAlternatingTreeRoot,
  scanAndLabelNeighbours,
} from './tree-operations';
import type { MatchingResult, MatchingState } from './types';
import { Label, NO_MATE } from './types';

// Re-export public API
export type { VertexKey, Mate, MatchingResult } from './types';

/**
 * Labels all free (unmatched) vertices as S-roots
 *
 * Free vertices become roots of alternating trees in the BFS search.
 * Each root's labelEnd points to itself.
 *
 * @param state - Current matching state (modified in place)
 */
function labelFreeVerticesAsRoots(state: MatchingState): void {
  for (const [, vertexState] of state.vertices) {
    const isFreeVertex = vertexState.mate === NO_MATE;
    if (isFreeVertex) {
      assignLabel(state, vertexState.key, Label.S, vertexState.key);
    }
  }
}

/**
 * Performs BFS search for an augmenting path
 *
 * Processes S-labelled vertices from the queue, scanning and labelling
 * their neighbours. Returns true if an augmenting path was found and
 * the matching was augmented.
 *
 * @param state - Current matching state (modified in place)
 * @returns true if augmenting path found and matching augmented, false otherwise
 */
function searchForAugmentingPath(state: MatchingState): boolean {
  if (IS_MATCHING_DEBUG_ENABLED) {
    const searchStartInfo: BFSSearchStartInfo = {
      queueSize: state.queue.length,
    };
    matchingLogger
      .withMetadata(searchStartInfo)
      .debug('Starting BFS search for augmenting path');
  }

  while (state.queue.length > 0) {
    const currentVertex = state.queue.shift();
    if (currentVertex === undefined) {
      throw new Error('Queue unexpectedly empty');
    }

    if (IS_MATCHING_DEBUG_ENABLED) {
      const queueInfo: QueueProcessingInfo = {
        currentVertex,
        remainingQueueSize: state.queue.length,
      };
      matchingLogger
        .withMetadata(queueInfo)
        .debug('Processing vertex from queue');
    }

    const edge = scanAndLabelNeighbours(state, currentVertex);

    if (edge !== null) {
      const [vertexU, vertexV] = edge;

      if (IS_MATCHING_DEBUG_ENABLED) {
        const edgeInfo: EdgeFoundInfo = { vertexU, vertexV };
        matchingLogger
          .withMetadata(edgeInfo)
          .debug('Found edge between S-labelled vertices');
      }

      // Check if vertices are in same alternating tree
      const rootU = findAlternatingTreeRoot(state, vertexU);
      const rootV = findAlternatingTreeRoot(state, vertexV);

      const sameTree = rootU === rootV;

      if (sameTree) {
        // Same tree - create blossom and continue BFS
        if (IS_MATCHING_DEBUG_ENABLED) {
          const blossomInfo: BlossomCreationInfo = {
            vertexU,
            vertexV,
            baseU: rootU,
            baseV: rootV,
          };
          matchingLogger
            .withMetadata(blossomInfo)
            .debug('Same tree - creating blossom');
        }

        addBlossom(state, vertexU, vertexV);

        if (IS_MATCHING_DEBUG_ENABLED) {
          matchingLogger.debug('Blossom created, continuing BFS');
        }
      } else {
        // Different trees - found augmenting path
        if (IS_MATCHING_DEBUG_ENABLED) {
          const pathInfo: AugmentingPathInfo = {
            vertexU,
            vertexV,
            baseU: rootU,
            baseV: rootV,
          };
          matchingLogger
            .withMetadata(pathInfo)
            .debug('Different trees - found augmenting path');
        }

        augmentMatching(state, vertexU, vertexV);

        if (IS_MATCHING_DEBUG_ENABLED) {
          matchingLogger.debug('Matching augmented');
        }

        return true;
      }
    }
  }

  if (IS_MATCHING_DEBUG_ENABLED) {
    matchingLogger.debug('Queue empty - no augmenting path found');
  }

  return false;
}

/**
 * Counts the number of matched vertices in a matching
 *
 * @param matching - Matching result
 * @returns Number of vertices that are matched (have non-null mates)
 */
export function countMatchedVertices(matching: MatchingResult): number {
  let matchedCount = 0;
  for (const [, mate] of matching) {
    const isMatched = mate !== null;
    if (isMatched) {
      matchedCount++;
    }
  }
  return matchedCount;
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
    if (IS_MATCHING_DEBUG_ENABLED) {
      iterationNumber++;
      const iterationInfo: IterationInfo = { iterationNumber };
      matchingLogger
        .withMetadata(iterationInfo)
        .debug('Starting main loop iteration');
    }

    // Reset labels and queue for new search stage
    resetLabels(state);

    // Label all free vertices as S-roots
    labelFreeVerticesAsRoots(state);

    // BFS search for augmenting path
    foundAugmentingPath = searchForAugmentingPath(state);

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
