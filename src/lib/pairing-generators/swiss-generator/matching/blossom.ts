/**
 * Blossom and augmenting path operations for Edmonds' Blossom Algorithm
 *
 * Contains functions for:
 * - Blossom creation (addBlossom)
 * - Blossom expansion (expandBlossom)
 * - Augmenting path processing
 * - Mate updates
 */

import {
  assignLabel,
  collectBlossomLeaves,
  findBaseVertexInfo,
  findDirectChildOf,
  findLowestCommonAncestor,
} from './tree-operations';
import type {
  BlossomId,
  BlossomState,
  BlossomChildren,
  LabeledVertexInfo,
  MatchingState,
  VertexKey,
} from './types';
import {
  Label,
  NOT_FOUND_IN_ARRAY,
  NO_PARENT_BLOSSOM,
  STEP_BACKWARD,
  STEP_FORWARD,
} from './types';

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
 * Updates inBlossom and blossomParent for all vertices in child blossoms
 *
 * After expansion, vertices need to point to their immediate child blossom,
 * not the (now deleted) outer blossom.
 *
 * @param state - Current matching state
 * @param blossom - Blossom being expanded
 */
function updateChildrenAfterExpansion(
  state: MatchingState,
  blossom: BlossomState,
): void {
  for (const childBlossomId of blossom.children) {
    if (typeof childBlossomId === 'string') {
      throw new Error(`Children should only contain blossom IDs`);
    }

    const childBlossom = state.blossoms.get(childBlossomId);
    const leafVertices = collectBlossomLeaves(state, childBlossomId);

    // Update inBlossom for all vertices in this child
    for (const vertexKey of leafVertices) {
      const vertexState = state.vertices.get(vertexKey);
      if (vertexState === undefined) {
        throw new Error(`Vertex ${vertexKey} not found`);
      }
      vertexState.inBlossom = childBlossomId;
    }

    // Reset blossomParent for trivial children
    const isTrivial =
      childBlossom !== undefined && childBlossom.children.length === 1;
    if (isTrivial) {
      const vertexKey = childBlossom.base;
      const vertexState = state.vertices.get(vertexKey);
      if (vertexState !== undefined) {
        vertexState.blossomParent = blossom.parent;
      }
    }
  }
}

/**
 * Gets walk direction based on parity of entry index (per NetworkX)
 *
 * NetworkX uses parity to ensure we traverse an even number of edges,
 * which is required for correct mate flipping.
 *
 * @param entryIndex - Index of entry child in blossom
 * @returns +1 for forward, -1 for backward
 */
function getWalkStep(entryIndex: number): number {
  const isOddEntry = (entryIndex & 1) === 1;
  return isOddEntry ? STEP_FORWARD : STEP_BACKWARD;
}

/**
 * Gets edge vertices w and x based on walk direction
 *
 * Per NetworkX:
 * - Forward (jstep=1): w, x = edges[j]
 * - Backward (jstep=-1): x, w = edges[j-1] (different index AND swapped)
 *
 * @param blossom - Blossom being traversed
 * @param j - Current position (may be negative)
 * @param jstep - Walk direction (+1 or -1)
 * @returns Tuple [w, x] of edge vertices
 */
function getEdgeVertices(
  blossom: BlossomState,
  j: number,
  jstep: number,
): [VertexKey, VertexKey] {
  const cycleLength = blossom.children.length;

  if (jstep === STEP_FORWARD) {
    const edgeIdx = (j + cycleLength) % cycleLength;
    return blossom.edges[edgeIdx];
  }

  // Backward: use edges[j-1] with swapped order
  const edgeIdx = (j - 1 + cycleLength) % cycleLength;
  const edge = blossom.edges[edgeIdx];
  return [edge[1], edge[0]];
}

/**
 * Expands a child blossom if it's non-trivial
 *
 * @param state - Current matching state
 * @param childId - Child blossom ID to potentially expand
 * @param entryVertex - Vertex where augmenting path enters the child
 */
function expandChildIfNonTrivial(
  state: MatchingState,
  childId: BlossomId,
  entryVertex: VertexKey,
): void {
  const child = state.blossoms.get(childId);
  const isNonTrivial = child !== undefined && child.children.length > 1;

  if (isNonTrivial) {
    expandBlossom(state, childId, entryVertex);
  }
}

