import NotFound from '@/app/[locale]/not-found';
import AppDocument from '@/app/app-document';
import { LOCALE_COOKIE, resolveLocale } from '@/lib/locales';
import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';

// unmatched urls never reach app/[locale], so the locale comes from the request
// and the page renders on demand
export const instant = false;

export const metadata: Metadata = {
  title: 'error 404 | mktour',
};

export default async function GlobalNotFound() {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  const locale = resolveLocale(
    headerList,
    cookieStore.get(LOCALE_COOKIE)?.value,
  );
  const messages = (await import(`@/messages/${locale}.json`)).default;

  return (
    <AppDocument locale={locale} messages={messages}>
      <NotFound />
    </AppDocument>
  );
}
