import {
  ChessTournamentEntity,
  RoundProps,
  convertPlayerToEntity,
  getGameToInsert,
  getNumberedPair,
} from '@/lib/client-actions/common-generator';
import { generateAlterations } from '@/lib/client-actions/swiss-generator/alterations';
import {
  constructBracketGroups,
  generateEntitiesByScore,
  getPairing,
  getParameters,
  reorderBracketGroups,
} from '@/lib/client-actions/swiss-generator/bracket-formation';
import { getInitialOrdering } from '@/lib/client-actions/swiss-generator/ordering';
import {
  compareQualityReports,
  evaluateAbsoluteCriteria,
  evaluateQualityCriteria,
} from '@/lib/client-actions/swiss-generator/quality-evaluation';
import { EvaluatedPairingCandidate } from '@/lib/client-actions/swiss-generator/types';
import { GameModel } from '@/types/tournaments';

/*
 * This function generates the bracket round for the Swiss tournament. It gets the
 * tournamentId, checks the query for the current list of players, and gets the games played by them.
 * By using that information, it returns the new games list, which are then published to the respective
 * ws.
 */
export function generateSwissRound({
  players,
  games,
  roundNumber,
  tournamentId,
}: RoundProps): GameModel[] {
  games = games?.filter((game) => game.round_number !== roundNumber) ?? [];

  // checking if the set of layers is even, if not, making it even with a smart alg
  const matchedEntities = players.map((player) =>
    convertPlayerToEntity(player, games),
  );

  const sortedEntities = getInitialOrdering(matchedEntities);

  // assign the pairing numbers accordig to order.
  sortedEntities.forEach(
    (matchedEntity, entityOrder) => (matchedEntity.pairingNumber = entityOrder),
  );

  const scoregroupsByScore = generateEntitiesByScore(sortedEntities);

  // Create array of [score, scoregroup] pairs for explicit sorting
  const scoregroupPairs = Array.from(scoregroupsByScore.entries());

  // Sort by score in descending order (highest score first) for top-down iteration
  const sortedScoregroupPairs = scoregroupPairs.sort(
    ([scoreA], [scoreB]) => scoreB - scoreA,
  );

  const currentMovedDownPlayers: ChessTournamentEntity[] = [];
  const roundOffset = games.length + 1;

  const gamesToInsert: GameModel[] = [];

  while (sortedScoregroupPairs.length > 0) {
    const shifted = sortedScoregroupPairs.shift();
    if (!shifted) break;
    const [score, scoregroup] = shifted;

    // Calculate bracket parameters
    const bracketParameters = getParameters(
      scoregroup,
      currentMovedDownPlayers,
    );

    // Construct original bracket groups
    const originalBracketGroups = constructBracketGroups(
      scoregroup,
      currentMovedDownPlayers,
      bracketParameters,
    );

    // Try different alterations, keeping track of the best valid pairing found
    const alterationsGenerator = generateAlterations(
      originalBracketGroups,
      bracketParameters,
    );

    // Track the best candidate that passes absolute criteria (C1-C4)
    let bestCandidate: EvaluatedPairingCandidate | null = null;

    let alterationResult = alterationsGenerator.next();
    while (!alterationResult.done) {
      const alteredBracketGroups = alterationResult.value;

      // Re-order bracket groups after alterations (preserves group membership)
      const orderedBracketGroups = reorderBracketGroups(alteredBracketGroups);

      // Convert BracketGroups to PairingCandidate using common entry point
      const candidatePairing = getPairing(
        orderedBracketGroups,
        bracketParameters,
      );

      // Create evaluation context
      const evaluationContext = {
        currentBracketScore: score,
        roundNumber,
        scoregroupsByScore: sortedScoregroupPairs,
      };

      // Evaluate absolute criteria (C1-C5) for this pairing candidate
      const absoluteEvaluation = evaluateAbsoluteCriteria(
        candidatePairing,
        evaluationContext,
      );

      // Check if all absolute criteria are satisfied
      if (
        absoluteEvaluation.c1UniqueOpponents &&
        absoluteEvaluation.c2UniquePAB &&
        absoluteEvaluation.c3ColourPreferenceSeparation &&
        absoluteEvaluation.c4PairingCompatibility
      ) {
        // Evaluate quality criteria (C6-C21)
        const qualityReport = evaluateQualityCriteria(
          candidatePairing,
          evaluationContext,
        );

        const currentCandidate: EvaluatedPairingCandidate = {
          candidate: candidatePairing,
          report: qualityReport,
        };

        // Keep this candidate if it's the first valid one or better than current best
        if (
          bestCandidate === null ||
          compareQualityReports(currentCandidate.report, bestCandidate.report) <
            0
        ) {
          bestCandidate = currentCandidate;
        }
      }

      alterationResult = alterationsGenerator.next();
    }

    if (bestCandidate === null) {
      // No valid pairing found that satisfies absolute criteria (C1-C4)
      const totalPlayers = scoregroup.length + currentMovedDownPlayers.length;
      const remainingBrackets = sortedScoregroupPairs.length;

      throw new Error(
        `Swiss pairing failed at round ${roundNumber} for scoregroup ${score}: ` +
          `No bracket alteration satisfies absolute criteria (C1-C4). ` +
          `Possible causes: (1) Tournament completion - all valid pairings exhausted, ` +
          `(2) Configuration issue - incompatible player pool, ` +
          `(3) Algorithm limitation. ` +
          `Diagnostic info: Total players in bracket: ${totalPlayers}, ` +
          `Downfloaters: ${currentMovedDownPlayers.length}, ` +
          `Remaining brackets: ${remainingBrackets}.`,
      );
    }

    // Use the best candidate found (best quality among those passing absolute criteria)
    const selectedPairing = bestCandidate.candidate;

    // Add downfloaters to moved down players for next bracket
    currentMovedDownPlayers.push(...selectedPairing.downfloaters);

    // Collect games from the best candidate
    const allPairs = [...selectedPairing.colouredPairs];

    for (const pair of allPairs) {
      const pairIndex = gamesToInsert.length;
      const numberedPair = getNumberedPair(pair, pairIndex, roundOffset);
      const game = getGameToInsert(numberedPair, tournamentId, roundNumber);
      gamesToInsert.push(game);
    }
  }

  return gamesToInsert;
}
