import type { AppErrorMessage } from '@/lib/errors';

const LOCAL_DATE_STRING_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export type LocalDateValidationError = Extract<
  AppErrorMessage,
  'INVALID_DATE' | 'TIME_TRAVEL' | 'DATE_TOO_FAR_AHEAD'
>;

export const dateToLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseLocalDateString = (value: string): number | null => {
  const match = LOCAL_DATE_STRING_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date.getTime();
};

const getTodayTimestamp = (): number => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
};

const getMaxDateTimestamp = (): number => {
  const now = new Date();
  return new Date(
    now.getFullYear() + 100,
    now.getMonth(),
    now.getDate(),
  ).getTime();
};

export const getLocalDateStringValidationError = (
  value: string,
): LocalDateValidationError | null => {
  const timestamp = parseLocalDateString(value);
  if (timestamp === null) return 'INVALID_DATE';
  if (timestamp < getTodayTimestamp()) return 'TIME_TRAVEL';
  if (timestamp > getMaxDateTimestamp()) return 'DATE_TOO_FAR_AHEAD';
  return null;
};
