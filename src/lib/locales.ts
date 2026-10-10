import { isbot } from 'isbot';

export const LOCALES = ['en', 'ru'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'NEXT_LOCALE';
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

// public indexable pages that also exist at /{locale}/... for search engines
const LOCALIZED_PATHS = [
  /^\/$/,
  /^\/info\/(about|faq|contact)$/,
  /^\/(clubs|tournaments)\/(?!my$|create$)[^/]+$/,
  /^\/user\/[^/]+$/,
];

export const isLocale = (value: unknown): value is Locale =>
  LOCALES.includes(value as Locale);

export const isLocalizedPath = (pathname: string) =>
  LOCALIZED_PATHS.some((pattern) => pattern.test(pathname));

export const localizePath = (pathname: string, locale: Locale) =>
  locale === DEFAULT_LOCALE
    ? pathname
    : `/${locale}${pathname === '/' ? '' : pathname}`;

export function splitLocalePrefix(pathname: string): {
  locale?: Locale;
  pathname: string;
} {
  const [, first, ...rest] = pathname.split('/');
  if (!isLocale(first)) return { pathname };
  return { locale: first, pathname: `/${rest.join('/')}` };
}

export function getAcceptedLocales(acceptLanguage: string | null): Locale[] {
  if (!acceptLanguage) return [];

  return acceptLanguage
    .split(',')
    .map((part) => {
      const [tag, quality] = part.trim().split(';q=');
      return {
        language: tag.trim().toLowerCase().split('-')[0],
        q: quality ? parseFloat(quality) : 1,
      };
    })
    .filter(({ q }) => q > 0)
    .sort((a, b) => b.q - a.q)
    .map(({ language }) => language)
    .filter(isLocale);
}

// crawlers always get the default locale on unprefixed urls, so every url
// they index has exactly one language
export function resolveLocale(
  headers: Pick<Headers, 'get'>,
  cookie: string | undefined,
): Locale {
  if (isbot(headers.get('user-agent'))) return DEFAULT_LOCALE;
  if (isLocale(cookie)) return cookie;

  const [accepted] = getAcceptedLocales(headers.get('accept-language'));
  return accepted ?? DEFAULT_LOCALE;
}
