/**
 * Tree operations for Edmonds' Blossom Algorithm
 *
 * Contains functions for alternating tree navigation and labeling:
 * - Finding base vertices and roots
 * - Traversing toward root
 * - Finding lowest common ancestor (LCA)
 * - Assigning labels during BFS
 * - Scanning and labeling neighbours
 */

import type {
  BaseVertexInfo,
  BlossomChainStepResult,
  BlossomId,
  BlossomState,
  LabelEndpoint,
  LowestCommonAncestorResult,
  MatchingState,
  PathWithEdges,
  ScanAndLabelResult,
  TraversalStepResult,
  VertexKey,
} from './types';
import { isBlossomId, Label, NO_EDGE_FOUND, NO_LABEL_ENDPOINT } from './types';

/**
 * Traverses the blossom chain from a vertex upward to the top-level blossom.
 *
 * Walks from the vertex's immediate blossom up through parent blossoms,
 * calling the processor for each blossom visited.
 *
 * @param state - Current matching state
 * @param vertexKey - Vertex to start traversal from
 * @param processStep - Callback invoked for each blossom; return true to stop early
 */
/** Maximum blossom chain depth before assuming cycle */
const MAX_BLOSSOM_CHAIN_DEPTH = 500;

export function traverseBlossomChain(
  state: MatchingState,
  vertexKey: VertexKey,
  processStep: (step: BlossomChainStepResult) => boolean,
): void {
  const vertexState = state.vertices.get(vertexKey);
  if (vertexState === undefined) {
    throw new Error(`Vertex ${vertexKey} not found in state`);
  }

  let currentBlossomId = vertexState.inBlossom;
  let currentBlossom = state.blossoms.get(currentBlossomId);
  let shouldStop = false;
  let depth = 0;
  const visitedBlossomIds = new Set<number>();

  while (currentBlossom !== undefined && !shouldStop) {
    depth++;
    if (depth > MAX_BLOSSOM_CHAIN_DEPTH) {
      console.error(
        `traverseBlossomChain: MAX DEPTH exceeded for vertex ${vertexKey}`,
      );
      throw new Error(`Blossom chain too deep for ${vertexKey}`);
    }
    if (visitedBlossomIds.has(currentBlossomId)) {
      console.error(
        `traverseBlossomChain: CYCLE at blossom ${currentBlossomId}`,
      );
      throw new Error(`Cycle in blossom chain at ${currentBlossomId}`);
    }
    visitedBlossomIds.add(currentBlossomId);
    const isNonTrivial = currentBlossom.children.length > 1;

    const stepResult: BlossomChainStepResult = {
      blossomId: currentBlossomId,
      blossom: currentBlossom,
      isNonTrivial,
    };

    shouldStop = processStep(stepResult);

    // Move to parent blossom
    if (currentBlossom.parent === null) {
      currentBlossom = undefined;
    } else {
      currentBlossomId = currentBlossom.parent;
      currentBlossom = state.blossoms.get(currentBlossomId);
    }
  }
}

/**
 * Collects all leaf vertices contained within a blossom.
 *
 * Traverses DOWN the blossom hierarchy to find all graph vertices.
 * Per NetworkX: b.leaves() yields all vertex keys inside blossom b.
 */
/** Maximum iterations in collectBlossomLeaves */
const MAX_COLLECT_ITERATIONS = 10000;

export function collectBlossomLeaves(
  state: MatchingState,
  blossomId: BlossomId,
): VertexKey[] {
  const blossom = state.blossoms.get(blossomId);
  if (blossom === undefined) {
    throw new Error(`Blossom ${blossomId} not found in state`);
  }

  const leaves: VertexKey[] = [];
  const stack = blossom.children.filter(isBlossomId);
  let iterations = 0;

  while (stack.length > 0) {
    iterations++;
    if (iterations > MAX_COLLECT_ITERATIONS) {
      console.error(
        `collectBlossomLeaves: MAX ITERATIONS at blossom ${blossomId}`,
      );
      throw new Error(`Too many iterations in collectBlossomLeaves`);
    }
    const childId = stack.pop();
    if (childId === undefined) {
      throw new Error('Stack unexpectedly empty in collectBlossomLeaves');
    }
    const childBlossom = state.blossoms.get(childId);

    if (childBlossom === undefined) {
      throw new Error(`Sub-blossom ${childId} not found in state`);
    }

    if (childBlossom.children.length === 1) {
      leaves.push(childBlossom.base);
    } else {
      const childBlossomIds = childBlossom.children.filter(isBlossomId);
      stack.push(...childBlossomIds);
    }
  }

  return leaves;
}

