/**
 * Unit tests for Edmonds' Blossom maximum matching algorithm
 *
 * Tests cover:
 * - Basic cases (empty, single vertex, pairs)
 * - Simple paths (various lengths)
 * - Blossom formation (odd cycles)
 * - Complete graphs
 * - Disconnected components
 * - Complex structures
 * - Edge cases
 */

import { describe, expect, test } from 'bun:test';

import type { VertexKey } from './matching';
import { maximumMatching } from './matching';
import {
  buildGraphFromConfig,
  countMatchedVertices,
  createCompleteGraphConfig,
  createCycleConfig,
  createPathConfig,
  createPetersenGraph,
  createStarGraph,
  createTestGraph,
  generateVertexNames,
  isMatchingValid,
  PETERSEN_INNER_0,
  PETERSEN_INNER_1,
  PETERSEN_INNER_2,
  PETERSEN_INNER_3,
  PETERSEN_INNER_4,
  PETERSEN_OUTER_0,
  PETERSEN_OUTER_1,
  PETERSEN_OUTER_2,
  PETERSEN_OUTER_3,
  PETERSEN_OUTER_4,
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
} from './matching/matching.fixtures';

// ============================================================================
// Test Constants (expected results)
// ============================================================================

/** Expected matching size for empty graph */
const EMPTY_MATCHING_SIZE = 0;

/** Expected matching size for single vertex */
const SINGLE_VERTEX_MATCHING_SIZE = 0;

/** Expected matching size for two connected vertices */
const TWO_VERTEX_MATCHING_SIZE = 1;

/** Expected matching size for triangle (3 vertices, 3 edges) */
const TRIANGLE_MATCHING_SIZE = 1;

/** Expected matching size for square (4 vertices, 4 edges) */
const SQUARE_MATCHING_SIZE = 2;

/** Expected matching size for pentagon (5 vertices, 5 edges) */
const PENTAGON_MATCHING_SIZE = 2;

/** Expected matching size for complete graph K3 */
const K3_MATCHING_SIZE = 1;

/** Expected matching size for complete graph K4 */
const K4_MATCHING_SIZE = 2;

/** Expected matching size for complete graph K5 */
const K5_MATCHING_SIZE = 2;

/** Expected matching size for complete graph K6 */
const K6_MATCHING_SIZE = 3;

/** Expected matching size for star graph */
const STAR_GRAPH_MATCHING_SIZE = 1;

/** Number of vertices in Petersen graph */
const PETERSEN_VERTEX_COUNT = 10;

// Path graph sizes
const PATH_4_VERTEX_COUNT = 4;
const PATH_5_VERTEX_COUNT = 5;
const PATH_6_VERTEX_COUNT = 6;
const PATH_20_VERTEX_COUNT = 20;

// Cycle graph sizes
const TRIANGLE_VERTEX_COUNT = 3;
const PENTAGON_VERTEX_COUNT = 5;

// Complete graph sizes
const K3_VERTEX_COUNT = 3;
const K4_VERTEX_COUNT = 4;
const K5_VERTEX_COUNT = 5;
const K6_VERTEX_COUNT = 6;

// Validation result expectations
const MATCHING_IS_VALID = true;

// ============================================================================
// Test Suites
// ============================================================================

