import { BASE_URL } from '@/lib/config/urls';
import {
  isLocale,
  isLocalizedPath,
  LOCALES,
  localizePath,
} from '@/lib/locales';
import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';

const baseUrl = BASE_URL || 'https://mktour.org';

export const toAbsoluteUrl = (path: string) =>
  `${baseUrl}${path === '/' ? '' : path}`;

export const getLanguageAlternates = (path: string) => ({
  'x-default': toAbsoluteUrl(path),
  ...Object.fromEntries(
    LOCALES.map((locale) => [
      locale,
      toAbsoluteUrl(localizePath(path, locale)),
    ]),
  ),
});

// every language version is canonical to itself and lists all versions
export async function getPageUrls(
  path: string,
): Promise<{ url: string; alternates: Metadata['alternates'] }> {
  const locale = await getLocale();
  if (!isLocalizedPath(path) || !isLocale(locale)) {
    const url = toAbsoluteUrl(path);
    return { url, alternates: { canonical: url } };
  }

  const url = toAbsoluteUrl(localizePath(path, locale));
  return {
    url,
    alternates: { canonical: url, languages: getLanguageAlternates(path) },
  };
}