/**
 * Finds the base vertex and top-level blossom ID for a vertex
 *
 * Uses traverseBlossomChain to walk the parent chain and capture
 * the final (top-level) blossom's base and ID.
 *
 * @param state - Current matching state
 * @param vertexKey - Vertex to find base and blossom for
 * @returns Tuple of [baseVertex, topLevelBlossomId]
 */
export function findBaseWithBlossomId(
  state: MatchingState,
  vertexKey: VertexKey,
): [VertexKey, BlossomId] {
  let result: [VertexKey, BlossomId] | null = null;

  const captureTopLevel = (step: BlossomChainStepResult): boolean => {
    result = [step.blossom.base, step.blossomId];
    const shouldStopEarly = false;
    return shouldStopEarly;
  };

  traverseBlossomChain(state, vertexKey, captureTopLevel);

  if (result === null) {
    throw new Error(`No blossom found for vertex ${vertexKey}`);
  }

  return result;
}

/**
 * Finds the base vertex of the top-level blossom containing a vertex
 *
 * The base is the vertex where the blossom connects to the alternating tree.
 * This function follows the blossom parent chain upward until reaching a
 * top-level blossom, then returns its base vertex.
 *
 * @param state - Current matching state
 * @param vertexKey - Vertex to find base for
 * @returns Base vertex of the top-level blossom containing this vertex
 */
export function findBase(
  state: MatchingState,
  vertexKey: VertexKey,
): VertexKey {
  const [baseVertex] = findBaseWithBlossomId(state, vertexKey);
  return baseVertex;
}

/**
 * Finds the direct child of an outer blossom that contains a vertex.
 *
 * When expanding a blossom, we need to find which child of the outer blossom
 * contains a given vertex. Since inBlossom points to the innermost blossom,
 * we traverse upward until we find the blossom whose parent is the outer blossom.
 *
 * @param state - Current matching state
 * @param outerBlossomId - The outer blossom whose direct child we seek
 * @param vertexKey - Vertex to find containing child for
 * @returns Blossom ID of the direct child containing the vertex
 * @throws Error if vertex is not inside the outer blossom
 */
export function findDirectChildOf(
  state: MatchingState,
  outerBlossomId: BlossomId,
  vertexKey: VertexKey,
): BlossomId {
  const vertexState = state.vertices.get(vertexKey);
  if (vertexState === undefined) {
    throw new Error(`Vertex ${vertexKey} not found in state`);
  }

  const outerBlossom = state.blossoms.get(outerBlossomId);
  if (outerBlossom === undefined) {
    throw new Error(`Outer blossom ${outerBlossomId} not found`);
  }

  // Per NetworkX: bubble up from vertex using blossomparent until we find
  // a node (vertex or blossom) whose parent is the outer blossom

  // Check vertex's blossomParent first
  if (vertexState.blossomParent === outerBlossomId) {
    // The vertex's trivial blossom is a direct child of outerBlossom
    // Find the trivial blossom for this vertex
    for (const [blossomId, blossom] of state.blossoms) {
      if (blossom.base === vertexKey && blossom.children.length === 1) {
        return blossomId;
      }
    }
    throw new Error(`Trivial blossom not found for vertex ${vertexKey}`);
  }

  // Case 2: vertex is in a non-trivial child - traverse UP from blossomParent
  // Per NetworkX: while blossomparent[t] != b: t = blossomparent[t]
  if (vertexState.blossomParent !== null) {
    let currentId: BlossomId | null = vertexState.blossomParent;
    while (currentId !== null) {
      const blossom = state.blossoms.get(currentId);
      if (blossom === undefined) {
        break;
      }
      if (blossom.parent === outerBlossomId) {
        return currentId;
      }
      currentId = blossom.parent;
    }
  }

  // Case 3: fallback using traverseBlossomChain (should rarely hit this)
  let result: BlossomId | null = null;

  const findChildWithParent = (step: BlossomChainStepResult): boolean => {
    const isDirectChild = step.blossom.parent === outerBlossomId;

    if (isDirectChild) {
      result = step.blossomId;
      const shouldStop = true;
      return shouldStop;
    }

    const shouldContinue = false;
    return shouldContinue;
  };

  traverseBlossomChain(state, vertexKey, findChildWithParent);

  if (result === null) {
    throw new Error(
      `Vertex ${vertexKey} is not inside blossom ${outerBlossomId}`,
    );
  }

  return result;
}

