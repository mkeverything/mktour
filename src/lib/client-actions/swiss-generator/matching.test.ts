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
import Graph from 'graphology';

import type { MatchingResult, VertexKey } from './matching';
import { maximumMatching } from './matching';

// ============================================================================
// Test Constants
// ============================================================================

/** Character code for lowercase 'a' - base for vertex naming */
const LOWERCASE_A_CHAR_CODE = 97;

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

/** Number of vertices in Petersen graph */
const PETERSEN_VERTEX_COUNT = 10;

/** First vertex index (for loops starting at 0) */
const FIRST_VERTEX_INDEX = 0;

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

// Vertex name constants for basic test cases
const VERTEX_A: VertexKey = 'a';
const VERTEX_B: VertexKey = 'b';
const VERTEX_C: VertexKey = 'c';
const VERTEX_D: VertexKey = 'd';
const VERTEX_E: VertexKey = 'e';

// Star graph constants
const STAR_GRAPH_MATCHING_SIZE = 1;
const STAR_CENTER: VertexKey = 'center';
const STAR_LEAF_1: VertexKey = 'leaf1';
const STAR_LEAF_2: VertexKey = 'leaf2';
const STAR_LEAF_3: VertexKey = 'leaf3';
const STAR_LEAF_4: VertexKey = 'leaf4';
const STAR_LEAF_5: VertexKey = 'leaf5';

// Petersen graph vertex constants
// Outer pentagon vertices
const PETERSEN_OUTER_0: VertexKey = 'outer0';
const PETERSEN_OUTER_1: VertexKey = 'outer1';
const PETERSEN_OUTER_2: VertexKey = 'outer2';
const PETERSEN_OUTER_3: VertexKey = 'outer3';
const PETERSEN_OUTER_4: VertexKey = 'outer4';

// Inner pentagram vertices
const PETERSEN_INNER_0: VertexKey = 'inner0';
const PETERSEN_INNER_1: VertexKey = 'inner1';
const PETERSEN_INNER_2: VertexKey = 'inner2';
const PETERSEN_INNER_3: VertexKey = 'inner3';
const PETERSEN_INNER_4: VertexKey = 'inner4';

// Petersen graph structure constants
const PETERSEN_PENTAGON_SIZE = 5;
const PETERSEN_PENTAGRAM_STRIDE = 2; // Connect every 2nd vertex in pentagram

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates an undirected graph for testing
 *
 * Uses graphology library to create an empty undirected graph instance.
 * Vertices and edges should be added separately using the returned graph.
 *
 * @returns Empty undirected graph
 */
function createGraph(): Graph {
  const graph = new Graph({ type: 'undirected' });
  return graph;
}

/**
 * Generates sequential vertex names starting from 'a'
 *
 * Creates vertex keys as lowercase letters: 'a', 'b', 'c', etc.
 * Used for consistent vertex naming across tests.
 *
 * Algorithm:
 * 1. Create array of specified length
 * 2. For each index, calculate character code (97 + index)
 * 3. Convert character code to letter
 *
 * @param vertexCount - Number of vertices to generate names for
 * @returns Array of vertex keys ['a', 'b', 'c', ...]
 */
function generateVertexNames(vertexCount: number): VertexKey[] {
  // Create placeholder array of correct length
  const placeholderArray = new Array(vertexCount);
  const indicesArray = Array.from(placeholderArray, (_, index) => index);

  // Convert each index to corresponding letter
  const vertexNames = indicesArray.map((index) => {
    const charCode = LOWERCASE_A_CHAR_CODE + index;
    const letter = String.fromCharCode(charCode);
    return letter;
  });

  return vertexNames;
}

/**
 * Adds vertices to a graph
 *
 * Takes a graph and array of vertex keys, adds each vertex to the graph.
 * Vertices are added without attributes (nodes only, no edges yet).
 *
 * @param graph - Graph to add vertices to (modified in place)
 * @param vertices - Array of vertex keys to add
 */