/**
 * Builds path of child indices from entry toward base (index 0)
 *
 * Direction based on parity per NetworkX:
 * - Odd entry index: go forward (wrapping around)
 * - Even entry index: go backward
 *
 * Path always has even length (blossom is odd cycle, entry != base).
 *
 * @param entryIndex - Starting position in cycle
 * @param cycleLength - Total number of children
 * @returns Array of child indices from entry toward base (excluding entry, including base)
 */
function buildPathToBase(entryIndex: number, childCount: number): number[] {
  const isOddEntry = entryIndex % 2 === 1;
  const step = isOddEntry ? STEP_FORWARD : STEP_BACKWARD;

  const path: number[] = [];
  let position = entryIndex;

  while (position !== 0) {
    position = nextChildPosition(position, step, childCount);
    path.push(position);
  }

  return path;
}

/**
 * Updates mate pointers for two vertices
 */
function setMates(
  state: MatchingState,
  vertexA: VertexKey,
  vertexB: VertexKey,
): void {
  const stateA = state.vertices.get(vertexA);
  const stateB = state.vertices.get(vertexB);

  if (stateA !== undefined && stateB !== undefined) {
    stateA.mate = vertexB;
    stateB.mate = vertexA;
  }
}

/**
 * Walks blossom cycle and updates mates per NetworkX algorithm
 *
 * Processes children in pairs from entry toward base (index 0).
 * For each pair, recursively expands non-trivial children and
 * matches the edge vertices connecting them.
 *
 * @param state - Current matching state
 * @param blossom - Blossom being expanded
 * @param entryIndex - Index of entry child
 */
function walkBlossomAndUpdateMates(
  state: MatchingState,
  blossom: BlossomState,
  entryIndex: number,
): void {
  const cycleLength = blossom.children.length;
  const path = buildPathToBase(entryIndex, cycleLength);
  const step = getWalkStep(entryIndex);

  // Process children in pairs
  for (let pairIndex = 0; pairIndex < path.length; pairIndex += 2) {
    const firstChildIndex = path[pairIndex];
    const secondChildIndex = path[pairIndex + 1];

    // Get edge vertices connecting this pair
    const [vertexInFirst, vertexInSecond] = getEdgeVertices(
      blossom,
      firstChildIndex,
      step,
    );

    // Expand first child with entry at vertexInFirst
    const firstChildId = blossom.children[firstChildIndex];
    if (typeof firstChildId === 'number') {
      expandChildIfNonTrivial(state, firstChildId, vertexInFirst);
    }

    // Expand second child with entry at vertexInSecond
    const secondChildId = blossom.children[secondChildIndex];
    if (typeof secondChildId === 'number') {
      expandChildIfNonTrivial(state, secondChildId, vertexInSecond);
    }

    // Match the edge vertices
    setMates(state, vertexInFirst, vertexInSecond);
  }
}

/**
 * Rotates blossom arrays so entry becomes the new base position (index 0)
 *
 * Per NetworkX: b.childs = b.childs[i:] + b.childs[:i]
 *
 * @param blossom - Blossom to rotate
 * @param entryIndex - Index to move to front
 */
function rotateBlossomToEntry(blossom: BlossomState, entryIndex: number): void {
  blossom.children = [
    ...blossom.children.slice(entryIndex),
    ...blossom.children.slice(0, entryIndex),
  ];
  blossom.edges = [
    ...blossom.edges.slice(entryIndex),
    ...blossom.edges.slice(0, entryIndex),
  ];
}

/**
 * Restores blossom children to top-level (removes parent pointers).
 *
 * Per NetworkX: `for s in b.childs: blossomparent[s] = None`
 *
 * Children become independent top-level blossoms because:
 * 1. The expanded blossom is being deleted
 * 2. Setting parent to grandparent would violate the invariant that
 *    B.parent === P implies B is in P.children
 *
 * @param state - Current matching state
 * @param blossom - Blossom whose children to restore
 * @param clearLabels - If true, clear labels (for end-of-stage); if false, keep for relabeling
 */
