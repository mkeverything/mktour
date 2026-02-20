/**
 * Test fixtures for matching algorithms
 *
 * Contains:
 * - Vertex constants for test graphs
 * - Graph construction utilities (path, cycle, complete, star, Petersen)
 * - Matching validation helpers
 * - Weight computation utilities
 */

import Graph from 'graphology';

import type { MatchingResult, VertexKey } from './types';

// ============================================================================
// Internal Constants
// ============================================================================

/** Character code for lowercase 'a' - base for vertex naming */
const LOWERCASE_A_CHAR_CODE = 97;

/** First vertex index (for loops starting at 0) */
const FIRST_VERTEX_INDEX = 0;

/** Pentagram stride - connect every 2nd vertex in inner ring */
const PETERSEN_PENTAGRAM_STRIDE = 2;

// ============================================================================
// Common Test Vertex Constants
// ============================================================================

export const VERTEX_A: VertexKey = 'a';
export const VERTEX_B: VertexKey = 'b';
export const VERTEX_C: VertexKey = 'c';
export const VERTEX_D: VertexKey = 'd';
export const VERTEX_E: VertexKey = 'e';
export const VERTEX_F: VertexKey = 'f';
export const VERTEX_G: VertexKey = 'g';

// Star graph vertices
export const STAR_CENTER: VertexKey = 'center';
export const STAR_LEAF_1: VertexKey = 'leaf1';
export const STAR_LEAF_2: VertexKey = 'leaf2';
export const STAR_LEAF_3: VertexKey = 'leaf3';
export const STAR_LEAF_4: VertexKey = 'leaf4';
export const STAR_LEAF_5: VertexKey = 'leaf5';

// Petersen graph outer pentagon vertices
export const PETERSEN_OUTER_0: VertexKey = 'outer0';
export const PETERSEN_OUTER_1: VertexKey = 'outer1';
export const PETERSEN_OUTER_2: VertexKey = 'outer2';
export const PETERSEN_OUTER_3: VertexKey = 'outer3';
export const PETERSEN_OUTER_4: VertexKey = 'outer4';

// Petersen graph inner pentagram vertices
export const PETERSEN_INNER_0: VertexKey = 'inner0';
export const PETERSEN_INNER_1: VertexKey = 'inner1';
export const PETERSEN_INNER_2: VertexKey = 'inner2';
export const PETERSEN_INNER_3: VertexKey = 'inner3';
export const PETERSEN_INNER_4: VertexKey = 'inner4';

// ============================================================================
// Types
// ============================================================================

/**
 * Edge configuration for unweighted graphs
 */
export interface EdgeConfig {
  readonly source: VertexKey;
  readonly target: VertexKey;
}

/**
 * Edge attributes for weighted graphs
 */
export interface WeightedEdgeAttributes {
  readonly weight: bigint;
}

/**
 * Edge configuration for weighted graphs
 */
export interface WeightedEdgeConfig extends EdgeConfig {
  readonly weight: bigint;
}

// ============================================================================
// Graph Construction
// ============================================================================

/**
 * Creates an undirected graph for testing
 */
export function createTestGraph(): Graph {
  return new Graph({ type: 'undirected' });
}

/**
 * Adds vertices to a graph
 */
export function addVertices(graph: Graph, vertices: VertexKey[]): void {
  for (const vertex of vertices) {
    graph.addNode(vertex);
  }
}

/**
 * Adds unweighted edges to a graph
 */
export function addEdges(graph: Graph, edges: EdgeConfig[]): void {
  for (const edge of edges) {
    graph.addEdge(edge.source, edge.target);
  }
}

/**
 * Adds weighted edges to a graph
 */
export function addWeightedEdges(
  graph: Graph,
  edges: WeightedEdgeConfig[],
): void {
  for (const edge of edges) {
    const attributes: WeightedEdgeAttributes = { weight: edge.weight };
    graph.addEdge(edge.source, edge.target, attributes);
  }
}

/**
 * Builds an unweighted graph from vertices and edges
 */
export function buildGraph(vertices: VertexKey[], edges: EdgeConfig[]): Graph {
  const graph = createTestGraph();
  addVertices(graph, vertices);
  addEdges(graph, edges);
  return graph;
}

/**
 * Builds a weighted graph from vertices and weighted edges
 */
export function buildWeightedGraph(
  vertices: VertexKey[],
  edges: WeightedEdgeConfig[],
): Graph {
  const graph = createTestGraph();
  addVertices(graph, vertices);
  addWeightedEdges(graph, edges);
  return graph;
}

// ============================================================================
// Vertex Name Generation
// ============================================================================

/**
 * Generates sequential vertex names starting from 'a'
 *
 * Creates vertex keys as lowercase letters: 'a', 'b', 'c', etc.
 *
 * @param vertexCount - Number of vertices to generate names for
 * @returns Array of vertex keys ['a', 'b', 'c', ...]
 */