function addVerticesToGraph(graph: Graph, vertices: VertexKey[]): void {
  // Add each vertex to the graph
  for (const vertex of vertices) {
    graph.addNode(vertex);
  }
}

/**
 * Represents an edge configuration for graph construction
 */
interface EdgeConfig {
  /** Source vertex of edge */
  readonly source: VertexKey;
  /** Target vertex of edge */
  readonly target: VertexKey;
}

/**
 * Adds edges to a graph from configuration
 *
 * Takes a graph and array of edge configurations, adds each edge to the graph.
 * Assumes vertices already exist in graph.
 *
 * @param graph - Graph to add edges to (modified in place)
 * @param edges - Array of edge configurations specifying source and target
 */
function addEdgesToGraph(graph: Graph, edges: EdgeConfig[]): void {
  // Add each edge to the graph
  for (const edge of edges) {
    graph.addEdge(edge.source, edge.target);
  }
}

/**
 * Configuration for path graph construction
 */
interface PathConfig {
  /** Number of vertices in the path */
  readonly vertexCount: number;
  /** Array of edge configurations forming the path */
  readonly edges: EdgeConfig[];
}

/**
 * Creates configuration for a path graph
 *
 * A path graph is a sequence of vertices connected linearly:
 * a—b—c—d (for vertexCount=4)
 *
 * Edge pattern: connect each vertex to the next one
 * (vertex[i], vertex[i+1]) for i = 0 to vertexCount-2
 *
 * @param vertexCount - Number of vertices in path
 * @returns Path configuration with vertex count and edge list
 */
function createPathConfig(vertexCount: number): PathConfig {
  // Generate vertex names first
  const vertices = generateVertexNames(vertexCount);

  // Build edges connecting consecutive vertices
  const edges: EdgeConfig[] = [];

  // Loop through vertices, stopping before the last one
  // (last vertex has no next vertex to connect to)
  const lastVertexIndex = vertexCount - 1;

  for (
    let currentIndex = FIRST_VERTEX_INDEX;
    currentIndex < lastVertexIndex;
    currentIndex++
  ) {
    // Get current and next vertex
    const sourceVertex = vertices[currentIndex];
    const nextIndex = currentIndex + 1;
    const targetVertex = vertices[nextIndex];

    // Create edge configuration
    const edgeConfig: EdgeConfig = {
      source: sourceVertex,
      target: targetVertex,
    };

    edges.push(edgeConfig);
  }

  // Return configuration object
  const pathConfig: PathConfig = {
    vertexCount,
    edges,
  };

  return pathConfig;
}

/**
 * Configuration for cycle graph construction
 */
interface CycleConfig {
  /** Number of vertices in the cycle */
  readonly vertexCount: number;
  /** Array of edge configurations forming the cycle */
  readonly edges: EdgeConfig[];
}

/**
 * Creates configuration for a cycle graph
 *
 * A cycle graph is a closed loop of vertices:
 * a—b—c—d—a (for vertexCount=4)
 *
 * Edge pattern: connect each vertex to the next one,
 * plus connect last vertex back to first vertex to close the cycle.
 *
 * @param vertexCount - Number of vertices in cycle
 * @returns Cycle configuration with vertex count and edge list
 */
function createCycleConfig(vertexCount: number): CycleConfig {
  // Generate vertex names first
  const vertices = generateVertexNames(vertexCount);

  // Build edges connecting consecutive vertices
  const edges: EdgeConfig[] = [];

  // Loop through all vertices to create cycle edges
  const lastVertexIndex = vertexCount - 1;

  for (
    let currentIndex = FIRST_VERTEX_INDEX;
    currentIndex < vertexCount;
    currentIndex++
  ) {
    // Get current vertex
    const sourceVertex = vertices[currentIndex];

    // Determine target vertex
    // - For all vertices except the last: connect to next vertex
    // - For last vertex: connect back to first vertex (close the cycle)
    const isLastVertex = currentIndex === lastVertexIndex;
    const targetIndex = isLastVertex ? FIRST_VERTEX_INDEX : currentIndex + 1;
    const targetVertex = vertices[targetIndex];

    // Create edge configuration
    const edgeConfig: EdgeConfig = {
      source: sourceVertex,
      target: targetVertex,
    };

    edges.push(edgeConfig);
  }

  // Return configuration object
  const cycleConfig: CycleConfig = {
    vertexCount,
    edges,
  };

  return cycleConfig;
}

