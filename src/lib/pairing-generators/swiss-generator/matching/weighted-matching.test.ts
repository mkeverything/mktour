/**
 * Unit tests for weighted maximum matching algorithm
 *
 * Tests verify that the algorithm finds maximum weight matchings,
 * not just maximum cardinality matchings.
 */

import { describe, expect, test } from 'bun:test';

import type { WeightedEdgeConfig } from './matching.fixtures';
import {
  buildWeightedGraph,
  computeMatchingWeight,
  countMatchedVertices,
  createTestGraph,
  isMatchingValid,
  STAR_CENTER,
  STAR_LEAF_1,
  STAR_LEAF_2,
  STAR_LEAF_3,
  STAR_LEAF_4,
  STAR_LEAF_5,
  VERTEX_A,
  VERTEX_B,
  VERTEX_C,
  VERTEX_D,
  VERTEX_E,
  VERTEX_F,
  VERTEX_G,
} from './matching.fixtures';
import { maximumWeightMatching } from './weighted-matching';

// ============================================================================
// Test Weight Constants
// ============================================================================

/** Standard weight for simple edge tests */
const WEIGHT_STANDARD = 10n;

/** Low weight for comparison tests */
const WEIGHT_LOW = 1n;

/** High weight for comparison tests */
const WEIGHT_HIGH = 10n;

/** Medium weight for trade-off tests */
const WEIGHT_MEDIUM = 5n;

/** Weight that makes one edge clearly preferred but not total-optimal */
const WEIGHT_SINGLE_HIGH = 8n;

/** Expected total for two medium-weight edges */
const EXPECTED_TWO_MEDIUM_TOTAL = 10n;

/** Expected matched count for 4-vertex perfect matching */
const EXPECTED_FOUR_VERTICES_MATCHED = 4;

/** Expected matched count for 6-vertex perfect matching */
const EXPECTED_SIX_VERTICES_MATCHED = 6;

/** Weight for path graph tests - outer edges */
const WEIGHT_PATH_OUTER = 3n;

/** Weight for path graph tests - middle edge (heavy) */
const WEIGHT_PATH_MIDDLE = 10n;

/** Very high weight that beats multiple lower weights */
const WEIGHT_VERY_HIGH = 100n;

/** Expected total for three medium edges */
const EXPECTED_THREE_MEDIUM_TOTAL = 15n;

/** Weight for equal weight tests */
const WEIGHT_UNIFORM = 5n;

/** Expected total for two equal weight edges (2 × 5) */
const EXPECTED_TWO_UNIFORM_TOTAL = 10n;

/** Expected total for three equal weight edges (3 × 5) */
const EXPECTED_THREE_UNIFORM_TOTAL = 15n;

/** Expected matched count for pentagon (5 vertices, 2 matched pairs) */
const EXPECTED_PENTAGON_MATCHED = 4;

/** Expected matched count for heptagon (7 vertices, 3 matched pairs) */
const EXPECTED_HEPTAGON_MATCHED = 6;

/** Expected minimum matched count for 12-vertex sparse tournament graph */
const EXPECTED_TOURNAMENT_MIN_MATCHED = 10;

/** Expected matched count for 8-vertex perfect matching */
const EXPECTED_EIGHT_MATCHED = 8;

/** Weight for sparse graph tests */
const WEIGHT_SPARSE = 100n;

// --- Numeric vertex IDs for larger tournament-like graphs ---

const VERTEX_0 = '0';
const VERTEX_1 = '1';
const VERTEX_2 = '2';
const VERTEX_3 = '3';
const VERTEX_4 = '4';
const VERTEX_5 = '5';
const VERTEX_6 = '6';
const VERTEX_7 = '7';
const VERTEX_8 = '8';
const VERTEX_9 = '9';
const VERTEX_10 = '10';
const VERTEX_11 = '11';

/** Expected total for three uniform edges (3 × 5) */
const EXPECTED_THREE_UNIFORM_HEPTAGON_TOTAL = 15n;

/** Weight for star graph tests - heavy edge to one leaf */
const WEIGHT_STAR_HEAVY = 20n;

/** Weight for star graph tests - light edges to other leaves */
const WEIGHT_STAR_LIGHT = 2n;

/** Weight for K4 complete graph - one heavy edge */
const WEIGHT_K4_HEAVY = 50n;

/** Weight for K4 complete graph - other edges */
const WEIGHT_K4_OTHER = 3n;

/** Expected total for K4 with one heavy edge (heavy + one other) */
const EXPECTED_K4_HEAVY_TOTAL = 53n;

/** Weight for competing alternatives test - slightly heavier middle */
const WEIGHT_SLIGHT_HEAVY = 7n;

/** Weight for competing alternatives test - outer edges */
const WEIGHT_SLIGHT_LIGHT = 4n;

/** Expected total for competing alternatives (two outer edges) */
const EXPECTED_COMPETING_OUTER_TOTAL = 8n;

// ============================================================================
// Edge Configurations
// ============================================================================

// --- Basic test edges ---

const EDGE_AB_STANDARD: WeightedEdgeConfig = {
  source: VERTEX_A,
  target: VERTEX_B,
  weight: WEIGHT_STANDARD,
};

// --- Triangle edges (for high weight preference test) ---

const EDGE_AB_LOW: WeightedEdgeConfig = {
  source: VERTEX_A,
  target: VERTEX_B,
  weight: WEIGHT_LOW,
};

const EDGE_BC_HIGH: WeightedEdgeConfig = {
  source: VERTEX_B,
  target: VERTEX_C,
  weight: WEIGHT_HIGH,
};

