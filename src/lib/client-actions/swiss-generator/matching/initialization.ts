/**
 * Initialization functions for Edmonds' Blossom Algorithm
 *
 * Contains functions for building initial algorithm state:
 * - Adjacency list construction
 * - Vertex state initialization
 * - Trivial blossom creation
 * - State reset between iterations
 */

import Graph from 'graphology';

import type {
  BlossomId,
  BlossomState,
  MatchingState,
  NeighbourSet,
  VertexKey,
  VertexState,
} from './types';
import { Label, NO_LABEL_ENDPOINT, NO_MATE, NO_PARENT_BLOSSOM } from './types';

/**
 * Builds adjacency list from graphology Graph
 *
 * @param graph - Graphology graph instance
 * @returns Adjacency list mapping vertex key to set of neighbour keys
 */
export function buildAdjacencyList(graph: Graph): Map<VertexKey, NeighbourSet> {
  const adjacencyList = new Map<VertexKey, NeighbourSet>();

  // Initialise empty neighbour sets for all vertices
  graph.forEachNode((vertexKey) => {
    const emptyNeighbourSet = new Set<VertexKey>();
    adjacencyList.set(vertexKey, emptyNeighbourSet);
  });

  // Populate adjacency list from graph edges
  graph.forEachEdge((_edgeKey, _attributes, sourceKey, targetKey) => {
    const sourceNeighbours = adjacencyList.get(sourceKey);
    const targetNeighbours = adjacencyList.get(targetKey);

    // Guard: ensure vertices exist in adjacency list
    if (sourceNeighbours === undefined) {
      throw new Error(`Source vertex ${sourceKey} not found in adjacency list`);
    }
    if (targetNeighbours === undefined) {
      throw new Error(`Target vertex ${targetKey} not found in adjacency list`);
    }

    // Add bidirectional edge (undirected graph)
    sourceNeighbours.add(targetKey);
    targetNeighbours.add(sourceKey);
  });

  return adjacencyList;
}

/**
 * Creates initial vertex state for algorithm
 *
 * Each vertex starts:
 * - Unmatched (mate = null)
 * - Unlabelled (label = NONE, labelEnd = null)
 * - In its own trivial blossom (inBlossom = vertexKey as BlossomId)
 *
 * @param vertexKey - Vertex key from graph
 * @param trivialBlossomId - ID of trivial blossom for this vertex
 * @returns Initialised vertex state
 */
export function createInitialVertexState(
  vertexKey: VertexKey,
  trivialBlossomId: BlossomId,
): VertexState {
  const initialState: VertexState = {
    key: vertexKey,
    mate: NO_MATE,
    label: Label.NONE,
    labelEnd: NO_LABEL_ENDPOINT,
    inBlossom: trivialBlossomId,
  };
  return initialState;
}

/**
 * Creates trivial blossom for a single vertex
 *
 * Trivial blossoms represent individual vertices before any
 * non-trivial blossoms are formed. They form the base of the
 * blossom hierarchy.
 *
 * Properties of trivial blossoms:
 * - No parent (top-level)
 * - Single child (the vertex itself)
 * - Base is the vertex
 * - Endpoints are meaningless (set to vertex for completeness)
 *
 * @param blossomId - Unique ID for this trivial blossom
 * @param vertexKey - Vertex key this blossom contains
 * @returns Trivial blossom state
 */
export function createTrivialBlossom(
  blossomId: BlossomId,
  vertexKey: VertexKey,
): BlossomState {
  const trivialBlossom: BlossomState = {
    id: blossomId,
    parent: NO_PARENT_BLOSSOM,
    children: [vertexKey],
    base: vertexKey,
    endpoints: [vertexKey, vertexKey],
  };
  return trivialBlossom;
}

/**
 * Initialises matching state from graphology Graph
 *
 * Creates initial algorithm state where:
 * - All vertices are unmatched
 * - All vertices are unlabelled
 * - Each vertex is in its own trivial blossom
 * - Processing queue is empty
 * - Adjacency list is built from graph
 *
 * Trivial blossoms are numbered 0, 1, 2, ... (same as iteration order).
 * Non-trivial blossoms will be numbered starting from nodeCount.
 *
 * @param graph - Graphology graph instance
 * @returns Initialised matching state
 */
export function initialiseState(graph: Graph): MatchingState {
  const totalVertices = graph.order;

  const vertices = new Map<VertexKey, VertexState>();
  const blossoms = new Map<BlossomId, BlossomState>();

  // Create vertex states and trivial blossoms
  let nextBlossomId: BlossomId = 0;
  graph.forEachNode((vertexKey) => {
    const trivialBlossomId = nextBlossomId;
    nextBlossomId++;

    // Create initial vertex state
    const vertexState = createInitialVertexState(vertexKey, trivialBlossomId);
    vertices.set(vertexKey, vertexState);

    // Create trivial blossom for this vertex
    const trivialBlossom = createTrivialBlossom(trivialBlossomId, vertexKey);
    blossoms.set(trivialBlossomId, trivialBlossom);
  });

  // Build adjacency list from graph structure
  const adjacencyList = buildAdjacencyList(graph);

  // Empty queue (will be populated during search stages)
  const emptyQueue: VertexKey[] = [];

  // Next blossom ID for non-trivial blossoms
  const firstNonTrivialBlossomId = totalVertices;

  const initialState: MatchingState = {
    vertices,
    blossoms,
    queue: emptyQueue,
    adjacencyList,
    nodeCount: totalVertices,
    nextBlossomId: firstNonTrivialBlossomId,
  };

  return initialState;
}

/**
 * Resets vertex labels and processing queue
 *
 * Must be called at the start of each augmenting path search stage
 * to clear labels from the previous iteration.
 *
 * This allows the algorithm to restart the BFS from all free vertices
 * without interference from previous search state.
 *
 * @param state - Matching state (modified in place)
 */
export function resetLabels(state: MatchingState): void {
  // Clear all vertex labels and label endpoints
  for (const [, vertexState] of state.vertices) {
    vertexState.label = Label.NONE;
    vertexState.labelEnd = NO_LABEL_ENDPOINT;
  }

  // Clear processing queue
  state.queue = [];
}
