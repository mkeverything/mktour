/**
 * Tournament Trace Debug Script
 *
 * Traces tournament history for a given seed and visualises why rounds may
 * have disconnected graphs (making perfect matching impossible).
 *
 * Usage: bun src/lib/client-actions/swiss-generator/scripts/trace-tournament.ts [seed]
 */

import { faker } from '@faker-js/faker';
import {
  EdgeAttributesObject,
  EdgeTargetLikeTuple,
  GraphBaseModel,
  NodeAttributesObject,
} from '@ts-graphviz/common';
import { digraph, toDot } from 'ts-graphviz';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import {
  ChessTournamentEntity,
  RoundProps,
  convertPlayerToEntity,
} from '@/lib/client-actions/common-generator';
import {
  fillRandomResult,
  generatePlayerModel,
  generateRandomDatabaseTournament,
  INITIAL_ONGOING_ROUND,
  updatePlayerScores,
} from '@/lib/client-actions/common-generator.test';
import { generateWeightedSwissRound } from '@/lib/client-actions/swiss-generator';
import { CardinalityValidationError } from '@/lib/client-actions/swiss-generator/weighted-pairing';
import { getInitialOrdering } from '@/lib/client-actions/swiss-generator/ordering';
import {
  areEntitiesCompatibleByC3,
  getNonTopscorers,
  havePlayedBefore,
} from '@/lib/client-actions/swiss-generator/quality-evaluation/evaluate';
import { findConnectedComponents } from '@/lib/client-actions/swiss-generator/scripts/graph-analysis';
import {
  EdgePair,
  EntityDisplayMap,
  GraphAnalysis,
  RoundTrace,
  TournamentTraceResult,
} from '@/lib/client-actions/swiss-generator/scripts/trace-types';
import { GameModel } from '@/server/db/zod/tournaments';
import type { PlayerTournamentModel } from '@/server/db/zod/players';

// ============================================================================
// Constants
// ============================================================================

/** Default seed for testing */
const DEFAULT_SEED = 19;

/** Player count range for generated tournaments */
const PLAYER_COUNT_RANGE = { min: 8, max: 16 };

// CLI Constants (yargs configuration)
const CLI_SCRIPT_NAME = 'trace-tournament';
const CLI_USAGE = '$0 [options]';
const CLI_OPTION_SEED = 'seed';
const CLI_OPTION_HELP = 'help';
const CLI_SEED_ALIAS = 's';
const CLI_SEED_DESCRIPTION = 'Random seed for tournament generation';
const CLI_HELP_ALIAS = 'h';
const YARGS_TYPE_NUMBER = 'number' as const;

// Format option constants
const CLI_OPTION_FORMAT = 'format';
const CLI_FORMAT_ALIAS = 'f';
const CLI_FORMAT_DESCRIPTION = 'Output format';
const CLI_FORMAT_STDOUT = 'stdout';
const CLI_FORMAT_DOT = 'dot';
const CLI_FORMAT_CHOICES = [CLI_FORMAT_STDOUT, CLI_FORMAT_DOT] as const;
const YARGS_TYPE_STRING = 'string' as const;

// ============================================================================
// Edge Collection
// ============================================================================

/**
 * Checks if two entities can be paired according to C1 and C3 criteria.
 *
 * @param firstEntity - First entity to check
 * @param secondEntity - Second entity to check
 * @param nonTopscorers - List of non-topscorer entities for C3
 * @returns True if entities are compatible for pairing
 */
function areEntitiesCompatible(
  firstEntity: ChessTournamentEntity,
  secondEntity: ChessTournamentEntity,
  nonTopscorers: ChessTournamentEntity[],
): boolean {
  const hasNotPlayedBefore = !havePlayedBefore(firstEntity, secondEntity);
  const isC3Compatible = areEntitiesCompatibleByC3(
    firstEntity,
    secondEntity,
    nonTopscorers,
  );
  return hasNotPlayedBefore && isC3Compatible;
}

/**
 * Collects all compatible edges between entities.
 *
 * Iterates through all entity pairs, checking C1 (unique opponents)
 * and C3 (colour preference) compatibility.
 *
 * @param entities - List of entities to check pairwise
 * @param nonTopscorers - Non-topscorer entities for C3 check
 * @returns Edges as entity ID pairs
 */
