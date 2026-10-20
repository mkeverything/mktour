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

export const localDateStringToDate = (value: string): Date =>
  new Date(parseLocalDateString(value) ?? value);

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

// a 'yyyy-mm-dd' string is read as local midnight. without the time it would be
// read as utc midnight and show the previous day west of utc
const toDate = (date: Date | string): Date =>
  typeof date === 'string' ? new Date(`${date}T00:00`) : date;

// 'sep 21' / '21 сент.' with a short month, 'september 21' / '21 сентября' with a long one.
// the year is shown when it isn't the current one, or always with `withYear`
export const formatDate = (
  date: Date | string,
  locale: string,
  month: 'short' | 'long',
  { withYear = false } = {},
): string => {
  const value = toDate(date);
  const showYear = withYear || value.getFullYear() !== new Date().getFullYear();
  const formatted = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month,
    year: showYear ? 'numeric' : undefined,
  }).format(value);

  // russian appends ' г.' to the year
  return formatted.replace(/ г\.$/, '').toLocaleLowerCase(locale);
};

export const formatTournamentDisplayDate = (
  date: Date | string,
  locale: string,
): string => {
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(
    toDate(date),
  );

  return `${weekday.toLocaleLowerCase(locale)}, ${formatDate(date, locale, 'long')}`;
};