const EDGE_AC_LOW: WeightedEdgeConfig = {
  source: VERTEX_A,
  target: VERTEX_C,
  weight: WEIGHT_LOW,
};

// --- Weight vs cardinality trade-off edges ---

const EDGE_AB_MEDIUM: WeightedEdgeConfig = {
  source: VERTEX_A,
  target: VERTEX_B,
  weight: WEIGHT_MEDIUM,
};

const EDGE_CD_MEDIUM: WeightedEdgeConfig = {
  source: VERTEX_C,
  target: VERTEX_D,
  weight: WEIGHT_MEDIUM,
};

const EDGE_AC_SINGLE_HIGH: WeightedEdgeConfig = {
  source: VERTEX_A,
  target: VERTEX_C,
  weight: WEIGHT_SINGLE_HIGH,
};

// --- Path graph edges ---

const EDGE_AB_PATH_OUTER: WeightedEdgeConfig = {
  source: VERTEX_A,
  target: VERTEX_B,
  weight: WEIGHT_PATH_OUTER,
};

const EDGE_BC_PATH_MIDDLE: WeightedEdgeConfig = {
  source: VERTEX_B,
  target: VERTEX_C,
  weight: WEIGHT_PATH_MIDDLE,
};

const EDGE_CD_PATH_OUTER: WeightedEdgeConfig = {
  source: VERTEX_C,
  target: VERTEX_D,
  weight: WEIGHT_PATH_OUTER,
};

// --- 6-vertex graph edges ---

const EDGE_EF_MEDIUM: WeightedEdgeConfig = {
  source: VERTEX_E,
  target: VERTEX_F,
  weight: WEIGHT_MEDIUM,
};

const EDGE_AB_VERY_HIGH: WeightedEdgeConfig = {
  source: VERTEX_A,
  target: VERTEX_B,
  weight: WEIGHT_VERY_HIGH,
};

const EDGE_AC_MEDIUM: WeightedEdgeConfig = {
  source: VERTEX_A,
  target: VERTEX_C,
  weight: WEIGHT_MEDIUM,
};

const EDGE_BD_MEDIUM: WeightedEdgeConfig = {
  source: VERTEX_B,
  target: VERTEX_D,
  weight: WEIGHT_MEDIUM,
};

// --- Pentagon edges (uniform weight) ---

const EDGE_AB_UNIFORM: WeightedEdgeConfig = {
  source: VERTEX_A,
  target: VERTEX_B,
  weight: WEIGHT_UNIFORM,
};

const EDGE_BC_UNIFORM: WeightedEdgeConfig = {
  source: VERTEX_B,
  target: VERTEX_C,
  weight: WEIGHT_UNIFORM,
};

const EDGE_CD_UNIFORM: WeightedEdgeConfig = {
  source: VERTEX_C,
  target: VERTEX_D,
  weight: WEIGHT_UNIFORM,
};

const EDGE_DE_UNIFORM: WeightedEdgeConfig = {
  source: VERTEX_D,
  target: VERTEX_E,
  weight: WEIGHT_UNIFORM,
};

const EDGE_EA_UNIFORM: WeightedEdgeConfig = {
  source: VERTEX_E,
  target: VERTEX_A,
  weight: WEIGHT_UNIFORM,
};

const EDGE_EF_UNIFORM: WeightedEdgeConfig = {
  source: VERTEX_E,
  target: VERTEX_F,
  weight: WEIGHT_UNIFORM,
};

// --- Pentagon edges (with heavy c-d) ---

const EDGE_BC_LOW: WeightedEdgeConfig = {
  source: VERTEX_B,
  target: VERTEX_C,
  weight: WEIGHT_LOW,
};

const EDGE_CD_HIGH: WeightedEdgeConfig = {
  source: VERTEX_C,
  target: VERTEX_D,
  weight: WEIGHT_HIGH,
};

const EDGE_DE_LOW: WeightedEdgeConfig = {
  source: VERTEX_D,
  target: VERTEX_E,
  weight: WEIGHT_LOW,
};

const EDGE_EA_LOW: WeightedEdgeConfig = {
  source: VERTEX_E,
  target: VERTEX_A,
  weight: WEIGHT_LOW,
};

// --- Square edges (uniform) ---

const EDGE_DA_UNIFORM: WeightedEdgeConfig = {
  source: VERTEX_D,
  target: VERTEX_A,
  weight: WEIGHT_UNIFORM,
};

// --- Disconnected triangles edges ---

const EDGE_CA_LOW: WeightedEdgeConfig = {
  source: VERTEX_C,
  target: VERTEX_A,
  weight: WEIGHT_LOW,
};

const EDGE_EF_HIGH: WeightedEdgeConfig = {
  source: VERTEX_E,
  target: VERTEX_F,
  weight: WEIGHT_HIGH,
};

const EDGE_FD_LOW: WeightedEdgeConfig = {
  source: VERTEX_F,
  target: VERTEX_D,
  weight: WEIGHT_LOW,
};

// --- Heptagon edges (uniform weight) ---

const EDGE_FG_UNIFORM: WeightedEdgeConfig = {
  source: VERTEX_F,
  target: VERTEX_G,
  weight: WEIGHT_UNIFORM,
};

const EDGE_GA_UNIFORM: WeightedEdgeConfig = {
  source: VERTEX_G,
  target: VERTEX_A,
  weight: WEIGHT_UNIFORM,
};

// --- Star graph edges (center to leaves with weights) ---

const EDGE_CENTER_LEAF1_HEAVY: WeightedEdgeConfig = {
  source: STAR_CENTER,
  target: STAR_LEAF_1,
  weight: WEIGHT_STAR_HEAVY,
};