function collectCompatibleEdges(
  entities: ChessTournamentEntity[],
  nonTopscorers: ChessTournamentEntity[],
): EdgePair[] {
  const edges: EdgePair[] = [];

  for (let firstIndex = 0; firstIndex < entities.length; firstIndex++) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < entities.length;
      secondIndex++
    ) {
      const firstEntity = entities[firstIndex];
      const secondEntity = entities[secondIndex];

      if (areEntitiesCompatible(firstEntity, secondEntity, nonTopscorers)) {
        edges.push([firstEntity.entityId, secondEntity.entityId]);
      }
    }
  }

  return edges;
}

// ============================================================================
// Graph Analysis
// ============================================================================

/**
 * Analyses compatibility graph and returns connectivity information.
 *
 * Uses entity IDs throughout - no conversion to pairing numbers needed.
 *
 * @param entities - Players to analyse
 * @param roundNumber - Current round for topscorer calculation
 * @returns Graph analysis with edges, components, and connectivity
 */
function analyseCompatibilityGraph(
  entities: ChessTournamentEntity[],
  roundNumber: number,
): GraphAnalysis {
  const nonTopscorers = getNonTopscorers([...entities], roundNumber);
  const edges = collectCompatibleEdges(entities, nonTopscorers);
  const components = findConnectedComponents(edges);

  // Calculate max matching: each component matches floor(n/2) pairs
  let maxPossibleMatching = 0;
  for (const component of components) {
    maxPossibleMatching += Math.floor(component.length / 2) * 2;
  }

  return {
    vertexCount: entities.length,
    edgeCount: edges.length,
    edges,
    components,
    isConnected: components.length === 1,
    maxPossibleMatching,
  };
}

// ============================================================================
// Player and Tournament Setup
// ============================================================================

/**
 * Generates players with assigned pairing numbers.
 *
 * @param playerCount - Number of players to generate
 * @returns Array of players with pairing numbers 0, 1, 2, ...
 */
function generatePlayersWithPairingNumbers(
  playerCount: number,
): PlayerTournamentModel[] {
  const players: PlayerTournamentModel[] = [];

  for (let playerIndex = 0; playerIndex < playerCount; playerIndex++) {
    const player = generatePlayerModel();
    player.pairingNumber = playerIndex;
    players.push(player);
  }

  return players;
}

/**
 * Builds entity display map from players.
 *
 * @param players - Players to map
 * @returns Map from entity ID to nickname
 */
function buildEntityDisplayMap(
  players: PlayerTournamentModel[],
): EntityDisplayMap {
  const displayMap: EntityDisplayMap = new Map();
  for (const player of players) {
    displayMap.set(player.id, player.nickname);
  }
  return displayMap;
}

/**
 * Extracts pairings from generated games.
 *
 * @param games - Games generated for a round
 * @returns Array of entity ID pairs (white, black)
 */
function extractPairingsFromGames(games: GameModel[]): EdgePair[] {
  const pairings: EdgePair[] = [];
  for (const game of games) {
    pairings.push([game.whiteId, game.blackId]);
  }
  return pairings;
}

// ============================================================================
// Round Simulation
// ============================================================================

/**
 * Result of simulating a single round.
 *
 * @property isSuccess - Whether games were generated
 * @property roundTrace - Trace of the round if successful
 * @property games - Generated games if successful
 */
interface RoundSimulationResult {
  isSuccess: boolean;
  roundTrace: RoundTrace | null;
  games: GameModel[];
}

/** Result when round generation fails (no valid pairing found) */
const ROUND_FAILURE: RoundSimulationResult = {
  isSuccess: false,
  roundTrace: null,
  games: [],
};

/**
 * Simulates a single round of the tournament.
 *
 * Captures the compatibility graph BEFORE pairing, then runs the
 * weighted matching algorithm and records which edges were selected.
 *
 * @param players - Current player list
 * @param previousGames - All games played so far
 * @param roundNumber - Current round number
 * @param tournamentId - Tournament ID for game generation
 * @returns Simulation result with success status and generated data
 */
