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
  FreeVertexLabelingInfo,
  GraphStatistics,
  IterationCompletionInfo,
  IterationInfo,
  MatchingResultInfo,
  MatchingStateInfo,
  QueueProcessingInfo,
} from './matching-logger';
import { IS_MATCHING_DEBUG_ENABLED, matchingLogger } from './matching-logger';
import {
  assignLabel,
  findAlternatingTreeRoot,
  getBaseVertexState,
  scanAndLabelNeighbours,
} from './tree-operations';
import type {
  Mate,
  MatchingResult,
  MatchingState,
  ScanFunction,
  VertexKey,
} from './types';
import { Label, NO_MATE } from './types';

// Re-export public API
export type { VertexKey, Mate, MatchingResult } from './types';

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
 * Finds bases of blossoms that contain at least one matched vertex
 *
 * A blossom is considered "matched" if any vertex inside it has a mate.
 * This is used to exclude such blossoms from being labelled as free roots.
 *
 * @param state - Current matching state
 * @returns Set of base vertex keys for matched blossoms
 */
function findMatchedBases(state: MatchingState): Set<VertexKey> {
  const matchedBases = new Set<VertexKey>();

  for (const [, vertexState] of state.vertices) {
    const hasMatch = vertexState.mate !== NO_MATE;
    if (hasMatch) {
      // Mark this vertex's blossom base as having a matched vertex
      const [baseKey] = getBaseVertexState(state, vertexState.key);
      matchedBases.add(baseKey);
    }
  }

  return matchedBases;
}

/**
 * Labels all free (unmatched) blossoms as S-roots
 *
 * A blossom is free if NO vertex inside it is matched. This follows the
 * NetworkX approach where "if v not in mate" checks the vertex directly,
 * not its blossom base. This prevents incorrectly labelling base vertices
 * of blossoms that contain matched non-base vertices.
 *
 * @param state - Current matching state (modified in place)
 */
function labelFreeVerticesAsRoots(state: MatchingState): void {
  // Identify blossoms that contain matched vertices (should not be labelled)
  const matchedBases = findMatchedBases(state);
  // Track which bases we've already processed to avoid duplicate labelling
  const labelledBases = new Set<VertexKey>();

  for (const [, vertexState] of state.vertices) {
    // Get the top-level blossom base for this vertex
    const [baseKey] = getBaseVertexState(state, vertexState.key);

    // Determine if this base should be labelled as a free S-root
    const alreadyProcessed = labelledBases.has(baseKey);
    const hasMatchedVertex = matchedBases.has(baseKey);
    const shouldLabel = !alreadyProcessed && !hasMatchedVertex;

    if (shouldLabel) {
      // Label this free blossom's base as S-root for BFS exploration
      assignLabel(state, baseKey, Label.S, baseKey);
      labelledBases.add(baseKey);
    }
  }

  if (IS_MATCHING_DEBUG_ENABLED) {
    const labelingInfo: FreeVertexLabelingInfo = {
      matchedBases: [...matchedBases],
      labeledRoots: [...labelledBases],
      queueAfterLabeling: [...state.queue],
    };
    matchingLogger
      .withMetadata(labelingInfo)
      .debug('Free vertices labeled as S-roots');
  }
}

/**
 * Generic BFS search for an augmenting path
 *
 * Processes S-labelled vertices from the queue using the provided scan function.
 * The scan function determines which edges to consider:
 * - Cardinality matching: all edges (scanAndLabelNeighbours)
 * - Weighted matching: only tight edges with slack = 0
 *
 * When an S-S edge is found:
 * - Same tree: create blossom and continue scanning
 * - Different trees: augment matching and return success
 *
 * @param state - Matching state (modified in place)
 * @param scanFn - Function to scan vertex neighbours
 * @returns true if augmenting path found and matching augmented, false otherwise
 */
export function bfsSearchForAugmentingPath<State extends MatchingState>(
  state: State,
  scanFn: ScanFunction<State>,
): boolean {
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

    // Use provided scan function (cardinality vs weighted)
    const edge = scanFn(state, currentVertex);

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
        // Same tree - create blossom and continue scanning from same vertex
        // The blossom contracts the cycle, potentially revealing new edges
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

        // Re-add the current vertex to continue scanning its remaining neighbors
        // After blossom creation, the vertex's base may have changed, and we may
        // find augmenting paths to other trees through neighbors we haven't checked
        state.queue.unshift(currentVertex);

        if (IS_MATCHING_DEBUG_ENABLED) {
          matchingLogger.debug('Blossom created, re-scanning vertex');
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