const EDGE_CENTER_LEAF2_LIGHT: WeightedEdgeConfig = {
  source: STAR_CENTER,
  target: STAR_LEAF_2,
  weight: WEIGHT_STAR_LIGHT,
};

const EDGE_CENTER_LEAF3_LIGHT: WeightedEdgeConfig = {
  source: STAR_CENTER,
  target: STAR_LEAF_3,
  weight: WEIGHT_STAR_LIGHT,
};

const EDGE_CENTER_LEAF4_LIGHT: WeightedEdgeConfig = {
  source: STAR_CENTER,
  target: STAR_LEAF_4,
  weight: WEIGHT_STAR_LIGHT,
};

const EDGE_CENTER_LEAF5_LIGHT: WeightedEdgeConfig = {
  source: STAR_CENTER,
  target: STAR_LEAF_5,
  weight: WEIGHT_STAR_LIGHT,
};

// --- K4 complete graph edges (one heavy, others light) ---

const EDGE_AB_K4_HEAVY: WeightedEdgeConfig = {
  source: VERTEX_A,
  target: VERTEX_B,
  weight: WEIGHT_K4_HEAVY,
};

const EDGE_AC_K4_OTHER: WeightedEdgeConfig = {
  source: VERTEX_A,
  target: VERTEX_C,
  weight: WEIGHT_K4_OTHER,
};

const EDGE_AD_K4_OTHER: WeightedEdgeConfig = {
  source: VERTEX_A,
  target: VERTEX_D,
  weight: WEIGHT_K4_OTHER,
};

const EDGE_BC_K4_OTHER: WeightedEdgeConfig = {
  source: VERTEX_B,
  target: VERTEX_C,
  weight: WEIGHT_K4_OTHER,
};

const EDGE_BD_K4_OTHER: WeightedEdgeConfig = {
  source: VERTEX_B,
  target: VERTEX_D,
  weight: WEIGHT_K4_OTHER,
};

const EDGE_CD_K4_OTHER: WeightedEdgeConfig = {
  source: VERTEX_C,
  target: VERTEX_D,
  weight: WEIGHT_K4_OTHER,
};

// --- Competing alternatives edges (4-path where outer sum > middle) ---

const EDGE_AB_SLIGHT_LIGHT: WeightedEdgeConfig = {
  source: VERTEX_A,
  target: VERTEX_B,
  weight: WEIGHT_SLIGHT_LIGHT,
};

const EDGE_BC_SLIGHT_HEAVY: WeightedEdgeConfig = {
  source: VERTEX_B,
  target: VERTEX_C,
  weight: WEIGHT_SLIGHT_HEAVY,
};

const EDGE_CD_SLIGHT_LIGHT: WeightedEdgeConfig = {
  source: VERTEX_C,
  target: VERTEX_D,
  weight: WEIGHT_SLIGHT_LIGHT,
};

// ============================================================================
// Tests
// ============================================================================

