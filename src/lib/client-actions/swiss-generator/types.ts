import {
  ChessTournamentEntity,
  ColouredEntitiesPair,
} from '@/lib/client-actions/common-generator';

/**
 * This interface describes the Swiss bracket parameters
 * @interface BracketParameters
 * @property {number} mdpCount - Moved down players count in the bracket
 * @property {number} maxPairs - Maximum number of pairs that can be formed in this bracket
 * @property {number} mdpPairingsCount - Number of MDP pairings to be made (min of mdpCount and maxPairs)
 */
export interface BracketParameters {
  mdpCount: number;
  maxPairs: number;
  mdpPairingsCount: number;
}

/**
 * This interface represents the two groups formed when dividing a homogeneous bracket for Swiss pairing
 * @interface HomoBracketGroups
 * @property {ChessTournamentEntity[]} S1 - Upper half of the bracket (top-ranked players)
 * @property {ChessTournamentEntity[]} S2 - Lower half of the bracket (lower-ranked players)
 */
export interface HomoBracketGroups {
  S1: ChessTournamentEntity[];
  S2: ChessTournamentEntity[];
}

/**
 * This interface represents bracket groups for heterogeneous brackets (with MDPs)
 * Extends HomoBracketGroups to include Limbo and remainder groups
 * @interface HeteroBracketGroups
 * @extends HomoBracketGroups
 * @property {ChessTournamentEntity[]} Limbo - Excess MDP players that cannot be paired in current bracket
 * @property {ChessTournamentEntity[]} S1R - Upper half of remainder (residents after MDP-Pairing)
 * @property {ChessTournamentEntity[]} S2R - Lower half of remainder (residents after MDP-Pairing)
 */
export interface HeteroBracketGroups extends HomoBracketGroups {
  Limbo: ChessTournamentEntity[];
  S1R: ChessTournamentEntity[];
  S2R: ChessTournamentEntity[];
}

/**
 * Union type for bracket groups - can be either homogeneous or heterogeneous
 */
export type BracketGroups = HomoBracketGroups | HeteroBracketGroups;

/**
 * This interface represents a pairing candidate for Swiss pairing
 * Unified structure for both homogeneous and heterogeneous brackets
 * @interface PairingCandidate
 * @property {ColouredEntitiesPair[]} colouredPairs - Array of all entity pairs formed in this bracket
 * @property {ChessTournamentEntity[]} downfloaters - Players who cannot be paired and move to lower scoregroup
 */
export interface PairingCandidate {
  colouredPairs: ColouredEntitiesPair[];
  downfloaters: ChessTournamentEntity[];
}

/**
 * Type guard to check if bracket groups are heterogeneous
 * @param bracketGroups - The bracket groups to check
 * @returns true if the bracket has Limbo, S1R and S2R (heterogeneous properties)
 */
export function isHeteroBracket(
  bracketGroups: BracketGroups,
): bracketGroups is HeteroBracketGroups {
  return (
    (bracketGroups as HeteroBracketGroups).Limbo !== undefined &&
    (bracketGroups as HeteroBracketGroups).S1R !== undefined &&
    (bracketGroups as HeteroBracketGroups).S2R !== undefined
  );
}

/**
 * Interface for bidirectional BSN mapping
 */
export interface BSNMaps {
  entityByBSN: Map<number, ChessTournamentEntity>;
  bsnByEntity: Map<ChessTournamentEntity, number>;
}

/**
 * Interface representing a pairing candidate that has been evaluated against quality criteria
 * @interface EvaluatedPairingCandidate
 * @property {PairingCandidate} candidate - The pairing candidate
 * @property {QualityEvaluationReport} report - The quality evaluation report for this candidate
 */
export interface EvaluatedPairingCandidate {
  candidate: PairingCandidate;
  report: QualityEvaluationReport;
}

/**
 * Basic absolute evaluation report interface for Swiss system pairing candidates
 * Contains FIDE (Dutch) System criteria C1-C3 which can be checked independently per bracket
 */
export interface BasicAbsoluteEvaluationReport {
  /** C1: Two players shall not play against each other more than once */
  c1UniqueOpponents: boolean;

  /** C2: No player receives PAB twice or multiple point-scoring rounds without playing */
  c2UniquePAB: boolean;

