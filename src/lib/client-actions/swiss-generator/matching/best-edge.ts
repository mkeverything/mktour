/**
 * Best edge tracking for weighted Blossom algorithm
 *
 * Tracks minimum slack edges from S-labeled nodes to external vertices.
 * Used for efficient delta computation.
 *
 * References:
 * - NetworkX max_weight_matching implementation (bestedge)
 */

import Graph from 'graphology';

import { findBase } from './tree-operations';
import { computeSlack } from './weighted-operations';
import type {
  BlossomId,
  GraphEdgeKey,
  NodeId,
  VertexKey,
  WeightedMatchingState,
} from './types';

/**
 * Clears all best edge tracking data
 *
 * Called at the start of each stage to reset tracking state.
 * Both per-node best edges and blossom best edge lists are cleared.
 *
 * @param state - Weighted matching state (modified in place)
 */
export function clearBestEdges(state: WeightedMatchingState): void {
  state.bestEdgeByNode.clear();
  state.blossomBestEdges.clear();
}

/**
 * Updates best edge for a node if the candidate has smaller slack
 *
 * If no current best edge exists, the candidate becomes the best.
 * Otherwise, compares slacks and updates if candidate is better.
 *
 * @param state - Weighted matching state (modified in place)
 * @param graph - Graphology graph
 * @param nodeId - Node to update best edge for
 * @param candidateEdge - Candidate edge to consider
 */
export function updateBestEdge(
  state: WeightedMatchingState,
  graph: Graph,
  nodeId: NodeId,
  candidateEdge: GraphEdgeKey,
): void {
  const currentBestEdge = state.bestEdgeByNode.get(nodeId);

  if (currentBestEdge === undefined) {
    state.bestEdgeByNode.set(nodeId, candidateEdge);
  } else {
    const currentSlack = computeSlack(state, graph, currentBestEdge);
    const candidateSlack = computeSlack(state, graph, candidateEdge);
    const isCandidateBetter = candidateSlack < currentSlack;

    if (isCandidateBetter) {
      state.bestEdgeByNode.set(nodeId, candidateEdge);
    }
  }
}

/**
 * Scans a vertex's neighbours to update best edges
 *
 * When a vertex gets S-labelled, we scan its neighbours for potential
 * best edges to nodes outside the current blossom. Only cross-blossom
 * edges are considered (edges to different top-level blossoms).
 *
 * @param state - Weighted matching state (modified in place)
 * @param graph - Graphology graph
 * @param vertexKey - S-labelled vertex to scan from
 */
export function scanVertexForBestEdges(
  state: WeightedMatchingState,
  graph: Graph,
  vertexKey: VertexKey,
): void {
  const vertexBase = findBase(state, vertexKey);
  const neighbours = state.adjacencyList.get(vertexKey);
  const hasNeighbours = neighbours !== undefined;

  if (hasNeighbours) {
    for (const neighbourKey of neighbours) {
      const neighbourBase = findBase(state, neighbourKey);
      const isCrossBlossomEdge = vertexBase !== neighbourBase;

      if (isCrossBlossomEdge) {
        const edgeKey = graph.edge(vertexKey, neighbourKey);

        if (edgeKey !== undefined) {
          updateBestEdge(state, graph, vertexBase, edgeKey);
        }
      }
    }
  }
}

/**
 * Gathers best edges from a list of member nodes
 *
 * Collects best edges from each member node that has one.
 * Used when forming a blossom to preserve edges for later expansion.
 *
 * @param state - Weighted matching state
 * @param memberNodes - Node IDs to collect best edges from
 * @returns Array of collected edge keys
 */
export function gatherBestEdgesFromMembers(
  state: WeightedMatchingState,
  memberNodes: NodeId[],
): GraphEdgeKey[] {
  const collectedEdges: GraphEdgeKey[] = [];

  for (const memberNode of memberNodes) {
    const memberBestEdge = state.bestEdgeByNode.get(memberNode);
    const hasBestEdge = memberBestEdge !== undefined;

    if (hasBestEdge) {
      collectedEdges.push(memberBestEdge);
    }
  }

  return collectedEdges;
}

/**
 * Finds the edge with minimum slack from a list of edges
 *
 * Used to determine the overall best edge for a blossom
 * from its collected member edges.
 *
 * @param state - Weighted matching state
 * @param graph - Graphology graph
 * @param edges - Edge keys to compare
 * @returns Edge with minimum slack, or null if list is empty
 */
export function findMinimumSlackEdge(
  state: WeightedMatchingState,
  graph: Graph,
  edges: GraphEdgeKey[],
): GraphEdgeKey | null {
  let bestEdge: GraphEdgeKey | null = null;
  let bestSlack: bigint | null = null;

  for (const candidateEdge of edges) {
    const candidateSlack = computeSlack(state, graph, candidateEdge);
    const isFirstOrBetter = bestSlack === null || candidateSlack < bestSlack;

    if (isFirstOrBetter) {
      bestEdge = candidateEdge;
      bestSlack = candidateSlack;
    }
  }

  return bestEdge;
}

/**
 * Stores collected edges for a blossom and sets its overall best edge
 *
 * Called when a blossom is formed. Stores the edge list for later use
 * (when blossom might be expanded) and computes the overall best edge.
 *
 * @param state - Weighted matching state (modified in place)
 * @param graph - Graphology graph
 * @param blossomId - ID of the blossom to store edges for
 * @param edges - Collected edges from member nodes
 */
export function storeBlossomBestEdges(
  state: WeightedMatchingState,
  graph: Graph,
  blossomId: BlossomId,
  edges: GraphEdgeKey[],
): void {
  state.blossomBestEdges.set(blossomId, edges);

  const overallBestEdge = findMinimumSlackEdge(state, graph, edges);
  const hasOverallBest = overallBestEdge !== null;

  if (hasOverallBest) {
    state.bestEdgeByNode.set(blossomId, overallBestEdge);
  }
}

/** Empty edge list returned when blossom has no stored edges */
const NO_STORED_EDGES: GraphEdgeKey[] = [];

/**
 * Retrieves stored best edges for a blossom being expanded
 *
 * When expanding a blossom, we retrieve the edges that were stored
 * when it was formed. Returns empty array if no edges were stored.
 *
 * @param state - Weighted matching state
 * @param blossomId - ID of the blossom being expanded
 * @returns Array of stored edge keys (may be empty)
 */
export function retrieveBlossomBestEdges(
  state: WeightedMatchingState,
  blossomId: BlossomId,
): GraphEdgeKey[] {
  const storedEdges = state.blossomBestEdges.get(blossomId);
  const hasStoredEdges = storedEdges !== undefined;

  if (hasStoredEdges) {
    return storedEdges;
  } else {
    return NO_STORED_EDGES;
  }
}