function simulateRound(
  players: PlayerTournamentModel[],
  previousGames: GameModel[],
  roundNumber: number,
  tournamentId: string,
): RoundSimulationResult {
  const updatedPlayers = updatePlayerScores(players, previousGames);

  // Build entities and analyse graph BEFORE pairing
  const entities = buildEntitiesForAnalysis(players, previousGames);
  const graphBeforePairing = analyseCompatibilityGraph(entities, roundNumber);

  // Run the weighted matching algorithm
  const roundProps: RoundProps = {
    players: updatedPlayers,
    games: previousGames,
    roundNumber,
    tournamentId,
  };

  let generatedGames: GameModel[];
  try {
    generatedGames = generateWeightedSwissRound(roundProps);
  } catch (error: unknown) {
    if (error instanceof CardinalityValidationError) {
      // Matching failed due to disconnected graph
      // The finalGraphAnalysis will capture the problematic graph state
      return ROUND_FAILURE;
    } else {
      // Unexpected error - rethrow
      throw error;
    }
  }

  const hasGames = generatedGames.length > 0;

  if (hasGames) {
    // Extract selected matching (which edges the algorithm chose)
    const selectedMatching = extractPairingsFromGames(generatedGames);

    const roundTrace: RoundTrace = {
      roundNumber,
      graphBeforePairing,
      selectedMatching,
    };

    return {
      isSuccess: true,
      roundTrace,
      games: generatedGames,
    };
  } else {
    return ROUND_FAILURE;
  }
}

/**
 * Builds entities for graph analysis from current player state.
 *
 * @param players - Current players
 * @param previousGames - Games played so far
 * @returns Sorted entities with pairing numbers assigned
 */
function buildEntitiesForAnalysis(
  players: PlayerTournamentModel[],
  previousGames: GameModel[],
): ChessTournamentEntity[] {
  const updatedPlayers = updatePlayerScores(players, previousGames);

  const convertToEntity = (
    player: PlayerTournamentModel,
  ): ChessTournamentEntity => convertPlayerToEntity(player, previousGames);
  const entities = updatedPlayers.map(convertToEntity);

  const sortedEntities = getInitialOrdering(entities);

  for (
    let entityIndex = 0;
    entityIndex < sortedEntities.length;
    entityIndex++
  ) {
    sortedEntities[entityIndex].pairingNumber = entityIndex;
  }

  return sortedEntities;
}

// ============================================================================
// Main Tracing Function
// ============================================================================

/**
 * Traces a tournament with the given seed.
 *
 * Generates rounds until pairing fails or all optimal rounds complete.
 * For each round, captures the compatibility graph before pairing and
 * the edges selected as the matching.
 *
 * @param seed - Random seed for deterministic generation
 * @returns Complete tournament trace result
 */
export function traceTournament(seed: number): TournamentTraceResult {
  // Seed faker for deterministic generation
  faker.seed(seed);

  // Generate tournament structure
  const playerCount = faker.number.int(PLAYER_COUNT_RANGE);
  const players = generatePlayersWithPairingNumbers(playerCount);
  const entityNames = buildEntityDisplayMap(players);

  const tournament = generateRandomDatabaseTournament();
  const tournamentId = tournament.id;

  // Swiss optimal rounds = n-2 for n players
  const optimalRounds = playerCount - 2;

  // State for simulation loop
  const rounds: RoundTrace[] = [];
  const allGames: GameModel[] = [];
  let currentRound = INITIAL_ONGOING_ROUND;
  let shouldContinue = true;

  // Simulate rounds until failure or completion
  while (shouldContinue && currentRound <= optimalRounds) {
    const result = simulateRound(players, allGames, currentRound, tournamentId);

    if (result.isSuccess && result.roundTrace !== null) {
      // Round succeeded - record trace and add games to history
      rounds.push(result.roundTrace);
      result.games.forEach(fillRandomResult);
      allGames.push(...result.games);
      currentRound++;
    } else {
      // Round failed - stop simulation
      shouldContinue = false;
    }
  }

  // Analyse final graph structure (at the round that failed or after last round)
  const finalEntities = buildEntitiesForAnalysis(players, allGames);
  const finalGraphAnalysis = analyseCompatibilityGraph(
    finalEntities,
    currentRound,
  );

  return {
    seed,
    playerCount,
    entityNames,
    rounds,
    finalGraphAnalysis,
  };
}

// ============================================================================
// Output Formatting Helpers
// ============================================================================

/** Number of characters to show for truncated entity IDs */
const ENTITY_ID_TRUNCATE_LENGTH = 8;

/**
 * Formats an entity ID for display using the entity names map.
 *
 * @param entityId - Entity ID to format
 * @param entityNames - Map from entity ID to nickname
 * @returns Formatted display string (nickname or truncated ID)
 */
function formatEntity(entityId: string, entityNames: EntityDisplayMap): string {
  const nickname = entityNames.get(entityId);
  const hasNickname = nickname !== undefined;

  if (hasNickname) {
    return nickname;
  } else {
    const truncatedId = entityId.substring(0, ENTITY_ID_TRUNCATE_LENGTH);
    return truncatedId;
  }
}