  /** C3: Non-topscorers with same absolute colour preference shall not meet */
  c3ColourPreferenceSeparation: boolean;
}

/**
 * Extended absolute evaluation report interface for Swiss system pairing candidates
 * Contains FIDE (Dutch) System criteria C4-C5 which require global tournament context
 */
export interface ExtendedAbsoluteEvaluationReport {
  /** C4: Downfloaters and players from other groups allow pairing */
  c4PairingCompatibility: boolean;

  /** C5: PAB receiver criterion (PAB recipient has valid score) */
  c5PabMinimization: boolean;
}

/**
 * Complete absolute evaluation report interface for Swiss system pairing candidates
 * Contains all FIDE (Dutch) System criteria C1-C5 which are absolute criteria that cannot be violated
 * These criteria must all be satisfied before proceeding to quality evaluation phase
 */
export interface AbsoluteEvaluationReport
  extends BasicAbsoluteEvaluationReport {
  /** C4: Downfloaters and players from other groups allow pairing */
  c4PairingCompatibility: boolean;
}

/**
 * This type is for the easy spreading o f the entityt groups ,needed in the swiss generator,
 * to be available by their current score.
 */
export type EntitiesByScore = Map<number, ChessTournamentEntity[]>;

/**
 * Result of C8 Future Criteria Compliance check
 */
export interface FutureCriteriaCompliance {
  pabScore: number;
  downfloaterCount: number;
  downfloaterScores: number[];
}

/**
 * Quality evaluation report for Swiss system pairing candidates
 * Contains FIDE (Dutch) System criteria C5-C21 which are used to compare and order candidates
 */
export interface QualityEvaluationReport {
  /** C5: Minimise the score of the PAB recipient */
  c5MinimisePabScore: number;

  /** C6: Minimise the number of downfloaters */
  c6MinimiseDownfloaters: number;

  /** C7: Minimise the scores of the downfloaters */
  c7MinimiseDownfloaterScores: number[];

  /** C8: Minimise the number of downfloaters in the following bracket */
  c8FutureCriteriaCompliance: FutureCriteriaCompliance;

  /** C9: Minimise the number of unplayed games of the PAB assignee */
  c9MinimisePabUnplayed: number;

  /** C10: Minimise colour difference violations (>2 or <-2) for topscorers */
  c10MinimiseColourDiffViolation: number;

  /** C11: Minimise same colour 3 times in a row for topscorers */
  c11MinimiseSameColourThreeTimes: number;

  /** C12: Minimise colour preference violations */
  c12MinimiseColourPrefViolation: number;

  /** C13: Minimise strong colour preference violations (alternating colours) */
  c13MinimiseStrongColourPrefViolation: number;

  /** C14: Minimise resident downfloaters who received a downfloat 1 round ago */
  c14MinimiseResidentDownfloaterPrev: number;

  /** C15: Minimise MDP opponents who received an upfloat 1 round ago */
  c15MinimiseMdpOpponentUpfloatPrev: number;

  /** C16: Minimise resident downfloaters who received a downfloat 2 rounds ago */
  c16MinimiseResidentDownfloaterPrev2: number;

  /** C17: Minimise MDP opponents who received an upfloat 2 rounds ago */
  c17MinimiseMdpOpponentUpfloatPrev2: number;

  /** C18: Minimise score difference of MDPs who received a downfloat 1 round ago */
  c18MinimiseMdpScoreDiffPrev: number[];

  /** C19: Minimise score difference of MDP opponents who received an upfloat 1 round ago */
  c19MinimiseMdpOpponentScoreDiffPrev: number[];

  /** C20: Minimise score difference of MDPs who received a downfloat 2 rounds ago */
  c20MinimiseMdpScoreDiffPrev2: number[];

  /** C21: Minimise score difference of MDP opponents who received an upfloat 2 rounds ago */
  c21MinimiseMdpOpponentScoreDiffPrev2: number[];
}

/**
 * Context used for evaluating quality criteria.
 * Contains information about the current state of the tournament and bracket.
 */
export interface EvaluationContext {
  currentBracketScore: number;
  roundNumber: number;
  scoregroupsByScore: [number, ChessTournamentEntity[]][];
}