/**
 * Configuration for complete graph construction
 */
interface CompleteGraphConfig {
  /** Number of vertices in the complete graph */
  readonly vertexCount: number;
  /** Array of edge configurations connecting all vertex pairs */
  readonly edges: EdgeConfig[];
}

/**
 * Creates configuration for a complete graph
 *
 * A complete graph has an edge between every pair of vertices.
 * For K4 (4 vertices): a—b, a—c, a—d, b—c, b—d, c—d (6 edges total)
 *
 * Edge count formula: n(n-1)/2 where n is vertex count
 *
 * @param vertexCount - Number of vertices in complete graph
 * @returns Complete graph configuration with vertex count and edge list
 */
function createCompleteGraphConfig(vertexCount: number): CompleteGraphConfig {
  // Generate vertex names first
  const vertices = generateVertexNames(vertexCount);

  // Build edges connecting all pairs of vertices
  const edges: EdgeConfig[] = [];

  // Outer loop: iterate through each vertex as potential source
  for (
    let sourceIndex = FIRST_VERTEX_INDEX;
    sourceIndex < vertexCount;
    sourceIndex++
  ) {
    const sourceVertex = vertices[sourceIndex];

    // Inner loop: connect to all vertices that come after source
    // (to avoid duplicate edges since graph is undirected)
    const firstTargetIndex = sourceIndex + 1;

    for (
      let targetIndex = firstTargetIndex;
      targetIndex < vertexCount;
      targetIndex++
    ) {
      const targetVertex = vertices[targetIndex];

      // Create edge configuration
      const edgeConfig: EdgeConfig = {
        source: sourceVertex,
        target: targetVertex,
      };

      edges.push(edgeConfig);
    }
  }

  // Return configuration object
  const completeGraphConfig: CompleteGraphConfig = {
    vertexCount,
    edges,
  };

  return completeGraphConfig;
}

/**
 * Builds a graph from vertex list and edge configurations
 *
 * Creates a graph, adds all vertices, then adds all edges.
 * Convenience function combining graph creation with population.
 *
 * @param vertices - Array of vertex keys to add
 * @param edges - Array of edge configurations to add
 * @returns Populated graph ready for matching
 */
function buildGraphFromConfig(
  vertices: VertexKey[],
  edges: EdgeConfig[],
): Graph {
  const graph = createGraph();
  addVerticesToGraph(graph, vertices);
  addEdgesToGraph(graph, edges);
  return graph;
}

/**
 * Creates a star graph (one center connected to multiple leaves)
 *
 * @param centerVertex - Center vertex key
 * @param leafVertices - Array of leaf vertex keys
 * @returns Star graph
 */
function createStarGraph(
  centerVertex: VertexKey,
  leafVertices: VertexKey[],
): Graph {
  const graph = createGraph();

  graph.addNode(centerVertex);
  for (const leaf of leafVertices) {
    graph.addNode(leaf);
    graph.addEdge(centerVertex, leaf);
  }

  return graph;
}

/**
 * Creates the Petersen graph
 *
 * Classic graph theory test case with 10 vertices and 15 edges.
 * Structure:
 * - Outer pentagon (5 vertices in a cycle)
 * - Inner pentagram (5 vertices, each connected to vertices 2 steps away)
 * - Spokes connecting outer to inner vertices
 *
 * @param outerVertices - Array of 5 outer pentagon vertices
 * @param innerVertices - Array of 5 inner pentagram vertices
 * @returns Petersen graph
 */
