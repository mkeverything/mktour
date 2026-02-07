/**
 * Dual variable updates for weighted Blossom algorithm
 *
 * Contains functions for:
 * - Computing the 4 delta types
 * - Selecting minimum delta
 * - Applying dual updates to vertices and blossoms
 *
 * Delta types (NetworkX naming):
 * - delta1: S-vertex to free vertex (slack / 1)
 * - delta2: S-vertex to T-vertex (slack / 1)
 * - delta3: S-blossom to S-blossom (slack / 2)
 * - delta4: Blossom dual reaches zero (dual / 2)
 *
 * References:
 * - NetworkX max_weight_matching implementation
 */

import Graph from 'graphology';

import {
  IS_MATCHING_DEBUG_ENABLED,
  IS_MATCHING_TRACE_ENABLED,
  matchingLogger,
  type EdgeDeltaInfo,
} from './matching-logger';
import { findBase, findBaseVertexInfo } from './tree-operations';
import { computeSlack, getEdgeEndpoints } from './weighted-operations';

import type {
  BaseDelta,
  BlossomDelta,
  BlossomId,
  DualVariable,
  EdgeDelta,
  GraphEdgeKey,
  NodeId,
  VertexKey,
  VertexState,
  WeightedMatchingState,
} from './types';
import { Label, ZERO_DUAL } from './types';

/** Tuple of vertex key and its state, from Map.entries() */
type VertexEntry = [VertexKey, VertexState];

/** Divisor for S→S edges and blossom duals (both sides change) */
const DUAL_CHANGE_DIVISOR = 2n;

/** Multiplier for vertex duals (single endpoint) */
const VERTEX_MULTIPLIER = 1n;

/** Positive sign (no change in direction) */
const POSITIVE_SIGN = 1n;

/** Negative sign (invert direction) */
const NEGATIVE_SIGN = -1n;

/**
 * Gets the label of a vertex's top-level blossom
 *
 * Per NetworkX: labels are stored on blossoms, not vertices.
 */
function getVertexLabel(
  state: WeightedMatchingState,
  vertexKey: VertexKey,
): Label {
  const { blossomState } = findBaseVertexInfo(state, vertexKey);
  return blossomState.label;
}

/**
 * Computes delta for an edge based on endpoint labels
 *
 * Delta type is determined by endpoint labels:
 * - S→free or S→T: delta = slack
 * - S→S cross-blossom: delta = slack/2
 *
 * @param state - Weighted matching state
 * @param graph - Graphology graph
 * @param edgeKey - Edge to compute delta for
 * @returns EdgeDelta or null if no delta applies
 */
export function computeEdgeDelta(
  state: WeightedMatchingState,
  graph: Graph,
  edgeKey: GraphEdgeKey,
): EdgeDelta | null {
  const [vertexU, vertexV] = getEdgeEndpoints(graph, edgeKey);
  const labelU = getVertexLabel(state, vertexU);
  const labelV = getVertexLabel(state, vertexV);

  const isUSLabelled = labelU === Label.S;
  const isVSLabelled = labelV === Label.S;
  const isBothSLabelled = isUSLabelled && isVSLabelled;
  const isExactlyOneSLabelled = isUSLabelled !== isVSLabelled;

  let result: EdgeDelta | null = null;

  if (isBothSLabelled) {
    // Both S-labelled: check if cross-blossom
    const baseU = findBase(state, vertexU);
    const baseV = findBase(state, vertexV);
    const isCrossBlossom = baseU !== baseV;

    if (isCrossBlossom) {
      // S→S cross-blossom: divide slack by 2
      const slack = computeSlack(state, graph, edgeKey);
      const delta = slack / DUAL_CHANGE_DIVISOR;
      result = { delta, edgeKey };
    }
    // else: internal edge, result stays null
  } else if (isExactlyOneSLabelled) {
    // Exactly one S-labelled: check if other is unlabelled (free or matched but not in tree)
    // T-labelled vertices are already in the tree and can't help make progress
    const otherLabel = isUSLabelled ? labelV : labelU;
    const isOtherUnlabelled = otherLabel === Label.NONE;

    if (isOtherUnlabelled) {
      // S→unlabelled: use full slack (delta2 in NetworkX terminology)
      const slack = computeSlack(state, graph, edgeKey);
      result = { delta: slack, edgeKey };
    }
    // T-labelled or S-labelled: doesn't contribute to delta
  }
  // else: neither S-labelled, result stays null

  // Skip edges with non-positive delta (tight or over-tight)
  // NetworkX only considers edges with positive slack for delta computation
  const hasNonPositiveDelta = result !== null && result.delta <= ZERO_DUAL;

  if (IS_MATCHING_TRACE_ENABLED && result !== null && !hasNonPositiveDelta) {
    const info: EdgeDeltaInfo = {
      type: isBothSLabelled ? 'S-S' : 'S-NONE',
      vertexU,
      vertexV,
      slack: result.delta.toString(),
      delta: result.delta.toString(),
    };
    matchingLogger.withMetadata(info).trace('Edge delta computed');
  }

  return hasNonPositiveDelta ? null : result;
}

