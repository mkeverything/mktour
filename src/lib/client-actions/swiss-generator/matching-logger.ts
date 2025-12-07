/**
 * Logger for Edmonds' Blossom Matching Algorithm
 *
 * Usage: Enable via environment variable
 *   DEBUG=matching bun test matching.test.ts
 *
 * Or set LOG_LEVEL=debug for all logs
 */

import { ConsoleTransport, LogLayer } from 'loglayer';

// ============================================================================
// Constants
// ============================================================================

/** Logger prefix for matching algorithm logs */
const LOGGER_PREFIX = '[MATCHING]';

/** Environment variable keyword for enabling matching logs */
const DEBUG_KEYWORD = 'matching';

/** Log level for debug output */
const LOG_LEVEL_DEBUG = 'debug';

/** Log level for info output (default) */
const LOG_LEVEL_INFO = 'info';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determines log level based on environment variables
 *
 * Returns debug level if either:
 * - DEBUG environment variable contains 'matching' keyword
 * - LOG_LEVEL environment variable is set to 'debug'
 *
 * Otherwise returns info level (effectively disabling debug logs)
 *
 * @returns Log level string for loglayer configuration
 */
function determineLogLevel(): string {
  const debugEnvContainsKeyword = process.env.DEBUG?.includes(DEBUG_KEYWORD);
  const logLevelIsDebug = process.env.LOG_LEVEL === LOG_LEVEL_DEBUG;

  const shouldEnableDebug = debugEnvContainsKeyword || logLevelIsDebug;

  const logLevel = shouldEnableDebug ? LOG_LEVEL_DEBUG : LOG_LEVEL_INFO;

  return logLevel;
}

// ============================================================================
// Logger Configuration
// ============================================================================

/** Console transport for matching algorithm logger */
const consoleTransport = new ConsoleTransport({
  logger: console,
});

/** Configuration for matching algorithm logger */
const loggerConfig = {
  transport: consoleTransport,
  logger: {
    prefix: LOGGER_PREFIX,
  },
  logLevel: determineLogLevel(),
};

// ============================================================================
// Logger Instance
// ============================================================================

/**
 * Logger instance for matching algorithm debugging
 *
 * Controlled via environment variables:
 * - DEBUG=matching (enable matching logs specifically)
 * - LOG_LEVEL=debug (enable all debug logs)
 */
export const matchingLogger = new LogLayer(loggerConfig);

/**
 * Whether debug logging is currently enabled for matching algorithm
 *
 * Use this to conditionally create debug-only variables to avoid overhead
 * when logging is disabled
 */
export const IS_MATCHING_DEBUG_ENABLED =
  loggerConfig.logLevel === LOG_LEVEL_DEBUG;

// ============================================================================
// Debug Logging Interfaces
// ============================================================================

/**
 * Graph statistics for logging algorithm entry
 */
export interface GraphStatistics {
  /** Number of vertices in graph */
  readonly vertexCount: number;

  /** Number of edges in graph */
  readonly edgeCount: number;
}

/**
 * Main loop iteration information for logging
 */
export interface IterationInfo {
  /** Current iteration number (1-indexed) */
  readonly iterationNumber: number;
}

/**
 * Main loop completion information for logging
 */
export interface IterationCompletionInfo {
  /** Current iteration number (1-indexed) */
  readonly iterationNumber: number;

  /** Whether an augmenting path was found in this iteration */
  readonly foundAugmentingPath: boolean;
}

/**
 * Final matching result information for logging
 */
export interface MatchingResultInfo {
  /** Total number of iterations performed */
  readonly iterationNumber: number;

  /** Number of matched vertices in final matching */
  readonly matchedVertexCount: number;
}

/**
 * BFS search start information for logging
 */
export interface BFSSearchStartInfo {
  /** Initial queue size at start of BFS */
  readonly queueSize: number;
}

/**
 * Queue processing information for logging
 */
export interface QueueProcessingInfo {
  /** Current vertex being processed */
  readonly currentVertex: string;

  /** Remaining queue size after dequeue */
  readonly remainingQueueSize: number;
}

/**
 * Edge found information for logging
 */
export interface EdgeFoundInfo {
  /** First vertex of edge */
  readonly vertexU: string;

  /** Second vertex of edge */
  readonly vertexV: string;
}

/**
 * Blossom creation information for logging
 */
export interface BlossomCreationInfo {
  /** First vertex of blossom edge */
  readonly vertexU: string;

  /** Second vertex of blossom edge */
  readonly vertexV: string;

  /** Base of first vertex */
  readonly baseU: string;

  /** Base of second vertex */
  readonly baseV: string;
}

/**
 * Augmenting path found information for logging
 */
export interface AugmentingPathInfo {
  /** First vertex of augmenting path */
  readonly vertexU: string;

  /** Second vertex of augmenting path */
  readonly vertexV: string;

  /** Base of first vertex */
  readonly baseU: string;

  /** Base of second vertex */
  readonly baseV: string;
}

/**
 * Augment matching start information for logging
 */
export interface AugmentMatchingStartInfo {
  /** First endpoint */
  readonly vertexU: string;

  /** Second endpoint */
  readonly vertexV: string;
}

/**
 * Augment from vertex start information for logging
 */
export interface AugmentFromVertexStartInfo {
  /** Vertex to augment from */
  readonly startVertex: string;
}

/**
 * Augment from vertex step information for logging
 */
export interface AugmentFromVertexStepInfo {
  /** Current vertex in traversal */
  readonly currentVertex: string;

  /** Base vertex found */
  readonly baseVertex: string;

  /** Whether this is root */
  readonly isRoot: boolean;

  /** Label of base vertex (S, T, or UNLABELLED) */
  readonly label: string;

  /** Label end pointer of base vertex */
  readonly labelEnd: string | null;

  /** Mate of base vertex */
  readonly mate: string | null;
}
