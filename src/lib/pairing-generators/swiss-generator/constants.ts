/**
 * Shared constants for Swiss tournament pairing system.
 *
 * Centralises constants used across multiple modules (quality-evaluation,
 * weighted-pairing, matching) to avoid duplication and circular imports.
 */

// ============================================================================
// Colour Assignment
// ============================================================================

/**
 * Colour index change when assigned white pieces.
 * Positive value: player's history shifts towards "more white games".
 */
export const WHITE_COLOUR_CHANGE = 1;

/**
 * Colour index change when assigned black pieces.
 * Negative value: player's history shifts towards "more black games".
 */
export const BLACK_COLOUR_CHANGE = -1;

// ============================================================================
// Graph Node Identifiers
// ============================================================================

/**
 * Node identifier for the PAB (pairing-allocated bye) vertex in the
 * compatibility graph. Used when odd number of players requires a bye.
 */
export const PAB_NODE_ID = 'PAB';

// ============================================================================
// Topscorer Threshold
// ============================================================================

/**
 * Threshold multiplier for determining topscorers.
 * A player is a topscorer if their score > maxPossibleScore × TOPSCORER_THRESHOLD.
 *
 * FIDE defines topscorers as players with more than 50% of maximum possible score.
 */
export const TOPSCORER_THRESHOLD = 0.5;