function createPetersenGraph(
  outerVertices: VertexKey[],
  innerVertices: VertexKey[],
): Graph {
  const graph = createGraph();

  // Add all vertices
  for (const vertex of [...outerVertices, ...innerVertices]) {
    graph.addNode(vertex);
  }

  // Outer pentagon edges
  for (
    let vertexIndex = FIRST_VERTEX_INDEX;
    vertexIndex < PETERSEN_PENTAGON_SIZE;
    vertexIndex++
  ) {
    const currentVertex = outerVertices[vertexIndex];
    const nextVertexIndex = (vertexIndex + 1) % PETERSEN_PENTAGON_SIZE;
    const nextVertex = outerVertices[nextVertexIndex];
    graph.addEdge(currentVertex, nextVertex);
  }

  // Inner pentagram edges (connect every 2nd vertex)
  for (
    let vertexIndex = FIRST_VERTEX_INDEX;
    vertexIndex < PETERSEN_PENTAGON_SIZE;
    vertexIndex++
  ) {
    const currentVertex = innerVertices[vertexIndex];
    const strideVertexIndex =
      (vertexIndex + PETERSEN_PENTAGRAM_STRIDE) % PETERSEN_PENTAGON_SIZE;
    const strideVertex = innerVertices[strideVertexIndex];
    graph.addEdge(currentVertex, strideVertex);
  }

  // Spokes from outer to inner
  for (
    let vertexIndex = FIRST_VERTEX_INDEX;
    vertexIndex < PETERSEN_PENTAGON_SIZE;
    vertexIndex++
  ) {
    const outerVertex = outerVertices[vertexIndex];
    const innerVertex = innerVertices[vertexIndex];
    graph.addEdge(outerVertex, innerVertex);
  }

  return graph;
}

/**
 * Counts the number of matched vertices in a matching result
 *
 * A vertex is matched if its mate is not null.
 * Since each edge contributes 2 matched vertices,
 * matching size = matched vertex count / 2.
 *
 * @param matching - Matching result from algorithm
 * @returns Number of matched vertices (not number of edges)
 */
function countMatchedVertices(matching: MatchingResult): number {
  let matchedCount = 0;

  // Count vertices that have a mate
  for (const [, mate] of matching) {
    const isMatched = mate !== null;
    if (isMatched) {
      matchedCount++;
    }
  }

  return matchedCount;
}

/**
 * Verifies that a matching is valid
 *
 * Checks two properties:
 * 1. Symmetry: if vertex a is matched to vertex b, then b must be matched to a
 * 2. Uniqueness: each vertex appears at most once as a mate
 *
 * @param matching - Matching result to validate
 * @returns true if matching is valid, false otherwise
 */
function isMatchingValid(matching: MatchingResult): boolean {
  // Check symmetry for each matched pair
  for (const [vertex, mate] of matching) {
    if (mate !== null) {
      // Get mate's mate
      const matesMate = matching.get(mate);

      // Verify mate's mate is the original vertex
      const isSymmetric = matesMate === vertex;
      if (!isSymmetric) {
        return false;
      }
    }
  }

  // Check uniqueness: collect all mates and verify no duplicates
  const mateSet = new Set<VertexKey>();

  for (const [, mate] of matching) {
    if (mate !== null) {
      // Check if this mate already seen
      const isDuplicate = mateSet.has(mate);
      if (isDuplicate) {
        return false;
      }

      mateSet.add(mate);
    }
  }

  return true;
}

// ============================================================================
// Test Suites
// ============================================================================

describe('maximumMatching', () => {
  describe('Basic Cases', () => {
    test('empty graph returns empty matching', () => {
      // Create empty graph with no vertices
      const graph = createGraph();

      // Run matching algorithm
      const matching = maximumMatching(graph);

      // Verify matching is empty
      expect(matching.size).toBe(EMPTY_MATCHING_SIZE);
    });

    test('single vertex returns empty matching', () => {
      // Create graph with one vertex
      const graph = createGraph();
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
      const graph = createGraph();
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
      const graph = createGraph();
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
      const graph = createGraph();
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
      const graph = createGraph();
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
      const graph = createGraph();
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
      const graph = createGraph();
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
      const graph = createGraph();
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
  });
});
