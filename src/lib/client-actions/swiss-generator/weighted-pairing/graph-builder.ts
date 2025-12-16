import Graph from "graphology";
import type { ChessTournamentEntity } from "@/lib/client-actions/common-generator";
import { havePlayedBefore, getNonTopscorers, areEntitiesCompatibleByC3, canEntityReceivePAB, PAB_NODE_ID } from "@/lib/client-actions/swiss-generator/quality-evaluation/evaluate";
import { EDGE_WEIGHT_ATTRIBUTE } from "@/lib/client-actions/swiss-generator/matching/weighted-operations";
import type { WeightContext } from "./types";
import { computeRegularEdgeWeight, computePabEdgeWeight } from "./weight-calculator";
import type { CriterionMultipliers } from "./weight-calculator";

export function createWeightContext(players: readonly ChessTournamentEntity[], roundNumber: number): WeightContext {
  return {
    roundNumber,
    playerCount: players.length,
    edgeCount: Math.floor(players.length / 2),
    maxPossibleScore: roundNumber - 1,
    hasOddPlayers: players.length % 2 === 1,
  };
}

export function buildWeightedGraph(players: readonly ChessTournamentEntity[], context: WeightContext, multipliers: CriterionMultipliers): Graph {
  const graph = new Graph({ type: "undirected" });
  
  for (const player of players) { graph.addNode(player.entityId); }
  if (context.hasOddPlayers) { graph.addNode(PAB_NODE_ID); }
  
  const nonTopscorers = getNonTopscorers([...players], context.roundNumber);
  
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const p1 = players[i], p2 = players[j];
      if (havePlayedBefore(p1, p2)) continue;
      if (!areEntitiesCompatibleByC3(p1, p2, nonTopscorers)) continue;
      graph.addEdge(p1.entityId, p2.entityId, { [EDGE_WEIGHT_ATTRIBUTE]: computeRegularEdgeWeight(p1, p2, context, multipliers) });
    }
  }
  
  if (context.hasOddPlayers) {
    for (const player of players) {
      if (!canEntityReceivePAB(player, context.roundNumber)) continue;
      graph.addEdge(PAB_NODE_ID, player.entityId, { [EDGE_WEIGHT_ATTRIBUTE]: computePabEdgeWeight(player, context, multipliers) });
    }
  }
  
  return graph;
}

export { PAB_NODE_ID, EDGE_WEIGHT_ATTRIBUTE };
