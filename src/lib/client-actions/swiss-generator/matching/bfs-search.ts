/**
 * Shared BFS infrastructure for Edmonds' Blossom Algorithm
 *
 * Contains generic functions used by both cardinality and weighted matching:
 * - bfsSearchForAugmentingPath: Generic BFS for augmenting paths
 * - findMatchedBases: Identifies blossoms with matched vertices
 * - labelFreeVerticesAsRoots: Labels free blossoms as S-roots
 * - countMatchedVertices: Counts matched vertices in a matching result
 */

import { augmentMatching } from './blossom';
import type {
  BFSSearchStartInfo,
  BlossomCreationInfo,
  AugmentingPathInfo,
  EdgeFoundInfo,
  FreeVertexLabelingInfo,
  QueueProcessingInfo,
} from './matching-logger';
import { IS_MATCHING_DEBUG_ENABLED, matchingLogger } from './matching-logger';
import {
  assignLabel,
  findAlternatingTreeRoot,
  findBaseVertexInfo,
} from './tree-operations';
import type {
  MatchingResult,
  MatchingState,
  ScanFunction,
  VertexKey,
} from './types';
import { Label, NO_MATE } from './types';

/**
 * Function type for creating a blossom during BFS.
 *
 * Cardinality matching uses plain addBlossom.
 * Weighted matching uses addWeightedBlossom which also initializes duals.
 */
export type AddBlossomFunction<State extends MatchingState> = (
  state: State,
  vertexU: VertexKey,
  vertexV: VertexKey,
) => void;

/**
 * Finds bases of blossoms that contain at least one matched vertex
 *
 * A blossom is considered "matched" if any vertex inside it has a mate.
 * This is used to exclude such blossoms from being labelled as free roots.
 *
 * @param state - Current matching state
 * @returns Set of base vertex keys for matched blossoms
 */
export function findMatchedBases(state: MatchingState): Set<VertexKey> {
  const matchedBases = new Set<VertexKey>();

  for (const [, vertexState] of state.vertices) {
    const hasMatch = vertexState.mate !== NO_MATE;
    if (hasMatch) {
      // Mark this vertex's blossom base as having a matched vertex
      const { baseVertex: baseKey } = findBaseVertexInfo(state, vertexState.key);
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
export function labelFreeVerticesAsRoots(state: MatchingState): void {
  // Identify blossoms that contain matched vertices (should not be labelled)
  const matchedBases = findMatchedBases(state);
  // Track which bases we've already processed to avoid duplicate labelling
  const labelledBases = new Set<VertexKey>();

  for (const [, vertexState] of state.vertices) {
    // Get the top-level blossom base for this vertex
    const { baseVertex: baseKey } = findBaseVertexInfo(state, vertexState.key);

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
 * @param addBlossomFn - Function to create blossoms (cardinality: addBlossom, weighted: addWeightedBlossom)
 * @returns true if augmenting path found and matching augmented, false otherwise
 */
export function bfsSearchForAugmentingPath<State extends MatchingState>(
  state: State,
  scanFn: ScanFunction<State>,
  addBlossomFn: AddBlossomFunction<State>,
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

        addBlossomFn(state, vertexU, vertexV);

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
