import { AppError } from '@/lib/errors';

import Graph from 'graphology';

import { computeSlack, getEdgeEndpoints } from './weighted-operations';
import type { GraphEdgeKey, WeightedMatchingState } from './types';
import {
  MIN_CHILDREN_FOR_NONTRIVIAL_BLOSSOM,
  NO_MATE,
  ZERO_DUAL,
} from './types';

/**
 * checks galil 1986 condition 7.0 on edges: every slack is non-negative
 *
 * a negative slack means the duals at an edge's ends add up to less than its
 * weight, so the sum of all duals no longer caps every matching and the
 * proof of optimality fails.
 *
 * @param state - weighted matching state after the last stage
 * @param graph - the solver's internal graph, with weights already doubled
 * @throws if any edge has negative slack, naming the edge and its slack
 */
function assertEdgeSlacks(state: WeightedMatchingState, graph: Graph): void {
  for (const edgeKey of graph.edges()) {
    const slack = computeSlack(state, graph, edgeKey);
    const isSlackNegative = slack < ZERO_DUAL;

    if (isSlackNegative) {
      const [vertexU, vertexV] = getEdgeEndpoints(graph, edgeKey);

      throw new AppError('PAIRING_GENERATOR_ERROR', {
        cause: `galil 7.0 fails: edge ${vertexU}-${vertexV} has slack ${slack}`,
      });
    }
  }
}

/**
 * checks galil 1986 condition 7.0 on vertices: every dual is non-negative
 *
 * the cap argument bounds any rival matching by the sum of all vertex duals,
 * including those of vertices the rival leaves unmatched. that bound only
 * holds when none of them is negative.
 *
 * @param state - weighted matching state after the last stage
 * @throws if a vertex has no dual or a negative one, naming it
 */
function assertVertexDualsNonNegative(state: WeightedMatchingState): void {
  for (const vertexKey of state.vertices.keys()) {
    const dual = state.duals.get(vertexKey);

    if (dual === undefined) {
      throw new AppError('PAIRING_GENERATOR_ERROR', {
        cause: `vertex ${vertexKey} has no dual`,
      });
    }

    const isNegative = dual < ZERO_DUAL;

    if (isNegative) {
      throw new AppError('PAIRING_GENERATOR_ERROR', {
        cause: `galil 7.0 fails: vertex ${vertexKey} has dual ${dual}`,
      });
    }
  }
}

/**
 * checks galil 1986 condition 7.0 on blossoms: every dual is non-negative
 *
 * the cap argument counts each blossom dual once per pair a matching can
 * hold inside the blossom. a rival matching holding fewer pairs there stays
 * under the cap only if the dual is non-negative.
 *
 * only blossoms still in the structure are checked: the dual map keeps
 * entries for removed blossoms, which say nothing about the final state.
 *
 * @param state - weighted matching state after the last stage
 * @throws if a live blossom has no dual or a negative one, naming it
 */
function assertBlossomDualsNonNegative(state: WeightedMatchingState): void {
  for (const [blossomId, blossom] of state.blossoms) {
    const isNonTrivial =
      blossom.children.length >= MIN_CHILDREN_FOR_NONTRIVIAL_BLOSSOM;

    if (isNonTrivial) {
      const dual = state.duals.get(blossomId);

      if (dual === undefined) {
        throw new AppError('PAIRING_GENERATOR_ERROR', {
          cause: `blossom ${blossomId} has no dual`,
        });
      }

      const isNegative = dual < ZERO_DUAL;

      if (isNegative) {
        throw new AppError('PAIRING_GENERATOR_ERROR', {
          cause: `galil 7.0 fails: blossom ${blossomId} has dual ${dual}`,
        });
      }
    }
  }
}

/**
 * finds the edge joining every matched pair, each edge once
 *
 * the solver stores the matching as mate pointers on vertices, while the
 * duality conditions are stated on edges, so the pairs are mapped back.
 *
 * @param state - weighted matching state after the last stage
 * @param graph - the solver's internal graph
 * @returns the key of every matched edge
 * @throws if a matched pair has no edge between them
 */