/**
 * Computes delta for T-labelled blossom dual reaching zero
 *
 * When a blossom's dual variable reaches zero, the blossom must be expanded.
 * Only applies to non-trivial T-labelled blossoms.
 *
 * @param state - Weighted matching state
 * @param blossomId - Blossom to compute delta for
 * @returns BlossomDelta with blossom ID and delta value, or null if not applicable
 * @throws If blossom or its base vertex not found
 */
export function computeBlossomDelta(
  state: WeightedMatchingState,
  blossomId: BlossomId,
): BlossomDelta | null {
  const blossom = state.blossoms.get(blossomId);

  if (blossom === undefined) {
    throw new Error(`Blossom ${blossomId} not found`);
  }

  let result: BlossomDelta | null = null;

  // First condition: must be non-trivial blossom (trivial = single vertex, no dual)
  const isNonTrivial = blossom.children.length > 1;

  if (isNonTrivial) {
    // Second condition: blossom must be T-labelled
    // T-labelled blossoms have their dual decreased during updates
    // Per NetworkX: labels are stored on blossoms, not vertices
    const isTLabelled = blossom.label === Label.T;

    if (isTLabelled) {
      const blossomDual = state.duals.get(blossomId);

      if (blossomDual === undefined) {
        throw new Error(`Dual not found for blossom ${blossomId}`);
      }

      // Delta = dual / 2 (blossom dual decreases by 2 per unit update)
      // When this reaches 0, blossom must be expanded
      const delta = blossomDual / DUAL_CHANGE_DIVISOR;
      result = { delta, blossomId };
    }
    // else: not T-labelled (S-labelled or NONE), result stays null
  }
  // else: trivial blossom, result stays null

  return result;
}

/** Source identifier for delta computation */
type DeltaSourceId = GraphEdgeKey | BlossomId;

/** Union of all concrete delta types (edge tightening or blossom expansion) */
export type AnyDelta = EdgeDelta | BlossomDelta;

/**
 * Collects applicable deltas by computing for each source ID
 *
 * Return type is determined by input type:
 * - GraphEdgeKey[] → EdgeDelta[]
 * - BlossomId[] → BlossomDelta[]
 *
 * @param state - Weighted matching state
 * @param graph - Graphology graph
 * @param sources - Array of edge keys or blossom IDs to compute deltas for
 * @returns Array of computed deltas (excludes sources with no applicable delta)
 */
function collectDeltas(
  state: WeightedMatchingState,
  graph: Graph,
  sources: GraphEdgeKey[],
): EdgeDelta[];
function collectDeltas(
  state: WeightedMatchingState,
  graph: Graph,
  sources: BlossomId[],
): BlossomDelta[];
function collectDeltas(
  state: WeightedMatchingState,
  graph: Graph,
  sources: DeltaSourceId[],
): AnyDelta[] {
  const deltas: AnyDelta[] = [];

  for (const sourceId of sources) {
    let delta: AnyDelta | null = null;

    if (typeof sourceId === 'string') {
      delta = computeEdgeDelta(state, graph, sourceId);
    } else {
      delta = computeBlossomDelta(state, sourceId);
    }

    if (delta !== null) {
      deltas.push(delta);
    }
  }

  return deltas;
}

/**
 * Collects all applicable edge deltas from the graph
 *
 * @param state - Weighted matching state
 * @param graph - Graphology graph
 * @returns Array of EdgeDelta objects (may be empty)
 */
export function collectEdgeDeltas(
  state: WeightedMatchingState,
  graph: Graph,
): EdgeDelta[] {
  return collectDeltas(state, graph, graph.edges());
}