/**
 * Formats an edge for display.
 *
 * @param edge - Edge as entity ID pair
 * @param entityNames - Map from entity ID to nickname
 * @returns Formatted edge string
 */
function formatEdge(edge: EdgePair, entityNames: EntityDisplayMap): string {
  const [firstId, secondId] = edge;
  const firstName = formatEntity(firstId, entityNames);
  const secondName = formatEntity(secondId, entityNames);
  return `${firstName} -- ${secondName}`;
}

/**
 * Formats a connected component for display.
 *
 * @param component - Array of entity IDs in the component
 * @param entityNames - Map from entity ID to nickname
 * @returns Formatted component string with size and members
 */
function formatComponent(
  component: string[],
  entityNames: EntityDisplayMap,
): string {
  const memberNames = component.map((id) => formatEntity(id, entityNames));
  const joinedMembers = memberNames.join(', ');
  return `(size ${component.length}): [${joinedMembers}]`;
}

/**
 * Formats a graph analysis for display.
 *
 * @param analysis - Graph analysis to format
 * @param entityNames - Map from entity ID to nickname
 * @returns Array of formatted lines
 */
function formatGraphAnalysis(
  analysis: GraphAnalysis,
  entityNames: EntityDisplayMap,
): string[] {
  const lines: string[] = [];

  lines.push(
    `  Vertices: ${analysis.vertexCount}, Edges: ${analysis.edgeCount}`,
  );

  // Format edges
  const hasEdges = analysis.edges.length > 0;
  if (hasEdges) {
    lines.push('  Edges:');
    for (const edge of analysis.edges) {
      const edgeString = formatEdge(edge, entityNames);
      lines.push(`    ${edgeString}`);
    }
  }

  // Format components
  lines.push('  Components:');
  for (
    let componentIndex = 0;
    componentIndex < analysis.components.length;
    componentIndex++
  ) {
    const component = analysis.components[componentIndex];
    const componentString = formatComponent(component, entityNames);
    lines.push(`    ${componentIndex + 1}. ${componentString}`);
  }

  // Connectivity status
  if (analysis.isConnected) {
    lines.push('  Status: Connected');
  } else {
    lines.push(
      `  Status: DISCONNECTED - Max matching: ${analysis.maxPossibleMatching}/${analysis.vertexCount}`,
    );
  }

  return lines;
}

// ============================================================================
// Main Output Formatter
// ============================================================================

/**
 * Formats the complete tournament trace result.
 *
 * @param result - Tournament trace result to format
 * @returns Formatted string output
 */
export function formatTraceOutput(result: TournamentTraceResult): string {
  const lines: string[] = [];

  lines.push(`=== Tournament Trace (Seed ${result.seed}) ===`);
  lines.push(`Players: ${result.playerCount}`);
  lines.push('');

  // Format each round with graph and matching
  for (const round of result.rounds) {
    lines.push(`--- Round ${round.roundNumber} ---`);

    // Graph before pairing
    lines.push('Graph before pairing:');
    const graphLines = formatGraphAnalysis(
      round.graphBeforePairing,
      result.entityNames,
    );
    lines.push(...graphLines);

    // Selected matching
    lines.push('Selected matching:');
    for (const edge of round.selectedMatching) {
      const edgeString = formatEdge(edge, result.entityNames);
      lines.push(`  ${edgeString}`);
    }

    lines.push('');
  }

  // Final round analysis
  const finalRoundNumber = result.rounds.length + 1;
  lines.push(`--- Round ${finalRoundNumber} (Final Analysis) ---`);
  const finalGraphLines = formatGraphAnalysis(
    result.finalGraphAnalysis,
    result.entityNames,
  );
  lines.push(...finalGraphLines);

  return lines.join('\n');
}

// ============================================================================
// DOT Output Formatter (ts-graphviz)
// ============================================================================

/** DOT graph name identifier */
const DOT_GRAPH_NAME = 'TournamentTrace';

/** DOT attribute for graph label */
const DOT_ATTR_LABEL = 'label';

/** DOT attribute for label location (top) */
const DOT_ATTR_LABELLOC = 'labelloc';

/** DOT label location value: top */
const DOT_LABELLOC_TOP = 't';

/** DOT edge colour for matched edges */
const DOT_MATCHED_EDGE_COLOR = 'green';

