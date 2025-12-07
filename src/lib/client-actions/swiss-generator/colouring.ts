import {
  ChessColour,
  ChessTournamentEntity,
  ColouredEntitiesPair,
  EntitiesPair,
} from '@/lib/client-actions/common-generator';
import { compareGamesByRound } from './ordering';

/**
 * Attempts to create a coloured pair based on alternating from last different colour round
 * @param firstEntity - First player entity
 * @param secondEntity - Second player entity
 * @returns Coloured pair with alternated colours, or null if no different colour history found
 */
function tryAlternateFromLastDifferentColours(
  firstEntity: ChessTournamentEntity,
  secondEntity: ChessTournamentEntity,
): ColouredEntitiesPair | null {
  // Sort both players' game histories by round number for parallel iteration
  const firstEntityGames =
    firstEntity.previousGames.toSorted(compareGamesByRound);
  const secondEntityGames =
    secondEntity.previousGames.toSorted(compareGamesByRound);

  // Iterate through both arrays simultaneously until one is exhausted
  const minLength = Math.min(firstEntityGames.length, secondEntityGames.length);
  let alternatedPair: ColouredEntitiesPair | null = null;

  for (let i = 0; i < minLength; i++) {
    const firstGame = firstEntityGames[i];
    const secondGame = secondEntityGames[i];

    // Determine what colour each entity played in this round
    const firstEntityWasWhite = firstGame.white_id === firstEntity.entityId;
    const secondEntityWasWhite = secondGame.white_id === secondEntity.entityId;

    // Check if they played different colours in this round
    if (firstEntityWasWhite !== secondEntityWasWhite) {
      // Apply alternation: assign opposite colours from last different-colour round
      if (firstEntityWasWhite) {
        // First entity was white before, so now gets black
        alternatedPair = {
          whiteEntity: secondEntity,
          blackEntity: firstEntity,
        };
      } else {
        // First entity was black before, so now gets white
        alternatedPair = {
          whiteEntity: firstEntity,
          blackEntity: secondEntity,
        };
      }
    }
    // Continue loop to find the MOST RECENT round where they had different colours
  }

  return alternatedPair;
}

/**
 * Gets the initial colour an entity played in their first game
 * @param entity - Chess tournament entity with previous games
 * @returns ChessColour indicating what colour the entity played first
 * @throws Error if entity has no previous games
 */
function getEntityInitialColour(entity: ChessTournamentEntity): ChessColour {
  if (entity.previousGames.length === 0) {
    throw new Error('Entity has no previous games to determine initial colour');
  }

  const sortedGames = entity.previousGames.toSorted(compareGamesByRound);
  const firstGame = sortedGames[0];

  return firstGame.white_id === entity.entityId
    ? ChessColour.White
    : ChessColour.Black;
}

/**
 * Interface for ranked entities pair (needed for colouring routines!)
 */
interface RankedEntities {
  higherRankedEntity: ChessTournamentEntity;
  lowerRankedEntity: ChessTournamentEntity;
}

/**
 * Gets the higher and lower ranked entities from a pair
 * @param firstEntity - First player entity
 * @param secondEntity - Second player entity
 * @returns Object with higher and lower ranked entities
 */
function getRankedEntities(
  firstEntity: ChessTournamentEntity,
  secondEntity: ChessTournamentEntity,
): RankedEntities {
  if (firstEntity.entityRating > secondEntity.entityRating) {
    return { higherRankedEntity: firstEntity, lowerRankedEntity: secondEntity };
  } else {
    return { higherRankedEntity: secondEntity, lowerRankedEntity: firstEntity };
  }
}

/**
 * Assigns colours based on highest ranked player's colour preference
 * @param rankedEntities - Higher and lower ranked entities
 * @returns Coloured pair with highest ranked player getting their preferred colour
 */
