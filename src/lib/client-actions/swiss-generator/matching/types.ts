/**
 * Types, interfaces, enums and constants for Edmonds' Blossom Algorithm
 *
 * These definitions are used throughout the matching algorithm implementation.
 */

// ============================================================================
// Public API Types
// ============================================================================

/** Vertex key from graphology Graph */
export type VertexKey = string;

/** Mate in matching: vertex key or null if unmatched */
export type Mate = VertexKey | null;

/** Matching result mapping each vertex to its mate (or null) */
export type MatchingResult = Map<VertexKey, Mate>;

// ============================================================================
// Internal Algorithm Types
// ============================================================================

/** Identifier for a blossom (unique numeric ID) */
export type BlossomId = number;

/** Identifier for either a vertex or blossom */
export type NodeId = VertexKey | BlossomId;

/** Parent blossom: blossom ID or null if top-level */
export type ParentBlossom = BlossomId | null;

/** Label endpoint: vertex key or null if not labelled */
export type LabelEndpoint = VertexKey | null;

/** Set of adjacent vertex keys */
export type NeighbourSet = Set<VertexKey>;

/** Children of a blossom (can be vertices or sub-blossoms) */
export type BlossomChildren = NodeId[];

/** Result of scanning and labelling a vertex's neighbours */
export type ScanAndLabelResult = [VertexKey, VertexKey] | null;

// ============================================================================
// Enums
// ============================================================================

/**
 * Label assigned to vertices during augmenting path search
 */
export enum Label {
  /** Vertex is not in any alternating tree */
  NONE = 'NONE',

  /** Vertex is S-labelled: root or odd distance from root in alternating tree */
  S = 'S',

  /** Vertex is T-labelled: even distance from root in alternating tree */
  T = 'T',
}

// ============================================================================
// Interfaces
// ============================================================================

/**
 * State information for a single vertex
 */
export interface VertexState {
  /** Vertex key from graph */
  readonly key: VertexKey;

  /** Current mate (partner in matching), or null if unmatched */
  mate: Mate;

  /** Label for augmenting path search */
  label: Label;

  /** Endpoint of edge that gave this vertex its label, or null if unlabelled */
  labelEnd: LabelEndpoint;

  /** ID of blossom containing this vertex */
  inBlossom: BlossomId;
}

/**
 * State information for a blossom
 */
export interface BlossomState {
  /** Unique identifier for this blossom */
  readonly id: BlossomId;

  /** Parent blossom in hierarchy, or null if top-level */
  parent: ParentBlossom;

  /** Children (vertices or sub-blossoms) forming the blossom */
  children: BlossomChildren;

  /** Base vertex where blossom connects to alternating tree */
  base: VertexKey;

  /** Edge endpoints where this blossom was created */
  endpoints: [VertexKey, VertexKey];
}

/**
 * Overall state of the matching algorithm
 */
export interface MatchingState {
  /** State for each vertex in the graph, keyed by vertex key */
  vertices: Map<VertexKey, VertexState>;

  /** State for each blossom, keyed by blossom ID */
  blossoms: Map<BlossomId, BlossomState>;

  /** Queue of S-labelled vertices to process */
  queue: VertexKey[];

  /** Adjacency list representation of graph */
  adjacencyList: Map<VertexKey, NeighbourSet>;

  /** Total number of vertices in original graph */
  readonly nodeCount: number;

  /** Next available blossom ID */
  nextBlossomId: BlossomId;
}

/**
 * Result of finding lowest common ancestor in alternating tree
 */
export interface LowestCommonAncestorResult {
  /** The LCA blossom ID where paths converge */
  lcaBlossomId: BlossomId;

  /** Path of blossom IDs from first vertex to LCA (excluding LCA) */
  pathFromU: BlossomId[];

  /** Path of blossom IDs from second vertex to LCA (excluding LCA) */
  pathFromV: BlossomId[];
}

/**
 * Result of processing a single step in alternating tree traversal
 */
export interface TraversalStepResult {
  /** Current vertex being processed */
  currentVertex: VertexKey;

  /** Base vertex for this step */
  baseVertex: VertexKey;

  /** Base vertex state */
  baseState: VertexState;

  /** Whether this step reached the root */
  isRoot: boolean;
}

/**
 * Result of determining walk direction through blossom cycle
 */
export interface WalkDirection {
  /** Step size for each iteration: +1 for forward, -1 for backward */
  stepSize: number;

  /** Distance from entry to base in chosen direction */
  distance: number;
}

/**
 * Result of an augmenting step including next vertex to continue from
 */
export interface AugmentStepResult {
  /** Whether to continue augmenting */
  shouldContinue: boolean;

  /** Next vertex to continue from (null if shouldContinue is false) */
  nextVertex: VertexKey | null;
}

// ============================================================================
// Constants
// ============================================================================

/** Indicates top-level blossom with no parent */
export const NO_PARENT_BLOSSOM: ParentBlossom = null;

/** Indicates vertex is unmatched */
export const NO_MATE: Mate = null;

/** Indicates vertex has no label endpoint */
export const NO_LABEL_ENDPOINT: LabelEndpoint = null;

/** Sentinel value for scan result when no edge found */
export const NO_EDGE_FOUND: ScanAndLabelResult = null;

/** Sentinel for no next vertex in augmenting path */
export const NO_NEXT_VERTEX: VertexKey | null = null;

/** Sentinel for array index not found */
export const NOT_FOUND_IN_ARRAY = -1;

/** Step direction: forward through blossom cycle */
export const STEP_FORWARD = 1;

/** Step direction: backward through blossom cycle */
export const STEP_BACKWARD = -1;

/** Minimum number of children for a non-trivial blossom */
export const MIN_CHILDREN_FOR_NONTRIVIAL_BLOSSOM = 2;