/** DOT edge pen width for matched edges */
const DOT_MATCHED_EDGE_PENWIDTH = 3;

/** DOT edge colour for unmatched edges */
const DOT_UNMATCHED_EDGE_COLOR = 'gray';

/**
 * Checks if an edge is in the selected matching.
 *
 * Uses Array.some() to check both orderings (edges are undirected).
 *
 * @param edge - Edge to check [firstId, secondId]
 * @param matching - Selected matching edges
 * @returns True if edge is in the matching
 */
function isEdgeInMatching(edge: EdgePair, matching: EdgePair[]): boolean {
  const [firstId, secondId] = edge;

  const matchesEdge = (matchedEdge: EdgePair): boolean => {
    const [matchFirst, matchSecond] = matchedEdge;
    const isForwardMatch = firstId === matchFirst && secondId === matchSecond;
    const isReverseMatch = firstId === matchSecond && secondId === matchFirst;
    return isForwardMatch || isReverseMatch;
  };

  return matching.some(matchesEdge);
}

/**
 * Creates a round-prefixed node ID for unique identification per round.
 *
 * @param roundNumber - Round number for prefix
 * @param entityId - Original entity ID
 * @returns Prefixed node ID
 */
function createRoundNodeId(roundNumber: number, entityId: string): string {
  const roundPrefix = `r${roundNumber}_`;
  return `${roundPrefix}${entityId}`;
}

/** Graphviz cluster prefix for subgraphs */
const DOT_CLUSTER_PREFIX = 'cluster_round';

/** Edge attributes for matched edges */
const MATCHED_EDGE_ATTRS: EdgeAttributesObject = {
  color: DOT_MATCHED_EDGE_COLOR,
  penwidth: DOT_MATCHED_EDGE_PENWIDTH,
};

/** Edge attributes for unmatched edges */
const UNMATCHED_EDGE_ATTRS: EdgeAttributesObject = {
  color: DOT_UNMATCHED_EDGE_COLOR,
};

/**
 * Adds nodes for all players to a graph with round-prefixed IDs.
 *
 * @param graph - The graph model to add nodes to
 * @param roundNumber - Round number for node ID prefix
 * @param entityNames - Map of entity IDs to nicknames
 */
function addRoundNodes(
  graph: GraphBaseModel,
  roundNumber: number,
  entityNames: EntityDisplayMap,
): void {
  for (const [entityId, nickname] of entityNames) {
    const roundNodeId = createRoundNodeId(roundNumber, entityId);
    const nodeAttrs: NodeAttributesObject = { [DOT_ATTR_LABEL]: nickname };
    graph.node(roundNodeId, nodeAttrs);
  }
}

/**
 * Adds edges to a graph with matching edges highlighted.
 *
 * @param graph - The graph model to add edges to
 * @param roundNumber - Round number for node ID prefix
 * @param edges - All edges in the compatibility graph
 * @param matching - Selected matching edges (highlighted green)
 */
function addRoundEdges(
  graph: GraphBaseModel,
  roundNumber: number,
  edges: EdgePair[],
  matching: EdgePair[],
): void {
  for (const edge of edges) {
    const [firstId, secondId] = edge;
    const roundFirstId = createRoundNodeId(roundNumber, firstId);
    const roundSecondId = createRoundNodeId(roundNumber, secondId);
    const edgeEndpoints: EdgeTargetLikeTuple = [roundFirstId, roundSecondId];
    const isMatched = isEdgeInMatching(edge, matching);
    const edgeAttrs = isMatched ? MATCHED_EDGE_ATTRS : UNMATCHED_EDGE_ATTRS;

    graph.edge(edgeEndpoints, edgeAttrs);
  }
}

/**
 * Formats the tournament trace as a Graphviz DOT diagram.
 *
 * Uses ts-graphviz to build a graph showing the compatibility
 * graph for each round with matched edges highlighted.
 *
 * @param result - Tournament trace result to format
 * @returns DOT format string
 */
