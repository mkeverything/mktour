/**
 * Weighted Maximum Matching using Edmonds' Blossom Algorithm
 *
 * Finds maximum weight matching in undirected weighted graphs.
 * Uses dual variables to track which edges are "tight" (slack = 0).
 * Only tight edges are traversed; dual updates make new edges tight.
 *
 * References:
 * - NetworkX max_weight_matching implementation
 * - Galil (1986): "Efficient algorithms for finding maximum matching in graphs"
 */

import Graph from 'graphology';

import { clearBestEdges, scanVertexForBestEdges } from './best-edge';
import {
  bfsSearchForAugmentingPath,
  labelFreeVerticesAsRoots,
} from './bfs-search';
import { expandBlossom } from './blossom';
import {
  applyDualUpdates,
  computeMinimumDelta,
  computeTerminationBound,
} from './dual-updates';
import { resetLabels } from './initialization';
import {
  IS_MATCHING_DEBUG_ENABLED,
  matchingLogger,
  type DeltaComputationInfo,
  type RequeueInfo,
  type WeightedBFSIterationInfo,
} from './matching-logger';
import { assignLabel, getBaseVertexState } from './tree-operations';
import {
  addWeightedBlossom,
  initialiseWeightedState,
  isEdgeTight,
} from './weighted-operations';
import type {
  DualVariable,
  MatchingResult,
  ScanAndLabelResult,
  VertexKey,
  WeightedMatchingState,
  WeightedScanFunction,
} from './types';
import { isBlossomDelta, Label, NO_MATE, ZERO_DUAL } from './types';
import type { AnyDelta } from './dual-updates';

/**
 * Resets labels and best edges for a new search stage
 *
 * Called at the start of each augmenting path search.
 * Clears all vertex labels, queue, and best edge tracking.
 *
 * @param state - Weighted matching state (modified in place)
 */
function resetLabelsForStage(state: WeightedMatchingState): void {
  resetLabels(state);
  clearBestEdges(state);
}

/**
 * Processes a single neighbour on a tight edge
 *
 * Mirrors scanAndLabelNeighbours logic from tree-operations.ts but for single neighbor.
 * Handles four cases:
 * - Same blossom: skip (internal blossom edge)
 * - S-labelled: return for caller to check blossom vs augmenting path
 * - Unlabelled free: found augmenting path endpoint
 * - Unlabelled matched: extend tree (label T, label mate S)
 * - T-labelled: skip
 *
 * @param state - Weighted matching state (modified in place)
 * @param currentVertex - S-labelled vertex scanning from
 * @param neighbourKey - Neighbour to process
 * @returns Neighbour key if S-labelled or free, null otherwise
 */
function processTightNeighbour(
  state: WeightedMatchingState,
  currentVertex: VertexKey,
  neighbourKey: VertexKey,
): VertexKey | null {
  const [currentBase] = getBaseVertexState(state, currentVertex);
  const [neighbourBase, neighbourBaseState] = getBaseVertexState(
    state,
    neighbourKey,
  );

  const isSameBlossom = currentBase === neighbourBase;
  const neighbourLabel = neighbourBaseState.label;

  let result: VertexKey | null = null;

  if (isSameBlossom) {
    // Skip edges within the same blossom (internal edges)
    result = null;
  } else if (neighbourLabel === Label.S) {
    result = neighbourKey;
  } else if (neighbourLabel === Label.NONE) {
    // Get actual vertex state to check mate (not base state)
    const neighbourState = state.vertices.get(neighbourKey);

    if (neighbourState === undefined) {
      throw new Error(`Neighbour ${neighbourKey} not found in state`);
    }

    const neighbourIsFree = neighbourState.mate === NO_MATE;

    if (neighbourIsFree) {
      // Free vertex: found augmenting path endpoint
      result = neighbourKey;
    } else {
      // Matched vertex: extend alternating tree
      // Label neighbour as T, its mate as S (adds mate to queue)
      const neighbourMate = neighbourState.mate;

      if (neighbourMate === null) {
        throw new Error(`Neighbour ${neighbourKey} should be matched`);
      }

      assignLabel(state, neighbourKey, Label.T, currentVertex);
      assignLabel(state, neighbourMate, Label.S, neighbourBase);
    }
  }
  // T-labelled: already in tree, result stays null

  return result;
}

/**
 * Checks if edge is tight and processes the neighbour
 *
 * @returns S-neighbour key if S-S tight edge, null otherwise
 */
