import { ChessTournamentEntity } from '@/lib/client-actions/common-generator';
import { GameModel } from '@/types/tournaments';

/**
 * Generic numeric comparison for sorting (ascending order - lower values first)
 *
 * WHY: Centralised numeric comparison avoids code duplication and provides
 * consistent comparison semantics across the Swiss generator system.
 *
 * @param firstValue - First numeric value
 * @param secondValue - Second numeric value
 * @returns negative if firstValue < secondValue, positive if firstValue > secondValue, 0 if equal
 */
export function compareNumeric(
  firstValue: number,
  secondValue: number,
): number {
  return firstValue - secondValue;
}

/**
 * Compares two games by round number for sorting (ascending order)
 * @param firstGame - First game
 * @param secondGame - Second game
 * @returns Comparison result for sorting
 */
export function compareGamesByRound(
  firstGame: GameModel,
  secondGame: GameModel,
): number {
  return compareNumeric(firstGame.round_number, secondGame.round_number);
}

/**
 * Compares two entities by their pairing number (ascending order)
 * @param firstEntity - First entity
 * @param secondEntity - Second entity
 * @returns Comparison result for sorting
 */
export function compareByPairingNumber(
  firstEntity: ChessTournamentEntity,
  secondEntity: ChessTournamentEntity,
): number {
  return compareNumeric(firstEntity.pairingNumber, secondEntity.pairingNumber);
}

/**
 * Compares two entities by their score (descending order - higher score first)
 *
 * WHY: Descending order needed for FIDE Swiss pairing where higher scores pair first.
 *
 * @param firstEntity - First entity
 * @param secondEntity - Second entity
 * @returns Comparison result for sorting
 */
export function compareByScore(
  firstEntity: ChessTournamentEntity,
  secondEntity: ChessTournamentEntity,
): number {
  // Note: Reversed order (secondEntity - firstEntity) for descending sort
  return compareNumeric(secondEntity.entityScore, firstEntity.entityScore);
}
/**
 * This function gets a list of entities as an input, and then prepares the ordering by FIDE dutch system rules
 *
 * WHY: FIDE requires stable multi-key sorting - primary by rating, then by title, then by name.
 * We use toSorted() to preserve immutability and apply sorts in reverse priority order.
 *
 * @param matchedEntities listlike of chess entities with the nickname, title, and rating set
 * @returns an ordered list of entities
 */
export function getInitialOrdering(matchedEntities: ChessTournamentEntity[]) {
  const nameSortedEntities = matchedEntities.toSorted(
    (firstPlayer, secondPlayer) =>
      firstPlayer.entityNickname.localeCompare(secondPlayer.entityNickname),
  );

  const titleSortedEntities = nameSortedEntities.toSorted(
    (firstPlayer, secondPlayer) =>
      compareNumeric(firstPlayer.entityTitle, secondPlayer.entityTitle),
  );

  const rankingSortedEntities = titleSortedEntities.toSorted(
    (firstPlayer, secondPlayer) =>
      compareNumeric(firstPlayer.entityRating, secondPlayer.entityRating),
  );

  return rankingSortedEntities;
}
