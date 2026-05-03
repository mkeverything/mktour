import {
  getWithdrawalForfeitResult,
  settlePendingGamesAsForfeit,
  shouldForfeitForWithdrawal,
} from '@/lib/utils';
import type { GameModel } from '@/server/zod/tournaments';
import { describe, expect, it } from 'bun:test';

const WHITE_PLAYER_ID = 'p-white';
const BLACK_PLAYER_ID = 'p-black';
const THIRD_PLAYER_ID = 'p-third';
const UNRELATED_PLAYER_ID = 'p-unrelated';

const FIRST_GAME_ID = 'game-1';
const SECOND_GAME_ID = 'game-2';

const PRE_EXISTING_FINISHED_AT = new Date('2025-01-01T00:00:00.000Z');

function makeGame(overrides: Partial<GameModel> = {}): GameModel {
  return {
    id: FIRST_GAME_ID,
    tournamentId: 'tournament-1',
    whiteId: WHITE_PLAYER_ID,
    blackId: BLACK_PLAYER_ID,
    whiteNickname: 'White',
    blackNickname: 'Black',
    gameNumber: 1,
    roundNumber: 1,
    roundName: null,
    whitePrevGameId: null,
    blackPrevGameId: null,
    result: null,
    finishedAt: null,
    pairMembers: null,
    ...overrides,
  };
}

describe('getWithdrawalForfeitResult', () => {
  it('returns 0-1 when the withdrawn player is white (black opponent wins)', () => {
    expect(getWithdrawalForfeitResult(makeGame(), WHITE_PLAYER_ID)).toBe('0-1');
  });

  it('returns 1-0 when the withdrawn player is black (white opponent wins)', () => {
    expect(getWithdrawalForfeitResult(makeGame(), BLACK_PLAYER_ID)).toBe('1-0');
  });
});

describe('shouldForfeitForWithdrawal', () => {
  it('returns true for a pending game involving the withdrawn player', () => {
    const pendingGame = makeGame();
    expect(shouldForfeitForWithdrawal(pendingGame, WHITE_PLAYER_ID)).toBe(true);
    expect(shouldForfeitForWithdrawal(pendingGame, BLACK_PLAYER_ID)).toBe(true);
  });

  it('returns false for an already-decided game (result must be preserved)', () => {
    const decidedGame = makeGame({ result: '1-0' });
    expect(shouldForfeitForWithdrawal(decidedGame, WHITE_PLAYER_ID)).toBe(
      false,
    );
    expect(shouldForfeitForWithdrawal(decidedGame, BLACK_PLAYER_ID)).toBe(
      false,
    );
  });

  it('returns false for a pending game not involving the withdrawn player', () => {
    expect(shouldForfeitForWithdrawal(makeGame(), UNRELATED_PLAYER_ID)).toBe(
      false,
    );
  });
});

describe('settlePendingGamesAsForfeit', () => {
  it('records forfeit results for all pending games involving the withdrawn player', () => {
    const games = [
      makeGame({ id: FIRST_GAME_ID }),
      makeGame({
        id: SECOND_GAME_ID,
        whiteId: BLACK_PLAYER_ID,
        blackId: THIRD_PLAYER_ID,
      }),
    ];

    const settled = settlePendingGamesAsForfeit(games, BLACK_PLAYER_ID);

    expect(settled[0].result).toBe('1-0');
    expect(settled[1].result).toBe('0-1');
    expect(settled[0].finishedAt).toBeInstanceOf(Date);
    expect(settled[1].finishedAt).toBeInstanceOf(Date);
  });

  it('leaves already-decided games untouched (FIDE C.04.3 §6.4: only pending games are forfeited)', () => {
    const decidedGame = makeGame({
      result: '1/2-1/2',
      finishedAt: PRE_EXISTING_FINISHED_AT,
    });

    const [settled] = settlePendingGamesAsForfeit(
      [decidedGame],
      WHITE_PLAYER_ID,
    );

    expect(settled.result).toBe('1/2-1/2');
    expect(settled.finishedAt).toEqual(PRE_EXISTING_FINISHED_AT);
  });

  it('leaves games without the withdrawn player untouched', () => {
    const otherGame = makeGame({
      whiteId: THIRD_PLAYER_ID,
      blackId: UNRELATED_PLAYER_ID,
    });

    const [settled] = settlePendingGamesAsForfeit([otherGame], WHITE_PLAYER_ID);

    expect(settled.result).toBeNull();
    expect(settled.finishedAt).toBeNull();
  });

  it('does not mutate the input array (pure function contract)', () => {
    const pendingGame = makeGame();
    settlePendingGamesAsForfeit([pendingGame], WHITE_PLAYER_ID);
    expect(pendingGame.result).toBeNull();
    expect(pendingGame.finishedAt).toBeNull();
  });
});
