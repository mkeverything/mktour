/**
 * Weighted operations for Edmonds' Blossom Algorithm
 *
 * Contains functions for slack computation and edge weight retrieval.
 *
 * Edge keys vs vertex pairs:
 * - Graphology uses edge keys (strings) for O(1) attribute access
 * - Vertex pairs require `graph.edge(u, v)` lookup to find the edge key
 * - We use edge keys throughout for efficiency with graphology's API
 *
 * References:
 * - NetworkX max_weight_matching implementation
 */

import Graph from 'graphology';

import { addBlossom } from './blossom';
import { initialiseState } from './initialization';
import { traverseBlossomChain } from './tree-operations';
import type {
  BlossomChainStepResult,
  BlossomId,
  DualVariable,
  EdgeWeight,
  GraphEdgeKey,
  NodeId,
  VertexKey,
  WeightedMatchingState,
} from './types';
import { ZERO_DUAL } from './types';

/** Attribute name for edge weight in graphology */
export const EDGE_WEIGHT_ATTRIBUTE = 'weight';

/** Factor for doubling weights to avoid division in dual updates */
const WEIGHT_DOUBLING_FACTOR = 2n;

/**
 * Retrieves edge weight from graphology graph
 *
 * Type narrowing guards against both invalid edge keys and wrong types.
 *
 * @param graph - Graphology graph instance
 * @param edgeKey - Edge key to get weight for
 * @returns Edge weight as BigInt
 * @throws If edge key is invalid or weight is not bigint
 */
export function getEdgeWeight(graph: Graph, edgeKey: GraphEdgeKey): EdgeWeight {
  const weight = graph.getEdgeAttribute(edgeKey, EDGE_WEIGHT_ATTRIBUTE);

  if (typeof weight !== 'bigint') {
    throw new Error(`Edge ${edgeKey} not found or has invalid weight`);
  }

  return weight;
}

/**
 * Gets the endpoints of an edge from the graph
 *
 * @param graph - Graphology graph instance
 * @param edgeKey - Edge key to get endpoints for
 * @returns Tuple of [source, target] vertex keys
 */
export function getEdgeEndpoints(
  graph: Graph,
  edgeKey: GraphEdgeKey,
): [VertexKey, VertexKey] {
  const source = graph.source(edgeKey);
  const target = graph.target(edgeKey);
  return [source, target];
}

/**
 * Doubles all edge weights in the graph
 *
 * Called once during initialisation. Doubling ensures all slack computations
 * remain integers without division (NetworkX approach).
 *
 * @param graph - Graphology graph instance (modified in place)
 */
export function doubleEdgeWeights(graph: Graph): void {
  graph.forEachEdge((edgeKey) => {
    const weight = getEdgeWeight(graph, edgeKey);
    const doubledWeight = weight * WEIGHT_DOUBLING_FACTOR;
    graph.setEdgeAttribute(edgeKey, EDGE_WEIGHT_ATTRIBUTE, doubledWeight);
  });
}

/**
 * Collects IDs of all non-trivial blossoms containing a vertex.
 *
 * @param state - Weighted matching state
 * @param vertexKey - Vertex to collect blossom IDs for
 * @returns Set of non-trivial blossom IDs containing the vertex
 */
function collectContainingBlossomIds(
  state: WeightedMatchingState,
  vertexKey: VertexKey,
): Set<BlossomId> {
  const blossomIds = new Set<BlossomId>();

  const addBlossomId = (step: BlossomChainStepResult): boolean => {
    if (step.isNonTrivial) {
      blossomIds.add(step.blossomId);
    }
    const shouldContinue = false;
    return shouldContinue;
  };

  traverseBlossomChain(state, vertexKey, addBlossomId);

  return blossomIds;
}

/**
 * Sums duals for blossoms that are in the given set.
 *
 * @param state - Weighted matching state
 * @param vertexKey - Vertex whose blossom chain to traverse
 * @param targetBlossomIds - Set of blossom IDs to include in sum
 * @returns Sum of duals for matching blossoms
 */
function sumBlossomDualsInSet(
  state: WeightedMatchingState,
  vertexKey: VertexKey,
  targetBlossomIds: Set<BlossomId>,
): DualVariable {
  let dualSum = ZERO_DUAL;

  const addMatchingDual = (step: BlossomChainStepResult): boolean => {
    const isTarget = step.isNonTrivial && targetBlossomIds.has(step.blossomId);

    if (isTarget) {
      const blossomDual = state.duals.get(step.blossomId);
      if (blossomDual === undefined) {
        throw new Error(`Dual not found for blossom ${step.blossomId}`);
      }
      dualSum = dualSum + blossomDual;
    }

    const shouldContinue = false;
    return shouldContinue;
  };

  traverseBlossomChain(state, vertexKey, addMatchingDual);

  return dualSum;
}

/**
 * Computes sum of duals for blossoms containing BOTH edge endpoints.
 *
 * Only blossoms containing both vertices contribute to edge slack.
 * External edges (different top-level blossoms) have no shared blossoms.
 *
 * @param state - Weighted matching state
 * @param vertexU - First edge endpoint
 * @param vertexV - Second edge endpoint
 * @returns Sum of duals for shared blossoms
 */