export function formatDotOutput(result: TournamentTraceResult): string {
  const graphLabel = `Tournament Trace (Seed ${result.seed})`;
  const entityNames = result.entityNames;
  const rounds = result.rounds;
  const finalEdges = result.finalGraphAnalysis.edges;
  const finalRoundNumber = rounds.length + 1;

  const graph = digraph(DOT_GRAPH_NAME, (graphBuilder) => {
    graphBuilder.set(DOT_ATTR_LABEL, graphLabel);
    graphBuilder.set(DOT_ATTR_LABELLOC, DOT_LABELLOC_TOP);

    // Create subgraph for each completed round
    for (const round of rounds) {
      const roundNumber = round.roundNumber;
      const clusterName = `${DOT_CLUSTER_PREFIX}${roundNumber}`;
      const clusterLabel = `Round ${roundNumber}`;
      const roundEdges = round.graphBeforePairing.edges;
      const selectedMatching = round.selectedMatching;

      graphBuilder.subgraph(clusterName, (cluster) => {
        cluster.set(DOT_ATTR_LABEL, clusterLabel);
        addRoundNodes(cluster, roundNumber, entityNames);
        addRoundEdges(cluster, roundNumber, roundEdges, selectedMatching);
      });
    }

    // Final round subgraph (the round that failed or after completion)
    const finalClusterName = `${DOT_CLUSTER_PREFIX}${finalRoundNumber}`;
    const finalClusterLabel = `Round ${finalRoundNumber} (Final)`;
    const emptyMatching: EdgePair[] = [];

    graphBuilder.subgraph(finalClusterName, (cluster) => {
      cluster.set(DOT_ATTR_LABEL, finalClusterLabel);
      addRoundNodes(cluster, finalRoundNumber, entityNames);
      addRoundEdges(cluster, finalRoundNumber, finalEdges, emptyMatching);
    });
  });

  return toDot(graph);
}

// ============================================================================
// CLI Runner
// ============================================================================

/** Output format type derived from CLI_FORMAT_CHOICES */
type OutputFormat = (typeof CLI_FORMAT_CHOICES)[number];

/**
 * Parsed CLI arguments.
 *
 * @property seed - Random seed for tournament generation
 * @property format - Output format (stdout or mermaid)
 */
interface CliArgs {
  seed: number;
  format: OutputFormat;
}

/**
 * Builds the seed option configuration for yargs.
 *
 * @returns Yargs option configuration object
 */
function buildSeedOption() {
  return {
    alias: CLI_SEED_ALIAS,
    type: YARGS_TYPE_NUMBER,
    description: CLI_SEED_DESCRIPTION,
    default: DEFAULT_SEED,
  };
}

/**
 * Builds the format option configuration for yargs.
 *
 * @returns Yargs option configuration object
 */
function buildFormatOption() {
  return {
    alias: CLI_FORMAT_ALIAS,
    type: YARGS_TYPE_STRING,
    description: CLI_FORMAT_DESCRIPTION,
    choices: CLI_FORMAT_CHOICES,
    default: CLI_FORMAT_STDOUT,
  };
}

/**
 * Parses CLI arguments using yargs.
 *
 * Pattern: hideBin() strips executable and script path from process.argv.
 * parseSync() is used since we have no async commands.
 *
 * @see https://github.com/yargs/yargs/blob/main/docs/typescript.md
 * @returns Parsed CLI arguments
 */
function parseCliArgs(): CliArgs {
  const processArgs = hideBin(process.argv);
  const seedOption = buildSeedOption();
  const formatOption = buildFormatOption();

  const argv = yargs(processArgs)
    .scriptName(CLI_SCRIPT_NAME)
    .usage(CLI_USAGE)
    .option(CLI_OPTION_SEED, seedOption)
    .option(CLI_OPTION_FORMAT, formatOption)
    .help()
    .alias(CLI_OPTION_HELP, CLI_HELP_ALIAS)
    .version(false)
    .strict()
    .parseSync();

  // Extract format with fallback to default (yargs guarantees valid choice)
  const formatValue = argv[CLI_OPTION_FORMAT];
  const format =
    formatValue === CLI_FORMAT_DOT ? CLI_FORMAT_DOT : CLI_FORMAT_STDOUT;

  return {
    seed: argv[CLI_OPTION_SEED],
    format,
  };
}

/**
 * Main entry point for CLI execution.
 *
 * Parses arguments, runs tournament trace, and outputs formatted result.
 */
function main(): void {
  const args = parseCliArgs();
  const result = traceTournament(args.seed);

  if (args.format === CLI_FORMAT_DOT) {
    const output = formatDotOutput(result);
    console.log(output);
  } else {
    const output = formatTraceOutput(result);
    console.log(output);
  }
}

/**
 * Bun entry point check.
 *
 * import.meta.main is true when this file is executed directly (not imported).
 *
 * @see https://bun.sh/guides/util/entrypoint
 */
if (import.meta.main) {
  main();
}
