/**
 * Graph connectivity analysis for tournament trace.
 *
 * Provides BFS-based connected component discovery.
 */

import { VertexKey } from '@/lib/client-actions/swiss-generator/matching/types';
import { EdgePair } from '@/lib/client-actions/swiss-generator/scripts/trace-types';

// ============================================================================
// Types
// ============================================================================

/** Adjacency list: maps each vertex to its neighbours */
type AdjacencyList = Map<VertexKey, Set<VertexKey>>;

// ============================================================================
// Constants
// ============================================================================

/** Empty neighbour set for defensive fallback */
const EMPTY_NEIGHBOUR_SET: ReadonlySet<VertexKey> = new Set();

// ============================================================================
// Adjacency List Construction
// ============================================================================

/**
 * Collects all unique vertices from edge list.
 *
 * Avoids needing a separate vertex list parameter, which could become
 * inconsistent with the edges.
 *
 * @param edges - Array of [source, target] vertex pairs
 * @returns Set of all vertex keys appearing in edges
 */
function collectVertices(edges: EdgePair[]): Set<VertexKey> {
  const vertices = new Set<VertexKey>();

  for (const [source, target] of edges) {
    vertices.add(source);
    vertices.add(target);
  }

  return vertices;
}

/**
 * Builds adjacency list from edges.
 *
 * Creates bidirectional entries for undirected graph.
 * Initialises all vertices to empty neighbour sets before adding edges.
 *
 * @param edges - Array of [source, target] vertex pairs
 * @param vertices - Set of all vertex keys
 * @returns Adjacency list mapping each vertex to its neighbours
 */
function buildAdjacencyList(
  edges: EdgePair[],
  vertices: Set<VertexKey>,
): AdjacencyList {
  // Initialise all vertices with empty neighbour sets
  const adjacency: AdjacencyList = new Map();
  for (const vertex of vertices) {
    adjacency.set(vertex, new Set());
  }

  // Add bidirectional edges
  // After initialisation, all keys exist - use get() with explicit check
  for (const [source, target] of edges) {
    const sourceNeighbours = adjacency.get(source);
    const targetNeighbours = adjacency.get(target);

    if (sourceNeighbours === undefined || targetNeighbours === undefined) {
      throw new Error(
        'Vertex missing from adjacency list after initialisation',
      );
    }

    sourceNeighbours.add(target);
    targetNeighbours.add(source);
  }

  return adjacency;
}

// ============================================================================
// BFS Component Search
// ============================================================================

/**
 * Performs BFS from a start vertex, collecting all reachable vertices.
 *
 * Uses a queue for level-order traversal. Marks vertices as visited
 * when dequeued (not when enqueued) to handle already-queued duplicates.
 *
 * @param startVertex - Vertex to start BFS from
 * @param adjacency - Adjacency list of the graph
 * @param visited - Set of visited vertices (modified in place)
 * @returns Array of vertices in this component
 */
function bfsComponent(
  startVertex: VertexKey,
  adjacency: AdjacencyList,
  visited: Set<VertexKey>,
): VertexKey[] {
  const component: VertexKey[] = [];
  const queue: VertexKey[] = [startVertex];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) {
      throw new Error('Queue unexpectedly empty');
    }

    // Skip if already visited (handles duplicates in queue)
    if (visited.has(current)) {
      // Vertex was already processed via another path
    } else {
      visited.add(current);
      component.push(current);

      // Enqueue unvisited neighbours
      // Use constant for missing keys (defensive, shouldn't happen)
      const neighbours = adjacency.get(current) ?? EMPTY_NEIGHBOUR_SET;
      for (const neighbour of neighbours) {
        if (!visited.has(neighbour)) {
          queue.push(neighbour);
        }
      }
    }
  }

  return component;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Finds connected components in an undirected graph using BFS.
 *
 * Extracts vertices from edge list to ensure consistency.
 * Each component is discovered via BFS starting from an unvisited vertex.
 * Visited set is shared across all BFS calls to avoid revisiting.
 *
 * @param edges - Array of [source, target] vertex pairs
 * @returns Array of components, each an array of vertex keys
 */
export function findConnectedComponents(edges: EdgePair[]): VertexKey[][] {
  // Extract vertices from edges - no separate vertex list needed
  const vertices = collectVertices(edges);
  const adjacency = buildAdjacencyList(edges, vertices);

  // Shared visited set prevents revisiting across components
  const visited = new Set<VertexKey>();
  const components: VertexKey[][] = [];

  for (const startVertex of vertices) {
    if (!visited.has(startVertex)) {
      const component = bfsComponent(startVertex, adjacency, visited);
      components.push(component);
    }
  }

  return components;
}
