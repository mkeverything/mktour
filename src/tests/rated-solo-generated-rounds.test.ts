import { describe, expect, it } from 'bun:test';

import {
  convertUnitToEntity,
  getGameToInsert,
  getNumberedPair,
} from '@/lib/pairing-generators/common-generator';
import type { UnitModel } from '@/server/zod/tournaments';

const now = new Date('2025-01-01T00:00:00.000Z');

function createSoloUnit(side: string): UnitModel {
  const playerId = `${side}-player-id`;
  return {
    id: `${side}-unit-id`,
    size: 1,
    unitNickname: `${side} player`,
    addedAt: now,
    number: side === 'white' ? 1 : 2,
    colorIndex: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    place: null,
    isOut: null,
    players: [
      {
        id: playerId,
        nickname: `${side} player`,
        realname: null,
        rating: 1500,
        userId: null,
        username: null,
      },
    ],
  };
}

describe('rated solo generated rounds', () => {
  it('fills exact player ids for generated solo games', () => {
    const whiteUnit = createSoloUnit('white');
    const blackUnit = createSoloUnit('black');
    const whiteEntity = convertUnitToEntity(whiteUnit, []);
    const blackEntity = convertUnitToEntity(blackUnit, []);

    const numberedPair = getNumberedPair({ whiteEntity, blackEntity }, 1, 0);
    const gameToSave = getGameToInsert(numberedPair, 'tournament-id', 1);

    expect(gameToSave.whitePlayerId).toBe(whiteUnit.players[0]?.id);
    expect(gameToSave.blackPlayerId).toBe(blackUnit.players[0]?.id);
  });
});
