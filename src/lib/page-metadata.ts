import { BASE_URL } from '@/lib/config/urls';
import {
  isLocalizedPath,
  type Locale,
  LOCALES,
  toPublicPath,
} from '@/lib/locales';
import type { Metadata, ResolvingMetadata } from 'next';
import { getLocale } from 'next-intl/server';

export const toAbsoluteUrl = (path: string) =>
  `${BASE_URL}${path === '/' ? '' : path}`;

export const getLanguageAlternates = (path: string) => ({
  'x-default': toAbsoluteUrl(path),
  ...(Object.fromEntries(
    LOCALES.map((locale) => [
      locale,
      toAbsoluteUrl(toPublicPath(path, locale)),
    ]),
  ) as Record<Locale, string>),
});

// every language version is canonical to itself and lists all versions.
// a page's open graph replaces the layout's wholesale, so it is inherited here
export async function getPageMetadata(
  parent: ResolvingMetadata,
  {
    path,
    title,
    description,
    ...metadata
  }: Metadata & {
    path: string;
    title: NonNullable<Metadata['title']>;
    description: string;
  },
): Promise<Metadata> {
  const [locale, previous] = await Promise.all([getLocale(), parent]);
  const languages = isLocalizedPath(path)
    ? getLanguageAlternates(path)
    : undefined;
  const url = languages?.[locale] ?? toAbsoluteUrl(path);

  return {
    ...metadata,
    title,
    description,
    alternates: { canonical: url, languages },
    openGraph: { ...previous.openGraph, title, description, url },
  };
}
