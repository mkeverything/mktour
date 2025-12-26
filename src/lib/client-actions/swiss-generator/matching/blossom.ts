/**
 * Blossom and augmenting path operations for Edmonds' Blossom Algorithm
 *
 * Contains functions for:
 * - Blossom creation (addBlossom)
 * - Blossom expansion (expandBlossom)
 * - Augmenting path processing
 * - Mate updates
 */

import type {
  AugmentFromVertexStartInfo,
  AugmentFromVertexStepInfo,
  AugmentMatchingStartInfo,
} from './matching-logger';
import { IS_MATCHING_DEBUG_ENABLED, matchingLogger } from './matching-logger';
import {
  findBaseVertexInfo,
  findDirectChildOf,
  findLowestCommonAncestor,
  isAlternatingTreeRoot,
} from './tree-operations';
import type {
  AugmentStepResult,
  BlossomId,
  BlossomState,
  BlossomChildren,
  MatchingState,
  TraversalStepResult,
  VertexKey,
  WalkDirection,
} from './types';
import {
  MIN_CHILDREN_FOR_NONTRIVIAL_BLOSSOM,
  NOT_FOUND_IN_ARRAY,
  NO_NEXT_VERTEX,
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
 * Promotes blossom children after expansion.
 *
 * When expanding a blossom B:
 * - If B has a parent P: children inherit P as their new parent, keeping chain intact
 * - If B is top-level: children become top-level (parent = null)
 *
 * This ensures the parent chain traversal from any vertex remains valid
 * after intermediate blossoms are expanded.
 *
 * @param state - Current matching state
 * @param blossom - Blossom whose children to promote
 */
function promoteBlossomChildren(
  state: MatchingState,
  blossom: BlossomState,
): void {
  const newParent = blossom.parent;

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

    // Children inherit expanded blossom's parent
    childBlossom.parent = newParent;
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
  for (const childBlossomId of childBlossomIds) {
    const childBlossom = state.blossoms.get(childBlossomId);
    if (childBlossom === undefined) {
      throw new Error(`Child blossom ${childBlossomId} not found in state`);
    }
    childBlossom.parent = newBlossomId;
  }
}

/**
 * Expands a blossom when an augmenting path passes through it
 *
 * When an augmenting path enters a blossom at some vertex, we need to:
 * 1. Find which sub-blossom contains the entry vertex
 * 2. Trace the path through the blossom's cycle to the base
 * 3. Update the matching along this path
 * 4. Recursively expand any sub-blossoms encountered
 * 5. Update parent pointers to restore the blossom hierarchy
 *
 * @param state - Current matching state (modified in place)
 * @param blossomId - Blossom to expand
 * @param entryVertex - Vertex where augmenting path enters the blossom
 */
export function expandBlossom(
  state: MatchingState,
  blossomId: BlossomId,
  entryVertex: VertexKey,
): void {
  const blossom = state.blossoms.get(blossomId);
  if (blossom === undefined) {
    throw new Error(`Blossom ${blossomId} not found in state`);
  }

  // Find which sub-blossom contains the entry vertex
  // Use findDirectChildOf because inBlossom points to innermost blossom,
  // but we need the direct child of this outer blossom
  const entryBlossomId = findDirectChildOf(state, blossomId, entryVertex);
  const entryIndex = findChildIndex(entryBlossomId, blossom.children);

  // Find the base sub-blossom
  const baseVertex = blossom.base;
  const baseBlossomId = findDirectChildOf(state, blossomId, baseVertex);
  const baseIndex = findChildIndex(baseBlossomId, blossom.children);

  // Determine direction to walk around the cycle
  const cycleLength = blossom.children.length;
  const walkDirection = determineWalkDirection(
    entryIndex,
    baseIndex,
    cycleLength,
  );

  // Promote children BEFORE expansion to ensure correct parent chain
  // This must happen first because recursive expansion deletes child blossoms,
  // and their grandchildren need to inherit from this blossom's parent
  promoteBlossomChildren(state, blossom);

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
    const nextIndex = currentIndex + walkDirection.stepSize;
    const wrappedIndex = (nextIndex + cycleLength) % cycleLength;
    currentIndex = wrappedIndex;
  }

  // Remove the expanded blossom from state to prevent re-expansion
  state.blossoms.delete(blossomId);
}

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
export function updateMates(
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

  // Clear old mate pointers ONLY if they still point back to us (symmetric check)
  // This prevents clearing mates that were already re-matched earlier in the same augmentation
  const oldMateU = stateU.mate;
  const oldMateV = stateV.mate;

  if (oldMateU !== null && oldMateU !== vertexV) {
    const oldMateUState = state.vertices.get(oldMateU);
    const oldMateStillPointsToU =
      oldMateUState !== undefined && oldMateUState.mate === vertexU;
    if (oldMateStillPointsToU) {
      oldMateUState.mate = null;
    }
  }

  if (oldMateV !== null && oldMateV !== vertexU) {
    const oldMateVState = state.vertices.get(oldMateV);
    const oldMateStillPointsToV =
      oldMateVState !== undefined && oldMateVState.mate === vertexV;
    if (oldMateStillPointsToV) {
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
 * Handles blossom expansion when the current vertex is inside a non-trivial
 * blossom. After expansion, recomputes the base vertex state since the vertex
 * may now be at top-level with different properties.
 *
 * @param state - Current matching state
 * @param step - Traversal step information
 * @returns Result indicating whether to continue and next vertex
 */
export function processAugmentStep(
  state: MatchingState,
  step: TraversalStepResult,
): AugmentStepResult {
  const { currentVertex } = step;

  // Expand blossom if current vertex is inside one
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

  if (IS_MATCHING_DEBUG_ENABLED) {
    matchingLogger.debug(
      `processAugmentStep: vertex=${currentVertex}, blossomId=${currentBlossomId}, ` +
        `parent=${currentBlossom.parent}, isInsideBlossom=${isInsideBlossom}`,
    );
  }

  if (isInsideBlossom) {
    const parentBlossomId = currentBlossom.parent;
    if (parentBlossomId === null) {
      throw new Error('Expected non-null parent for nested blossom');
    }

    if (IS_MATCHING_DEBUG_ENABLED) {
      matchingLogger.debug(`Expanding parent blossom ${parentBlossomId}`);
    }

    expandBlossom(state, parentBlossomId, currentVertex);

    // Check if still inside a blossom after expansion
    const blossomAfterExpansion = state.blossoms.get(currentBlossomId);
    if (IS_MATCHING_DEBUG_ENABLED && blossomAfterExpansion) {
      matchingLogger.debug(
        `After expansion: blossom ${currentBlossomId} parent=${blossomAfterExpansion.parent}`,
      );
    }
  }

  // Use original base state for path traversal, not recomputed state
  // After blossom expansion, the newly exposed vertex may have stale labels
  // because only the outer blossom's base was labelled during BFS.
  // The original base (from step) has the correct labelEnd for the tree structure.
  const { baseState: originalBaseState } = step;

  if (IS_MATCHING_DEBUG_ENABLED) {
    matchingLogger.debug(
      `Using original base for traversal: labelEnd=${originalBaseState.labelEnd}, ` +
        `mate=${originalBaseState.mate}, isRoot=${step.isRoot}`,
    );
  }

  // Check if we've reached a root using the original base state
  if (step.isRoot) {
    const stopResult: AugmentStepResult = {
      shouldContinue: false,
      nextVertex: NO_NEXT_VERTEX,
    };
    return stopResult;
  }

  // Get the vertex that gave the original base its label
  const labelEnd = originalBaseState.labelEnd;

  if (labelEnd === null) {
    throw new Error(
      `Vertex ${step.baseVertex} has label ${originalBaseState.label} but no labelEnd`,
    );
  }

  // Find the T-vertex (labelEnd) and get its base
  const { baseVertex: labelEndBase, baseState: labelEndBaseState } =
    findBaseVertexInfo(state, labelEnd);

  // Get T-vertex's matched partner (the next S-vertex in the path toward root)
  // Save this BEFORE updateMates clears it
  const previousMate = labelEndBaseState.mate;

  // If T has no mate, we've reached the end of the path
  if (previousMate === null) {
    const stopResult: AugmentStepResult = {
      shouldContinue: false,
      nextVertex: NO_NEXT_VERTEX,
    };
    return stopResult;
  }

  // Recompute current vertex's base AFTER blossom expansion for matching
  const { baseVertex: currentBase } = findBaseVertexInfo(state, currentVertex);

  // Match T-vertex with current vertex's base
  // This flips the edge: T was matched with previousMate, now T is matched with currentBase
  updateMates(state, labelEndBase, currentBase);

  // Continue from T's old mate (the next S-vertex toward the root)
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
 * flipping mate assignments along the path. Also expands any blossoms encountered.
 *
 * @param state - Current matching state (modified in place)
 * @param startVertex - Vertex to start tracing from
 */
export function augmentFromVertex(
  state: MatchingState,
  startVertex: VertexKey,
): void {
  if (IS_MATCHING_DEBUG_ENABLED) {
    const startInfo: AugmentFromVertexStartInfo = { startVertex };
    matchingLogger
      .withMetadata(startInfo)
      .debug('Starting augment from vertex');
  }

  let currentVertex = startVertex;
  let shouldContinue = true;

  while (shouldContinue) {
    const { baseVertex, baseState, topLevelBlossomId } = findBaseVertexInfo(
      state,
      currentVertex,
    );
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
      topLevelBlossomId,
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
 * along the path increases the matching size by 1.
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