function checkAndProcessTightEdge(
  state: WeightedMatchingState,
  graph: Graph,
  currentVertex: VertexKey,
  neighbourKey: VertexKey,
): VertexKey | null {
  // Get edge between vertices
  const edgeKey = graph.edge(currentVertex, neighbourKey);
  const hasEdge = edgeKey !== undefined;

  let result: VertexKey | null = null;

  if (hasEdge) {
    // Only process edges with zero slack (tight edges)
    const isTight = isEdgeTight(state, graph, edgeKey);

    if (isTight) {
      // Label unlabelled as T, return S-neighbours
      result = processTightNeighbour(state, currentVertex, neighbourKey);
    }
  }

  return result;
}

/**
 * Scans neighbours on tight edges
 *
 * @param state - Weighted matching state (modified in place)
 * @param graph - Graphology graph
 * @param currentVertex - S-labelled vertex to scan from
 * @returns [currentVertex, sNeighbour] if S-S edge found, null otherwise
 */
function scanTightNeighbours(
  state: WeightedMatchingState,
  graph: Graph,
  currentVertex: VertexKey,
): ScanAndLabelResult {
  // Track best edges for delta computation when stuck
  scanVertexForBestEdges(state, graph, currentVertex);

  const neighbours = state.adjacencyList.get(currentVertex);
  const hasNeighbours = neighbours !== undefined;

  let result: ScanAndLabelResult = null;

  if (hasNeighbours) {
    // Convert to array for index-based iteration
    const neighbourArray = Array.from(neighbours);
    let index = 0;
    let foundSEdge = false;

    // Process neighbours until S-S edge found or all checked
    while (index < neighbourArray.length && !foundSEdge) {
      const neighbourKey = neighbourArray[index];
      const sNeighbour = checkAndProcessTightEdge(
        state,
        graph,
        currentVertex,
        neighbourKey,
      );
      if (sNeighbour !== null) {
        // S-S edge: potential blossom or augmenting path
        foundSEdge = true;
        result = [currentVertex, sNeighbour];
      }

      index++;
    }
  }

  return result;
}

/**
 * Result of a single search stage
 */
enum StageResult {
  /** Augmenting path found and matching updated */
  PATH_FOUND = 'PATH_FOUND',
  /** No path found and no more deltas possible */
  NO_MORE_DELTAS = 'NO_MORE_DELTAS',
}

/**
 * Applies delta update and handles blossom expansion if needed
 *
 * @param state - Weighted matching state (modified in place)
 * @param delta - The delta to apply
 */
function applyDeltaAndExpand(
  state: WeightedMatchingState,
  delta: AnyDelta,
): void {
  // Update all dual variables
  applyDualUpdates(state, delta.delta);

  // If delta was from a T-blossom reaching zero, expand it
  if (isBlossomDelta(delta)) {
    const blossom = state.blossoms.get(delta.blossomId);
    if (blossom === undefined) {
      throw new Error(`Blossom ${delta.blossomId} not found for expansion`);
    }
    expandBlossom(state, delta.blossomId, blossom.base);
  }
}

/**
 * Creates a scan function for tight edges with graph bound
 *
 * Factory pattern to avoid creating closures on each BFS call.
 * The returned function scans only tight edges (slack = 0).
 *
 * @param graph - Graphology graph to bind
 * @returns WeightedScanFunction with graph captured
 */
function createTightEdgeScan(graph: Graph): WeightedScanFunction {
  return (state, vertex) => scanTightNeighbours(state, graph, vertex);
}

/**
 * Re-adds all S-labelled vertices to the queue for continued BFS
 *
 * Called after delta update to ensure BFS can explore newly tight edges.
 *
 * @param state - Weighted matching state (queue modified in place)
 */
function requeueSLabelledVertices(state: WeightedMatchingState): void {
  state.queue = [];

  for (const [vertexKey, vertexState] of state.vertices) {
    if (vertexState.label === Label.S) {
      state.queue.push(vertexKey);
    }
  }
}

/**
 * Determines if the search should terminate
 *
 * Termination occurs when:
 * - No delta exists (minDelta is null)
 * - No S-vertices exist (terminationBound is null)
 * - Delta is zero (edge already tight but unusable - internal to blossom)
 * - Termination bound is smaller or equal to minDelta (S-vertex dual would go negative)
 *
 * @param minDelta - Minimum delta from edges/blossoms, or null
 * @param terminationBound - Minimum S-vertex dual, or null
 * @returns true if search should terminate
 */
