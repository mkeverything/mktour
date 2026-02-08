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
import { generateWeightedPairing } from '@/lib/client-actions/swiss-generator/weighted-pairing';
import {
  IS_PAIRING_DEBUG_ENABLED,
  pairingLogger,
} from '@/lib/client-actions/swiss-generator/pairing-logger';
import type {
  AlterationBracketInfo,
  AlterationGeneratorInfo,
  BracketGroupsInfo,
  PerfectQualityCheckInfo,
} from '@/lib/client-actions/swiss-generator/pairing-logger';
import {
  compareQualityReports,
  computeAllBracketIdeals,
  evaluateAbsoluteCriteria,
  evaluateQualityCriteria,
  isPerfectQuality,
} from '@/lib/client-actions/swiss-generator/quality-evaluation';
import {
  EvaluatedPairingCandidate,
  isHeteroBracket,
} from '@/lib/client-actions/swiss-generator/types';
import { GameModel } from '@/server/db/zod/tournaments';
import { SwissPlayerModel } from '@/lib/client-actions/swiss-generator/types';

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
  games = games?.filter((game) => game.roundNumber !== roundNumber) ?? [];

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

  // Log round start
  if (IS_PAIRING_DEBUG_ENABLED) {
    const formatScoregroupSummary = ([score, sg]: [
      number,
      ChessTournamentEntity[],
    ]) => ({
      score,
      count: sg.length,
    });
    const scoregroupSummaries = sortedScoregroupPairs.map(
      formatScoregroupSummary,
    );

    const roundStartInfo = {
      playerCount: sortedEntities.length,
      scoregroupCount: sortedScoregroupPairs.length,
      scoregroups: scoregroupSummaries,
    };

    pairingLogger
      .withMetadata(roundStartInfo)
      .debug(`Round ${roundNumber} start`);
  }

  let currentMovedDownPlayers: ChessTournamentEntity[] = [];
  const roundOffset = games.length + 1;

  const gamesToInsert: GameModel[] = [];

  while (sortedScoregroupPairs.length > 0) {
    const shifted = sortedScoregroupPairs.shift();
    if (!shifted) break;
    const [score, scoregroup] = shifted;

    // Calculate base bracket parameters (theoretical maximum)
    const baseParameters = getParameters(scoregroup, currentMovedDownPlayers);
    const calculatedMaxPairs = baseParameters.maxPairs;

    // Log bracket processing start
    if (IS_PAIRING_DEBUG_ENABLED) {
      const isLowestBracket = sortedScoregroupPairs.length === 0;

      const bracketProcessingInfo = {
        score,
        residentCount: scoregroup.length,
        mdpCount: currentMovedDownPlayers.length,
        maxPairs: calculatedMaxPairs,
        isLowestBracket,
      };

      pairingLogger
        .withMetadata(bracketProcessingInfo)
        .debug('Processing bracket');
    }

    // Track the best candidate that passes absolute criteria (C1-C4)
    let bestCandidate: EvaluatedPairingCandidate | null = null;

    // FIDE Article 3.1.2: MaxPairs can be reduced when no valid pairing exists
    // In lowest bracket: no reduction allowed (only 1 PAB permitted)
    // In other brackets: reduce until valid pairing found or 0 pairs
    const isLowestBracket = sortedScoregroupPairs.length === 0;
    const minTargetPairs = isLowestBracket ? calculatedMaxPairs : 0;

    let targetPairs = calculatedMaxPairs;
    let foundValidPairing = false;

    // Try progressively fewer pairs until valid pairing found
    while (!foundValidPairing && targetPairs >= minTargetPairs) {
      // Adjust parameters for current targetPairs
      const bracketParameters = {
        ...baseParameters,
        maxPairs: targetPairs,
        mdpPairingsCount: Math.min(baseParameters.mdpCount, targetPairs),
      };

      // Construct bracket groups with adjusted parameters
      const originalBracketGroups = constructBracketGroups(
        scoregroup,
        currentMovedDownPlayers,
        bracketParameters,
      );

      // Log bracket groups
      if (IS_PAIRING_DEBUG_ENABLED) {
        const getPairingNumbers = (entities: ChessTournamentEntity[]) =>
          entities.map((entity) => entity.pairingNumber);

        const bracketGroupsInfo: BracketGroupsInfo = {
          targetPairs,
          S1: getPairingNumbers(originalBracketGroups.S1),
          S2: getPairingNumbers(originalBracketGroups.S2),
        };

        if (isHeteroBracket(originalBracketGroups)) {
          bracketGroupsInfo.S1R = getPairingNumbers(originalBracketGroups.S1R);
          bracketGroupsInfo.S2R = getPairingNumbers(originalBracketGroups.S2R);
          bracketGroupsInfo.Limbo = getPairingNumbers(
            originalBracketGroups.Limbo,
          );
        }

        pairingLogger
          .withMetadata(bracketGroupsInfo)
          .debug('Bracket groups formed');
      }

      // Try different alterations at current targetPairs level
      const alterationsGenerator = generateAlterations(
        originalBracketGroups,
        bracketParameters,
      );

      // Compute ideal values cache for this bracket (for isPerfectQuality check)
      const bracketPlayers = scoregroup.concat(currentMovedDownPlayers);
      const bracketContext = {
        currentBracketScore: score,
        roundNumber,
        scoregroupsByScore: sortedScoregroupPairs,
      };
      const idealsCache = computeAllBracketIdeals(
        bracketPlayers,
        bracketContext,
      );

      // Debug: track alteration count
      let alterationCount = 0;

      // Flag to stop searching when perfect pairing found
      let foundPerfectPairing = false;

      let alterationResult = alterationsGenerator.next();
      while (!alterationResult.done && !foundPerfectPairing) {
        alterationCount++;

        const alteredBracketGroups = alterationResult.value;

        // Re-order bracket groups after alterations (preserves group membership)
        const orderedBracketGroups = reorderBracketGroups(alteredBracketGroups);

        // Log all bracket groups for this alteration
        if (IS_PAIRING_DEBUG_ENABLED) {
          const extractPairingNumber = (
            entity: ChessTournamentEntity,
          ): number => entity.pairingNumber;

          const alterationBracketInfo: AlterationBracketInfo = {
            s1PairingNumbers: orderedBracketGroups.S1.map(extractPairingNumber),
            s2PairingNumbers: orderedBracketGroups.S2.map(extractPairingNumber),
            alterationNumber: alterationCount,
          };

          if (isHeteroBracket(orderedBracketGroups)) {
            alterationBracketInfo.s1rPairingNumbers =
              orderedBracketGroups.S1R.map(extractPairingNumber);
            alterationBracketInfo.s2rPairingNumbers =
              orderedBracketGroups.S2R.map(extractPairingNumber);
          }

          pairingLogger
            .withMetadata(alterationBracketInfo)
            .debug('Alteration bracket');
        }

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

        // Evaluate absolute criteria (C1-C4) for this pairing candidate
        const absoluteEvaluation = evaluateAbsoluteCriteria(
          candidatePairing,
          evaluationContext,
        );

        // Check if all absolute criteria are satisfied
        const satisfiesAbsoluteCriteria =
          absoluteEvaluation.c1UniqueOpponents &&
          absoluteEvaluation.c2UniquePAB &&
          absoluteEvaluation.c3ColourPreferenceSeparation &&
          absoluteEvaluation.c4PairingCompatibility;

        // Log criteria evaluation result
        if (IS_PAIRING_DEBUG_ENABLED) {
          const criteriaResultInfo = {
            alterationNumber: alterationCount,
            c1Passed: absoluteEvaluation.c1UniqueOpponents,
            c2Passed: absoluteEvaluation.c2UniquePAB,
            c3Passed: absoluteEvaluation.c3ColourPreferenceSeparation,
            c4Passed: absoluteEvaluation.c4PairingCompatibility,
            allPassed: satisfiesAbsoluteCriteria,
          };

          pairingLogger
            .withMetadata(criteriaResultInfo)
            .debug('Alteration evaluated');
        }

        if (satisfiesAbsoluteCriteria) {
          foundValidPairing = true;

          if (IS_PAIRING_DEBUG_ENABLED) {
            pairingLogger.debug('Evaluating quality criteria');
          }

          // Evaluate quality criteria (C5-C21)
          const qualityReport = evaluateQualityCriteria(
            candidatePairing,
            evaluationContext,
          );

          if (IS_PAIRING_DEBUG_ENABLED) {
            pairingLogger.debug('Quality criteria evaluated');
          }

          const currentCandidate: EvaluatedPairingCandidate = {
            candidate: candidatePairing,
            report: qualityReport,
          };

          // Keep this candidate if it's the first valid one or better than current best
          const isFirstValidCandidate = bestCandidate === null;
          const isBetterThanCurrent =
            bestCandidate !== null &&
            compareQualityReports(
              currentCandidate.report,
              bestCandidate.report,
            ) < 0;

          if (isFirstValidCandidate || isBetterThanCurrent) {
            bestCandidate = currentCandidate;

            if (IS_PAIRING_DEBUG_ENABLED) {
              pairingLogger.debug('Checking perfect quality');
            }

            // Early termination: if this pairing has perfect quality, stop searching
            if (isPerfectQuality(qualityReport, idealsCache)) {
              foundPerfectPairing = true;
            }

            if (IS_PAIRING_DEBUG_ENABLED) {
              const perfectQualityCheckInfo: PerfectQualityCheckInfo = {
                foundPerfectPairing,
              };
              pairingLogger
                .withMetadata(perfectQualityCheckInfo)
                .debug('Perfect quality check complete');
            }
          }
        }

        if (IS_PAIRING_DEBUG_ENABLED) {
          pairingLogger.debug('Getting next alteration');
        }

        alterationResult = alterationsGenerator.next();

        if (IS_PAIRING_DEBUG_ENABLED) {
          const alterationGeneratorInfo: AlterationGeneratorInfo = {
            alterationDone: alterationResult.done ?? false,
          };
          pairingLogger
            .withMetadata(alterationGeneratorInfo)
            .debug('Next alteration retrieved');
        }
      }

      // No valid pairing at current targetPairs, try with fewer pairs
      if (!foundValidPairing) {
        if (IS_PAIRING_DEBUG_ENABLED) {
          pairingLogger
            .withMetadata({ targetPairs, nextTargetPairs: targetPairs - 1 })
            .debug('Reducing targetPairs');
        }
        targetPairs--;
      }
    }

    if (bestCandidate === null) {
      // No valid pairing found after trying all alterations
      const totalPlayers = scoregroup.length + currentMovedDownPlayers.length;
      const remainingBrackets = sortedScoregroupPairs.length;

      // Log failure before throwing
      if (IS_PAIRING_DEBUG_ENABLED) {
        const failureInfo = {
          score,
          totalPlayers,
          remainingBrackets,
        };

        pairingLogger.withMetadata(failureInfo).debug('Pairing failed');
      }

      throw new Error(
        `Swiss pairing failed at round ${roundNumber} for scoregroup ${score}: ` +
          `No valid pairing found after trying all alterations. ` +
          `Diagnostic info: Total players: ${totalPlayers}, ` +
          `Remaining brackets: ${remainingBrackets}.`,
      );
    }

    // Use the best candidate found (best quality among those passing absolute criteria)
    const selectedPairing = bestCandidate.candidate;

    // Log selected pairing
    if (IS_PAIRING_DEBUG_ENABLED) {
      const getPairingNumber = (entity: ChessTournamentEntity) =>
        entity.pairingNumber;
      const downfloaterPairingNumbers =
        selectedPairing.downfloaters.map(getPairingNumber);

      const selectedPairingInfo = {
        score,
        pairCount: selectedPairing.colouredPairs.length,
        downfloaterCount: selectedPairing.downfloaters.length,
        downfloaterPairingNumbers,
      };

      pairingLogger.withMetadata(selectedPairingInfo).debug('Pairing selected');
    }

    // Set downfloaters as MDPs for next bracket
    currentMovedDownPlayers = selectedPairing.downfloaters;

    // Collect games from the best candidate
    const allPairs = [...selectedPairing.colouredPairs];

    for (const pair of allPairs) {
      const pairIndex = gamesToInsert.length;
      const numberedPair = getNumberedPair(pair, pairIndex, roundOffset);
      const game = getGameToInsert(numberedPair, tournamentId, roundNumber);
      gamesToInsert.push(game);
    }
  }

  // Log round completion
  if (IS_PAIRING_DEBUG_ENABLED) {
    const roundCompletionInfo = {
      roundNumber,
      gamesGenerated: gamesToInsert.length,
    };

    pairingLogger
      .withMetadata(roundCompletionInfo)
      .debug('Round generation complete');
  }

  return gamesToInsert;
}

