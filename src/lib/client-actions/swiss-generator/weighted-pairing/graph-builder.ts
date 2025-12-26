import Graph from 'graphology';

import type { ChessTournamentEntity } from '@/lib/client-actions/common-generator';
import { getSwissColouredPair } from '@/lib/client-actions/swiss-generator/colouring';
import { EDGE_WEIGHT_ATTRIBUTE } from '@/lib/client-actions/swiss-generator/matching/weighted-operations';
import {
  areEntitiesCompatibleByC3,
  canEntityReceivePAB,
  getNonTopscorers,
  getTopscorers,
  havePlayedBefore,
  PAB_NODE_ID,
} from '@/lib/client-actions/swiss-generator/quality-evaluation/evaluate';

import type { WeightContext } from './types';
import type { CriterionMultipliers } from './weight-calculator';
import { computePabEdgeWeight, computeRegularEdgeWeight } from './weight-calculator';

/** Maps score values to the count of players with that score. */
type ScoregroupSizeMap = Map<number, number>;

/** Default count when a scoregroup has not been seen yet. */
const DEFAULT_SCOREGROUP_COUNT = 0;

/** Graph type for pairing graphs - always undirected. */
const GRAPH_TYPE = 'undirected' as const;

/**
 * Computes the number of players at each score level.
 *
 * Used by RANKING criterion to calculate ideal S1↔S2 pairing differences.
 *
 * @param players - All players in the tournament
 * @returns Map from score to count of players with that score
 */
function computeScoregroupSizes(
  players: readonly ChessTournamentEntity[],
): ScoregroupSizeMap {
  const sizes: ScoregroupSizeMap = new Map();

  for (const player of players) {
    const currentCount = sizes.get(player.entityScore) ?? DEFAULT_SCOREGROUP_COUNT;
    sizes.set(player.entityScore, currentCount + 1);
  }

  return sizes;
}

/**
 * Creates weight context for a round.
 *
 * Contains all tournament parameters needed for weight calculations.
 *
 * @param players - All players in the tournament
 * @param roundNumber - Current round number (1-indexed)
 * @returns WeightContext with tournament parameters
 */
export function createWeightContext(
  players: readonly ChessTournamentEntity[],
  roundNumber: number,
): WeightContext {
  const scoregroupSizes = computeScoregroupSizes(players);

  return {
    roundNumber,
    playerCount: players.length,
    edgeCount: Math.floor(players.length / 2),
    maxPossibleScore: roundNumber - 1,
    hasOddPlayers: players.length % 2 === 1,
    scoregroupSizes,
  };
}

/**
 * Adds weighted edges between all compatible player pairs.
 *
 * Iterates over all unique player pairs, checking compatibility by C3 and
 * prior games. For compatible pairs, computes edge weight from FIDE criteria.
 *
 * @param graph - Graph to add edges to
 * @param players - All players in the tournament
 * @param context - Tournament context for weight calculations
 * @param multipliers - Criterion multipliers for weight encoding
 * @param topscorers - Players at maximum score
 * @param nonTopscorers - Players below maximum score
 */
function addRegularEdges(
  graph: Graph,
  players: readonly ChessTournamentEntity[],
  context: WeightContext,
  multipliers: CriterionMultipliers,
  topscorers: readonly ChessTournamentEntity[],
  nonTopscorers: readonly ChessTournamentEntity[],
): void {
  for (let firstIndex = 0; firstIndex < players.length; firstIndex++) {
    for (let secondIndex = firstIndex + 1; secondIndex < players.length; secondIndex++) {
      const firstPlayer = players[firstIndex];
      const secondPlayer = players[secondIndex];

      const hasNotPlayedBefore = !havePlayedBefore(firstPlayer, secondPlayer);
      const isCompatibleByC3 = areEntitiesCompatibleByC3(firstPlayer, secondPlayer, [...nonTopscorers]);

      if (hasNotPlayedBefore && isCompatibleByC3) {
        const simplePair: [ChessTournamentEntity, ChessTournamentEntity] = [firstPlayer, secondPlayer];
        const colouredPair = getSwissColouredPair(simplePair);
        const edgeWeight = computeRegularEdgeWeight(colouredPair, context, multipliers, topscorers);
        const edgeAttributes = { [EDGE_WEIGHT_ATTRIBUTE]: edgeWeight };

        graph.addEdge(firstPlayer.entityId, secondPlayer.entityId, edgeAttributes);
      }
    }
  }
}

/**
 * Adds weighted edges from PAB node to all eligible players.
 *
 * Only players who can receive a bye (not already had one) get PAB edges.
 *
 * @param graph - Graph to add edges to
 * @param players - All players in the tournament
 * @param context - Tournament context for weight calculations
 * @param multipliers - Criterion multipliers for weight encoding
 * @param topscorers - Players at maximum score
 */
function addPabEdges(
  graph: Graph,
  players: readonly ChessTournamentEntity[],
  context: WeightContext,
  multipliers: CriterionMultipliers,
  topscorers: readonly ChessTournamentEntity[],
): void {
  for (const player of players) {
    const canReceivePab = canEntityReceivePAB(player, context.roundNumber);

    if (canReceivePab) {
      const edgeWeight = computePabEdgeWeight(player, context, multipliers, topscorers);
      const edgeAttributes = { [EDGE_WEIGHT_ATTRIBUTE]: edgeWeight };

      graph.addEdge(PAB_NODE_ID, player.entityId, edgeAttributes);
    }
  }
}

/**
 * Builds a weighted graph for the Blossom algorithm.
 *
 * Creates nodes for all players (and PAB if odd count), then adds edges
 * between compatible players with weights computed from FIDE criteria.
 *
 * @param players - All players in the tournament
 * @param context - Tournament context for weight calculations
 * @param multipliers - Criterion multipliers for weight encoding
 * @returns Undirected graph with weighted edges
 */
export function buildWeightedGraph(
  players: readonly ChessTournamentEntity[],
  context: WeightContext,
  multipliers: CriterionMultipliers,
): Graph {
  const graph = new Graph({ type: GRAPH_TYPE });

  for (const player of players) {
    graph.addNode(player.entityId);
  }
  if (context.hasOddPlayers) {
    graph.addNode(PAB_NODE_ID);
  }

  const topscorers = getTopscorers([...players], context.roundNumber);
  const nonTopscorers = getNonTopscorers([...players], context.roundNumber);

  addRegularEdges(graph, players, context, multipliers, topscorers, nonTopscorers);

  if (context.hasOddPlayers) {
    addPabEdges(graph, players, context, multipliers, topscorers);
  }

  return graph;
}

export { PAB_NODE_ID, EDGE_WEIGHT_ATTRIBUTE };