/**
 * Checks if a blossom is a root of an alternating tree
 *
 * Per NetworkX: a blossom is a root if S-labelled with labelEnd = null.
 * This distinguishes roots from non-root S-blossoms which have labelEnd
 * pointing to the vertex that labelled them.
 *
 * @param blossom - Blossom state to check
 * @returns true if blossom is a root
 */
export function isAlternatingTreeRoot(blossom: BlossomState): boolean {
  const isSLabelled = blossom.label === Label.S;
  const hasNullLabelEnd = blossom.labelEnd === NO_LABEL_ENDPOINT;
  return isSLabelled && hasNullLabelEnd;
}

/**
 * Finds the base vertex information for a given vertex
 *
 * Combines finding the base vertex, retrieving its state, and getting the
 * top-level blossom ID. This is the unified function for all base vertex lookups.
 *
 * @param state - Current matching state
 * @param vertex - Vertex to find base info for
 * @returns BaseVertexInfo containing base vertex, state, and blossom ID
 */
export function findBaseVertexInfo(
  state: MatchingState,
  vertex: VertexKey,
): BaseVertexInfo {
  const [baseVertex, topLevelBlossomId] = findBaseWithBlossomId(state, vertex);
  const blossomState = state.blossoms.get(topLevelBlossomId);

  if (blossomState === undefined) {
    throw new Error(`Blossom ${topLevelBlossomId} not found in state`);
  }

  const baseInfo: BaseVertexInfo = {
    baseVertex,
    blossomState,
    topLevelBlossomId,
  };

  return baseInfo;
}

/**
 * Generic traversal toward root of alternating tree
 *
 * Follows labelEnd pointers upward through alternating tree,
 * calling the step processor for each vertex visited.
 *
 * @param state - Current matching state
 * @param startVertex - Vertex to start traversal from
 * @param processStep - Callback invoked for each step; returns true to stop early
 */
/** Maximum traversal steps before assuming cycle */
const MAX_TRAVERSAL_STEPS = 1000;