function collectMatchedEdges(
  state: WeightedMatchingState,
  graph: Graph,
): Set<GraphEdgeKey> {
  const matchedEdges = new Set<GraphEdgeKey>();

  for (const [vertexKey, vertexState] of state.vertices) {
    const mate = vertexState.mate;
    const isMatched = mate !== NO_MATE;

    if (isMatched) {
      const matchedEdge = graph.edge(vertexKey, mate);

      if (matchedEdge === undefined) {
        throw new AppError('PAIRING_GENERATOR_ERROR', {
          cause: `matched ${vertexKey}-${mate} has no edge`,
        });
      }

      matchedEdges.add(matchedEdge);
    }
  }

  return matchedEdges;
}

/**
 * checks galil 1986 condition 7.1: every matched edge has slack zero
 *
 * by 7.0 the sum of all duals caps every matching. our matching reaches that
 * cap only if the duals at each matched edge's ends pay exactly its weight;
 * any overpayment leaves our weight below the cap and the proof fails.
 *
 * @param state - weighted matching state after the last stage
 * @param graph - the solver's internal graph, with weights already doubled
 * @throws if a matched edge has non-zero slack, naming it
 */
function assertMatchedEdgesTight(
  state: WeightedMatchingState,
  graph: Graph,
): void {
  const matchedEdges = collectMatchedEdges(state, graph);

  for (const edgeKey of matchedEdges) {
    const slack = computeSlack(state, graph, edgeKey);
    const isTight = slack === ZERO_DUAL;

    if (!isTight) {
      const [vertexU, vertexV] = getEdgeEndpoints(graph, edgeKey);

      throw new AppError('PAIRING_GENERATOR_ERROR', {
        cause: `galil 7.1 fails: ${vertexU}-${vertexV} has slack ${slack}`,
      });
    }
  }
}

/**
 * checks galil 1986 condition 7.2: every unmatched vertex has dual zero
 *
 * an unmatched vertex pays toward no edge of our matching, so any dual it
 * holds counts toward the cap but not toward our weight, leaving our weight
 * below the cap and the proof unfinished.
 *
 * @param state - weighted matching state after the last stage
 * @throws if an unmatched vertex has no dual or a non-zero one, naming it
 */
function assertUnmatchedDualsZero(state: WeightedMatchingState): void {
  for (const [vertexKey, vertexState] of state.vertices) {
    const isUnmatched = vertexState.mate === NO_MATE;

    if (isUnmatched) {
      const dual = state.duals.get(vertexKey);

      if (dual === undefined) {
        throw new AppError('PAIRING_GENERATOR_ERROR', {
          cause: `unmatched ${vertexKey} has no dual`,
        });
      }

      const isZero = dual === ZERO_DUAL;

      if (!isZero) {
        throw new AppError('PAIRING_GENERATOR_ERROR', {
          cause: `galil 7.2 fails: unmatched ${vertexKey} has dual ${dual}`,
        });
      }
    }
  }
}

/**
 * checks the solver's final duals against galil 1986, section 7
 *
 * the conditions there prove a matching has maximum weight. 7.0 to 7.2 are
 * checked. 7.3, every blossom with a positive dual is full, is not yet: it
 * holds while blossoms never outlive a stage, and its check comes with the
 * blossom-lifetime fix.
 *
 * @param state - weighted matching state after the last stage
 * @param graph - the solver's internal graph, with weights already doubled
 * @throws if a checked condition fails, naming it
 */
export function verifyMatchingOptimum(
  state: WeightedMatchingState,
  graph: Graph,
): void {
  assertEdgeSlacks(state, graph);
  assertVertexDualsNonNegative(state);
  assertBlossomDualsNonNegative(state);
  assertMatchedEdgesTight(state, graph);
  assertUnmatchedDualsZero(state);
}