function restoreChildrenToTopLevel(
  state: MatchingState,
  blossom: BlossomState,
  clearLabels: boolean = true,
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

    // Children become top-level (no parent)
    childBlossom.parent = NO_PARENT_BLOSSOM;

    // Clear labels if requested (for end-of-stage expansion)
    if (clearLabels) {
      childBlossom.label = Label.NONE;
      childBlossom.labelEnd = null;
      childBlossom.labelEdgeVertex = null;
    }
  }
}

/**
 * Advances position in blossom cycle with wrap-around.
 *
 * Handles negative indices like Python: `(-1 + 5) % 5 = 4`
 * JavaScript's `%` returns `-1 % 5 = -1`, so we add childCount first.
 */
function nextChildPosition(
  position: number,
  step: number,
  childCount: number,
): number {
  return (position + step + childCount) % childCount;
}

/**
 * Clears label information from a blossom.
 *
 * Per NetworkX: label[x] = None before relabeling.
 */
function clearBlossomLabel(blossom: BlossomState): void {
  blossom.label = Label.NONE;
  blossom.labelEnd = null;
  blossom.labelEdgeVertex = null;
}

/**
 * Checks if a labeled leaf is valid for relabeling in phase 2.
 *
 * Per NetworkX: label[v] == 2 and inblossom[v] == bv
 */
function isValidForRelabel(
  labeled: LabeledVertexInfo | null,
  childId: BlossomId,
): labeled is LabeledVertexInfo {
  return (
    labeled !== null &&
    labeled.blossom.label === Label.T &&
    labeled.blossom.id === childId
  );
}

/**
 * Clears labels and relabels a reachable child in phase 2.
 *
 * Per NetworkX: clear label[v] and label[mate[blossombase[bv]]], then assignLabel.
 */
function relabelReachableChild(
  state: MatchingState,
  child: BlossomState,
  labeled: LabeledVertexInfo,
): void {
  const labelingVertex = labeled.blossom.labelEnd;

  // Per NetworkX: clear labels before relabeling
  clearBlossomLabel(labeled.blossom);

  const baseState = state.vertices.get(child.base);
  if (baseState === undefined) {
    throw new Error(`Child base vertex ${child.base} not found`);
  }

  if (baseState.mate !== null) {
    const { blossomState: mateBlossom } = findBaseVertexInfo(
      state,
      baseState.mate,
    );
    clearBlossomLabel(mateBlossom);
  }

  if (labelingVertex !== null) {
    assignLabel(state, labeled.vertex, Label.T, labelingVertex);
  }
}

/**
 * Finds the first labeled vertex within a child blossom.
 */
function findLabeledLeafInChild(
  state: MatchingState,
  childId: BlossomId,
): LabeledVertexInfo | null {
  const leaves = collectBlossomLeaves(state, childId);

  for (const vertex of leaves) {
    const vertexState = state.vertices.get(vertex);
    if (vertexState === undefined) {
      throw new Error(`Vertex ${vertex} not found in state`);
    }

    const blossom = state.blossoms.get(vertexState.inBlossom);
    if (blossom === undefined) {
      throw new Error(
        `Blossom ${vertexState.inBlossom} not found for vertex ${vertex}`,
      );
    }

    if (blossom.label !== Label.NONE) {
      return { vertex, blossom };
    }
  }

  return null;
}

/**
 * Relabels children of expanded T-blossom with alternating T-S labels.
 *
 * Per NetworkX, two phases:
 * - Phase 1: T-label from entry to base (assignLabel recursively S-labels mate)
 * - Phase 2: Check remaining children for external reachability
 */
