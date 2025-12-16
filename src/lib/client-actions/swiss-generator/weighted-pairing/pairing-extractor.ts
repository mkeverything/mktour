import type { ChessTournamentEntity, ColouredEntitiesPair } from "@/lib/client-actions/common-generator";
import { getSwissColouredPair } from "@/lib/client-actions/swiss-generator/colouring";
import type { MatchingResult } from "@/lib/client-actions/swiss-generator/matching/types";
import type { ExtractionResult } from "./types";
import { PAB_NODE_ID } from "@/lib/client-actions/swiss-generator/quality-evaluation/evaluate";

/**
 * Extracts pairing from matching result.
 */
export function extractPairingFromMatching(
  matching: MatchingResult,
  players: readonly ChessTournamentEntity[],
  roundNumber: number,
): ExtractionResult {
  const playerMap = new Map(players.map(p => [p.entityId, p]));
  const colouredPairs: ColouredEntitiesPair[] = [];
  let pabRecipient: ChessTournamentEntity | null = null;
  const processed = new Set<string>();

  for (const [vertexId, mateId] of matching) {
    if (processed.has(vertexId) || mateId === null) continue;
    processed.add(vertexId);
    processed.add(mateId);

    if (vertexId === PAB_NODE_ID) {
      pabRecipient = playerMap.get(mateId) ?? null;
    } else if (mateId === PAB_NODE_ID) {
      pabRecipient = playerMap.get(vertexId) ?? null;
    } else {
      const player1 = playerMap.get(vertexId);
      const player2 = playerMap.get(mateId);
      if (player1 && player2) {
        const pair = getSwissColouredPair([player1, player2], roundNumber);
        colouredPairs.push(pair);
      }
    }
  }

  return { colouredPairs, pabRecipient };
}