/**
 * Collects all applicable blossom deltas from the state
 *
 * @param state - Weighted matching state
 * @param graph - Graphology graph
 * @returns Array of BlossomDelta objects (may be empty)
 */
export function collectBlossomDeltas(
  state: WeightedMatchingState,
  graph: Graph,
): BlossomDelta[] {
  return collectDeltas(state, graph, [...state.blossoms.keys()]);
}

/**
 * Compares two deltas and returns the one with smaller delta value
 *
 * Used as reducer callback for finding minimum delta.
 *
 * @param current - Current minimum delta (accumulator)
 * @param candidate - Delta to compare against current
 * @returns The delta with smaller value
 */
function selectSmallerDelta<DeltaType extends BaseDelta>(
  current: DeltaType,
  candidate: DeltaType,
): DeltaType {
  if (candidate.delta < current.delta) {
    return candidate;
  } else {
    return current;
  }
}

/**
 * Finds the delta with minimum value from a collection
 *
 * @param deltas - Array of delta objects (EdgeDelta or BlossomDelta)
 * @returns The delta with smallest value, or null if empty
 */
export function findMinimumDelta<DeltaType extends BaseDelta>(
  deltas: DeltaType[],
): DeltaType | null {
  if (deltas.length === 0) {
    return null;
  } else {
    return deltas.reduce(selectSmallerDelta);
  }
}

/**
 * Information about a node for dual updates
 */
interface NodeDualInfo {
  readonly nodeId: NodeId;
  readonly label: Label;
  readonly isBlossom: boolean;
}

/**
 * Iterates over all nodes (vertices and non-trivial blossoms) with their labels
 *
 * Yields vertices first (all of them), then non-trivial blossoms.
 * Labels come from the BASE vertex to match delta computation.
 * This ensures vertices inside blossoms inherit the blossom's label.
 *
 * @param state - Weighted matching state
 * @yields NodeDualInfo for each vertex and non-trivial blossom
 */
function* iterateNodesWithLabels(
  state: WeightedMatchingState,
): Generator<NodeDualInfo> {
  // Yield all vertices with their top-level blossom's label for consistency
  // Per NetworkX: labels are stored on blossoms, not vertices
  for (const [vertexKey] of state.vertices) {
    const { blossomState } = findBaseVertexInfo(state, vertexKey);
    const nodeInfo: NodeDualInfo = {
      nodeId: vertexKey,
      label: blossomState.label,
      isBlossom: false,
    };
    yield nodeInfo;
  }

  // Yield non-trivial blossoms
  // Per NetworkX: labels are stored directly on blossoms
  for (const [blossomId, blossom] of state.blossoms) {
    const isNonTrivial = blossom.children.length > 1;

    if (isNonTrivial) {
      const nodeInfo: NodeDualInfo = {
        nodeId: blossomId,
        label: blossom.label,
        isBlossom: true,
      };
      yield nodeInfo;
    }
  }
}

/**
 * Computes the dual change for a given label
 *
 * Vertices and blossoms change in opposite directions:
 * - Vertices: S decreases, T increases (by delta)
 * - Blossoms: S increases, T decreases (by 2*delta)
 *
 * @param label - Label of the vertex/blossom
 * @param delta - Base delta value
 * @param isBlossom - Whether this is a blossom (affects direction and multiplier)
 * @returns The change to apply to the dual (can be negative)
 */
function computeDualChange(
  label: Label,
  delta: DualVariable,
  isBlossom: boolean,
): DualVariable {
  if (label === Label.NONE) {
    return ZERO_DUAL;
  }

  const multiplier = isBlossom ? DUAL_CHANGE_DIVISOR : VERTEX_MULTIPLIER;
  const labelSign = label === Label.S ? NEGATIVE_SIGN : POSITIVE_SIGN;
  const blossomInverter = isBlossom ? NEGATIVE_SIGN : POSITIVE_SIGN;

  return delta * multiplier * labelSign * blossomInverter;
}

/**
 * Applies dual variable updates based on the computed delta
 *
 * Updates vertex and blossom duals according to their labels:
 * - S-labelled vertices: dual -= delta
 * - T-labelled vertices: dual += delta
 * - S-labelled blossoms: dual += 2*delta (opposite direction)
 * - T-labelled blossoms: dual -= 2*delta (opposite direction)
 *
 * @param state - Weighted matching state (modified in place)
 * @param delta - The delta value to apply
 */