function shouldTerminateSearch(
  minDelta: AnyDelta | null,
  terminationBound: DualVariable | null,
): boolean {
  let shouldTerminate: boolean;

  if (minDelta === null) {
    // No delta means no more updates possible
    shouldTerminate = true;
  } else if (terminationBound === null) {
    // No S-vertices means nothing to update
    shouldTerminate = true;
  } else if (minDelta.delta === ZERO_DUAL) {
    // Delta zero means edge is already tight but unusable (internal to blossom)
    // Applying delta 0 won't make progress, so terminate
    shouldTerminate = true;
  } else {
    // If termination bound is smaller or equal, applying minDelta would make duals negative
    shouldTerminate = terminationBound <= minDelta.delta;
  }

  return shouldTerminate;
}

/**
 * Performs one search stage: BFS on tight edges with delta updates when stuck
 *
 * Keeps applying delta updates until either:
 * - An augmenting path is found (returns PATH_FOUND)
 * - No more delta updates possible (returns NO_MORE_DELTAS)
 *
 * @param state - Weighted matching state (modified in place)
 * @param graph - Graphology graph
 * @param scanFn - Scan function for tight edges
 * @returns Stage result indicating what happened
 */
function performSearchStage(
  state: WeightedMatchingState,
  graph: Graph,
  scanFn: WeightedScanFunction,
): StageResult {
  let result: StageResult | null = null;

  while (result === null) {
    if (IS_MATCHING_DEBUG_ENABLED) {
      const iterationInfo: WeightedBFSIterationInfo = {
        queueSize: state.queue.length,
      };
      matchingLogger
        .withMetadata(iterationInfo)
        .debug('Weighted BFS iteration starting');
    }

    const foundPath = bfsSearchForAugmentingPath(
      state,
      scanFn,
      addWeightedBlossom,
    );

    if (foundPath) {
      if (IS_MATCHING_DEBUG_ENABLED) {
        matchingLogger.debug('Augmenting path found');
      }
      result = StageResult.PATH_FOUND;
    } else {
      // Stuck: try to make new edges tight via delta update
      const minDelta = computeMinimumDelta(state, graph);
      const terminationBound = computeTerminationBound(state);

      if (IS_MATCHING_DEBUG_ENABLED) {
        const deltaValue = minDelta !== null ? minDelta.delta : null;
        const deltaInfo: DeltaComputationInfo = { deltaValue };
        matchingLogger
          .withMetadata(deltaInfo)
          .debug('Delta computation result');
      }

      // Check termination: if termination bound is smallest, no more paths exist
      const shouldTerminate = shouldTerminateSearch(minDelta, terminationBound);

      if (shouldTerminate) {
        result = StageResult.NO_MORE_DELTAS;
      } else if (minDelta !== null) {
        applyDeltaAndExpand(state, minDelta);
        // Re-add S-labelled vertices to queue to explore newly tight edges
        requeueSLabelledVertices(state);

        if (IS_MATCHING_DEBUG_ENABLED) {
          const requeueInfo: RequeueInfo = {
            queueSizeAfterRequeue: state.queue.length,
          };
          matchingLogger
            .withMetadata(requeueInfo)
            .debug('Requeued S-labelled vertices');
        }
      }
    }
  }

  return result;
}

/**
 * Extracts final matching result from weighted matching state
 *
 * @param state - Weighted matching state after algorithm completes
 * @returns Map from vertex key to matched partner (or null if unmatched)
 */
function extractMatchingResult(state: WeightedMatchingState): MatchingResult {
  const matching: MatchingResult = new Map();

  for (const [vertexKey, vertexState] of state.vertices) {
    matching.set(vertexKey, vertexState.mate);
  }

  return matching;
}

/**
 * Computes maximum weight matching in an undirected weighted graph
 *
 * Implements weighted Blossom algorithm:
 * 1. Initialise duals to maxWeight, all edges start with non-negative slack
 * 2. Label free vertices as S-roots
 * 3. BFS on tight edges only (slack = 0)
 * 4. If stuck (no augmenting path), compute delta and update duals
 * 5. Repeat until no more augmenting paths exist
 *
 * @param graph - Graphology graph with BigInt 'weight' edge attributes
 * @returns Map from vertex key to matched partner (or null if unmatched)
 */
export function maximumWeightMatching(inputGraph: Graph): MatchingResult {
  // Copy graph to avoid mutating caller's data (algorithm doubles weights internally)
  const graph = inputGraph.copy();
  const state = initialiseWeightedState(graph);
  const scanTightEdges = createTightEdgeScan(graph);

  // Main loop: find augmenting paths until no more exist
  let hasMoreWork = true;

  while (hasMoreWork) {
    // Prepare for new search stage
    resetLabelsForStage(state);
    labelFreeVerticesAsRoots(state);

    // Perform search with delta updates
    const stageResult = performSearchStage(state, graph, scanTightEdges);
    hasMoreWork = stageResult === StageResult.PATH_FOUND;
  }

  return extractMatchingResult(state);
}
