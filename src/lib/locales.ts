import { isbot } from 'isbot';
import type { NextRequest } from 'next/server';

export const LOCALES = ['en', 'ru'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'NEXT_LOCALE';
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'en',
  ru: 'рус',
};

export const OPEN_GRAPH_LOCALES: Record<Locale, string> = {
  en: 'en_US',
  ru: 'ru_RU',
};

// our own public pages, also served at /{locale}/... for search engines.
// user-created pages keep a single url, however many languages are added
export const LOCALIZED_PATHS = [
  '/',
  '/info/about',
  '/info/faq',
  '/info/contact',
  '/clubs/all',
  '/tournaments/all',
];

export const isLocale = (value: unknown): value is Locale =>
  LOCALES.includes(value as Locale);

export const isLocalizedPath = (pathname: string) =>
  LOCALIZED_PATHS.includes(pathname);

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

export function getAcceptedLocales(acceptLanguage: string): Locale[] {
  const preferred = acceptLanguage
    .split(',')
    .map(parseLanguageRange)
    .filter((range) => range.quality > 0)
    .sort((a, b) => b.quality - a.quality);

  return preferred.map((range) => range.language).filter(isLocale);
}

// 'ru-RU;q=0.8' → { language: 'ru', quality: 0.8 }
function parseLanguageRange(range: string) {
  const [tag, quality] = range.split(';q=');
  return {
    language: tag.trim().toLowerCase().split('-')[0],
    quality: quality ? parseFloat(quality) : 1,
  };
}

export type Visitor = {
  isCrawler: boolean;
  isSignedIn: boolean;
  savedLocale?: Locale;
  // undefined when the browser states no preference at all
  acceptedLocales?: Locale[];
};

export function readVisitor(
  headers: Pick<Headers, 'get'>,
  cookies: Pick<NextRequest['cookies'], 'get'>,
): Visitor {
  const savedLocale = cookies.get(LOCALE_COOKIE)?.value;
  const acceptLanguage = headers.get('accept-language')?.trim();

  return {
    isCrawler: isbot(headers.get('user-agent')),
    isSignedIn: Boolean(cookies.get('auth_session')?.value),
    savedLocale: isLocale(savedLocale) ? savedLocale : undefined,
    acceptedLocales: acceptLanguage
      ? getAcceptedLocales(acceptLanguage)
      : undefined,
  };
}

// crawlers always get the default locale on unprefixed urls, so every url
// they index has exactly one language
export function resolveLocale(visitor: Visitor): Locale {
  if (visitor.isCrawler) return DEFAULT_LOCALE;
  return visitor.savedLocale ?? visitor.acceptedLocales?.[0] ?? DEFAULT_LOCALE;
}

// the unprefixed url shows the saved choice, so only crawlers and visitors
// without one whose browser accepts the language stay on /{locale}/...
export function keepsPrefixedUrl(visitor: Visitor, locale: Locale) {
  if (visitor.isCrawler) return true;
  if (visitor.isSignedIn || visitor.savedLocale) return false;
  return visitor.acceptedLocales?.includes(locale) ?? true;
}