describe('maximumMatching', () => {
  describe('Basic Cases', () => {
    test('empty graph returns empty matching', () => {
      // Create empty graph with no vertices
      const graph = createTestGraph();

      // Run matching algorithm
      const matching = maximumMatching(graph);

      // Verify matching is empty
      expect(matching.size).toBe(EMPTY_MATCHING_SIZE);
    });

    test('single vertex returns empty matching', () => {
      // Create graph with one vertex
      const graph = createTestGraph();
      graph.addNode(VERTEX_A);

      // Run matching algorithm
      const matching = maximumMatching(graph);

      // Verify matching properties
      expect(matching.size).toBe(1);

      // Verify vertex is unmatched
      const mateOfA = matching.get(VERTEX_A);
      expect(mateOfA).toBeNull();

      // Verify no vertices are matched
      const matchedCount = countMatchedVertices(matching);
      expect(matchedCount).toBe(SINGLE_VERTEX_MATCHING_SIZE);
    });

    test('two disconnected vertices return empty matching', () => {
      // Create graph with two vertices but no edge
      const graph = createTestGraph();
      graph.addNode(VERTEX_A);
      graph.addNode(VERTEX_B);

      // Run matching algorithm
      const matching = maximumMatching(graph);

      // Verify both vertices are unmatched
      const mateOfA = matching.get(VERTEX_A);
      const mateOfB = matching.get(VERTEX_B);
      expect(mateOfA).toBeNull();
      expect(mateOfB).toBeNull();

      // Verify no vertices are matched
      const matchedCount = countMatchedVertices(matching);
      expect(matchedCount).toBe(EMPTY_MATCHING_SIZE);
    });

    test('two connected vertices return perfect matching', () => {
      // Create graph with two vertices and one edge
      const graph = createTestGraph();
      graph.addNode(VERTEX_A);
      graph.addNode(VERTEX_B);
      graph.addEdge(VERTEX_A, VERTEX_B);

      // Run matching algorithm
      const matching = maximumMatching(graph);

      // Verify both vertices are matched to each other
      const mateOfA = matching.get(VERTEX_A);
      const mateOfB = matching.get(VERTEX_B);
      expect(mateOfA).toBe(VERTEX_B);
      expect(mateOfB).toBe(VERTEX_A);

      // Verify matching is valid
      const isValid = isMatchingValid(matching);
      expect(isValid).toBe(MATCHING_IS_VALID);

      // Verify matching size (2 vertices matched = 1 edge)
      const matchedCount = countMatchedVertices(matching);
      const expectedMatchedCount = TWO_VERTEX_MATCHING_SIZE * 2;
      expect(matchedCount).toBe(expectedMatchedCount);
    });
  });

  describe('Simple Paths', () => {
    test('4-vertex path returns matching of size 2', () => {
      // Create path: a—b—c—d
      const pathVertexCount = PATH_4_VERTEX_COUNT;
      const pathConfig = createPathConfig(pathVertexCount);
      const vertices = generateVertexNames(pathVertexCount);
      const graph = buildGraphFromConfig(vertices, pathConfig.edges);

      // Run matching algorithm
      const matching = maximumMatching(graph);

      // Verify matching is valid
      const isValid = isMatchingValid(matching);
      expect(isValid).toBe(MATCHING_IS_VALID);

      // Verify matching size (4 vertices → 2 edges)
      const matchedCount = countMatchedVertices(matching);
      const expectedMatchedCount = PATH_4_VERTEX_COUNT;
      expect(matchedCount).toBe(expectedMatchedCount);
    });

    test('5-vertex path returns matching of size 2', () => {
      // Create path: a—b—c—d—e
      const pathVertexCount = PATH_5_VERTEX_COUNT;
      const pathConfig = createPathConfig(pathVertexCount);
      const vertices = generateVertexNames(pathVertexCount);
      const graph = buildGraphFromConfig(vertices, pathConfig.edges);

      // Run matching algorithm
      const matching = maximumMatching(graph);

      // Verify matching is valid
      const isValid = isMatchingValid(matching);
      expect(isValid).toBe(MATCHING_IS_VALID);

      // Verify matching size (5 vertices → 2 edges, 1 unmatched)
      const matchedCount = countMatchedVertices(matching);
      const expectedMatchedCount = PATH_4_VERTEX_COUNT;
      expect(matchedCount).toBe(expectedMatchedCount);
    });

    test('6-vertex path returns matching of size 3', () => {
      // Create path: a—b—c—d—e—f
      const pathVertexCount = PATH_6_VERTEX_COUNT;
      const pathConfig = createPathConfig(pathVertexCount);
      const vertices = generateVertexNames(pathVertexCount);
      const graph = buildGraphFromConfig(vertices, pathConfig.edges);

      // Run matching algorithm
      const matching = maximumMatching(graph);

      // Verify matching is valid
      const isValid = isMatchingValid(matching);
      expect(isValid).toBe(MATCHING_IS_VALID);

      // Verify matching size (6 vertices → 3 edges)
      const matchedCount = countMatchedVertices(matching);
      const expectedMatchedCount = PATH_6_VERTEX_COUNT;
      expect(matchedCount).toBe(expectedMatchedCount);
    });

    test('20-vertex path returns matching of size 10', () => {
      // Create long path to test scalability
      const pathVertexCount = PATH_20_VERTEX_COUNT;
      const pathConfig = createPathConfig(pathVertexCount);
      const vertices = generateVertexNames(pathVertexCount);
      const graph = buildGraphFromConfig(vertices, pathConfig.edges);

      // Run matching algorithm
      const matching = maximumMatching(graph);

      // Verify matching is valid
      const isValid = isMatchingValid(matching);
      expect(isValid).toBe(MATCHING_IS_VALID);

      // Verify matching size (20 vertices → 10 edges)
      const matchedCount = countMatchedVertices(matching);
      const expectedMatchedCount = PATH_20_VERTEX_COUNT;
      expect(matchedCount).toBe(expectedMatchedCount);
    });
  });

  describe('Blossom Formation (Odd Cycles)', () => {
    test('triangle (3-cycle) returns matching of size 1', () => {
      // Create triangle: a—b—c—a
      const triangleVertexCount = TRIANGLE_VERTEX_COUNT;
      const triangleConfig = createCycleConfig(triangleVertexCount);
      const vertices = generateVertexNames(triangleVertexCount);
      const graph = buildGraphFromConfig(vertices, triangleConfig.edges);

      // Run matching algorithm
      const matching = maximumMatching(graph);

      // Verify matching is valid
      const isValid = isMatchingValid(matching);
      expect(isValid).toBe(MATCHING_IS_VALID);

      // Verify matching size (3 vertices → 1 edge, 1 unmatched)
      const matchedCount = countMatchedVertices(matching);
      const expectedMatchedCount = TRIANGLE_MATCHING_SIZE * 2;
      expect(matchedCount).toBe(expectedMatchedCount);
    });

    test('pentagon (5-cycle) returns matching of size 2', () => {
      // Create pentagon: a—b—c—d—e—a
      const pentagonVertexCount = PENTAGON_VERTEX_COUNT;
      const pentagonConfig = createCycleConfig(pentagonVertexCount);
      const vertices = generateVertexNames(pentagonVertexCount);
      const graph = buildGraphFromConfig(vertices, pentagonConfig.edges);

      // Run matching algorithm
      const matching = maximumMatching(graph);

      // Verify matching is valid
      const isValid = isMatchingValid(matching);
      expect(isValid).toBe(MATCHING_IS_VALID);

      // Verify matching size (5 vertices → 2 edges, 1 unmatched)
      const matchedCount = countMatchedVertices(matching);
      const expectedMatchedCount = PENTAGON_MATCHING_SIZE * 2;
      expect(matchedCount).toBe(expectedMatchedCount);
    });

    test('triangle with external edge', () => {
      // Create triangle with external vertex: a—b—c—a, d—a
      // This tests blossom formation when augmenting path enters blossom
      const graph = createTestGraph();
      graph.addNode(VERTEX_A);
      graph.addNode(VERTEX_B);
      graph.addNode(VERTEX_C);
      graph.addNode(VERTEX_D);

      // Add triangle edges
      graph.addEdge(VERTEX_A, VERTEX_B);
      graph.addEdge(VERTEX_B, VERTEX_C);
      graph.addEdge(VERTEX_C, VERTEX_A);

      // Add external edge
      graph.addEdge(VERTEX_D, VERTEX_A);

      // Run matching algorithm
      const matching = maximumMatching(graph);

      // Verify matching is valid
      const isValid = isMatchingValid(matching);
      expect(isValid).toBe(MATCHING_IS_VALID);

      // Verify matching size (4 vertices → 2 edges)
      // Optimal: d-a, b-c (leaving c unmatched is also valid)
      const matchedCount = countMatchedVertices(matching);
      const expectedMatchedCount = PATH_4_VERTEX_COUNT;
      expect(matchedCount).toBe(expectedMatchedCount);
    });
  });

  describe('Complete Graphs', () => {
    test('K3 (complete graph on 3 vertices) returns matching of size 1', () => {
      // Create K3: every pair connected
      const k3VertexCount = K3_VERTEX_COUNT;
      const k3Config = createCompleteGraphConfig(k3VertexCount);
      const vertices = generateVertexNames(k3VertexCount);
      const graph = buildGraphFromConfig(vertices, k3Config.edges);

      // Run matching algorithm
      const matching = maximumMatching(graph);

      // Verify matching is valid
      const isValid = isMatchingValid(matching);
      expect(isValid).toBe(MATCHING_IS_VALID);

      // Verify matching size (3 vertices → 1 edge, 1 unmatched)
      const matchedCount = countMatchedVertices(matching);
      const expectedMatchedCount = K3_MATCHING_SIZE * 2;
      expect(matchedCount).toBe(expectedMatchedCount);
    });

    test('K4 (complete graph on 4 vertices) returns matching of size 2', () => {
      // Create K4: every pair connected
      const k4VertexCount = K4_VERTEX_COUNT;
      const k4Config = createCompleteGraphConfig(k4VertexCount);
      const vertices = generateVertexNames(k4VertexCount);
      const graph = buildGraphFromConfig(vertices, k4Config.edges);

      // Run matching algorithm
      const matching = maximumMatching(graph);

      // Verify matching is valid
      const isValid = isMatchingValid(matching);
      expect(isValid).toBe(MATCHING_IS_VALID);

      // Verify matching size (4 vertices → 2 edges, perfect matching)
      const matchedCount = countMatchedVertices(matching);
      const expectedMatchedCount = K4_MATCHING_SIZE * 2;
      expect(matchedCount).toBe(expectedMatchedCount);
    });

    test('K5 (complete graph on 5 vertices) returns matching of size 2', () => {
      // Create K5: every pair connected
      const k5VertexCount = K5_VERTEX_COUNT;
      const k5Config = createCompleteGraphConfig(k5VertexCount);
      const vertices = generateVertexNames(k5VertexCount);
      const graph = buildGraphFromConfig(vertices, k5Config.edges);

      // Run matching algorithm
      const matching = maximumMatching(graph);

      // Verify matching is valid
      const isValid = isMatchingValid(matching);
      expect(isValid).toBe(MATCHING_IS_VALID);

      // Verify matching size (5 vertices → 2 edges, 1 unmatched)
      const matchedCount = countMatchedVertices(matching);
      const expectedMatchedCount = K5_MATCHING_SIZE * 2;
      expect(matchedCount).toBe(expectedMatchedCount);
    });

    test('K6 (complete graph on 6 vertices) returns matching of size 3', () => {
      // Create K6: every pair connected
      const k6VertexCount = K6_VERTEX_COUNT;
      const k6Config = createCompleteGraphConfig(k6VertexCount);
      const vertices = generateVertexNames(k6VertexCount);
      const graph = buildGraphFromConfig(vertices, k6Config.edges);

      // Run matching algorithm
      const matching = maximumMatching(graph);

      // Verify matching is valid
      const isValid = isMatchingValid(matching);
      expect(isValid).toBe(MATCHING_IS_VALID);

      // Verify matching size (6 vertices → 3 edges, perfect matching)
      const matchedCount = countMatchedVertices(matching);
      const expectedMatchedCount = K6_MATCHING_SIZE * 2;
      expect(matchedCount).toBe(expectedMatchedCount);
    });
  });

  describe('Disconnected Components', () => {
    test('two separate edges', () => {
      // Create graph with two disjoint edges: a-b, c-d
      const graph = createTestGraph();
      graph.addNode(VERTEX_A);
      graph.addNode(VERTEX_B);
      graph.addNode(VERTEX_C);
      graph.addNode(VERTEX_D);

      graph.addEdge(VERTEX_A, VERTEX_B);
      graph.addEdge(VERTEX_C, VERTEX_D);

      // Run matching algorithm
      const matching = maximumMatching(graph);

      // Verify matching is valid
      const isValid = isMatchingValid(matching);
      expect(isValid).toBe(MATCHING_IS_VALID);

      // Verify matching size (4 vertices → 2 edges)
      const matchedCount = countMatchedVertices(matching);
      const expectedMatchedCount = PATH_4_VERTEX_COUNT;
      expect(matchedCount).toBe(expectedMatchedCount);
    });

    test('triangle and separate edge', () => {
      // Create graph: triangle (a-b-c-a) and separate edge (d-e)
      const graph = createTestGraph();
      graph.addNode(VERTEX_A);
      graph.addNode(VERTEX_B);
      graph.addNode(VERTEX_C);
      graph.addNode(VERTEX_D);
      graph.addNode(VERTEX_E);

      // Add triangle
      graph.addEdge(VERTEX_A, VERTEX_B);
      graph.addEdge(VERTEX_B, VERTEX_C);
      graph.addEdge(VERTEX_C, VERTEX_A);

      // Add separate edge
      graph.addEdge(VERTEX_D, VERTEX_E);

      // Run matching algorithm
      const matching = maximumMatching(graph);

      // Verify matching is valid
      const isValid = isMatchingValid(matching);
      expect(isValid).toBe(MATCHING_IS_VALID);

      // Verify matching size (5 vertices → 2 edges, 1 unmatched in triangle)
      const matchedCount = countMatchedVertices(matching);
      const expectedMatchedCount = PATH_4_VERTEX_COUNT;
      expect(matchedCount).toBe(expectedMatchedCount);
    });

    test('isolated vertex with connected component', () => {
      // Create graph: edge (a-b) and isolated vertex (c)
      const graph = createTestGraph();
      graph.addNode(VERTEX_A);
      graph.addNode(VERTEX_B);
      graph.addNode(VERTEX_C);

      graph.addEdge(VERTEX_A, VERTEX_B);

      // Run matching algorithm
      const matching = maximumMatching(graph);

      // Verify matching is valid
      const isValid = isMatchingValid(matching);
      expect(isValid).toBe(MATCHING_IS_VALID);

      // Verify a-b are matched, c is unmatched
      const mateOfA = matching.get(VERTEX_A);
      const mateOfB = matching.get(VERTEX_B);
      const mateOfC = matching.get(VERTEX_C);

      expect(mateOfA).toBe(VERTEX_B);
      expect(mateOfB).toBe(VERTEX_A);
      expect(mateOfC).toBeNull();

      // Verify matching size (3 vertices → 1 edge, 1 isolated)
      const matchedCount = countMatchedVertices(matching);
      const expectedMatchedCount = TWO_VERTEX_MATCHING_SIZE * 2;
      expect(matchedCount).toBe(expectedMatchedCount);
    });
  });

  describe('Additional Graph Shapes', () => {
    test('square (4-cycle) returns perfect matching', () => {
      // Create square: a—b—c—d—a (even cycle has perfect matching)
      const graph = createTestGraph();
      graph.addNode(VERTEX_A);
      graph.addNode(VERTEX_B);
      graph.addNode(VERTEX_C);
      graph.addNode(VERTEX_D);

      graph.addEdge(VERTEX_A, VERTEX_B);
      graph.addEdge(VERTEX_B, VERTEX_C);
      graph.addEdge(VERTEX_C, VERTEX_D);
      graph.addEdge(VERTEX_D, VERTEX_A);

      // Run matching algorithm
      const matching = maximumMatching(graph);

      // Verify matching is valid
      const isValid = isMatchingValid(matching);
      expect(isValid).toBe(MATCHING_IS_VALID);

      // Verify perfect matching (4 vertices → 2 edges)
      const matchedCount = countMatchedVertices(matching);
      const expectedMatchedCount = SQUARE_MATCHING_SIZE * 2;
      expect(matchedCount).toBe(expectedMatchedCount);
    });

    test('star graph (K_{1,5}) returns matching of size 1', () => {
      // Create star: center connected to 5 leaves
      // Only 1 edge can be in the matching (center can match with only 1 leaf)
      const allStarLeaves = [
        STAR_LEAF_1,
        STAR_LEAF_2,
        STAR_LEAF_3,
        STAR_LEAF_4,
        STAR_LEAF_5,
      ];
      const graph = createStarGraph(STAR_CENTER, allStarLeaves);

      // Run matching algorithm
      const matching = maximumMatching(graph);

      // Verify matching is valid
      const isValid = isMatchingValid(matching);
      expect(isValid).toBe(MATCHING_IS_VALID);

      // Verify matching size (1 edge → 2 vertices matched)
      const matchedCount = countMatchedVertices(matching);
      const expectedMatchedCount = STAR_GRAPH_MATCHING_SIZE * 2;
      expect(matchedCount).toBe(expectedMatchedCount);

      // Verify center is matched
      const centerMate = matching.get(STAR_CENTER);
      expect(centerMate).not.toBeNull();
    });

    test('Petersen graph returns perfect matching', () => {
      // Petersen graph: classic test case (10 vertices, 15 edges)
      const outerVertices = [
        PETERSEN_OUTER_0,
        PETERSEN_OUTER_1,
        PETERSEN_OUTER_2,
        PETERSEN_OUTER_3,
        PETERSEN_OUTER_4,
      ];
      const innerVertices = [
        PETERSEN_INNER_0,
        PETERSEN_INNER_1,
        PETERSEN_INNER_2,
        PETERSEN_INNER_3,
        PETERSEN_INNER_4,
      ];
      const graph = createPetersenGraph(outerVertices, innerVertices);

      // Run matching algorithm
      const matching = maximumMatching(graph);

      // Verify matching is valid
      const isValid = isMatchingValid(matching);
      expect(isValid).toBe(MATCHING_IS_VALID);

      // Verify perfect matching
      const matchedCount = countMatchedVertices(matching);
      const expectedMatchedCount = PETERSEN_VERTEX_COUNT;
      expect(matchedCount).toBe(expectedMatchedCount);
    });

    test('Seed 54 problematic graph (6 nodes, 12 edges) returns perfect matching', () => {
      // Graph structure from Swiss tournament seed 54 that caused infinite loop
      // This is NOT a complete graph K6 (which would have 15 edges)
      // Structure: 6 nodes with specific missing edges (A-E, B-F, C-F)
      const graph = createTestGraph();

      // Add vertices (using simplified names for clarity)
      const VERTEX_P_A: VertexKey = 'pA';
      const VERTEX_P_B: VertexKey = 'pB';
      const VERTEX_P_C: VertexKey = 'pC';
      const VERTEX_P_D: VertexKey = 'pD';
      const VERTEX_P_E: VertexKey = 'pE';
      const VERTEX_P_F: VertexKey = 'pF';

      graph.addNode(VERTEX_P_A);
      graph.addNode(VERTEX_P_B);
      graph.addNode(VERTEX_P_C);
      graph.addNode(VERTEX_P_D);
      graph.addNode(VERTEX_P_E);
      graph.addNode(VERTEX_P_F);

      // Add edges (12 edges - missing A-E, B-F, C-F from K6)
      // A's edges: A-B, A-C, A-D, A-F
      graph.addEdge(VERTEX_P_A, VERTEX_P_B);
      graph.addEdge(VERTEX_P_A, VERTEX_P_C);
      graph.addEdge(VERTEX_P_A, VERTEX_P_D);
      graph.addEdge(VERTEX_P_A, VERTEX_P_F);

      // B's remaining edges: B-C, B-D, B-E
      graph.addEdge(VERTEX_P_B, VERTEX_P_C);
      graph.addEdge(VERTEX_P_B, VERTEX_P_D);
      graph.addEdge(VERTEX_P_B, VERTEX_P_E);

      // C's remaining edges: C-D, C-E
      graph.addEdge(VERTEX_P_C, VERTEX_P_D);
      graph.addEdge(VERTEX_P_C, VERTEX_P_E);

      // D's remaining edges: D-E, D-F
      graph.addEdge(VERTEX_P_D, VERTEX_P_E);
      graph.addEdge(VERTEX_P_D, VERTEX_P_F);

      // E's remaining edges: E-F
      graph.addEdge(VERTEX_P_E, VERTEX_P_F);

      // Run matching algorithm
      const matching = maximumMatching(graph);

      // Verify matching is valid
      const isValid = isMatchingValid(matching);
      expect(isValid).toBe(MATCHING_IS_VALID);

      // Verify perfect matching (6 nodes → 3 edges → 6 matched vertices)
      const matchedCount = countMatchedVertices(matching);
      const expectedMatchedCount = 6;
      expect(matchedCount).toBe(expectedMatchedCount);
    });
  });
});
