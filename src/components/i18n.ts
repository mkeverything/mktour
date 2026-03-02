import { getUserLocale } from '@/components/get-user-locale';
import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async () => {
  // Provide a static locale, fetch a user setting,
  // read from `cookies()`, `headers()`, etc.
  const locale = await getUserLocale();

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});

export type Locale = 'en' | 'ru';
export const defaultLocale: Locale = 'ru';