function relabelChildrenForDelta4(
  state: MatchingState,
  blossom: BlossomState,
  entryIndex: number,
): void {
  const childCount = blossom.children.length;
  const step = getWalkStep(entryIndex);

  let labelingVertex = blossom.labelEnd;
  let labeledVertex = blossom.labelEdgeVertex;

  if (labelingVertex === null || labeledVertex === null) {
    throw new Error(`T-blossom ${blossom.id} missing labelEnd/labelEdgeVertex`);
  }

  // Phase 1: T-label from entry toward base
  let position = entryIndex;
  while (position !== 0) {
    // Per NetworkX: clear labels before assignLabel
    const { blossomState: labeledBlossom } = findBaseVertexInfo(
      state,
      labeledVertex,
    );
    clearBlossomLabel(labeledBlossom);

    const childId = blossom.children[position];
    if (typeof childId === 'number') {
      const childBlossom = state.blossoms.get(childId);
      if (childBlossom !== undefined) {
        clearBlossomLabel(childBlossom);
      }
    }

    assignLabel(state, labeledVertex, Label.T, labelingVertex);

    position = nextChildPosition(position, step, childCount);
    if (position === 0) {
      break;
    }

    [labelingVertex, labeledVertex] = getEdgeVertices(blossom, position, step);
    position = nextChildPosition(position, step, childCount);
  }

  // Phase 2: Check children on other path (base to entry)
  position = 0;
  while (blossom.children[position] !== blossom.children[entryIndex]) {
    const childId = blossom.children[position];
    if (typeof childId === 'number') {
      const child = state.blossoms.get(childId);
      if (child === undefined) {
        throw new Error(`Child blossom ${childId} not found`);
      }

      if (child.label !== Label.S) {
        const labeled = findLabeledLeafInChild(state, childId);
        if (isValidForRelabel(labeled, childId)) {
          relabelReachableChild(state, child, labeled);
        }
      }
    }

    position = nextChildPosition(position, step, childCount);
  }
}

/**
 * Creates a new blossom from an odd-length cycle in the alternating tree
 *
 * Called when an edge connects two S-labelled vertices in the same alternating
 * tree. The cycle is formed by the edge plus the paths from both vertices up
 * to their lowest common ancestor (LCA).
 *
 * @param state - Current matching state (modified in place)
 * @param vertexU - First endpoint of the edge creating the blossom
 * @param vertexV - Second endpoint of the edge creating the blossom
 */
export function addBlossom(
  state: MatchingState,
  vertexU: VertexKey,
  vertexV: VertexKey,
): void {
  // Find the lowest common ancestor and paths from both vertices
  const lcaResult = findLowestCommonAncestor(state, vertexU, vertexV);
  const { lcaBlossomId, pathFromU, pathFromV, edgesFromU, edgesFromV } =
    lcaResult;

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
  const unrotatedChildren: BlossomId[] = [
    ...pathFromU,
    lcaBlossomId,
    ...pathFromV.toReversed(),
  ];

  // Build junction edges between consecutive children
  // Per NetworkX: b.edges[i] connects b.children[i] to b.children[i+1]
  //
  // edgesFromU[i] connects pathFromU[i] to pathFromU[i+1] (or LCA for last)
  // edgesFromV needs reversal: both array order and endpoint order swapped
  // Closing edge connects last child (vertexV) back to first child (vertexU)
  const swapEndpoints = ([a, b]: [VertexKey, VertexKey]): [
    VertexKey,
    VertexKey,
  ] => [b, a];
  const reversedEdgesFromV = edgesFromV.toReversed().map(swapEndpoints);
  const closingEdge: [VertexKey, VertexKey] = [vertexV, vertexU];

  const unrotatedEdges: Array<[VertexKey, VertexKey]> = [
    ...edgesFromU,
    ...reversedEdgesFromV,
    closingEdge,
  ];

  // Rotate so base (LCA) is at index 0, per NetworkX convention
  // This simplifies expandBlossom which expects base at index 0
  const lcaIndex = pathFromU.length;
  const childBlossomIds = [
    ...unrotatedChildren.slice(lcaIndex),
    ...unrotatedChildren.slice(0, lcaIndex),
  ];
  const blossomEdges = [
    ...unrotatedEdges.slice(lcaIndex),
    ...unrotatedEdges.slice(0, lcaIndex),
  ];

  // Create the new blossom
  // Inherit label/labelEnd from LCA (both S-vertices are in same alternating tree)
  const newBlossom: BlossomState = {
    id: newBlossomId,
    parent: NO_PARENT_BLOSSOM,
    children: childBlossomIds,
    base: lcaBlossom.base,
    label: lcaBlossom.label,
    labelEnd: lcaBlossom.labelEnd,
    labelEdgeVertex: lcaBlossom.labelEdgeVertex,
    endpoints: [vertexU, vertexV],
    edges: blossomEdges,
  };

  // Add to blossoms map
  state.blossoms.set(newBlossomId, newBlossom);

  // Update parent pointers for all sub-blossoms
  // Also set blossomParent for vertices in trivial child blossoms
  for (const childBlossomId of childBlossomIds) {
    const childBlossom = state.blossoms.get(childBlossomId);
    if (childBlossom === undefined) {
      throw new Error(`Child blossom ${childBlossomId} not found in state`);
    }
    childBlossom.parent = newBlossomId;

    // If this is a trivial blossom (single vertex), set the vertex's blossomParent
    // Per NetworkX: blossomparent[v] = b when v is a direct child of blossom b
    const isTrivial = childBlossom.children.length === 1;
    if (isTrivial) {
      const vertexKey = childBlossom.base;
      const vertexState = state.vertices.get(vertexKey);
      if (vertexState !== undefined) {
        vertexState.blossomParent = newBlossomId;
      }
    }
  }

  // Collect leaf vertices
  const leafVertices = collectBlossomLeaves(state, newBlossomId);

  // Update inBlossom for all vertices inside the new blossom
  // Per NetworkX: for v in b.leaves(): if label[inblossom[v]] == 2: queue.append(v); inblossom[v] = b
  for (const vertexKey of leafVertices) {
    const vertexState = state.vertices.get(vertexKey);
    if (vertexState === undefined) {
      throw new Error(`Vertex ${vertexKey} not found in state`);
    }

    // Per NetworkX: add T-labeled vertices to queue before updating inBlossom
    // These vertices can now scan from the S-labeled blossom
    const oldBlossom = state.blossoms.get(vertexState.inBlossom);
    if (oldBlossom === undefined) {
      throw new Error(
        `Blossom ${vertexState.inBlossom} not found for vertex ${vertexKey}`,
      );
    }
    if (oldBlossom.label === Label.T) {
      state.queue.push(vertexKey);
    }

    vertexState.inBlossom = newBlossomId;
  }
}

