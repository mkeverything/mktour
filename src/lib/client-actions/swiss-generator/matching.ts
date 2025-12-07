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

import type {
  AugmentFromVertexStartInfo,
  AugmentFromVertexStepInfo,
  AugmentingPathInfo,
  AugmentMatchingStartInfo,
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

// ============================================================================
// Public API Types
// ============================================================================

/** Vertex key from graphology Graph */
export type VertexKey = string;

/** Mate in matching: vertex key or null if unmatched */
export type Mate = VertexKey | null;

/** Matching result mapping each vertex to its mate (or null) */
export type MatchingResult = Map<VertexKey, Mate>;

// ============================================================================
// Internal Algorithm Types
// ============================================================================

/** Identifier for a blossom (unique numeric ID) */
type BlossomId = number;

/** Identifier for either a vertex or blossom */
type NodeId = VertexKey | BlossomId;

/** Parent blossom: blossom ID or null if top-level */
type ParentBlossom = BlossomId | null;

/** Label endpoint: vertex key or null if not labelled */
type LabelEndpoint = VertexKey | null;

/** Set of adjacent vertex keys */
type NeighbourSet = Set<VertexKey>;

/** Children of a blossom (can be vertices or sub-blossoms) */
type BlossomChildren = NodeId[];

/** Result of scanning and labelling a vertex's neighbours */
type ScanAndLabelResult = [VertexKey, VertexKey] | null;

// ============================================================================
// Enums
// ============================================================================

/**
 * Label assigned to vertices during augmenting path search
 */
enum Label {
  /** Vertex is not in any alternating tree */
  NONE = 'NONE',

  /** Vertex is S-labelled: root or odd distance from root in alternating tree */
  S = 'S',

  /** Vertex is T-labelled: even distance from root in alternating tree */
  T = 'T',
}

// ============================================================================
// Interfaces
// ============================================================================

/**
 * State information for a single vertex
 */
interface VertexState {
  /** Vertex key from graph */
  readonly key: VertexKey;

  /** Current mate (partner in matching), or null if unmatched */
  mate: Mate;

  /** Label for augmenting path search */
  label: Label;

  /** Endpoint of edge that gave this vertex its label, or null if unlabelled */
  labelEnd: LabelEndpoint;

  /** ID of blossom containing this vertex */
  inBlossom: BlossomId;
}

/**
 * State information for a blossom
 */
interface BlossomState {
  /** Unique identifier for this blossom */
  readonly id: BlossomId;

  /** Parent blossom in hierarchy, or null if top-level */
  parent: ParentBlossom;

  /** Children (vertices or sub-blossoms) forming the blossom */
  children: BlossomChildren;

  /** Base vertex where blossom connects to alternating tree */
  base: VertexKey;

  /** Edge endpoints where this blossom was created */
  endpoints: [VertexKey, VertexKey];
}

/**
 * Overall state of the matching algorithm
 */
interface MatchingState {
  /** State for each vertex in the graph, keyed by vertex key */
  vertices: Map<VertexKey, VertexState>;

  /** State for each blossom, keyed by blossom ID */
  blossoms: Map<BlossomId, BlossomState>;

  /** Queue of S-labelled vertices to process */
  queue: VertexKey[];

  /** Adjacency list representation of graph */
  adjacencyList: Map<VertexKey, NeighbourSet>;

  /** Total number of vertices in original graph */
  readonly nodeCount: number;

  /** Next available blossom ID */
  nextBlossomId: BlossomId;
}

/**
 * Result of finding lowest common ancestor in alternating tree
 */
interface LowestCommonAncestorResult {
  /** The LCA blossom ID where paths converge */
  lcaBlossomId: BlossomId;

  /** Path of blossom IDs from first vertex to LCA (excluding LCA) */
  pathFromU: BlossomId[];

  /** Path of blossom IDs from second vertex to LCA (excluding LCA) */
  pathFromV: BlossomId[];
}

/**
 * Result of processing a single step in alternating tree traversal
 */
interface TraversalStepResult {
  /** Current vertex being processed */
  currentVertex: VertexKey;

  /** Base vertex for this step */
  baseVertex: VertexKey;

  /** Base vertex state */
  baseState: VertexState;

  /** Whether this step reached the root */
  isRoot: boolean;
}

/**
 * Result of determining walk direction through blossom cycle
 */
interface WalkDirection {
  /** Step size for each iteration: +1 for forward, -1 for backward */
  stepSize: number;

  /** Distance from entry to base in chosen direction */
  distance: number;
}

/**
 * Result of an augmenting step including next vertex to continue from
 */
interface AugmentStepResult {
  /** Whether to continue augmenting */
  shouldContinue: boolean;

  /** Next vertex to continue from (null if shouldContinue is false) */
  nextVertex: VertexKey | null;
}

// ============================================================================
// Constants for Initial State
// ============================================================================

/** Indicates top-level blossom with no parent */
const NO_PARENT_BLOSSOM: ParentBlossom = null;

/** Indicates vertex is unmatched */
const NO_MATE: Mate = null;

/** Indicates vertex has no label endpoint */
const NO_LABEL_ENDPOINT: LabelEndpoint = null;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Builds adjacency list from graphology Graph
 *
 * @param graph - Graphology graph instance
 * @returns Adjacency list mapping vertex key to set of neighbour keys
 */
function buildAdjacencyList(graph: Graph): Map<VertexKey, NeighbourSet> {
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
function createInitialVertexState(
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
function createTrivialBlossom(
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
function initialiseState(graph: Graph): MatchingState {
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
function resetLabels(state: MatchingState): void {
  // Clear all vertex labels and label endpoints
  for (const [, vertexState] of state.vertices) {
    vertexState.label = Label.NONE;
    vertexState.labelEnd = NO_LABEL_ENDPOINT;
  }

  // Clear processing queue
  state.queue = [];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Result of finding lowest common ancestor
 */
interface LowestCommonAncestorResult {
  /** The LCA blossom ID where paths converge */
  lcaBlossomId: BlossomId;

  /** Path of blossom IDs from first vertex to LCA (excluding LCA) */
  pathFromU: BlossomId[];

  /** Path of blossom IDs from second vertex to LCA (excluding LCA) */
  pathFromV: BlossomId[];
}

/**
 * Finds the base vertex of the top-level blossom containing a vertex
 *
 * The base is the vertex where the blossom connects to the alternating tree.
 * This function follows the blossom parent chain upward until reaching a
 * top-level blossom, then returns its base vertex.
 *
 * Example:
 * - Vertex v is in blossom B1
 * - Blossom B1 is contained in blossom B2
 * - Blossom B2 is top-level with base vertex u
 * - Result: u
 *
 * @param state - Current matching state
 * @param vertexKey - Vertex to find base for
 * @returns Base vertex of the top-level blossom containing this vertex
 */
function findBase(state: MatchingState, vertexKey: VertexKey): VertexKey {
  // Get the vertex state
  const vertexState = state.vertices.get(vertexKey);
  if (vertexState === undefined) {
    throw new Error(`Vertex ${vertexKey} not found in state`);
  }

  // Start with the blossom containing this vertex
  let currentBlossomId = vertexState.inBlossom;
  let currentBlossom = state.blossoms.get(currentBlossomId);

  if (currentBlossom === undefined) {
    throw new Error(`Blossom ${currentBlossomId} not found in state`);
  }

  // Follow parent chain to find top-level blossom
  let parentBlossomId = currentBlossom.parent;
  while (parentBlossomId !== null) {
    currentBlossomId = parentBlossomId;
    currentBlossom = state.blossoms.get(currentBlossomId);

    if (currentBlossom === undefined) {
      throw new Error(`Blossom ${currentBlossomId} not found in state`);
    }

    parentBlossomId = currentBlossom.parent;
  }

  // Return base of top-level blossom
  return currentBlossom.base;
}

/**
 * Checks if a vertex is a root of an alternating tree
 *
 * A vertex is a root if it is S-labelled and its labelEnd points to itself.
 *
 * @param vertexState - Vertex state to check
 * @returns true if vertex is a root
 */
function isAlternatingTreeRoot(vertexState: VertexState): boolean {
  const isSLabelled = vertexState.label === Label.S;
  const labelEndPointsToSelf = vertexState.labelEnd === vertexState.key;
  return isSLabelled && labelEndPointsToSelf;
}

/**
 * Gets the base vertex state for a given vertex
 *
 * Combines finding the base vertex and retrieving its state with guard checks.
 * This is a common pattern used throughout the algorithm.
 *
 * @param state - Current matching state
 * @param vertex - Vertex to find base state for
 * @returns Tuple of [base vertex key, base vertex state]
 */
function getBaseVertexState(
  state: MatchingState,
  vertex: VertexKey,
): [VertexKey, VertexState] {
  const baseVertex = findBase(state, vertex);
  const baseState = state.vertices.get(baseVertex);

  if (baseState === undefined) {
    throw new Error(`Base vertex ${baseVertex} not found in state`);
  }

  return [baseVertex, baseState];
}

/**
 * Generic traversal toward root of alternating tree
 *
 * Follows labelEnd pointers upward through alternating tree,
 * calling the step processor for each vertex visited.
 *
 * The inner check `if (!reachedRoot)` is necessary to prevent accessing
 * labelEnd when we've reached the root or stopped early, as roots don't
 * have meaningful labelEnd pointers.
 *
 * @param state - Current matching state
 * @param startVertex - Vertex to start traversal from
 * @param processStep - Callback invoked for each step; returns true to stop early
 */
function traverseTowardRoot(
  state: MatchingState,
  startVertex: VertexKey,
  processStep: (step: TraversalStepResult) => boolean,
): void {
  let currentVertex = startVertex;
  let reachedRoot = false;

  while (!reachedRoot) {
    const [baseVertex, baseState] = getBaseVertexState(state, currentVertex);
    const isRoot = isAlternatingTreeRoot(baseState);

    const stepResult: TraversalStepResult = {
      currentVertex,
      baseVertex,
      baseState,
      isRoot,
    };
    const shouldStopEarly = processStep(stepResult);

    reachedRoot = isRoot || shouldStopEarly;

    // Only move to next vertex if we haven't reached root and shouldn't stop
    // Roots don't have meaningful labelEnd pointers, so we must check first
    if (!reachedRoot) {
      const labelEnd = baseState.labelEnd;
      if (labelEnd === null) {
        throw new Error(
          `Vertex ${baseVertex} has label ${baseState.label} but no labelEnd`,
        );
      }

      currentVertex = labelEnd;
    }
  }
}

/**
 * Builds path from a vertex to the root of its alternating tree
 *
 * Follows labelEnd edges upward through the alternating tree structure,
 * recording the blossom IDs along the path.
 *
 * @param state - Current matching state
 * @param startVertex - Vertex to start from
 * @returns Array of blossom IDs from start to root (inclusive)
 */
function buildPathToRoot(
  state: MatchingState,
  startVertex: VertexKey,
): BlossomId[] {
  const path: BlossomId[] = [];

  const addBlossomToPath = (step: TraversalStepResult): boolean => {
    const blossomId = step.baseState.inBlossom;
    path.push(blossomId);
    const shouldStopEarly = false;
    return shouldStopEarly;
  };

  traverseTowardRoot(state, startVertex, addBlossomToPath);

  return path;
}

/**
 * Finds the root vertex of the alternating tree containing a given vertex
 *
 * Follows labelEnd pointers upward until reaching a vertex whose labelEnd
 * points to itself (i.e., an S-labelled root).
 *
 * This is distinct from findBase() which returns the blossom base. Two vertices
 * can be in different blossoms (different bases) but still in the same
 * alternating tree (same root).
 *
 * @param state - Current matching state
 * @param vertex - Vertex to find root for
 * @returns Root vertex of the alternating tree
 */
function findAlternatingTreeRoot(
  state: MatchingState,
  vertex: VertexKey,
): VertexKey {
  let rootVertex: VertexKey | null = null;

  const captureRoot = (step: TraversalStepResult): boolean => {
    if (step.isRoot) {
      rootVertex = step.baseVertex;
      const shouldStopEarly = true;
      return shouldStopEarly;
    }
    const shouldContinue = false;
    return shouldContinue;
  };

  traverseTowardRoot(state, vertex, captureRoot);

  if (rootVertex === null) {
    throw new Error(
      `Failed to find alternating tree root for vertex ${vertex}`,
    );
  }

  return rootVertex;
}

/**
 * Constructs LCA result from paths and intersection point
 *
 * Trims the first path to exclude LCA (second path already excludes it)
 *
 * @param lcaBlossomId - The blossom ID where paths intersect
 * @param firstPath - First path (will be trimmed to exclude LCA)
 * @param secondPath - Second path (already excludes LCA)
 * @returns LCA result with trimmed paths
 */
function buildLCAResult(
  lcaBlossomId: BlossomId,
  firstPath: BlossomId[],
  secondPath: BlossomId[],
): LowestCommonAncestorResult {
  // Trim first path to exclude LCA
  const lcaIndexInFirstPath = firstPath.indexOf(lcaBlossomId);
  const trimmedFirstPath = firstPath.slice(0, lcaIndexInFirstPath);

  const result: LowestCommonAncestorResult = {
    lcaBlossomId,
    pathFromU: trimmedFirstPath,
    pathFromV: secondPath,
  };

  return result;
}

/**
 * Finds where two paths intersect
 *
 * Builds the second path while checking for intersection with the first path.
 * Checks for intersection BEFORE adding to path to avoid trimming.
 *
 * @param state - Current matching state
 * @param startVertex - Vertex to build second path from
 * @param firstPath - First path to check intersection against
 * @returns Intersection result with LCA and trimmed paths, or null if no intersection
 */
function findPathIntersection(
  state: MatchingState,
  startVertex: VertexKey,
  firstPath: BlossomId[],
): LowestCommonAncestorResult | null {
  const pathBeforeLCA: BlossomId[] = [];
  const firstPathSet = new Set(firstPath);
  let intersectionBlossomId: BlossomId | null = null;

  const checkForIntersection = (step: TraversalStepResult): boolean => {
    const blossomId = step.baseState.inBlossom;

    // Check for intersection BEFORE adding to path
    const foundIntersection = firstPathSet.has(blossomId);
    if (foundIntersection) {
      intersectionBlossomId = blossomId;
      const shouldStopEarly = true;
      return shouldStopEarly;
    } else {
      // Add to path (LCA won't be added since we stop when found)
      pathBeforeLCA.push(blossomId);
      const shouldStopEarly = false;
      return shouldStopEarly;
    }
  };

  traverseTowardRoot(state, startVertex, checkForIntersection);

  // Return result based on whether intersection was found
  if (intersectionBlossomId !== null) {
    const result = buildLCAResult(
      intersectionBlossomId,
      firstPath,
      pathBeforeLCA,
    );
    return result;
  } else {
    return null;
  }
}

/**
 * Finds the lowest common ancestor blossom of two vertices in the alternating tree
 *
 * Used when an edge connects two S-vertices in the same alternating tree,
 * indicating a blossom should be created. The LCA is where the two paths converge.
 *
 * @param state - Current matching state
 * @param vertexU - First vertex
 * @param vertexV - Second vertex
 * @returns LCA result with blossom ID and trimmed paths
 */
function findLowestCommonAncestor(
  state: MatchingState,
  vertexU: VertexKey,
  vertexV: VertexKey,
): LowestCommonAncestorResult {
  // Build path from U to root
  const pathFromU = buildPathToRoot(state, vertexU);

  // Find where path from V intersects path from U
  const intersection = findPathIntersection(state, vertexV, pathFromU);

  if (intersection === null) {
    throw new Error(
      `No common ancestor found for vertices ${vertexU} and ${vertexV} - not in same tree`,
    );
  }

  return intersection;
}

// ============================================================================
// Core Algorithm Functions
// ============================================================================

/**
 * Constant indicating no edge was found during scan
 */
const NO_EDGE_FOUND: ScanAndLabelResult = null;

/**
 * Assigns a label to a vertex during augmenting path search
 *
 * S-vertices are roots or at odd distance from root in the alternating tree.
 * T-vertices are matched vertices at even distance from root.
 *
 * The label is assigned to the base vertex of the top-level blossom containing
 * the vertex. If labelling as S, the vertex is added to the processing queue.
 *
 * @param state - Current matching state (modified in place)
 * @param vertex - Vertex to label
 * @param label - Label to assign (S or T)
 * @param labelEnd - Endpoint of edge that caused this labelling
 */
function assignLabel(
  state: MatchingState,
  vertex: VertexKey,
  label: Label,
  labelEnd: VertexKey,
): void {
  // Find the base vertex of the top-level blossom containing this vertex
  const [baseVertex, baseState] = getBaseVertexState(state, vertex);

  // Assign label and label endpoint to the base vertex
  baseState.label = label;
  baseState.labelEnd = labelEnd;

  // If labelling as S, add to queue for processing
  if (label === Label.S) {
    state.queue.push(baseVertex);
  }
}

/**
 * Scans and labels neighbours of an S-labelled vertex
 *
 * Examines each neighbour edge and takes action:
 * - Free vertex → returns edge (augmenting path)
 * - S-labelled vertex → returns edge (caller determines blossom vs augmenting path)
 * - Unlabelled matched vertex → labels neighbour and its mate, returns null
 * - T-labelled vertex → skip
 *
 * When an edge is returned with both endpoints S-labelled, caller must check
 * if they're in the same tree (create blossom) or different trees (augmenting path).
 *
 * @param state - Current matching state (modified when labeling neighbours)
 * @param vertex - S-labelled vertex to scan from
 * @returns Edge if found (for augmenting path or blossom), null otherwise
 */
function scanAndLabelNeighbours(
  state: MatchingState,
  vertex: VertexKey,
): ScanAndLabelResult {
  const neighbours = state.adjacencyList.get(vertex);
  if (neighbours === undefined) {
    throw new Error(`Vertex ${vertex} not found in adjacency list`);
  }

  const [vertexBase] = getBaseVertexState(state, vertex);

  for (const neighbour of neighbours) {
    const [neighbourBase, neighbourBaseState] = getBaseVertexState(
      state,
      neighbour,
    );

    // Skip internal edges within same top-level blossom
    const isInternalEdge = vertexBase === neighbourBase;

    if (!isInternalEdge) {
      const neighbourLabel = neighbourBaseState.label;

      // Case 1: Neighbour is unlabelled
      if (neighbourLabel === Label.NONE) {
        const neighbourMate = neighbourBaseState.mate;

        if (neighbourMate === null) {
          // Neighbour is free - found augmenting path
          const edge: ScanAndLabelResult = [vertex, neighbour];
          return edge;
        } else {
          // Neighbour is matched - extend alternating tree by labeling
          assignLabel(state, neighbour, Label.T, vertex);
          assignLabel(state, neighbourMate, Label.S, neighbourBase);
          // Continue scanning (return null at end if nothing else found)
        }
      }
      // Case 2: Neighbour is S-labelled
      else if (neighbourLabel === Label.S) {
        // Return edge for caller to determine if blossom or augmenting path
        const edge: ScanAndLabelResult = [vertex, neighbour];
        return edge;
      }
      // Case 3: Neighbour is T-labelled - skip (cannot extend through T-vertex)
    }
  }

  // No augmenting path or blossom edge found
  return NO_EDGE_FOUND;
}

/**
 * Creates a new blossom from an odd-length cycle in the alternating tree
 *
 * Called when an edge connects two S-labelled vertices in the same alternating
 * tree. The cycle is formed by the edge plus the paths from both vertices up
 * to their lowest common ancestor (LCA).
 *
 * Algorithm:
 * 1. Find LCA and paths from both vertices to it
 * 2. Create new blossom with children: pathFromU + [LCA] + reverse(pathFromV)
 * 3. Update parent pointers for all sub-blossoms in the cycle
 *
 * The new blossom:
 * - Contains all blossoms in the cycle (sub-blossoms become children)
 * - Inherits the base vertex from the LCA blossom
 * - Becomes the new top-level blossom (parent pointers updated)
 * - Does NOT need label assignment (base vertex already has correct S-label)
 *
 * Note: We don't need to recursively update inBlossom for vertices because
 * findBase() follows the parent chain upward to find the top-level blossom.
 * The parent pointers maintain the hierarchy correctly.
 *
 * @param state - Current matching state (modified in place)
 * @param vertexU - First endpoint of the edge creating the blossom
 * @param vertexV - Second endpoint of the edge creating the blossom
 */
function addBlossom(
  state: MatchingState,
  vertexU: VertexKey,
  vertexV: VertexKey,
): void {
  // Find the lowest common ancestor and paths from both vertices
  const lcaResult = findLowestCommonAncestor(state, vertexU, vertexV);
  const { lcaBlossomId, pathFromU, pathFromV } = lcaResult;

  // Get the LCA blossom to inherit its base
  const lcaBlossom = state.blossoms.get(lcaBlossomId);
  if (lcaBlossom === undefined) {
    throw new Error(`LCA blossom ${lcaBlossomId} not found in state`);
  }

  // Allocate new blossom ID
  const newBlossomId = state.nextBlossomId;
  state.nextBlossomId++;

  // Build children list forming the cycle around the blossom
  // Order: pathFromU (U→LCA excluding LCA) + [LCA] + reverse(pathFromV) (LCA→V excluding LCA)
  const reversedPathFromV = [...pathFromV].reverse();
  const childBlossomIds: BlossomId[] = [
    ...pathFromU,
    lcaBlossomId,
    ...reversedPathFromV,
  ];

  // Create the new blossom
  const newBlossom: BlossomState = {
    id: newBlossomId,
    parent: NO_PARENT_BLOSSOM,
    children: childBlossomIds,
    base: lcaBlossom.base,
    endpoints: [vertexU, vertexV],
  };

  // Add to blossoms map
  state.blossoms.set(newBlossomId, newBlossom);

  // Update parent pointers for all sub-blossoms
  // This is sufficient - findBase() will follow the parent chain upward
  for (const childBlossomId of childBlossomIds) {
    const childBlossom = state.blossoms.get(childBlossomId);
    if (childBlossom === undefined) {
      throw new Error(`Child blossom ${childBlossomId} not found in state`);
    }
    childBlossom.parent = newBlossomId;
  }

  // Note: No need to modify labels or queue - the base vertex already
  // has the correct S-label and queue status from before blossom creation.
  // No need to update inBlossom for vertices - findBase() follows parent chain.
}

// ============================================================================
// Blossom Expansion Constants and Helpers
// ============================================================================

/**
 * Constant indicating element not found in array
 */
const NOT_FOUND_IN_ARRAY = -1;

/**
 * Step size for walking forward through cycle
 */
const STEP_FORWARD = 1;

/**
 * Step size for walking backward through cycle
 */
const STEP_BACKWARD = -1;

/**
 * Minimum number of children for a non-trivial blossom
 * (Trivial blossoms contain exactly 1 child - the vertex itself)
 */
const MIN_CHILDREN_FOR_NONTRIVIAL_BLOSSOM = 2;

/**
 * Finds the index of a blossom in a parent blossom's children array
 *
 * @param childBlossomId - Blossom to find
 * @param children - Children array to search
 * @returns Index of child in array
 * @throws Error if child not found in array
 */
function findChildIndex(
  childBlossomId: BlossomId,
  children: BlossomChildren,
): number {
  const index = children.indexOf(childBlossomId);

  if (index === NOT_FOUND_IN_ARRAY) {
    throw new Error(`Blossom ${childBlossomId} not found in children array`);
  }

  return index;
}

/**
 * Determines which direction to walk around a blossom cycle
 *
 * Given entry and base positions in a circular array, calculates
 * whether to walk forward or backward to minimize distance.
 *
 * @param entryIndex - Starting position in cycle
 * @param baseIndex - Target position in cycle
 * @param cycleLength - Total length of cycle
 * @returns Walk direction (stepSize +1 or -1) and distance
 */
function determineWalkDirection(
  entryIndex: number,
  baseIndex: number,
  cycleLength: number,
): WalkDirection {
  const forwardDistance = (baseIndex - entryIndex + cycleLength) % cycleLength;
  const backwardDistance = (entryIndex - baseIndex + cycleLength) % cycleLength;

  const shouldWalkForward = forwardDistance <= backwardDistance;
  const stepSize = shouldWalkForward ? STEP_FORWARD : STEP_BACKWARD;
  const distance = shouldWalkForward ? forwardDistance : backwardDistance;

  const direction: WalkDirection = { stepSize, distance };
  return direction;
}

/**
 * Restores blossom children to top-level (removes parent pointers)
 *
 * When expanding a blossom, its children become top-level blossoms again.
 *
 * @param state - Current matching state
 * @param blossom - Blossom whose children to restore
 */
function restoreChildrenToTopLevel(
  state: MatchingState,
  blossom: BlossomState,
): void {
  for (const childBlossomId of blossom.children) {
    // Type guard: ensure we only have blossom IDs
    if (typeof childBlossomId === 'string') {
      throw new Error(
        `Blossom ${blossom.id} children should only contain blossom IDs, not vertex keys`,
      );
    }

    const childBlossom = state.blossoms.get(childBlossomId);
    if (childBlossom === undefined) {
      throw new Error(`Child blossom ${childBlossomId} not found in state`);
    }

    childBlossom.parent = NO_PARENT_BLOSSOM;
  }
}

/**
 * Expands a blossom when an augmenting path passes through it
 *
 * When an augmenting path enters a blossom at some vertex, we need to:
 * 1. Find which sub-blossom contains the entry vertex
 * 2. Trace the path through the blossom's cycle to the base
 * 3. Update the matching along this path (alternating matched/unmatched edges)
 * 4. Recursively expand any sub-blossoms encountered
 * 5. Update parent pointers to restore the blossom hierarchy
 *
 * The blossom's children form a cycle. The base is at some position in this cycle.
 * We walk from the entry point toward the base, flipping edges to maintain
 * the alternating path structure.
 *
 * @param state - Current matching state (modified in place)
 * @param blossomId - Blossom to expand
 * @param entryVertex - Vertex where augmenting path enters the blossom
 */
function expandBlossom(
  state: MatchingState,
  blossomId: BlossomId,
  entryVertex: VertexKey,
): void {
  const blossom = state.blossoms.get(blossomId);
  if (blossom === undefined) {
    throw new Error(`Blossom ${blossomId} not found in state`);
  }

  // Find which sub-blossom contains the entry vertex
  const entryVertexState = state.vertices.get(entryVertex);
  if (entryVertexState === undefined) {
    throw new Error(`Entry vertex ${entryVertex} not found in state`);
  }

  const entryBlossomId = entryVertexState.inBlossom;
  const entryIndex = findChildIndex(entryBlossomId, blossom.children);

  // Find the base sub-blossom
  const baseVertex = blossom.base;
  const baseVertexState = state.vertices.get(baseVertex);
  if (baseVertexState === undefined) {
    throw new Error(`Base vertex ${baseVertex} not found in state`);
  }

  const baseBlossomId = baseVertexState.inBlossom;
  const baseIndex = findChildIndex(baseBlossomId, blossom.children);

  // Determine direction to walk around the cycle
  const cycleLength = blossom.children.length;
  const walkDirection = determineWalkDirection(
    entryIndex,
    baseIndex,
    cycleLength,
  );

  // Walk from entry toward base, recursively expanding sub-blossoms
  let currentIndex = entryIndex;

  for (
    let stepsWalked = 0;
    stepsWalked < walkDirection.distance;
    stepsWalked++
  ) {
    const currentChildId = blossom.children[currentIndex];

    // Type guard: ensure we only have blossom IDs
    if (typeof currentChildId === 'string') {
      throw new Error(
        `Blossom ${blossomId} children should only contain blossom IDs, not vertex keys`,
      );
    }

    const currentChild = state.blossoms.get(currentChildId);
    if (currentChild === undefined) {
      throw new Error(`Child blossom ${currentChildId} not found in state`);
    }

    // Recursively expand non-trivial sub-blossoms
    const childCount = currentChild.children.length;
    const isNonTrivialBlossom =
      childCount >= MIN_CHILDREN_FOR_NONTRIVIAL_BLOSSOM;

    if (isNonTrivialBlossom) {
      expandBlossom(state, currentChildId, currentChild.base);
    }

    // Move to next child in cycle
    // Uses modulo arithmetic to wrap around: (index + step + length) % length
    // ensures result is always positive and within [0, length)
    const nextIndex = currentIndex + walkDirection.stepSize;
    const wrappedIndex = (nextIndex + cycleLength) % cycleLength;
    currentIndex = wrappedIndex;
  }

  // Restore parent pointers - make children top-level again
  restoreChildrenToTopLevel(state, blossom);

  // Note: The blossom itself remains in the blossoms map but is no longer
  // referenced via parent pointers, effectively making it "expanded"
}

// ============================================================================
// Augmenting Path Functions
// ============================================================================

/**
 * Constant indicating no next vertex in augmenting path traversal
 */
const NO_NEXT_VERTEX: VertexKey | null = null;

/**
 * Updates mate assignments for two vertices
 *
 * Sets both vertices to be matched with each other, clearing any
 * previous mate assignments to maintain matching symmetry.
 *
 * @param state - Current matching state
 * @param vertexU - First vertex
 * @param vertexV - Second vertex
 */
function updateMates(
  state: MatchingState,
  vertexU: VertexKey,
  vertexV: VertexKey,
): void {
  const stateU = state.vertices.get(vertexU);
  const stateV = state.vertices.get(vertexV);

  if (stateU === undefined) {
    throw new Error(`Vertex ${vertexU} not found in state`);
  }
  if (stateV === undefined) {
    throw new Error(`Vertex ${vertexV} not found in state`);
  }

  // Clear old mate pointers to maintain symmetry
  const oldMateU = stateU.mate;
  const oldMateV = stateV.mate;

  if (oldMateU !== null && oldMateU !== vertexV) {
    const oldMateUState = state.vertices.get(oldMateU);
    if (oldMateUState !== undefined) {
      oldMateUState.mate = null;
    }
  }

  if (oldMateV !== null && oldMateV !== vertexU) {
    const oldMateVState = state.vertices.get(oldMateV);
    if (oldMateVState !== undefined) {
      oldMateVState.mate = null;
    }
  }

  // Set new mates
  stateU.mate = vertexV;
  stateV.mate = vertexU;
}

/**
 * Processes one step of augmenting path traversal
 *
 * @param state - Current matching state
 * @param step - Traversal step information
 * @returns Result indicating whether to continue and next vertex
 */
function processAugmentStep(
  state: MatchingState,
  step: TraversalStepResult,
): AugmentStepResult {
  const { currentVertex, baseVertex, baseState, isRoot } = step;

  // Expand blossom if current vertex is inside one
  // IMPORTANT: Must do this BEFORE checking isRoot, because the vertex might
  // be inside a blossom that needs expansion even if the blossom base is a root
  // We check the CURRENT vertex's blossom, not the base vertex's
  const currentVertexState = state.vertices.get(currentVertex);
  if (currentVertexState === undefined) {
    throw new Error(`Vertex ${currentVertex} not found in state`);
  }

  const currentBlossomId = currentVertexState.inBlossom;
  const currentBlossom = state.blossoms.get(currentBlossomId);
  if (currentBlossom === undefined) {
    throw new Error(`Blossom ${currentBlossomId} not found in state`);
  }

  const isInsideBlossom = currentBlossom.parent !== NO_PARENT_BLOSSOM;
  if (isInsideBlossom) {
    const parentBlossomId = currentBlossom.parent;
    if (parentBlossomId === null) {
      throw new Error('Expected non-null parent for nested blossom');
    }
    expandBlossom(state, parentBlossomId, currentVertex);
  }

  // Check if we've reached a root AFTER expanding blossoms
  if (isRoot) {
    const stopResult: AugmentStepResult = {
      shouldContinue: false,
      nextVertex: NO_NEXT_VERTEX,
    };
    return stopResult;
  }

  // Get the vertex that gave this base its label
  const labelEnd = baseState.labelEnd;
  if (labelEnd === null) {
    throw new Error(
      `Vertex ${baseVertex} has label ${baseState.label} but no labelEnd`,
    );
  }

  // Find who labelEnd was matched to before
  const [labelEndBase, labelEndBaseState] = getBaseVertexState(state, labelEnd);
  const previousMate = labelEndBaseState.mate;

  if (previousMate === null) {
    // labelEnd was free (shouldn't happen in augmenting path, stop here)
    const stopResult: AugmentStepResult = {
      shouldContinue: false,
      nextVertex: NO_NEXT_VERTEX,
    };
    return stopResult;
  }

  // Match labelEnd with current's base
  updateMates(state, labelEndBase, baseVertex);

  // Continue from labelEnd's previous mate
  const continueResult: AugmentStepResult = {
    shouldContinue: true,
    nextVertex: previousMate,
  };
  return continueResult;
}

/**
 * Augments matching along path from a vertex toward its alternating tree root
 *
 * Traces backward through the alternating tree following labelEnd pointers,
 * flipping mate assignments along the path. Also expands any blossoms
 * encountered.
 *
 * The path structure alternates:
 * - current vertex (just matched)
 * - labelEnd (T-vertex that gave current its label)
 * - mate of labelEnd (S-vertex)
 * - repeat
 *
 * Note: Uses custom traversal (not traverseTowardRoot) because it needs to
 * continue from labelEnd's mate, not labelEnd itself.
 *
 * @param state - Current matching state (modified in place)
 * @param startVertex - Vertex to start tracing from
 */
function augmentFromVertex(state: MatchingState, startVertex: VertexKey): void {
  if (IS_MATCHING_DEBUG_ENABLED) {
    const startInfo: AugmentFromVertexStartInfo = { startVertex };
    matchingLogger
      .withMetadata(startInfo)
      .debug('Starting augment from vertex');
  }

  let currentVertex = startVertex;
  let shouldContinue = true;

  while (shouldContinue) {
    const [baseVertex, baseState] = getBaseVertexState(state, currentVertex);
    const isRoot = isAlternatingTreeRoot(baseState);

    if (IS_MATCHING_DEBUG_ENABLED) {
      const stepInfo: AugmentFromVertexStepInfo = {
        currentVertex,
        baseVertex,
        isRoot,
        label: baseState.label,
        labelEnd: baseState.labelEnd,
        mate: baseState.mate,
      };
      matchingLogger
        .withMetadata(stepInfo)
        .debug('Augment from vertex - processing step');
    }

    const stepResult: TraversalStepResult = {
      currentVertex,
      baseVertex,
      baseState,
      isRoot,
    };
    const augmentResult = processAugmentStep(state, stepResult);

    shouldContinue = augmentResult.shouldContinue;

    if (shouldContinue) {
      const nextVertex = augmentResult.nextVertex;
      if (nextVertex === null) {
        throw new Error('shouldContinue is true but nextVertex is null');
      }
      currentVertex = nextVertex;
    }
  }

  if (IS_MATCHING_DEBUG_ENABLED) {
    matchingLogger.debug('Augment from vertex completed');
  }
}

/**
 * Augments the matching along a path between two vertices
 *
 * An augmenting path alternates between unmatched and matched edges,
 * starting and ending at free (unmatched) vertices. Flipping all edges
 * along the path (matched→unmatched, unmatched→matched) increases the
 * matching size by 1.
 *
 * Algorithm:
 * 1. Match the two endpoint vertices with each other
 * 2. Trace path from first endpoint toward its tree root, flipping edges
 * 3. Trace path from second endpoint toward its tree root, flipping edges
 * 4. Expand any blossoms encountered along the paths
 *
 * @param state - Current matching state (modified in place)
 * @param vertexU - First endpoint of augmenting path
 * @param vertexV - Second endpoint of augmenting path
 */
function augmentMatching(
  state: MatchingState,
  vertexU: VertexKey,
  vertexV: VertexKey,
): void {
  if (IS_MATCHING_DEBUG_ENABLED) {
    const startInfo: AugmentMatchingStartInfo = { vertexU, vertexV };
    matchingLogger.withMetadata(startInfo).debug('Starting augment matching');
  }

  // Match the two endpoints
  updateMates(state, vertexU, vertexV);

  if (IS_MATCHING_DEBUG_ENABLED) {
    matchingLogger.debug('Endpoints matched, augmenting from first vertex');
  }

  // Augment from both sides toward their respective roots
  augmentFromVertex(state, vertexU);

  if (IS_MATCHING_DEBUG_ENABLED) {
    matchingLogger.debug(
      'First vertex augmented, augmenting from second vertex',
    );
  }

  augmentFromVertex(state, vertexV);

  if (IS_MATCHING_DEBUG_ENABLED) {
    matchingLogger.debug('Second vertex augmented, augment matching complete');
  }
}

// ============================================================================
// Main Algorithm
// ============================================================================

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
      // Must use alternating tree root, not blossom base
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
    // edge === null: continue BFS with next vertex in queue
  }

  // Queue empty without finding augmenting path
  if (IS_MATCHING_DEBUG_ENABLED) {
    matchingLogger.debug('Queue empty - no augmenting path found');
  }

  return false;
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
  // Debug-only: track iteration count for logging
  let iterationNumber = 0;

  // Log algorithm entry with graph statistics (only if debug enabled)
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
  const matching = new Map<VertexKey, Mate>();
  for (const [vertexKey, vertexState] of state.vertices) {
    matching.set(vertexKey, vertexState.mate);
  }

  // Log algorithm exit with final statistics (only if debug enabled)
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

/**
 * Counts the number of matched vertices in a matching
 *
 * @param matching - Matching result
 * @returns Number of vertices that are matched (have non-null mates)
 */
function countMatchedVertices(matching: MatchingResult): number {
  let matchedCount = 0;
  for (const [, mate] of matching) {
    const isMatched = mate !== null;
    if (isMatched) {
      matchedCount++;
    }
  }
  return matchedCount;
}
