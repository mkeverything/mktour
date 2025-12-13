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

import { initialiseState } from './initialization';
import type {
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
const EDGE_WEIGHT_ATTRIBUTE = 'weight';

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
 * Computes slack for an edge (vertex-only duals, no blossom accounting yet)
 *
 * Slack formula: dual[u] + dual[v] - weight (weight already doubled)
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

  const weight = getEdgeWeight(graph, edgeKey);
  const slack = dualU + dualV - weight;

  return slack;
}

/**
 * Checks if an edge is tight (slack = 0)
 *
 * @param state - Weighted matching state
 * @param graph - Graphology graph instance
 * @param edgeKey - Edge to check
 * @returns true if edge is tight
 */
export function isEdgeTight(
  state: WeightedMatchingState,
  graph: Graph,
  edgeKey: GraphEdgeKey,
): boolean {
  const slack = computeSlack(state, graph, edgeKey);
  return slack === ZERO_DUAL;
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
