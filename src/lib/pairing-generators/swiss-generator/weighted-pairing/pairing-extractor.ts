import type {
  ChessTournamentEntity,
  ColouredEntitiesPair,
} from '@/lib/pairing-generators/common-generator';
import { getSwissColouredPair } from '@/lib/pairing-generators/swiss-generator/colouring';
import type { MatchingResult } from '@/lib/pairing-generators/swiss-generator/matching/types';
import { PAB_NODE_ID } from '@/lib/pairing-generators/swiss-generator/quality-evaluation/evaluate';

/** Type alias for player ID to entity lookup. */
type PlayerLookupMap = Map<string, ChessTournamentEntity>;

/**
 * Checks if an edge involves the PAB node.
 *
 * @param vertexId - First vertex of the edge
 * @param mateId - Second vertex of the edge
 * @returns True if either vertex is the PAB node
 */
function isPabEdge(vertexId: string, mateId: string): boolean {
  return vertexId === PAB_NODE_ID || mateId === PAB_NODE_ID;
}

/**
 * Creates a coloured pair from two player IDs.
 *
 * Looks up both players and assigns colours based on Swiss rules.
 *
 * @param vertexId - First player's entity ID
 * @param mateId - Second player's entity ID
 * @param playerMap - Lookup map from entity ID to player
 * @returns Coloured pair if both players found, null otherwise
 */
function createColouredPairFromIds(
  vertexId: string,
  mateId: string,
  playerMap: PlayerLookupMap,
): ColouredEntitiesPair | null {
  const firstPlayer = playerMap.get(vertexId);
  const secondPlayer = playerMap.get(mateId);
  const areBothPlayersFound =
    firstPlayer !== undefined && secondPlayer !== undefined;

  if (areBothPlayersFound) {
    const simplePair: [ChessTournamentEntity, ChessTournamentEntity] = [
      firstPlayer,
      secondPlayer,
    ];
    return getSwissColouredPair(simplePair);
  }

  return null;
}

/**
 * Extracts coloured pairs from matching result.
 *
 * Converts the raw matching (vertex -> mate mapping) into structured
 * coloured pairs. PAB edges are skipped as they don't produce pairs.
 *
 * @param matching - Raw matching result from Blossom algorithm
 * @param players - All players (for ID to entity lookup)
 * @returns Array of coloured pairs
 */
export function extractPairingFromMatching(
  matching: MatchingResult,
  players: readonly ChessTournamentEntity[],
): readonly ColouredEntitiesPair[] {
  const createPlayerEntry = (
    player: ChessTournamentEntity,
  ): [string, ChessTournamentEntity] => [player.entityId, player];
  const playerMap: PlayerLookupMap = new Map(players.map(createPlayerEntry));

  const colouredPairs: ColouredEntitiesPair[] = [];
  const processedVertices = new Set<string>();

  for (const [vertexId, mateId] of matching) {
    const isAlreadyProcessed = processedVertices.has(vertexId);
    const hasNoMate = mateId === null;

    if (isAlreadyProcessed || hasNoMate) {
      continue;
    }

    processedVertices.add(vertexId);
    processedVertices.add(mateId);

    const isPab = isPabEdge(vertexId, mateId);

    if (isPab) {
      continue;
    }

    const colouredPair = createColouredPairFromIds(vertexId, mateId, playerMap);

    if (colouredPair !== null) {
      colouredPairs.push(colouredPair);
    }
  }

  return colouredPairs;
}
