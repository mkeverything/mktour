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
import { bfsSearchForAugmentingPath } from './index';
import { resetLabels } from './initialization';
import { assignLabel, getBaseVertexState } from './tree-operations';
import { initialiseWeightedState, isEdgeTight } from './weighted-operations';
import type {
  MatchingResult,
  ScanAndLabelResult,
  VertexKey,
  WeightedMatchingState,
} from './types';
import { Label, NO_MATE } from './types';

/**
 * Finds bases of blossoms that contain at least one matched vertex
 *
 * @param state - Current matching state
 * @returns Set of base vertex keys for matched blossoms
 */
function findMatchedBases(state: WeightedMatchingState): Set<VertexKey> {
  const matchedBases = new Set<VertexKey>();

  for (const [, vertexState] of state.vertices) {
    const hasMatch = vertexState.mate !== NO_MATE;

    if (hasMatch) {
      const [baseKey] = getBaseVertexState(state, vertexState.key);
      matchedBases.add(baseKey);
    }
  }

  return matchedBases;
}

/**
 * Labels all free (unmatched) blossoms as S-roots
 *
 * A blossom is free if NO vertex inside it is matched.
 *
 * @param state - Current matching state (modified in place)
 */
function labelFreeVerticesAsRoots(state: WeightedMatchingState): void {
  const matchedBases = findMatchedBases(state);
  const labelledBases = new Set<VertexKey>();

  for (const [, vertexState] of state.vertices) {
    const [baseKey] = getBaseVertexState(state, vertexState.key);

    const alreadyProcessed = labelledBases.has(baseKey);
    const hasMatchedVertex = matchedBases.has(baseKey);
    const shouldLabel = !alreadyProcessed && !hasMatchedVertex;

    if (shouldLabel) {
      assignLabel(state, baseKey, Label.S, baseKey);
      labelledBases.add(baseKey);
    }
  }
}

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
 * Labels unlabelled neighbours as T. Returns the neighbour key
 * if it's S-labelled (indicating potential blossom or augmenting path).
 *
 * @param state - Weighted matching state (modified in place)
 * @param currentVertex - S-labelled vertex scanning from
 * @param neighbourKey - Neighbour to process
 * @returns Neighbour key if S-labelled, null otherwise
 */
function processTightNeighbour(
  state: WeightedMatchingState,
  currentVertex: VertexKey,
  neighbourKey: VertexKey,
): VertexKey | null {
  const [neighbourBase, neighbourBaseState] = getBaseVertexState(
    state,
    neighbourKey,
  );
  const neighbourLabel = neighbourBaseState.label;

  let result: VertexKey | null = null;

  if (neighbourLabel === Label.S) {
    result = neighbourKey;
  } else if (neighbourLabel === Label.NONE) {
    assignLabel(state, neighbourBase, Label.T, currentVertex);
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
      foundSEdge = sNeighbour !== null;

      if (foundSEdge) {
        // S-S edge: potential blossom or augmenting path
        result = [currentVertex, sNeighbour];
      }

      index++;
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
export function maximumWeightMatching(graph: Graph): MatchingResult {
  const state = initialiseWeightedState(graph);

  // Wrapper to capture graph in closure for scanTightNeighbours
  const scanTightEdges = (
    s: WeightedMatchingState,
    v: VertexKey,
  ): ScanAndLabelResult => scanTightNeighbours(s, graph, v);

  let foundAugmentingPath = true;

  while (foundAugmentingPath) {
    // Reset for new search stage
    resetLabelsForStage(state);

    // Label free vertices as S-roots
    labelFreeVerticesAsRoots(state);

    // Search for augmenting path on tight edges only
    foundAugmentingPath = bfsSearchForAugmentingPath(state, scanTightEdges);

    // TODO: If stuck (no augmenting path on tight edges), compute delta and update duals
  }

  return extractMatchingResult(state);
}
