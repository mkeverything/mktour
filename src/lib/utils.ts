/* eslint-disable */
// FIXME eslint
import type { GameResult } from '@/server/zod/enums';
import { GameModel } from '@/server/zod/tournaments';
import { ClassValue, clsx } from 'clsx';
import { Clock, icons } from 'lucide-react';
import { customAlphabet } from 'nanoid';
import { FC } from 'react';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function timeout(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const newid = customAlphabet(
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  8,
);

export function shallowEqual(
  object1: { [key: string]: string | number | boolean | undefined | null },
  object2: { [key: string]: string | number | boolean | undefined | null },
) {
  const keys1 = Object.keys(object1);
  const keys2 = Object.keys(object2);

  if (keys1.length !== keys2.length) {
    return false;
  }

  for (const key of keys1) {
    if (object1[key] !== object2[key]) {
      return false;
    }
  }
  return true;
}

export function selectRef(ref: HTMLDivElement) {
  if (!ref) return;
  ref.ontouchstart = (e) => {
    const targetElement = e.target as HTMLElement;
    const isRemoveSelectionButton =
      targetElement.id === 'removeSelection' ||
      targetElement.closest('#removeSelection');

    if (!isRemoveSelectionButton) {
      e.preventDefault();
    }
  };
}

export function shuffle<T>(array: T[]): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
/**
 * Creates a debounced function that delays invoking the provided function
 * until after 'wait' milliseconds have elapsed since the last time it was invoked.
 *
 * @param func - The function to debounce
 * @param wait - The number of milliseconds to delay
 * @param immediate - If true, trigger the function on the leading edge instead of the trailing edge
 * @returns A debounced version of the provided function
 */
export function debounce<T extends (..._args: any[]) => any>(
  func: T,
  wait: number,
  immediate = false,
): (..._args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function (this: any, ...args: Parameters<T>): void {
    const context = this;

    const later = function () {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };

    const callNow = immediate && !timeout;

    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(later, wait);

    if (callNow) func.apply(context, args);
  };
}

export const getClockIcon = (time: Date | null | undefined): FC => {
  if (!time) return Clock;

  let hour = time.getHours();
  const minutes = time.getMinutes();
  if (minutes >= 30) {
    hour = hour + 1;
  }
  hour = hour % 12;
  const clockIcon = `Clock${hour === 0 ? '12' : hour}` as keyof typeof icons;

  return icons[clockIcon];
};

export function getSwissRecommendedRoundsNumber(players: number): number {
  if (players < 2) return 1;
  if (players === 2) return 1;
  if (players < 7) return Math.floor(Math.log2(players - 1)) + 2;
  return Math.floor(Math.log2(players - 1)) + 3;
}

export function getSwissMaxRoundsNumber(players: number): number {
  if (players <= 4) return Math.max(1, players - 1);
  return Math.max(1, players % 2 === 0 ? players - 3 : players - 2);
}

/**
 * Forfeit results for player withdrawal.
 *
 * Per FIDE Swiss C.04.3 Article 6.4: a player who withdraws mid-tournament
 * forfeits all remaining games — their opponent wins.
 */
const FORFEIT_RESULT_WHEN_WITHDRAWN_IS_WHITE: GameResult = '0-1';
const FORFEIT_RESULT_WHEN_WITHDRAWN_IS_BLACK: GameResult = '1-0';

/**
 * Forfeit result for a pending game where one side withdrew.
 * Caller must ensure the withdrawn player is in the game.
 */
export function getWithdrawalForfeitResult(
  game: GameModel,
  withdrawnPlayerId: string,
): GameResult {
  const isWithdrawnWhite = game.whiteId === withdrawnPlayerId;
  if (isWithdrawnWhite) {
    return FORFEIT_RESULT_WHEN_WITHDRAWN_IS_WHITE;
  } else {
    return FORFEIT_RESULT_WHEN_WITHDRAWN_IS_BLACK;
  }
}

/**
 * Whether a pending game should be forfeited because one side withdrew.
 *
 * Games with a result are already decided and left untouched.
 * Games not involving the withdrawn player are unaffected.
 */
export function shouldForfeitForWithdrawal(
  game: GameModel,
  withdrawnPlayerId: string,
): boolean {
  const hasResult = game.result !== null;
  const hasWithdrawnPlayer =
    game.whiteId === withdrawnPlayerId || game.blackId === withdrawnPlayerId;
  return !hasResult && hasWithdrawnPlayer;
}

/**
 * Converts a single game to a forfeit if the withdrawn player is in it.
 *
 * Pure — does not mutate the input. Games that are already decided, or that
 * don't involve the withdrawn player, pass through unchanged.
 */
function forfeitGameIfNeeded(
  game: GameModel,
  withdrawnPlayerId: string,
): GameModel {
  // Already-decided games and games not involving the withdrawn player
  // must be left alone — this is what makes the outer map a safe pass-through.
  const shouldForfeit = shouldForfeitForWithdrawal(game, withdrawnPlayerId);

  if (shouldForfeit) {
    // Forfeit: opponent wins, timestamp set to now (matches setTournamentGameResult).
    const forfeitResult = getWithdrawalForfeitResult(game, withdrawnPlayerId);
    const finishedAt = new Date();
    const forfeitedGame: GameModel = {
      ...game,
      result: forfeitResult,
      finishedAt,
    };
    return forfeitedGame;
  } else {
    return game;
  }
}

/**
 * Applies withdrawal forfeits across a list of games.
 *
 * Pending games involving the withdrawn player become forfeit losses (opponent
 * wins). All other games pass through unchanged. Pure function — returns a new
 * array without mutating the input.
 *
 * Called from both sides: server-side inside the withdrawPlayer transaction to
 * persist forfeits, and client-side as the optimistic cache update so the
 * server and client agree on what happened while the mutation is in flight.
 */
export function settlePendingGamesAsForfeit(
  games: GameModel[],
  withdrawnPlayerId: string,
): GameModel[] {
  const settleGame = (game: GameModel): GameModel =>
    forfeitGameIfNeeded(game, withdrawnPlayerId);
  return games.map(settleGame);
}
