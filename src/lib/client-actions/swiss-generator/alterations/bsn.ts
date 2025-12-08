/**
 * BSN (Bracket Sequence Number) utilities for Swiss system pairing
 *
 * BSNs are used to track player positions within a bracket during alterations.
 * They provide a stable numbering scheme based on score and pairing number.
 */

import { ChessTournamentEntity } from '@/lib/client-actions/common-generator';
import {
  compareByPairingNumber,
  compareByScore,
} from '@/lib/client-actions/swiss-generator/ordering';
import type { BSNMaps } from '@/lib/client-actions/swiss-generator/types';

/**
 * Generates BSN (Bracket Sequence Numbers) for all players in the tournament
 * BSNs are used for tracking alterations/transpositions in Swiss system pairing
 * Sorts players by dual priority: score first, then initial pairing number
 * Creates bidirectional mapping for fast lookups in both directions
 * @param entities - Array of all tournament entities
 * @returns Object with both BSN to entity and entity to BSN maps
 */
export function generateBSNMaps(entities: ChessTournamentEntity[]): BSNMaps {
  const entityByBSN = new Map<number, ChessTournamentEntity>();
  const bsnByEntity = new Map<ChessTournamentEntity, number>();

  // Sort by dual priority: score first (descending), then pairing number (ascending)
  const sortedForBSN = entities
    .toSorted(compareByPairingNumber)
    .toSorted(compareByScore);

  sortedForBSN.forEach((entity, index) => {
    // BSN starts from 1, not 0
    const bsn = index + 1;
    entityByBSN.set(bsn, entity);
    bsnByEntity.set(entity, bsn);
  });

  return { entityByBSN, bsnByEntity };
}

/**
 * Converts a BSN to its corresponding entity
 * @param bsn - Bracket Sequence Number
 * @param entityByBSN - Map from BSN to entity
 * @returns Entity corresponding to the BSN
 * @throws Error if BSN not found in map
 */
export function convertBSNToEntity(
  bsn: number,
  entityByBSN: Map<number, ChessTournamentEntity>,
): ChessTournamentEntity {
  const entity = entityByBSN.get(bsn);

  // TODO: This undefined check is purely due to TypeScript limitations
  // Map.has() check doesn't provide type narrowing for Map.get()
  if (entity === undefined) {
    throw new Error(`Entity not found for BSN ${bsn}`);
  }

  return entity;
}

/**
 * Converts an entity to its corresponding BSN
 * @param entity - Chess tournament entity
 * @param bsnByEntity - Map from entity to BSN
 * @returns BSN corresponding to the entity
 * @throws Error if entity not found in map
 */
export function convertEntityToBSN(
  entity: ChessTournamentEntity,
  bsnByEntity: Map<ChessTournamentEntity, number>,
): number {
  const bsn = bsnByEntity.get(entity);

  // TODO: This undefined check is purely due to TypeScript limitations
  if (bsn === undefined) {
    throw new Error('BSN not found for entity');
  }

  return bsn;
}
