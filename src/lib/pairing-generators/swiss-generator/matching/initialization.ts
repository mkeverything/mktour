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

import { IS_MATCHING_DEBUG_ENABLED, matchingLogger } from './matching-logger';
import type {
  BlossomId,
  BlossomState,
  MatchingState,
  NeighbourSet,
  VertexKey,
  VertexState,
} from './types';
import { Label, NO_MATE, NO_PARENT_BLOSSOM } from './types';

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
 * - In its own trivial blossom (inBlossom = trivialBlossomId)
 *
 * Note: labels are stored on blossoms, not vertices (per NetworkX)
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
    inBlossom: trivialBlossomId,
    blossomParent: null, // Not inside any non-trivial blossom initially
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
 * - Unlabelled (label = NONE, labelEnd = null)
 * - Endpoints are meaningless (set to vertex for completeness)
 * - No edges (single vertex has no junction edges)
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
    label: Label.NONE,
    labelEnd: null,
    labelEdgeVertex: null,
    endpoints: [vertexKey, vertexKey],
    edges: [],
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
 * Clears blossom labels and label endpoints
 *
 * Per NetworkX: labels are stored on blossoms, not vertices.
 * This resets all blossoms to unlabelled state at start of each search stage.
 *
 * @param state - Matching state (modified in place)
 */
function clearBlossomLabels(state: MatchingState): void {
  for (const [, blossom] of state.blossoms) {
    blossom.label = Label.NONE;
    blossom.labelEnd = null;
    blossom.labelEdgeVertex = null;
  }
}

/**
 * Resets each vertex to point to its trivial blossom
 *
 * Finds the trivial blossom for each vertex by matching the vertex key
 * to the blossom's base vertex. This ensures vertices are assigned to
 * their CORRECT trivial blossoms regardless of Map iteration order.
 *
 * @param state - Matching state (modified in place)
 */
function resetVerticesToTrivialBlossoms(state: MatchingState): void {
  // Build a map from base vertex to trivial blossom ID
  const baseToBlossomId = new Map<VertexKey, BlossomId>();
  for (const [blossomId, blossom] of state.blossoms) {
    const isTrivial = blossom.children.length === 1;
    if (isTrivial) {
      baseToBlossomId.set(blossom.base, blossomId);
    }
  }

  // Reset each vertex to its trivial blossom (where base === vertexKey)
  for (const [vertexKey, vertexState] of state.vertices) {
    const trivialBlossomId = baseToBlossomId.get(vertexKey);
    if (trivialBlossomId === undefined) {
      throw new Error(`Trivial blossom not found for vertex ${vertexKey}`);
    }
    vertexState.inBlossom = trivialBlossomId;
  }
}

/**
 * Removes non-trivial blossoms and resets trivial blossom parent pointers
 *
 * @param state - Matching state (modified in place)
 */
function removeNonTrivialBlossoms(state: MatchingState): void {
  const blossomIdsToRemove: BlossomId[] = [];

  for (const [blossomId, blossom] of state.blossoms) {
    const isTrivial = blossom.children.length === 1;
    if (isTrivial) {
      // Reset trivial blossom parent pointer
      blossom.parent = NO_PARENT_BLOSSOM;
    } else {
      // Mark non-trivial blossom for removal
      blossomIdsToRemove.push(blossomId);
    }
  }

  // Remove non-trivial blossoms
  for (const blossomId of blossomIdsToRemove) {
    state.blossoms.delete(blossomId);
  }

  // Reset nextBlossomId to start after trivial blossoms
  state.nextBlossomId = state.nodeCount;
}

/**
 * Resets vertex labels, processing queue, and blossom structure
 *
 * Must be called at the start of each augmenting path search stage.
 * Clears all state from the previous iteration including:
 * - Vertex labels and label endpoints
 * - Processing queue
 * - Non-trivial blossom structure
 *
 * Resetting blossoms to trivial state prevents blossom structure from
 * previous iterations causing incorrect augmenting path detection.
 *
 * @param state - Matching state (modified in place)
 */
export function resetLabels(state: MatchingState): void {
  const blossomCountBefore = state.blossoms.size;
  const nextIdBefore = state.nextBlossomId;

  clearBlossomLabels(state);
  resetVerticesToTrivialBlossoms(state);
  removeNonTrivialBlossoms(state);
  state.queue = [];

  if (IS_MATCHING_DEBUG_ENABLED) {
    matchingLogger.debug(
      `resetLabels: blossoms ${blossomCountBefore}→${state.blossoms.size}, ` +
        `nextBlossomId ${nextIdBefore}→${state.nextBlossomId}`,
    );
  }
}
