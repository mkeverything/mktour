'use server';

import { Locale } from '@/components/i18n';
import { cookies, headers } from 'next/headers';

const COOKIE_NAME = 'NEXT_LOCALE';
const SUPPORTED_LOCALES: ReadonlyArray<Locale> = ['en', 'ru'];

function detectLocaleFromHeader(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return 'en';

  const entries = acceptLanguage
    .split(',')
    .map((part) => {
      const [lang, quality] = part.trim().split(';q=');
      return {
        lang: lang.trim().toLowerCase(),
        q: quality ? parseFloat(quality) : 1,
      };
    })
    .sort((a, b) => b.q - a.q);

  for (const entry of entries) {
    const prefix = entry.lang.split('-')[0];
    const match = SUPPORTED_LOCALES.find((l) => l === prefix);
    if (match) return match;
  }

  return 'en';
}

export async function getUserLocale(): Promise<Locale> {
  const cookieValue = (await cookies()).get(COOKIE_NAME)?.value;
  if (cookieValue && SUPPORTED_LOCALES.includes(cookieValue as Locale)) {
    return cookieValue as Locale;
  }

  const acceptLanguage = (await headers()).get('accept-language');
  return detectLocaleFromHeader(acceptLanguage);
}

export async function setUserLocale(locale: Locale) {
  (await cookies()).set(COOKIE_NAME, locale, {
    sameSite: 'lax',
  });
}