describe('maximumWeightMatching', () => {
  describe('Basic Cases', () => {
    test('two vertices with weighted edge', () => {
      const vertices = [VERTEX_A, VERTEX_B];
      const edges = [EDGE_AB_STANDARD];
      const graph = buildWeightedGraph(vertices, edges);

      const matching = maximumWeightMatching(graph);

      expect(isMatchingValid(matching)).toBe(true);
      expect(matching.get(VERTEX_A)).toBe(VERTEX_B);
      expect(matching.get(VERTEX_B)).toBe(VERTEX_A);
    });

    test('prefers higher weight edge in triangle', () => {
      // Triangle with one heavy edge (b-c = 10)
      // Should match b-c, leaving a unmatched
      const vertices = [VERTEX_A, VERTEX_B, VERTEX_C];
      const edges = [EDGE_AB_LOW, EDGE_BC_HIGH, EDGE_AC_LOW];
      const graph = buildWeightedGraph(vertices, edges);

      const matching = maximumWeightMatching(graph);

      expect(isMatchingValid(matching)).toBe(true);
      expect(matching.get(VERTEX_B)).toBe(VERTEX_C);
      expect(matching.get(VERTEX_C)).toBe(VERTEX_B);
      expect(matching.get(VERTEX_A)).toBeNull();
    });
  });

  describe('Weight vs Cardinality Trade-offs', () => {
    test('prefers two low edges over one high when total is greater', () => {
      // 4 vertices: a-b (5), c-d (5), a-c (8)
      // Options: {a-b, c-d} = 10 vs {a-c} = 8
      // Should choose {a-b, c-d}
      const vertices = [VERTEX_A, VERTEX_B, VERTEX_C, VERTEX_D];
      const edges = [EDGE_AB_MEDIUM, EDGE_CD_MEDIUM, EDGE_AC_SINGLE_HIGH];
      const graph = buildWeightedGraph(vertices, edges);

      const matching = maximumWeightMatching(graph);

      expect(isMatchingValid(matching)).toBe(true);
      const totalWeight = computeMatchingWeight(graph, matching);
      expect(totalWeight).toBe(EXPECTED_TWO_MEDIUM_TOTAL);
      expect(countMatchedVertices(matching)).toBe(
        EXPECTED_FOUR_VERTICES_MATCHED,
      );
    });
  });

  describe('Path Graphs', () => {
    test('4-vertex path prefers heavy middle over two outer edges (max weight mode)', () => {
      // Path: a—b—c—d with weights a-b=3, b-c=10, c-d=3
      // Options: {a-b, c-d} = 6 vs {b-c} = 10
      // Should choose {b-c} since 10 > 6 in max weight mode
      const vertices = [VERTEX_A, VERTEX_B, VERTEX_C, VERTEX_D];
      const edges = [
        EDGE_AB_PATH_OUTER,
        EDGE_BC_PATH_MIDDLE,
        EDGE_CD_PATH_OUTER,
      ];
      const graph = buildWeightedGraph(vertices, edges);
      const maxCardinality = false;

      const matching = maximumWeightMatching(graph, maxCardinality);

      expect(isMatchingValid(matching)).toBe(true);
      expect(matching.get(VERTEX_B)).toBe(VERTEX_C);
      expect(matching.get(VERTEX_C)).toBe(VERTEX_B);
      const totalWeight = computeMatchingWeight(graph, matching);
      expect(totalWeight).toBe(WEIGHT_PATH_MIDDLE);
    });

    test('4-vertex path prefers more pairs in max cardinality mode', () => {
      // Path: a—b—c—d with weights a-b=3, b-c=10, c-d=3
      // Options: {a-b, c-d} = 6 (2 pairs) vs {b-c} = 10 (1 pair)
      // Should choose {a-b, c-d} in max cardinality mode
      const vertices = [VERTEX_A, VERTEX_B, VERTEX_C, VERTEX_D];
      const edges = [
        EDGE_AB_PATH_OUTER,
        EDGE_BC_PATH_MIDDLE,
        EDGE_CD_PATH_OUTER,
      ];
      const graph = buildWeightedGraph(vertices, edges);
      const maxCardinality = true;

      const matching = maximumWeightMatching(graph, maxCardinality);

      expect(isMatchingValid(matching)).toBe(true);
      expect(countMatchedVertices(matching)).toBe(4);
      expect(matching.get(VERTEX_A)).toBe(VERTEX_B);
      expect(matching.get(VERTEX_C)).toBe(VERTEX_D);
    });
  });

  describe('Larger Graphs', () => {
    test('6-vertex graph with three disjoint edges', () => {
      // Three separate edges: a-b, c-d, e-f all with medium weight
      const vertices = [
        VERTEX_A,
        VERTEX_B,
        VERTEX_C,
        VERTEX_D,
        VERTEX_E,
        VERTEX_F,
      ];
      const edges = [EDGE_AB_MEDIUM, EDGE_CD_MEDIUM, EDGE_EF_MEDIUM];
      const graph = buildWeightedGraph(vertices, edges);

      const matching = maximumWeightMatching(graph);

      expect(isMatchingValid(matching)).toBe(true);
      expect(countMatchedVertices(matching)).toBe(
        EXPECTED_SIX_VERTICES_MATCHED,
      );
      const totalWeight = computeMatchingWeight(graph, matching);
      expect(totalWeight).toBe(EXPECTED_THREE_MEDIUM_TOTAL);
    });

    test('6-vertex graph prefers one very high edge over two medium (max weight mode)', () => {
      // Edges: a-b (100), a-c (5), b-d (5), e-f (5)
      // If we take a-b, we can also take e-f = 105 (2 pairs)
      // If we skip a-b, we could take a-c, b-d, e-f = 15 (3 pairs)
      // Should choose a-b + e-f = 105 in max weight mode
      const vertices = [
        VERTEX_A,
        VERTEX_B,
        VERTEX_C,
        VERTEX_D,
        VERTEX_E,
        VERTEX_F,
      ];
      const edges = [
        EDGE_AB_VERY_HIGH,
        EDGE_AC_MEDIUM,
        EDGE_BD_MEDIUM,
        EDGE_EF_MEDIUM,
      ];
      const graph = buildWeightedGraph(vertices, edges);
      const maxCardinality = false;

      const matching = maximumWeightMatching(graph, maxCardinality);

      expect(isMatchingValid(matching)).toBe(true);
      expect(matching.get(VERTEX_A)).toBe(VERTEX_B);
      expect(matching.get(VERTEX_E)).toBe(VERTEX_F);
      const expectedTotal = WEIGHT_VERY_HIGH + WEIGHT_MEDIUM;
      const totalWeight = computeMatchingWeight(graph, matching);
      expect(totalWeight).toBe(expectedTotal);
    });

    test('6-vertex graph prefers more pairs in max cardinality mode', () => {
      // Edges: a-b (100), a-c (5), b-d (5), e-f (5)
      // Should choose a-c, b-d, e-f = 15 (3 pairs, 6 vertices matched) in max cardinality mode
      const vertices = [
        VERTEX_A,
        VERTEX_B,
        VERTEX_C,
        VERTEX_D,
        VERTEX_E,
        VERTEX_F,
      ];
      const edges = [
        EDGE_AB_VERY_HIGH,
        EDGE_AC_MEDIUM,
        EDGE_BD_MEDIUM,
        EDGE_EF_MEDIUM,
      ];
      const graph = buildWeightedGraph(vertices, edges);
      const maxCardinality = true;

      const matching = maximumWeightMatching(graph, maxCardinality);

      expect(isMatchingValid(matching)).toBe(true);
      expect(countMatchedVertices(matching)).toBe(6);
    });
  });

  describe('Odd Cycles (Pentagon)', () => {
    test('pentagon with uniform weights matches 2 pairs', () => {
      // Pentagon: a—b—c—d—e—a, all edges weight 5
      // Can match at most 2 pairs (4 vertices), leaving 1 unmatched
      const vertices = [VERTEX_A, VERTEX_B, VERTEX_C, VERTEX_D, VERTEX_E];
      const edges = [
        EDGE_AB_UNIFORM,
        EDGE_BC_UNIFORM,
        EDGE_CD_UNIFORM,
        EDGE_DE_UNIFORM,
        EDGE_EA_UNIFORM,
      ];
      const graph = buildWeightedGraph(vertices, edges);

      const matching = maximumWeightMatching(graph);

      expect(isMatchingValid(matching)).toBe(true);
      expect(countMatchedVertices(matching)).toBe(EXPECTED_PENTAGON_MATCHED);
      const totalWeight = computeMatchingWeight(graph, matching);
      expect(totalWeight).toBe(EXPECTED_TWO_UNIFORM_TOTAL);
    });

    test('pentagon with one heavy edge prefers that edge', () => {
      // Pentagon: a—b—c—d—e—a
      // Edge c-d has high weight (10), others have low weight (1)
      const vertices = [VERTEX_A, VERTEX_B, VERTEX_C, VERTEX_D, VERTEX_E];
      const edges = [
        EDGE_AB_LOW,
        EDGE_BC_LOW,
        EDGE_CD_HIGH,
        EDGE_DE_LOW,
        EDGE_EA_LOW,
      ];
      const graph = buildWeightedGraph(vertices, edges);

      const matching = maximumWeightMatching(graph);

      expect(isMatchingValid(matching)).toBe(true);
      expect(matching.get(VERTEX_C)).toBe(VERTEX_D);
      expect(matching.get(VERTEX_D)).toBe(VERTEX_C);
    });
  });

  describe('Equal Weight Scenarios', () => {
    test('square with uniform weights finds perfect matching', () => {
      // Square: a—b—c—d—a, all edges weight 5
      const vertices = [VERTEX_A, VERTEX_B, VERTEX_C, VERTEX_D];
      const edges = [
        EDGE_AB_UNIFORM,
        EDGE_BC_UNIFORM,
        EDGE_CD_UNIFORM,
        EDGE_DA_UNIFORM,
      ];
      const graph = buildWeightedGraph(vertices, edges);

      const matching = maximumWeightMatching(graph);

      expect(isMatchingValid(matching)).toBe(true);
      expect(countMatchedVertices(matching)).toBe(
        EXPECTED_FOUR_VERTICES_MATCHED,
      );
      const totalWeight = computeMatchingWeight(graph, matching);
      expect(totalWeight).toBe(EXPECTED_TWO_UNIFORM_TOTAL);
    });

    test('6-vertex path with uniform weights', () => {
      // Path: a—b—c—d—e—f, all edges weight 5
      // Maximum matching: 3 pairs = 15
      const vertices = [
        VERTEX_A,
        VERTEX_B,
        VERTEX_C,
        VERTEX_D,
        VERTEX_E,
        VERTEX_F,
      ];
      const edges = [
        EDGE_AB_UNIFORM,
        EDGE_BC_UNIFORM,
        EDGE_CD_UNIFORM,
        EDGE_DE_UNIFORM,
        EDGE_EF_UNIFORM,
      ];
      const graph = buildWeightedGraph(vertices, edges);

      const matching = maximumWeightMatching(graph);

      expect(isMatchingValid(matching)).toBe(true);
      expect(countMatchedVertices(matching)).toBe(
        EXPECTED_SIX_VERTICES_MATCHED,
      );
      const totalWeight = computeMatchingWeight(graph, matching);
      expect(totalWeight).toBe(EXPECTED_THREE_UNIFORM_TOTAL);
    });
  });

  describe('Disconnected Components', () => {
    test('two triangles with different weights', () => {
      // Triangle 1: a-b-c with heavy edge b-c
      // Triangle 2: d-e-f with heavy edge e-f
      const vertices = [
        VERTEX_A,
        VERTEX_B,
        VERTEX_C,
        VERTEX_D,
        VERTEX_E,
        VERTEX_F,
      ];
      const edges = [
        EDGE_AB_LOW,
        EDGE_BC_HIGH,
        EDGE_CA_LOW,
        EDGE_DE_LOW,
        EDGE_EF_HIGH,
        EDGE_FD_LOW,
      ];
      const graph = buildWeightedGraph(vertices, edges);

      const matching = maximumWeightMatching(graph);

      expect(isMatchingValid(matching)).toBe(true);
      expect(matching.get(VERTEX_B)).toBe(VERTEX_C);
      expect(matching.get(VERTEX_E)).toBe(VERTEX_F);
      const expectedTotal = WEIGHT_HIGH + WEIGHT_HIGH;
      const totalWeight = computeMatchingWeight(graph, matching);
      expect(totalWeight).toBe(expectedTotal);
    });
  });

  describe('Edge Cases', () => {
    test('empty graph returns empty matching', () => {
      const graph = createTestGraph();
      const matching = maximumWeightMatching(graph);
      expect(matching.size).toBe(0);
    });

    test('single vertex returns unmatched', () => {
      const graph = createTestGraph();
      graph.addNode(VERTEX_A);
      const matching = maximumWeightMatching(graph);
      expect(matching.get(VERTEX_A)).toBeNull();
    });
  });

  describe('Complete Graphs', () => {
    test('K4 with one heavy edge prefers heavy edge plus disjoint edge', () => {
      // Complete graph K4 with edge a-b having heavy weight (50)
      // All other edges have light weight (3)
      // Should match a-b (50) + c-d (3) = 53
      const vertices = [VERTEX_A, VERTEX_B, VERTEX_C, VERTEX_D];
      const edges = [
        EDGE_AB_K4_HEAVY,
        EDGE_AC_K4_OTHER,
        EDGE_AD_K4_OTHER,
        EDGE_BC_K4_OTHER,
        EDGE_BD_K4_OTHER,
        EDGE_CD_K4_OTHER,
      ];
      const graph = buildWeightedGraph(vertices, edges);

      const matching = maximumWeightMatching(graph);

      expect(isMatchingValid(matching)).toBe(true);
      expect(countMatchedVertices(matching)).toBe(
        EXPECTED_FOUR_VERTICES_MATCHED,
      );
      expect(matching.get(VERTEX_A)).toBe(VERTEX_B);
      expect(matching.get(VERTEX_C)).toBe(VERTEX_D);
      const totalWeight = computeMatchingWeight(graph, matching);
      expect(totalWeight).toBe(EXPECTED_K4_HEAVY_TOTAL);
    });

    test('K4 with uniform weights finds perfect matching', () => {
      // Complete graph K4 with all edges having uniform weight
      // Any perfect matching gives total = 2 × WEIGHT_UNIFORM = 10
      const vertices = [VERTEX_A, VERTEX_B, VERTEX_C, VERTEX_D];
      const edges: WeightedEdgeConfig[] = [
        { source: VERTEX_A, target: VERTEX_B, weight: WEIGHT_UNIFORM },
        { source: VERTEX_A, target: VERTEX_C, weight: WEIGHT_UNIFORM },
        { source: VERTEX_A, target: VERTEX_D, weight: WEIGHT_UNIFORM },
        { source: VERTEX_B, target: VERTEX_C, weight: WEIGHT_UNIFORM },
        { source: VERTEX_B, target: VERTEX_D, weight: WEIGHT_UNIFORM },
        { source: VERTEX_C, target: VERTEX_D, weight: WEIGHT_UNIFORM },
      ];
      const graph = buildWeightedGraph(vertices, edges);

      const matching = maximumWeightMatching(graph);

      expect(isMatchingValid(matching)).toBe(true);
      expect(countMatchedVertices(matching)).toBe(
        EXPECTED_FOUR_VERTICES_MATCHED,
      );
      const totalWeight = computeMatchingWeight(graph, matching);
      expect(totalWeight).toBe(EXPECTED_TWO_UNIFORM_TOTAL);
    });
  });

  describe('Larger Odd Cycles (Heptagon)', () => {
    test('heptagon with uniform weights matches 3 pairs', () => {
      // Heptagon (7-cycle): a—b—c—d—e—f—g—a, all edges weight 5
      // Can match at most 3 pairs (6 vertices), leaving 1 unmatched
      const vertices = [
        VERTEX_A,
        VERTEX_B,
        VERTEX_C,
        VERTEX_D,
        VERTEX_E,
        VERTEX_F,
        VERTEX_G,
      ];
      const edges = [
        EDGE_AB_UNIFORM,
        EDGE_BC_UNIFORM,
        EDGE_CD_UNIFORM,
        EDGE_DE_UNIFORM,
        EDGE_EF_UNIFORM,
        EDGE_FG_UNIFORM,
        EDGE_GA_UNIFORM,
      ];
      const graph = buildWeightedGraph(vertices, edges);

      const matching = maximumWeightMatching(graph);

      expect(isMatchingValid(matching)).toBe(true);
      expect(countMatchedVertices(matching)).toBe(EXPECTED_HEPTAGON_MATCHED);
      const totalWeight = computeMatchingWeight(graph, matching);
      expect(totalWeight).toBe(EXPECTED_THREE_UNIFORM_HEPTAGON_TOTAL);
    });
  });

  describe('Star Graphs', () => {
    test('star with varying weights picks heaviest edge', () => {
      // Star: center connected to 5 leaves
      // One edge (center-leaf1) has high weight (20), others have low weight (2)
      // Can only match one edge, should pick the heaviest
      const vertices = [
        STAR_CENTER,
        STAR_LEAF_1,
        STAR_LEAF_2,
        STAR_LEAF_3,
        STAR_LEAF_4,
        STAR_LEAF_5,
      ];
      const edges = [
        EDGE_CENTER_LEAF1_HEAVY,
        EDGE_CENTER_LEAF2_LIGHT,
        EDGE_CENTER_LEAF3_LIGHT,
        EDGE_CENTER_LEAF4_LIGHT,
        EDGE_CENTER_LEAF5_LIGHT,
      ];
      const graph = buildWeightedGraph(vertices, edges);

      const matching = maximumWeightMatching(graph);

      expect(isMatchingValid(matching)).toBe(true);
      expect(matching.get(STAR_CENTER)).toBe(STAR_LEAF_1);
      expect(matching.get(STAR_LEAF_1)).toBe(STAR_CENTER);
      const totalWeight = computeMatchingWeight(graph, matching);
      expect(totalWeight).toBe(WEIGHT_STAR_HEAVY);
    });
  });

  describe('Blossom Formation', () => {
    test('triangle with two external vertices triggers blossom and dual updates', () => {
      // Triangle A-B-C with external D connected to A, E connected to C
      // Forces blossom formation around triangle during search
      //     D
      //     |
      // A---B---C---E
      //  \     /
      //   \   /
      //    (triangle edge A-C)
      const vertices = [VERTEX_A, VERTEX_B, VERTEX_C, VERTEX_D, VERTEX_E];
      const edges: WeightedEdgeConfig[] = [
        { source: VERTEX_A, target: VERTEX_B, weight: WEIGHT_UNIFORM },
        { source: VERTEX_B, target: VERTEX_C, weight: WEIGHT_UNIFORM },
        { source: VERTEX_A, target: VERTEX_C, weight: WEIGHT_UNIFORM }, // Triangle edge
        { source: VERTEX_D, target: VERTEX_A, weight: WEIGHT_UNIFORM }, // External D
        { source: VERTEX_E, target: VERTEX_C, weight: WEIGHT_UNIFORM }, // External E
      ];
      const graph = buildWeightedGraph(vertices, edges);

      const matching = maximumWeightMatching(graph);

      // Should match D-A and E-C, leaving B unmatched (odd vertex in triangle)
      expect(isMatchingValid(matching)).toBe(true);
      expect(countMatchedVertices(matching)).toBe(EXPECTED_PENTAGON_MATCHED); // 4 matched
      const totalWeight = computeMatchingWeight(graph, matching);
      expect(totalWeight).toBe(EXPECTED_TWO_UNIFORM_TOTAL); // 2 × 5 = 10
    });

    test('bowtie graph (two triangles sharing vertex) requires blossom handling', () => {
      // Two triangles sharing vertex C:
      // Triangle 1: A-B-C
      // Triangle 2: C-D-E
      //     A       E
      //    / \     / \
      //   B---C---D
      const vertices = [VERTEX_A, VERTEX_B, VERTEX_C, VERTEX_D, VERTEX_E];
      const edges: WeightedEdgeConfig[] = [
        // Triangle 1
        { source: VERTEX_A, target: VERTEX_B, weight: WEIGHT_UNIFORM },
        { source: VERTEX_B, target: VERTEX_C, weight: WEIGHT_UNIFORM },
        { source: VERTEX_C, target: VERTEX_A, weight: WEIGHT_UNIFORM },
        // Triangle 2
        { source: VERTEX_C, target: VERTEX_D, weight: WEIGHT_UNIFORM },
        { source: VERTEX_D, target: VERTEX_E, weight: WEIGHT_UNIFORM },
        { source: VERTEX_E, target: VERTEX_C, weight: WEIGHT_UNIFORM },
      ];
      const graph = buildWeightedGraph(vertices, edges);

      const matching = maximumWeightMatching(graph);

      // Should match 2 pairs (4 vertices), C can be in one pair
      expect(isMatchingValid(matching)).toBe(true);
      expect(countMatchedVertices(matching)).toBe(EXPECTED_PENTAGON_MATCHED); // 4 matched
      const totalWeight = computeMatchingWeight(graph, matching);
      expect(totalWeight).toBe(EXPECTED_TWO_UNIFORM_TOTAL); // 2 × 5 = 10
    });

    test('sparse tournament-like graph with constraints triggers blossom dual updates', () => {
      // 12 vertices simulating tournament round 2+ where some edges are forbidden
      // This structure requires blossom formation and subsequent dual updates
      const vertices = [
        VERTEX_0,
        VERTEX_1,
        VERTEX_2,
        VERTEX_3,
        VERTEX_4,
        VERTEX_5,
        VERTEX_6,
        VERTEX_7,
        VERTEX_8,
        VERTEX_9,
        VERTEX_10,
        VERTEX_11,
      ];

      // Create sparse graph - not all pairs connected (simulating prior games)
      // Structure designed to force blossom formation with odd cycles
      const edges: WeightedEdgeConfig[] = [
        // Chain forming odd cycle (5-cycle)
        { source: VERTEX_0, target: VERTEX_1, weight: WEIGHT_UNIFORM },
        { source: VERTEX_1, target: VERTEX_2, weight: WEIGHT_UNIFORM },
        { source: VERTEX_2, target: VERTEX_3, weight: WEIGHT_UNIFORM },
        { source: VERTEX_3, target: VERTEX_4, weight: WEIGHT_UNIFORM },
        { source: VERTEX_4, target: VERTEX_0, weight: WEIGHT_UNIFORM },
        // Additional connections
        { source: VERTEX_5, target: VERTEX_0, weight: WEIGHT_UNIFORM },
        { source: VERTEX_5, target: VERTEX_6, weight: WEIGHT_UNIFORM },
        { source: VERTEX_6, target: VERTEX_7, weight: WEIGHT_UNIFORM },
        { source: VERTEX_7, target: VERTEX_8, weight: WEIGHT_UNIFORM },
        { source: VERTEX_8, target: VERTEX_9, weight: WEIGHT_UNIFORM },
        { source: VERTEX_9, target: VERTEX_10, weight: WEIGHT_UNIFORM },
        { source: VERTEX_10, target: VERTEX_11, weight: WEIGHT_UNIFORM },
        // Cross connections to increase complexity
        { source: VERTEX_2, target: VERTEX_7, weight: WEIGHT_UNIFORM },
        { source: VERTEX_3, target: VERTEX_8, weight: WEIGHT_UNIFORM },
        { source: VERTEX_4, target: VERTEX_9, weight: WEIGHT_UNIFORM },
      ];
      const graph = buildWeightedGraph(vertices, edges);

      const matching = maximumWeightMatching(graph);

      expect(isMatchingValid(matching)).toBe(true);
      // 12 vertices, should get at least 5 pairs (10 matched)
      expect(countMatchedVertices(matching)).toBeGreaterThanOrEqual(
        EXPECTED_TOURNAMENT_MIN_MATCHED,
      );
    });

    test('12-vertex graph with multiple triangles finds optimal matching', () => {
      // 4 disjoint triangles - each can contribute 1 edge to matching
      // Maximum cardinality = 4 edges (8 vertices), not 6 (12 vertices)
      // because triangles are odd cycles
      const vertices = [
        VERTEX_0,
        VERTEX_1,
        VERTEX_2,
        VERTEX_3,
        VERTEX_4,
        VERTEX_5,
        VERTEX_6,
        VERTEX_7,
        VERTEX_8,
        VERTEX_9,
        VERTEX_10,
        VERTEX_11,
      ];

      // Uniform weights for simplicity
      const edges: WeightedEdgeConfig[] = [
        // Triangle 1: 0-1-2
        { source: VERTEX_0, target: VERTEX_1, weight: WEIGHT_UNIFORM },
        { source: VERTEX_1, target: VERTEX_2, weight: WEIGHT_UNIFORM },
        { source: VERTEX_2, target: VERTEX_0, weight: WEIGHT_UNIFORM },
        // Triangle 2: 3-4-5
        { source: VERTEX_3, target: VERTEX_4, weight: WEIGHT_UNIFORM },
        { source: VERTEX_4, target: VERTEX_5, weight: WEIGHT_UNIFORM },
        { source: VERTEX_5, target: VERTEX_3, weight: WEIGHT_UNIFORM },
        // Triangle 3: 6-7-8
        { source: VERTEX_6, target: VERTEX_7, weight: WEIGHT_UNIFORM },
        { source: VERTEX_7, target: VERTEX_8, weight: WEIGHT_UNIFORM },
        { source: VERTEX_8, target: VERTEX_6, weight: WEIGHT_UNIFORM },
        // Triangle 4: 9-10-11
        { source: VERTEX_9, target: VERTEX_10, weight: WEIGHT_UNIFORM },
        { source: VERTEX_10, target: VERTEX_11, weight: WEIGHT_UNIFORM },
        { source: VERTEX_11, target: VERTEX_9, weight: WEIGHT_UNIFORM },
      ];
      const graph = buildWeightedGraph(vertices, edges);

      const matching = maximumWeightMatching(graph);

      expect(isMatchingValid(matching)).toBe(true);
      // 4 disjoint triangles = 4 edges max (8 vertices)
      const EXPECTED_TRIANGLES_MATCHED = 8;
      expect(countMatchedVertices(matching)).toBe(EXPECTED_TRIANGLES_MATCHED);
    });
  });

  describe('Competing Alternatives', () => {
    test('4-path prefers two outer edges when sum exceeds middle', () => {
      // Path: a—b—c—d with weights a-b=4, b-c=7, c-d=4
      // Options: {a-b, c-d} = 8 vs {b-c} = 7
      // Should choose {a-b, c-d} since 8 > 7
      const vertices = [VERTEX_A, VERTEX_B, VERTEX_C, VERTEX_D];
      const edges = [
        EDGE_AB_SLIGHT_LIGHT,
        EDGE_BC_SLIGHT_HEAVY,
        EDGE_CD_SLIGHT_LIGHT,
      ];
      const graph = buildWeightedGraph(vertices, edges);

      const matching = maximumWeightMatching(graph);

      expect(isMatchingValid(matching)).toBe(true);
      expect(countMatchedVertices(matching)).toBe(
        EXPECTED_FOUR_VERTICES_MATCHED,
      );
      expect(matching.get(VERTEX_A)).toBe(VERTEX_B);
      expect(matching.get(VERTEX_C)).toBe(VERTEX_D);
      const totalWeight = computeMatchingWeight(graph, matching);
      expect(totalWeight).toBe(EXPECTED_COMPETING_OUTER_TOTAL);
    });
  });

  describe('Sparse Graphs (late-round Swiss)', () => {
    test('finds perfect matching on two disjoint 4-cycles', () => {
      const vertices = [
        VERTEX_0,
        VERTEX_1,
        VERTEX_2,
        VERTEX_3,
        VERTEX_4,
        VERTEX_5,
        VERTEX_6,
        VERTEX_7,
      ];
      const edges: WeightedEdgeConfig[] = [
        { source: VERTEX_0, target: VERTEX_1, weight: WEIGHT_SPARSE },
        { source: VERTEX_1, target: VERTEX_2, weight: WEIGHT_SPARSE },
        { source: VERTEX_2, target: VERTEX_3, weight: WEIGHT_SPARSE },
        { source: VERTEX_3, target: VERTEX_0, weight: WEIGHT_SPARSE },
        { source: VERTEX_4, target: VERTEX_5, weight: WEIGHT_SPARSE },
        { source: VERTEX_5, target: VERTEX_6, weight: WEIGHT_SPARSE },
        { source: VERTEX_6, target: VERTEX_7, weight: WEIGHT_SPARSE },
        { source: VERTEX_7, target: VERTEX_4, weight: WEIGHT_SPARSE },
      ];
      const graph = buildWeightedGraph(vertices, edges);

      const matching = maximumWeightMatching(graph, true);

      expect(isMatchingValid(matching)).toBe(true);
      expect(countMatchedVertices(matching)).toBe(EXPECTED_EIGHT_MATCHED);
    });

    test('finds perfect matching on single 8-cycle', () => {
      const vertices = [
        VERTEX_0,
        VERTEX_1,
        VERTEX_2,
        VERTEX_3,
        VERTEX_4,
        VERTEX_5,
        VERTEX_6,
        VERTEX_7,
      ];
      const edges: WeightedEdgeConfig[] = [
        { source: VERTEX_0, target: VERTEX_1, weight: WEIGHT_SPARSE },
        { source: VERTEX_1, target: VERTEX_2, weight: WEIGHT_SPARSE },
        { source: VERTEX_2, target: VERTEX_3, weight: WEIGHT_SPARSE },
        { source: VERTEX_3, target: VERTEX_4, weight: WEIGHT_SPARSE },
        { source: VERTEX_4, target: VERTEX_5, weight: WEIGHT_SPARSE },
        { source: VERTEX_5, target: VERTEX_6, weight: WEIGHT_SPARSE },
        { source: VERTEX_6, target: VERTEX_7, weight: WEIGHT_SPARSE },
        { source: VERTEX_7, target: VERTEX_0, weight: WEIGHT_SPARSE },
      ];
      const graph = buildWeightedGraph(vertices, edges);

      const matching = maximumWeightMatching(graph, true);

      expect(isMatchingValid(matching)).toBe(true);
      expect(countMatchedVertices(matching)).toBe(EXPECTED_EIGHT_MATCHED);
    });
  });
});