/**
 * Generates Swiss round using weighted maximum matching (Blossom algorithm).
 *
 * This alternative implementation finds globally optimal pairings by encoding
 * all FIDE criteria as edge weights and solving maximum weight matching.
 * Unlike the bracket-by-bracket approach, this considers all players simultaneously.
 *
 * @param props - Round generation properties
 * @returns Array of games for the round
 */
export function generateWeightedSwissRound({
  players,
  games,
  roundNumber,
  tournamentId,
}: RoundProps): GameModel[] {
  // Filter out any games from the current round (in case of re-generation)
  const filteredGames =
    games?.filter((game) => game.roundNumber !== roundNumber) ?? [];

  // Convert player models to chess tournament entities with history
  const convertPlayer = (player: SwissPlayerModel): ChessTournamentEntity =>
    convertPlayerToEntity(player, filteredGames);
  const matchedEntities = players.map(convertPlayer);

  // Sort entities by initial ordering rules (score, then tiebreakers)
  const sortedEntities = getInitialOrdering(matchedEntities);

  // Assign pairing numbers according to initial order
  const assignPairingNumber = (
    entity: ChessTournamentEntity,
    index: number,
  ): void => {
    entity.pairingNumber = index;
  };
  sortedEntities.forEach(assignPairingNumber);

  // Log round start for weighted pairing
  if (IS_PAIRING_DEBUG_ENABLED) {
    const weightedRoundStartInfo = {
      algorithm: 'weighted-blossom',
      playerCount: sortedEntities.length,
      roundNumber,
    };

    pairingLogger
      .withMetadata(weightedRoundStartInfo)
      .debug(`Weighted round ${roundNumber} start`);
  }

  // Generate pairings using weighted maximum matching
  const colouredPairs = generateWeightedPairing(sortedEntities, roundNumber);

  // Log pairing result
  if (IS_PAIRING_DEBUG_ENABLED) {
    const pairingResultInfo = {
      pairCount: colouredPairs.length,
    };

    pairingLogger
      .withMetadata(pairingResultInfo)
      .debug('Weighted pairing complete');
  }

  // Convert coloured pairs to game models
  const roundOffset = filteredGames.length + 1;
  const gamesToInsert: GameModel[] = [];

  for (const pair of colouredPairs) {
    const pairIndex = gamesToInsert.length;
    const numberedPair = getNumberedPair(pair, pairIndex, roundOffset);
    const game = getGameToInsert(numberedPair, tournamentId, roundNumber);
    gamesToInsert.push(game);
  }

  // Log round completion
  if (IS_PAIRING_DEBUG_ENABLED) {
    const roundCompletionInfo = {
      roundNumber,
      gamesGenerated: gamesToInsert.length,
      algorithm: 'weighted-blossom',
    };

    pairingLogger
      .withMetadata(roundCompletionInfo)
      .debug('Weighted round generation complete');
  }

  return gamesToInsert;
}