export function applyDualUpdates(
  state: WeightedMatchingState,
  delta: DualVariable,
): void {
  for (const nodeInfo of iterateNodesWithLabels(state)) {
    const currentDual = state.duals.get(nodeInfo.nodeId);

    if (currentDual === undefined) {
      throw new Error(`Dual not found for node ${nodeInfo.nodeId}`);
    }

    const change = computeDualChange(nodeInfo.label, delta, nodeInfo.isBlossom);
    const newDual = currentDual + change;

    state.duals.set(nodeInfo.nodeId, newDual);
  }

  if (IS_MATCHING_DEBUG_ENABLED) {
    matchingLogger.withMetadata({ delta }).debug('Dual updates applied');
  }
}

/**
 * Computes the minimum delta across all edge and blossom deltas
 *
 * This determines the next dual update step:
 * - EdgeDelta: edge becomes tight, retry BFS
 * - BlossomDelta: blossom dual reaches zero, expand blossom
 * - null: no more updates possible (matching complete)
 *
 * @param state - Weighted matching state
 * @param graph - Graphology graph
 * @returns The minimum delta (edge or blossom), or null if none applicable
 */
export function computeMinimumDelta(
  state: WeightedMatchingState,
  graph: Graph,
): AnyDelta | null {
  // Collect all deltas from both sources
  const edgeDeltas = collectEdgeDeltas(state, graph);
  const blossomDeltas = collectBlossomDeltas(state, graph);

  // Combine into single array and find minimum
  const allDeltas: AnyDelta[] = [...edgeDeltas, ...blossomDeltas];

  return findMinimumDelta(allDeltas);
}

/**
 * Filters vertices to only S-labelled ones
 *
 * Per NetworkX: labels are stored on blossoms, so we check
 * the top-level blossom's label for each vertex.
 *
 * @param state - Weighted matching state
 * @returns Array of vertex entries for S-labelled vertices
 */
function filterSLabelledVertices(state: WeightedMatchingState): VertexEntry[] {
  const sLabelledVertices: VertexEntry[] = [];

  for (const entry of state.vertices.entries()) {
    const [vertexKey] = entry;
    const { blossomState } = findBaseVertexInfo(state, vertexKey);

    if (blossomState.label === Label.S) {
      sLabelledVertices.push(entry);
    }
  }

  return sLabelledVertices;
}

/**
 * Extracts dual values for a list of vertices
 *
 * @param state - Weighted matching state
 * @param vertexEntries - Vertex entries to extract duals for
 * @returns Array of dual values
 * @throws If any vertex is missing its dual
 */
function extractDualsForVertices(
  state: WeightedMatchingState,
  vertexEntries: VertexEntry[],
): DualVariable[] {
  const duals: DualVariable[] = [];

  for (const [vertexKey] of vertexEntries) {
    const dual = state.duals.get(vertexKey);

    if (dual === undefined) {
      throw new Error(`Dual not found for S-vertex ${vertexKey}`);
    }

    duals.push(dual);
  }

  return duals;
}

/**
 * Finds minimum value in a list of duals
 *
 * @param duals - Non-empty array of dual values
 * @returns The minimum dual value
 */
function findMinimumDual(duals: DualVariable[]): DualVariable {
  const selectSmaller = (
    currentMin: DualVariable,
    dual: DualVariable,
  ): DualVariable => {
    if (dual < currentMin) {
      return dual;
    } else {
      return currentMin;
    }
  };

  return duals.reduce(selectSmaller);
}

/**
 * Computes the termination bound (delta1) - minimum S-vertex dual
 *
 * This is the smallest dual value among S-labelled vertices.
 * When this reaches zero, no more augmenting paths are possible
 * and the algorithm should terminate.
 *
 * Unlike delta2/delta3/delta4, this doesn't produce an actionable event
 * (no edge to tighten or blossom to expand), it's purely a termination check.
 *
 * @param state - Weighted matching state
 * @returns Minimum S-vertex dual, or null if no S-vertices exist
 */
export function computeTerminationBound(
  state: WeightedMatchingState,
): DualVariable | null {
  const sVertices = filterSLabelledVertices(state);

  if (sVertices.length === 0) {
    return null;
  }

  const sVertexDuals = extractDualsForVertices(state, sVertices);

  return findMinimumDual(sVertexDuals);
}