export function traverseTowardRoot(
  state: MatchingState,
  startVertex: VertexKey,
  processStep: (step: TraversalStepResult) => boolean,
): void {
  let currentVertex = startVertex;
  let reachedRoot = false;
  let stepCount = 0;
  const visitedVertices = new Set<VertexKey>();

  while (!reachedRoot) {
    stepCount++;
    if (stepCount > MAX_TRAVERSAL_STEPS) {
      console.error(
        `traverseTowardRoot: CYCLE DETECTED after ${stepCount} steps`,
      );
      console.error(`Start: ${startVertex}, Current: ${currentVertex}`);
      console.error(`Visited: ${[...visitedVertices].join(', ')}`);
      throw new Error(`Cycle in traverseTowardRoot from ${startVertex}`);
    }
    if (visitedVertices.has(currentVertex)) {
      // Dump diagnostic info about each vertex in the cycle
      console.error(`\n=== CYCLE DETECTED ===`);
      console.error(
        `Path: ${[...visitedVertices].join(' -> ')} -> ${currentVertex}`,
      );
      for (const v of [...visitedVertices, currentVertex]) {
        const [base, blossomId] = findBaseWithBlossomId(state, v);
        const blossom = state.blossoms.get(blossomId);
        console.error(
          `  ${v}: base=${base}, blossom=${blossomId}, label=${blossom?.label}, labelEnd=${blossom?.labelEnd}`,
        );
      }
      console.error(`======================\n`);
      throw new Error(
        `Cycle in tree traversal: revisited ${currentVertex}. ` +
          `Path: ${[...visitedVertices].join(' -> ')} -> ${currentVertex}`,
      );
    }
    visitedVertices.add(currentVertex);

    const [baseVertex, topLevelBlossomId] = findBaseWithBlossomId(
      state,
      currentVertex,
    );
    const blossomState = state.blossoms.get(topLevelBlossomId);

    if (blossomState === undefined) {
      throw new Error(`Blossom ${topLevelBlossomId} not found in state`);
    }

    const isRoot = isAlternatingTreeRoot(blossomState);

    const stepResult: TraversalStepResult = {
      currentVertex,
      baseVertex,
      blossomState,
      topLevelBlossomId,
      isRoot,
    };
    const shouldStopEarly = processStep(stepResult);

    reachedRoot = isRoot || shouldStopEarly;

    // Only move to next vertex if we haven't reached root and shouldn't stop
    // Roots have labelEnd = null per NetworkX, so we must check isRoot first
    if (!reachedRoot) {
      const labelEnd = blossomState.labelEnd;
      // Use null check (not NO_LABEL_ENDPOINT) so TypeScript narrows the type
      if (labelEnd === null) {
        throw new Error(
          `Blossom ${topLevelBlossomId} has label ${blossomState.label} but no labelEnd`,
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
export function buildPathToRoot(
  state: MatchingState,
  startVertex: VertexKey,
): BlossomId[] {
  const path: BlossomId[] = [];

  const addBlossomToPath = (step: TraversalStepResult): boolean => {
    path.push(step.topLevelBlossomId);
    const shouldStopEarly = false;
    return shouldStopEarly;
  };

  traverseTowardRoot(state, startVertex, addBlossomToPath);

  return path;
}

/**
 * Builds path from a vertex to the root, collecting edges along the way
 *
 * Each edge connects consecutive blossoms in the path:
 * - edge[i] = [vertexInBlossom[i], vertexInBlossom[i+1]]
 * - The first vertex is labelEdgeVertex (in this blossom)
 * - The second vertex is labelEnd (in parent blossom)
 *
 * @param state - Current matching state
 * @param startVertex - Vertex to start from
 * @returns Path of blossom IDs and connecting edges
 */
export function buildPathToRootWithEdges(
  state: MatchingState,
  startVertex: VertexKey,
): PathWithEdges {
  const path: BlossomId[] = [];
  const edges: Array<[VertexKey, VertexKey]> = [];

  const collectPathAndEdges = (step: TraversalStepResult): boolean => {
    path.push(step.topLevelBlossomId);

    // Collect edge to parent (if not root)
    // labelEdgeVertex: vertex in this blossom that was labeled
    // labelEnd: vertex in parent blossom that did the labeling
    const labelEdgeVertex = step.blossomState.labelEdgeVertex;
    const labelEnd = step.blossomState.labelEnd;

    const hasEdgeToParent = labelEdgeVertex !== null && labelEnd !== null;
    if (hasEdgeToParent) {
      const edgeToParent: [VertexKey, VertexKey] = [labelEdgeVertex, labelEnd];
      edges.push(edgeToParent);
    }

    const shouldStopEarly = false;
    return shouldStopEarly;
  };

  traverseTowardRoot(state, startVertex, collectPathAndEdges);

  const result: PathWithEdges = { path, edges };
  return result;
}

/**
 * Finds the root vertex of the alternating tree containing a given vertex
 *
 * Follows labelEnd pointers upward until reaching a vertex whose labelEnd
 * points to itself (i.e., an S-labelled root).
 *
 * @param state - Current matching state
 * @param vertex - Vertex to find root for
 * @returns Root vertex of the alternating tree
 */
export function findAlternatingTreeRoot(
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
 * Constructs LCA result from paths, edges, and intersection point
 *
 * Trims the first path and edges to exclude LCA (second path already excludes it)
 *
 * @param lcaBlossomId - The blossom ID where paths intersect
 * @param firstPath - First path (will be trimmed to exclude LCA)
 * @param firstEdges - Edges along first path (will be trimmed to match)
 * @param secondPath - Second path (already excludes LCA)
 * @param secondEdges - Edges along second path (already excludes LCA)
 * @returns LCA result with trimmed paths and edges
 */
function buildLCAResult(
  lcaBlossomId: BlossomId,
  firstPath: BlossomId[],
  firstEdges: Array<[VertexKey, VertexKey]>,
  secondPath: BlossomId[],
  secondEdges: Array<[VertexKey, VertexKey]>,
): LowestCommonAncestorResult {
  // Trim first path to exclude LCA
  const lcaIndexInFirstPath = firstPath.indexOf(lcaBlossomId);
  const trimmedFirstPath = firstPath.slice(0, lcaIndexInFirstPath);

  // Trim first edges to match trimmed path
  // edges[i] connects path[i] to path[i+1], so slice(0, lcaIndex) includes edge to LCA
  const trimmedFirstEdges = firstEdges.slice(0, lcaIndexInFirstPath);

  const result: LowestCommonAncestorResult = {
    lcaBlossomId,
    pathFromU: trimmedFirstPath,
    pathFromV: secondPath,
    edgesFromU: trimmedFirstEdges,
    edgesFromV: secondEdges,
  };

  return result;
}

/**
 * Finds where two paths intersect, collecting edges along the way
 *
 * Builds the second path while checking for intersection with the first path.
 * Checks for intersection BEFORE adding to path to avoid trimming.
 *
 * @param state - Current matching state
 * @param startVertex - Vertex to build second path from
 * @param firstPathWithEdges - First path with edges to check intersection against
 * @returns Intersection result with LCA, trimmed paths, and edges; or null if no intersection
 */
function findPathIntersection(
  state: MatchingState,
  startVertex: VertexKey,
  firstPathWithEdges: PathWithEdges,
): LowestCommonAncestorResult | null {
  const pathBeforeLCA: BlossomId[] = [];
  const edgesBeforeLCA: Array<[VertexKey, VertexKey]> = [];
  const firstPathSet = new Set(firstPathWithEdges.path);
  let intersectionBlossomId: BlossomId | null = null;

  const checkForIntersection = (step: TraversalStepResult): boolean => {
    const blossomId = step.topLevelBlossomId;

    // Check for intersection BEFORE adding to path
    const foundIntersection = firstPathSet.has(blossomId);
    if (foundIntersection) {
      intersectionBlossomId = blossomId;
      const shouldStopEarly = true;
      return shouldStopEarly;
    }

    // Add blossom to path (LCA won't be added since we stop when found)
    pathBeforeLCA.push(blossomId);

    // Collect edge to parent (if exists)
    const labelEdgeVertex = step.blossomState.labelEdgeVertex;
    const labelEnd = step.blossomState.labelEnd;
    const hasEdgeToParent = labelEdgeVertex !== null && labelEnd !== null;
    if (hasEdgeToParent) {
      const edgeToParent: [VertexKey, VertexKey] = [labelEdgeVertex, labelEnd];
      edgesBeforeLCA.push(edgeToParent);
    }

    const shouldStopEarly = false;
    return shouldStopEarly;
  };

  traverseTowardRoot(state, startVertex, checkForIntersection);

  // Return result based on whether intersection was found
  if (intersectionBlossomId !== null) {
    const result = buildLCAResult(
      intersectionBlossomId,
      firstPathWithEdges.path,
      firstPathWithEdges.edges,
      pathBeforeLCA,
      edgesBeforeLCA,
    );
    return result;
  }

  return null;
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
 * @returns LCA result with blossom ID, trimmed paths, and connecting edges
 */
export function findLowestCommonAncestor(
  state: MatchingState,
  vertexU: VertexKey,
  vertexV: VertexKey,
): LowestCommonAncestorResult {
  // Build path from U to root, collecting edges along the way
  const pathFromUWithEdges = buildPathToRootWithEdges(state, vertexU);

  // Find where path from V intersects path from U, collecting V's edges too
  const intersection = findPathIntersection(state, vertexV, pathFromUWithEdges);

  if (intersection === null) {
    throw new Error(
      `No common ancestor found for vertices ${vertexU} and ${vertexV} - not in same tree`,
    );
  }

  return intersection;
}

/**
 * Assigns a label to a vertex during augmenting path search
 *
 * S-vertices are roots or at odd distance from root in the alternating tree.
 * T-vertices are matched vertices at even distance from root.
 *
 * The label is assigned to the base vertex of the top-level blossom containing
 * the vertex. If labelling as S, the vertex is added to the processing queue.
 *
 * Per NetworkX: roots have labelEnd = null (NO_LABEL_ENDPOINT), while
 * non-root vertices have labelEnd pointing to the vertex that labelled them.
 *
 * @param state - Current matching state (modified in place)
 * @param vertex - Vertex to label
 * @param label - Label to assign (S or T)
 * @param labelEnd - Endpoint of edge that caused this labelling, or null for roots
 */
export function assignLabel(
  state: MatchingState,
  vertex: VertexKey,
  label: Label,
  labelEnd: LabelEndpoint,
): void {
  // Find the top-level blossom containing this vertex
  const { baseVertex, blossomState } = findBaseVertexInfo(state, vertex);

  // Per NetworkX: assert label.get(w) is None and label.get(b) is None
  if (blossomState.label !== Label.NONE) {
    throw new Error(
      `assignLabel: blossom ${blossomState.id} already has label ${blossomState.label}, ` +
        `cannot assign ${label}. Vertex=${vertex}, labelEnd=${labelEnd}`,
    );
  }

  // Assign label and label endpoints to the blossom (per NetworkX: labels are per-blossom)
  // labelEnd: vertex in parent blossom that caused labeling
  // labelEdgeVertex: vertex in this blossom that was labeled
  blossomState.label = label;
  blossomState.labelEnd = labelEnd;
  blossomState.labelEdgeVertex = vertex;

  // Per NetworkX: handle S and T labels differently
  if (label === Label.S) {
    // S-blossom: add base vertex to queue for processing
    state.queue.push(baseVertex);
  } else if (label === Label.T) {
    // T-blossom: recursively label the base's mate as S
    // Per NetworkX: assignLabel(mate[base], 1, base)
    const baseState = state.vertices.get(baseVertex);
    if (baseState !== undefined && baseState.mate !== null) {
      assignLabel(state, baseState.mate, Label.S, baseVertex);
    }
  }
}

/**
 * Checks if a vertex is truly free (unmatched)
 *
 * A vertex is free if the vertex itself has no mate. We check the actual
 * vertex's mate, not its blossom base's mate, to correctly handle cases
 * where a vertex inside a blossom is matched but its base is not.
 *
 * @param state - Current matching state
 * @param vertexKey - Vertex to check
 * @returns true if the vertex has no mate
 */
function isVertexFree(state: MatchingState, vertexKey: VertexKey): boolean {
  const vertexState = state.vertices.get(vertexKey);
  if (vertexState === undefined) {
    throw new Error(`Vertex ${vertexKey} not found in state`);
  }
  return vertexState.mate === null;
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
 * @param state - Current matching state (modified when labeling neighbours)
 * @param vertex - S-labelled vertex to scan from
 * @returns Edge if found (for augmenting path or blossom), null otherwise
 */
export function scanAndLabelNeighbours(
  state: MatchingState,
  vertex: VertexKey,
): ScanAndLabelResult {
  const neighbours = state.adjacencyList.get(vertex);
  if (neighbours === undefined) {
    throw new Error(`Vertex ${vertex} not found in adjacency list`);
  }

  const { baseVertex: vertexBase } = findBaseVertexInfo(state, vertex);

  for (const neighbour of neighbours) {
    const { baseVertex: neighbourBase, blossomState: neighbourBlossomState } =
      findBaseVertexInfo(state, neighbour);

    // Skip internal edges within same top-level blossom
    const isInternalEdge = vertexBase === neighbourBase;

    if (!isInternalEdge) {
      const neighbourLabel = neighbourBlossomState.label;

      // Case 1: Neighbour is unlabelled
      if (neighbourLabel === Label.NONE) {
        // Check if the ACTUAL VERTEX is free, not its base
        // This prevents incorrectly treating matched vertices as free
        // when their blossom base happens to have no mate
        const neighbourIsFree = isVertexFree(state, neighbour);

        if (neighbourIsFree) {
          // Neighbour is truly free - found augmenting path
          const edge: ScanAndLabelResult = [vertex, neighbour];
          return edge;
        } else {
          // Neighbour is matched - extend alternating tree by labeling
          // Per NetworkX: label the mate of T's BASE, not T itself
          // In a blossom, base.mate is the external matched edge
          const baseState = state.vertices.get(neighbourBase);
          if (baseState === undefined) {
            throw new Error(`Base vertex ${neighbourBase} not found`);
          }
          const baseMate = baseState.mate;
          if (baseMate === null) {
            throw new Error(`T-vertex base ${neighbourBase} should be matched`);
          }

          // Per NetworkX: assert mate's blossom is unlabeled before labeling
          // If already labeled, something is wrong with blossom structure
          const { blossomState: baseMateBlossomState } = findBaseVertexInfo(
            state,
            baseMate,
          );
          if (baseMateBlossomState.label !== Label.NONE) {
            console.error(
              `BUG: mate ${baseMate} already labeled ${baseMateBlossomState.label}`,
            );
            console.error(
              `  neighbour=${neighbour}, neighbourBase=${neighbourBase}`,
            );
            console.error(
              `  mate blossom=${baseMateBlossomState.id}, labelEnd=${baseMateBlossomState.labelEnd}`,
            );
            // Skip labeling to avoid creating cycle
            continue;
          }

          // Per NetworkX: assignLabel(w, 2, p) - T-label recursively labels mate as S
          assignLabel(state, neighbour, Label.T, vertex);
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