/**
 * Expands a blossom during augmentation or delta4
 *
 * Per NetworkX, expansion differs based on context:
 * - endstage=true: Just clear labels (end of stage, cleanup)
 * - endstage=false: Relabel children with alternating T-S (delta4 during BFS)
 *
 * @param state - Current matching state (modified in place)
 * @param blossomId - Blossom to expand
 * @param entryVertex - Vertex where path enters the blossom
 * @param endstage - If true, just clear labels; if false, relabel for delta4
 */
export function expandBlossom(
  state: MatchingState,
  blossomId: BlossomId,
  entryVertex: VertexKey,
  endstage: boolean = true,
): void {
  const blossom = state.blossoms.get(blossomId);
  if (blossom === undefined) {
    throw new Error(`Blossom ${blossomId} not found in state`);
  }

  // Find which child contains the entry vertex
  const entryChildId = findDirectChildOf(state, blossomId, entryVertex);
  const entryIndex = findChildIndex(entryChildId, blossom.children);

  // Restore children to top-level
  // For delta4 (endstage=false): don't clear labels, we'll relabel them
  // For augmentation (endstage=true): clear labels
  restoreChildrenToTopLevel(state, blossom, endstage);
  updateChildrenAfterExpansion(state, blossom);

  if (endstage) {
    // Augmentation: expand children and update mates
    expandChildIfNonTrivial(state, entryChildId, entryVertex);
    walkBlossomAndUpdateMates(state, blossom, entryIndex);
    rotateBlossomToEntry(blossom, entryIndex);
  } else {
    // Delta4: relabel children with alternating T-S
    relabelChildrenForDelta4(state, blossom, entryIndex);
  }

  // Remove the expanded blossom
  state.blossoms.delete(blossomId);
}

type AugmentStepPair = { sVertex: VertexKey; sVertexMate: VertexKey };

/**
 * Sets a single vertex's mate (one direction only)
 *
 * Unlike symmetric mate updates, this only sets vertex.mate = mate.
 * The reverse direction is set separately during the other pass
 * of augmentMatching, or in a different step of the same pass.
 *
 * @param state - Current matching state
 * @param vertex - Vertex whose mate to set
 * @param mate - New mate for vertex
 */
function setMate(
  state: MatchingState,
  vertex: VertexKey,
  mate: VertexKey,
): void {
  const vertexState = state.vertices.get(vertex);
  if (vertexState === undefined) {
    throw new Error(`Vertex ${vertex} not found`);
  }
  vertexState.mate = mate;
}