export function generateVertexNames(vertexCount: number): VertexKey[] {
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

// ============================================================================
// Graph Configuration Types
// ============================================================================

/**
 * Configuration for path graph construction
 */
export interface PathConfig {
  /** Number of vertices in the path */
  readonly vertexCount: number;
  /** Array of edge configurations forming the path */
  readonly edges: EdgeConfig[];
}

/**
 * Configuration for cycle graph construction
 */
export interface CycleConfig {
  /** Number of vertices in the cycle */
  readonly vertexCount: number;
  /** Array of edge configurations forming the cycle */
  readonly edges: EdgeConfig[];
}

/**
 * Configuration for complete graph construction
 */
export interface CompleteGraphConfig {
  /** Number of vertices in the complete graph */
  readonly vertexCount: number;
  /** Array of edge configurations connecting all vertex pairs */
  readonly edges: EdgeConfig[];
}

// ============================================================================
// Graph Configuration Builders
// ============================================================================

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
export function createPathConfig(vertexCount: number): PathConfig {
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
export function createCycleConfig(vertexCount: number): CycleConfig {
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
export function createCompleteGraphConfig(
  vertexCount: number,
): CompleteGraphConfig {
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
export function buildGraphFromConfig(
  vertices: VertexKey[],
  edges: EdgeConfig[],
): Graph {
  const graph = createTestGraph();
  addVertices(graph, vertices);
  addEdges(graph, edges);
  return graph;
}

// ============================================================================
// Special Graph Builders
// ============================================================================

/**
 * Creates a star graph (one center connected to multiple leaves)
 *
 * @param centerVertex - Center vertex key
 * @param leafVertices - Array of leaf vertex keys
 * @returns Star graph
 */
export function createStarGraph(
  centerVertex: VertexKey,
  leafVertices: VertexKey[],
): Graph {
  const graph = createTestGraph();

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
export function createPetersenGraph(
  outerVertices: VertexKey[],
  innerVertices: VertexKey[],
): Graph {
  const graph = createTestGraph();
  const pentagonSize = outerVertices.length;

  // Add all vertices
  for (const vertex of [...outerVertices, ...innerVertices]) {
    graph.addNode(vertex);
  }

  // Outer pentagon edges
  for (
    let vertexIndex = FIRST_VERTEX_INDEX;
    vertexIndex < pentagonSize;
    vertexIndex++
  ) {
    const currentVertex = outerVertices[vertexIndex];
    const nextVertexIndex = (vertexIndex + 1) % pentagonSize;
    const nextVertex = outerVertices[nextVertexIndex];
    graph.addEdge(currentVertex, nextVertex);
  }

  // Inner pentagram edges (connect every 2nd vertex)
  for (
    let vertexIndex = FIRST_VERTEX_INDEX;
    vertexIndex < pentagonSize;
    vertexIndex++
  ) {
    const currentVertex = innerVertices[vertexIndex];
    const strideVertexIndex =
      (vertexIndex + PETERSEN_PENTAGRAM_STRIDE) % pentagonSize;
    const strideVertex = innerVertices[strideVertexIndex];
    graph.addEdge(currentVertex, strideVertex);
  }

  // Spokes from outer to inner
  for (
    let vertexIndex = FIRST_VERTEX_INDEX;
    vertexIndex < pentagonSize;
    vertexIndex++
  ) {
    const outerVertex = outerVertices[vertexIndex];
    const innerVertex = innerVertices[vertexIndex];
    graph.addEdge(outerVertex, innerVertex);
  }

  return graph;
}

// ============================================================================
// Matching Validation
// ============================================================================

/**
 * Validates that a matching is symmetric and unique
 *
 * Symmetric: if a→b then b→a
 * Unique: each vertex appears at most once as a mate
 */
export function isMatchingValid(matching: MatchingResult): boolean {
  const mates = new Set<VertexKey>();

  for (const [vertex, mate] of matching) {
    if (mate === null) {
      continue;
    }

    // Check symmetry
    const matesMate = matching.get(mate);
    if (matesMate !== vertex) {
      return false;
    }

    // Check uniqueness
    if (mates.has(mate)) {
      return false;
    }
    mates.add(mate);
  }

  return true;
}

/**
 * Counts matched vertices in a matching
 */
export function countMatchedVertices(matching: MatchingResult): number {
  let count = 0;
  for (const [, mate] of matching) {
    if (mate !== null) {
      count++;
    }
  }
  return count;
}

// ============================================================================
// Weight Computation
// ============================================================================

/**
 * Creates a canonical edge identifier for deduplication
 *
 * Ensures same ID regardless of vertex order (a-b === b-a)
 */
function createEdgeId(vertex1: VertexKey, vertex2: VertexKey): string {
  return vertex1 < vertex2 ? `${vertex1}-${vertex2}` : `${vertex2}-${vertex1}`;
}

/**
 * Computes total weight of edges in a matching
 *
 * @param graph - Weighted graph
 * @param matching - Matching result
 * @returns Sum of matched edge weights
 */
export function computeMatchingWeight(
  graph: Graph,
  matching: MatchingResult,
): bigint {
  let totalWeight = 0n;
  const processedEdges = new Set<string>();

  for (const [vertex, mate] of matching) {
    if (mate === null) {
      continue;
    }

    const edgeId = createEdgeId(vertex, mate);
    if (processedEdges.has(edgeId)) {
      continue;
    }
    processedEdges.add(edgeId);

    const edgeKey = graph.edge(vertex, mate);
    if (edgeKey !== undefined) {
      const attributes = graph.getEdgeAttributes(
        edgeKey,
      ) as WeightedEdgeAttributes;
      totalWeight += attributes.weight;
    }
  }

  return totalWeight;
}
