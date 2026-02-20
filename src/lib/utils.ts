/* eslint-disable */
// FIXME eslint
import { ClassValue, clsx } from 'clsx';
import { customAlphabet } from 'nanoid';
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
  object1: { [key: string]: string | number | undefined | null },
  object2: { [key: string]: string | number | undefined | null },
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

export function getSwissRecommendedRoundsNumber(players: number): number {
  if (players < 2) return 0;
  if (players === 2) return 1;
  if (players < 7) return Math.floor(Math.log2(players - 1)) + 2;
  return Math.floor(Math.log2(players - 1)) + 3;
}

export function getSwissMinRoundsNumber(players: number): number {
  if (players < 2) return 0;
  return 1;
}

export function getSwissMaxRoundsNumber(players: number): number {
  if (players < 4) return players;
  return players % 2 === 0 ? players - 3 : players - 2;
}