/**
 * Checks whether a blossom has sub-blossoms that need expansion
 *
 * @param blossom - Blossom to check
 * @returns true if blossom has more than one child (non-trivial)
 */
function isNonTrivialBlossom(blossom: BlossomState): boolean {
  return blossom.children.length > 1;
}

/**
 * Processes one S-T step of augmenting path traversal
 *
 * Handles two mate flips per step:
 * 1. sVertex.mate = sVertexMate (completing the pair started by the previous step)
 * 2. nextSVertexMate.mate = nextSVertex (starting a pair the next step will complete)
 *
 * Returns the next pair, or null when we reach a free vertex (alternating tree root).
 *
 * @param state - Current matching state
 * @param sVertex - Current S-vertex being processed
 * @param sVertexMate - Vertex that sVertex should be matched to
 * @returns Next (sVertex, sVertexMate) pair, or null if at root
 */
function augmentOneStep(
  state: MatchingState,
  sVertex: VertexKey,
  sVertexMate: VertexKey,
): AugmentStepPair | null {
  // Rearrange internal matching before setting external mate
  const { blossomState: sBlossom, topLevelBlossomId: sBlossomId } =
    findBaseVertexInfo(state, sVertex);
  if (isNonTrivialBlossom(sBlossom)) {
    expandBlossom(state, sBlossomId, sVertex);
  }

  // One direction only; the other pass of augmentMatching sets the reverse
  setMate(state, sVertex, sVertexMate);

  // labelEnd === null means free vertex (root of alternating tree)
  if (sBlossom.labelEnd === null) {
    return null;
  }

  // Follow the tree edge: S-blossom's labelEnd points to the T-vertex that labelled it
  const tVertex = sBlossom.labelEnd;
  const { blossomState: tBlossom, topLevelBlossomId: tBlossomId } =
    findBaseVertexInfo(state, tVertex);

  // T-blossom's labeledge tells us which S-vertex labelled it and from where
  const nextSVertex = tBlossom.labelEnd;
  const nextSVertexMate = tBlossom.labelEdgeVertex;
  if (nextSVertex === null || nextSVertexMate === null) {
    throw new Error('T-blossom missing labeledge');
  }

  // Expand T-blossom with entry at the vertex the augmenting path passes through
  if (isNonTrivialBlossom(tBlossom)) {
    expandBlossom(state, tBlossomId, nextSVertexMate);
  }

  // Flip the T-blossom's matched edge (next step completes the symmetric pair)
  setMate(state, nextSVertexMate, nextSVertex);

  return { sVertex: nextSVertex, sVertexMate: nextSVertexMate };
}

/**
 * Augments matching along path from a vertex toward its alternating tree root
 *
 * Traces backward through the alternating tree, expanding blossoms and
 * flipping mate assignments at each S-T pair along the path.
 *
 * @param state - Current matching state (modified in place)
 * @param sVertex - Starting S-vertex
 * @param sVertexMate - Vertex that sVertex should be matched to
 */
function augmentFromVertex(
  state: MatchingState,
  sVertex: VertexKey,
  sVertexMate: VertexKey,
): void {
  let current: AugmentStepPair | null = { sVertex, sVertexMate };

  while (current !== null) {
    current = augmentOneStep(state, current.sVertex, current.sVertexMate);
  }
}

/**
 * Augments the matching along a path between two vertices
 *
 * An augmenting path alternates between unmatched and matched edges,
 * starting and ending at free (unmatched) vertices. Flipping all edges
 * along the path increases the matching size by 1.
 *
 * Each pass traces from one endpoint toward its root, setting mates
 * one direction at a time. The two passes together produce symmetric
 * mate assignments for the augmenting edge endpoints.
 *
 * @param state - Current matching state (modified in place)
 * @param vertexU - First endpoint of augmenting path
 * @param vertexV - Second endpoint of augmenting path
 */
export function augmentMatching(
  state: MatchingState,
  vertexU: VertexKey,
  vertexV: VertexKey,
): void {
  // Trace from each endpoint toward its root, flipping mates along the path
  augmentFromVertex(state, vertexU, vertexV);
  augmentFromVertex(state, vertexV, vertexU);
}