function computeSharedBlossomDualSum(
  state: WeightedMatchingState,
  vertexU: VertexKey,
  vertexV: VertexKey,
): DualVariable {
  const blossomIdsContainingU = collectContainingBlossomIds(state, vertexU);
  const sharedDualSum = sumBlossomDualsInSet(state, vertexV, blossomIdsContainingU);

  return sharedDualSum;
}

/**
 * Computes slack for an edge.
 *
 * Slack formula: dual(u) + dual(v) + sharedBlossomDuals - weight
 * Only blossoms containing BOTH endpoints contribute to slack.
 * Edge is tight when slack = 0.
 *
 * @param state - Weighted matching state
 * @param graph - Graphology graph instance
 * @param edgeKey - Edge to compute slack for
 * @returns Slack value (0 = tight)
 */
export function computeSlack(
  state: WeightedMatchingState,
  graph: Graph,
  edgeKey: GraphEdgeKey,
): DualVariable {
  const [vertexU, vertexV] = getEdgeEndpoints(graph, edgeKey);

  const dualU = state.duals.get(vertexU);
  const dualV = state.duals.get(vertexV);

  if (dualU === undefined) {
    throw new Error(`Dual not found for vertex ${vertexU}`);
  }
  if (dualV === undefined) {
    throw new Error(`Dual not found for vertex ${vertexV}`);
  }

  const sharedBlossomDuals = computeSharedBlossomDualSum(state, vertexU, vertexV);
  const weight = getEdgeWeight(graph, edgeKey);
  const slack = dualU + dualV + sharedBlossomDuals - weight;

  return slack;
}

/**
 * Checks if an edge is tight (slack <= 0)
 *
 * An edge is tight when its slack is zero or negative. Negative slack
 * (over-tight) can occur after delta updates and these edges should
 * still be traversable in BFS.
 *
 * @param state - Weighted matching state
 * @param graph - Graphology graph instance
 * @param edgeKey - Edge to check
 * @returns true if edge is tight or over-tight
 */
export function isEdgeTight(
  state: WeightedMatchingState,
  graph: Graph,
  edgeKey: GraphEdgeKey,
): boolean {
  const slack = computeSlack(state, graph, edgeKey);
  return slack <= ZERO_DUAL;
}

/**
 * Finds maximum edge weight in a graph
 *
 * @param graph - Graphology graph instance
 * @returns Maximum weight, or 0n if graph has no edges
 */
export function findMaxEdgeWeight(graph: Graph): EdgeWeight {
  const findMaxReducer = (
    currentMax: EdgeWeight,
    edgeKey: GraphEdgeKey,
  ): EdgeWeight => {
    const edgeWeight = getEdgeWeight(graph, edgeKey);
    const isNewMax = edgeWeight > currentMax;

    if (isNewMax) {
      return edgeWeight;
    } else {
      return currentMax;
    }
  };

  return graph.reduceEdges(findMaxReducer, ZERO_DUAL);
}

/**
 * Initialises weighted matching state from graphology graph
 *
 * Extends base matching state with:
 * - Doubled edge weights (for integer dual updates)
 * - Vertex duals initialised to maxWeight (blossom duals added lazily)
 * - Empty best edge tracking maps
 *
 * @param graph - Graphology graph instance (weights will be doubled in place)
 * @returns Initialised weighted matching state
 */
export function initialiseWeightedState(graph: Graph): WeightedMatchingState {
  // Double weights first (modifies graph in place)
  doubleEdgeWeights(graph);

  // Find max weight after doubling
  const maxEdgeWeight = findMaxEdgeWeight(graph);

  // Initialise base state (vertices, blossoms, queue, adjacency)
  const baseState = initialiseState(graph);

  // Initialise duals: vertices get maxWeight, blossoms added when created
  const duals = new Map<NodeId, DualVariable>();
  for (const vertexKey of baseState.vertices.keys()) {
    duals.set(vertexKey, maxEdgeWeight);
  }

  // Empty maps for best edge tracking (populated during algorithm)
  const bestEdgeByNode = new Map<NodeId, GraphEdgeKey>();
  const blossomBestEdges = new Map<BlossomId, GraphEdgeKey[]>();

  const weightedState: WeightedMatchingState = {
    ...baseState,
    duals,
    bestEdgeByNode,
    blossomBestEdges,
    maxEdgeWeight,
  };

  return weightedState;
}

/**
 * Creates a blossom and initializes its dual variable for weighted matching.
 *
 * Wrapper around addBlossom that handles dual initialization.
 * Non-trivial blossoms start with dual = 0.
 *
 * @param state - Weighted matching state (modified in place)
 * @param vertexU - First endpoint of the edge creating the blossom
 * @param vertexV - Second endpoint of the edge creating the blossom
 */
export function addWeightedBlossom(
  state: WeightedMatchingState,
  vertexU: VertexKey,
  vertexV: VertexKey,
): void {
  // Get the blossom ID that will be assigned
  const newBlossomId = state.nextBlossomId;

  // Create the blossom (increments nextBlossomId)
  addBlossom(state, vertexU, vertexV);

  // Initialize dual for the new blossom
  state.duals.set(newBlossomId, ZERO_DUAL);
}
