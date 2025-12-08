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
  BlossomId,
  LowestCommonAncestorResult,
  MatchingState,
  ScanAndLabelResult,
  TraversalStepResult,
  VertexKey,
  VertexState,
} from './types';
import { Label, NO_EDGE_FOUND } from './types';

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
export function isAlternatingTreeRoot(vertexState: VertexState): boolean {
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
export function getBaseVertexState(
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
 * @param state - Current matching state
 * @param startVertex - Vertex to start traversal from
 * @param processStep - Callback invoked for each step; returns true to stop early
 */
export function traverseTowardRoot(
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
export function buildPathToRoot(
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
export function findLowestCommonAncestor(
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
export function assignLabel(
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