function assignColourByPreference(
  rankedEntities: RankedEntities,
): ColouredEntitiesPair {
  const { higherRankedEntity, lowerRankedEntity } = rankedEntities;

  // Give highest ranked player their colour preference
  // Negative colour index means prefers white, positive means prefers black
  if (higherRankedEntity.colourIndex <= 0) {
    // Higher ranked player prefers white (or neutral)
    return { whiteEntity: higherRankedEntity, blackEntity: lowerRankedEntity };
  } else {
    // Higher ranked player prefers black
    return { whiteEntity: lowerRankedEntity, blackEntity: higherRankedEntity };
  }
}

/**
 * Assigns colours based on initial colour rule for highest ranked player
 * If highest ranked player has odd pairing number, they get their initial colour
 * Otherwise they get opposite to their initial colour
 * @param rankedEntities - Higher and lower ranked entities
 * @returns Coloured pair based on initial colour rule
 */
function assignColourByInitialRule(
  rankedEntities: RankedEntities,
): ColouredEntitiesPair {
  const { higherRankedEntity, lowerRankedEntity } = rankedEntities;
  const higherInitialColour = getEntityInitialColour(higherRankedEntity);
  const hasOddPairingNumber = higherRankedEntity.pairingNumber % 2 === 1;

  if (hasOddPairingNumber) {
    // Odd pairing number: give initial colour
    if (higherInitialColour === ChessColour.White) {
      return {
        whiteEntity: higherRankedEntity,
        blackEntity: lowerRankedEntity,
      };
    } else {
      return {
        whiteEntity: lowerRankedEntity,
        blackEntity: higherRankedEntity,
      };
    }
  } else {
    // Even pairing number: give opposite to initial colour
    if (higherInitialColour === ChessColour.White) {
      return {
        whiteEntity: lowerRankedEntity,
        blackEntity: higherRankedEntity,
      };
    } else {
      return {
        whiteEntity: higherRankedEntity,
        blackEntity: lowerRankedEntity,
      };
    }
  }
}

/**
 * Swiss system colour allocation function following FIDE rules
 * Implements the complete colour assignment logic according to FIDE Dutch system:
 * 1. Different colour indices: player with smaller index gets white
 * 2. Equal colour indices: try to alternate based on last round they had different colours
 * 3. If no alternation possible and higher ranked player has colour preference: give preference
 * 4. If no alternation possible and higher ranked player neutral: use initial colour rule
 * @param uncolouredPair - Pair of entities to assign colours to
 * @returns ColouredEntitiesPair with white/black assignment
 */
export function getSwissColouredPair(
  uncolouredPair: EntitiesPair,
): ColouredEntitiesPair {
  let colouredPair: ColouredEntitiesPair;
  const [firstEntity, secondEntity] = uncolouredPair;

  if (firstEntity.colourIndex != secondEntity.colourIndex) {
    // Different colour indices: player with higher colour index (more colour imbalance) gets black
    // This helps balance colour distribution across the tournament
    if (firstEntity.colourIndex < secondEntity.colourIndex) {
      colouredPair = { whiteEntity: firstEntity, blackEntity: secondEntity };
    } else {
      colouredPair = { whiteEntity: secondEntity, blackEntity: firstEntity };
    }
  } else {
    // Equal colour indices: apply FIDE rule for alternating based on game history
    // Find last round where these players had different colours and assign opposite colours
    const alternatedPair = tryAlternateFromLastDifferentColours(
      firstEntity,
      secondEntity,
    );

    if (alternatedPair) {
      // History found: use alternated colour assignment
      colouredPair = alternatedPair;
    } else {
      // No alternation possible: use ranking-based rules
      const rankedEntities = getRankedEntities(firstEntity, secondEntity);

      if (rankedEntities.higherRankedEntity.colourIndex !== 0) {
        // Higher ranked player has colour preference: use preference rule (FIDE rule 4)
        colouredPair = assignColourByPreference(rankedEntities);
      } else {
        // Higher ranked player has neutral colour preference: use initial colour rule (FIDE rule 5)
        colouredPair = assignColourByInitialRule(rankedEntities);
      }
    }
  }

  return colouredPair;
}
