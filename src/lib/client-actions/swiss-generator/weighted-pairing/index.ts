import type { ChessTournamentEntity } from "@/lib/client-actions/common-generator";
import { maximumWeightMatching } from "@/lib/client-actions/swiss-generator/matching/weighted-matching";
import { createWeightContext, buildWeightedGraph } from "./graph-builder";
import { computeMultipliers, REGULAR_CRITERIA, PAB_CRITERIA } from "./weight-calculator";
import { extractPairingFromMatching } from "./pairing-extractor";
import type { ExtractionResult } from "./types";

/**
 * Generates Swiss round pairing using weighted maximum matching.
 */
export function generateWeightedPairing(
  players: ChessTournamentEntity[],
  roundNumber: number,
): ExtractionResult {
  const context = createWeightContext(players, roundNumber);
  
  const regularMultipliers = computeMultipliers(REGULAR_CRITERIA, context);
  const pabMultipliers = computeMultipliers(PAB_CRITERIA, context);
  
  // Combine multipliers for graph building
  const combinedMultipliers = {
    multipliers: new Map([...regularMultipliers.multipliers, ...pabMultipliers.multipliers]),
    bases: new Map([...regularMultipliers.bases, ...pabMultipliers.bases]),
  };
  
  const graph = buildWeightedGraph(players, context, combinedMultipliers);
  const matching = maximumWeightMatching(graph);
  
  return extractPairingFromMatching(matching, players, roundNumber);
}

export { createWeightContext, buildWeightedGraph } from "./graph-builder";
export type { WeightContext, ExtractionResult } from "./types";
