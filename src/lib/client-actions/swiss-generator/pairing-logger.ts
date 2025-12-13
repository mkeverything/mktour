/**
 * Logger for Swiss System Pairing Algorithm
 *
 * Usage: Enable via environment variable
 *   DEBUG=pairing bun test swiss-generator.test.ts
 *
 * Or set LOG_LEVEL=debug for all logs
 */

import { ConsoleTransport, LogLayer } from 'loglayer';
import type { SerializedGraph } from 'graphology-types';

// ============================================================================
// Constants
// ============================================================================

/** Logger prefix for pairing algorithm logs */
const LOGGER_PREFIX = '[PAIRING]';

/** Environment variable keyword for enabling pairing logs */
const DEBUG_KEYWORD = 'pairing';

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
 * - DEBUG environment variable contains 'pairing' keyword
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

/** Console transport for pairing algorithm logger */
const consoleTransport = new ConsoleTransport({
  logger: console,
  messageField: 'msg',
  stringify: true,
});

/** Configuration for pairing algorithm logger */
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
 * Logger instance for pairing algorithm debugging
 *
 * Controlled via environment variables:
 * - DEBUG=pairing (enable pairing logs specifically)
 * - LOG_LEVEL=debug (enable all debug logs)
 */
export const pairingLogger = new LogLayer(loggerConfig);

/**
 * Whether debug logging is currently enabled for pairing algorithm
 *
 * Use this to conditionally create debug-only variables to avoid overhead
 * when logging is disabled
 */
export const IS_PAIRING_DEBUG_ENABLED =
  loggerConfig.logLevel === LOG_LEVEL_DEBUG;

// ============================================================================
// Debug Logging Interfaces
// ============================================================================

/**
 * Round start information for logging
 */
export interface RoundStartInfo {
  /** Current round number */
  readonly roundNumber: number;

  /** Total number of players in the round */
  readonly playerCount: number;

  /** Number of scoregroups to process */
  readonly scoregroupCount: number;
}

/**
 * Bracket processing information for logging
 */
export interface BracketProcessingInfo {
  /** Score of this scoregroup */
  readonly score: number;

  /** Number of residents (players from this scoregroup) */
  readonly residentCount: number;

  /** Number of moved down players from higher scoregroups */
  readonly mdpCount: number;

  /** Maximum pairs that can be formed */
  readonly maxPairs: number;

  /** Whether this is the lowest bracket */
  readonly isLowestBracket: boolean;

  /** Current target pairs being tried */
  readonly targetPairs: number;
}

/**
 * Bracket groups structure for logging
 */
export interface BracketGroupsInfo {
  /** Current target pairs being tried */
  readonly targetPairs: number;

  /** S1 (MDPs or upper half) pairing numbers */
  readonly S1: number[];

  /** S2 (residents for MDP-pairing or lower half) pairing numbers */
  readonly S2: number[];

  /** S1R pairing numbers (remainder upper half, heterogeneous brackets only) */
  S1R?: number[];

  /** S2R pairing numbers (remainder lower half, heterogeneous brackets only) */
  S2R?: number[];

  /** Limbo (excess MDPs, heterogeneous brackets only) pairing numbers */
  Limbo?: number[];
}

/**
 * Alteration attempt information for logging
 */
export interface AlterationAttemptInfo {
  /** Alteration number (1-indexed) */
  readonly alterationNumber: number;

  /** S1 player pairing numbers */
  readonly s1PairingNumbers: number[];

  /** S2 player pairing numbers */
  readonly s2PairingNumbers: number[];

  /** Whether this is a heterogeneous bracket */
  readonly isHeterogeneous: boolean;
}

/**
 * Criteria evaluation result for logging
 */
export interface CriteriaResultInfo {
  /** Alteration number (1-indexed) */
  readonly alterationNumber: number;

  /** C1: Unique opponents satisfied */
  readonly c1Passed: boolean;

  /** C2: Unique PAB satisfied */
  readonly c2Passed: boolean;

  /** C3: Colour preference separation satisfied */
  readonly c3Passed: boolean;

  /** C4: Pairing compatibility satisfied */
  readonly c4Passed: boolean;

  /** Overall pass/fail */
  readonly allPassed: boolean;
}

/**
 * Selected pairing information for logging
 */
export interface SelectedPairingInfo {
  /** Score of the bracket */
  readonly score: number;

  /** Number of pairs formed */
  readonly pairCount: number;

  /** Number of downfloaters */
  readonly downfloaterCount: number;

  /** Pairing numbers of downfloaters */
  readonly downfloaterPairingNumbers: number[];

  /** Total alterations tried before finding valid pairing */
  readonly alterationsTried: number;
}

/**
 * Round completion information for logging
 */
export interface RoundCompletionInfo {
  /** Round number */
  readonly roundNumber: number;

  /** Total games generated */
  readonly gamesGenerated: number;
}

/**
 * Pairing failure information for logging
 */
export interface PairingFailureInfo {
  /** Score of the failing bracket */
  readonly score: number;

  /** Total players in bracket */
  readonly totalPlayers: number;

  /** Alterations tried before failure */
  readonly alterationsTried: number;

  /** Last target pairs value tried */
  readonly lastTargetPairs: number;
}

/**
 * Perfect quality check result for logging
 */
export interface PerfectQualityCheckInfo {
  /** Whether a perfect quality pairing was found */
  readonly foundPerfectPairing: boolean;
}

/**
 * Alteration generator state for logging
 */
export interface AlterationGeneratorInfo {
  /** Whether the generator is exhausted */
  readonly alterationDone: boolean;
}

/**
 * C8 context information for logging
 */
export interface C8ContextInfo {
  /** Number of players in the next bracket */
  readonly nextBracketPlayerCount: number;

  /** Number of downfloaters from current bracket */
  readonly currentDownfloaterCount: number;

  /** Number of remaining scoregroups */
  readonly remainingScoregroups: number;
}

/**
 * C8 min downfloaters result for logging
 */
export interface C8MinDownfloatersInfo {
  /** Minimum number of downfloaters required */
  readonly minDownfloaterCount: number;
}

/**
 * Compatibility graph structure for logging
 */
export interface CompatibilityGraphInfo {
  /** Serialized graph from graphology */
  readonly graph: SerializedGraph;
}

/**
 * Alteration bracket groups for logging
 */
export interface AlterationBracketInfo {
  /** S1 pairing numbers */
  readonly s1PairingNumbers: number[];

  /** S2 pairing numbers */
  readonly s2PairingNumbers: number[];

  /** Current alteration number (1-indexed) */
  readonly alterationNumber: number;

  /** S1R pairing numbers (remainder upper half, heterogeneous brackets only) */
  s1rPairingNumbers?: number[];

  /** S2R pairing numbers (remainder lower half, heterogeneous brackets only) */
  s2rPairingNumbers?: number[];
}
