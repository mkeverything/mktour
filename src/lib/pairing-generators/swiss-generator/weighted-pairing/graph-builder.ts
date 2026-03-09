import Graph from 'graphology';

import type { ChessTournamentEntity } from '@/lib/pairing-generators/common-generator';
import { getSwissColouredPair } from '@/lib/pairing-generators/swiss-generator/colouring';
import { EDGE_WEIGHT_ATTRIBUTE } from '@/lib/pairing-generators/swiss-generator/matching/weighted-operations';
import { compareNumeric } from '@/lib/pairing-generators/swiss-generator/ordering';
import {
  canEntityReceivePAB,
  getTopscorers,
  havePlayedBefore,
  PAB_NODE_ID,
} from '@/lib/pairing-generators/swiss-generator/quality-evaluation/evaluate';

import type { ScoreGroup, WeightContext } from './types';
import type { CriterionMultipliers } from './weight-calculator';
import {
  computePabEdgeWeight,
  computeRegularEdgeWeight,
} from './weight-calculator';

/** Default count when a scoregroup has not been seen yet. */
const DEFAULT_SCOREGROUP_COUNT = 0;

/** Graph type for pairing graphs - always undirected. */
const GRAPH_TYPE = 'undirected' as const;

/**
 * Compares two score groups by score in descending order (higher score first).
 *
 * Uses reversed argument order with compareNumeric for descending sort.
 *
 * @param firstGroup - First score group
 * @param secondGroup - Second score group
 * @returns Comparison result for sorting
 */
function compareScoreGroupByScoreDescending(
  firstGroup: ScoreGroup,
  secondGroup: ScoreGroup,
): number {
  return compareNumeric(secondGroup.score, firstGroup.score);
}

/**
 * Computes score groups sorted descending by score.
 *
 * Counts players at each score level, then sorts brackets from highest to
 * lowest score. Used by BRACKET_RANK (bracket index) and RANKING (group size).
 *
 * @param players - All players in the tournament
 * @returns Score groups sorted descending by score
 */
function computeScoreGroups(
  players: readonly ChessTournamentEntity[],
): ScoreGroup[] {
  const countByScore = new Map<number, number>();

  for (const player of players) {
    const currentCount =
      countByScore.get(player.entityScore) ?? DEFAULT_SCOREGROUP_COUNT;
    countByScore.set(player.entityScore, currentCount + 1);
  }

  const scoreGroups: ScoreGroup[] = [];
  for (const [score, count] of countByScore) {
    scoreGroups.push({ score, count });
  }

  scoreGroups.sort(compareScoreGroupByScoreDescending);

  return scoreGroups;
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
  const scoreGroups = computeScoreGroups(players);

  const scoregroupSizes = new Map<number, number>();
  for (const group of scoreGroups) {
    scoregroupSizes.set(group.score, group.count);
  }

  return {
    roundNumber,
    playerCount: players.length,
    edgeCount: Math.floor(players.length / 2),
    maxPossibleScore: roundNumber - 1,
    hasOddPlayers: players.length % 2 === 1,
    scoregroupSizes,
    scoreGroups,
    numBrackets: scoreGroups.length,
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
): void {
  for (let firstIndex = 0; firstIndex < players.length; firstIndex++) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < players.length;
      secondIndex++
    ) {
      const firstPlayer = players[firstIndex];
      const secondPlayer = players[secondIndex];

      const hasNotPlayedBefore = !havePlayedBefore(firstPlayer, secondPlayer);
      if (hasNotPlayedBefore) {
        const simplePair: [ChessTournamentEntity, ChessTournamentEntity] = [
          firstPlayer,
          secondPlayer,
        ];
        const colouredPair = getSwissColouredPair(simplePair);
        const edgeWeight = computeRegularEdgeWeight(
          colouredPair,
          context,
          multipliers,
          topscorers,
        );
        const edgeAttributes = { [EDGE_WEIGHT_ATTRIBUTE]: edgeWeight };

        graph.addEdge(
          firstPlayer.entityId,
          secondPlayer.entityId,
          edgeAttributes,
        );
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
      const edgeWeight = computePabEdgeWeight(
        player,
        context,
        multipliers,
        topscorers,
      );
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

  addRegularEdges(graph, players, context, multipliers, topscorers);

  if (context.hasOddPlayers) {
    addPabEdges(graph, players, context, multipliers, topscorers);
  }

  return graph;
}

export { EDGE_WEIGHT_ATTRIBUTE, PAB_NODE_ID };
