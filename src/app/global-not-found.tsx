import NotFound from '@/app/[locale]/not-found';
import AppDocument from '@/app/app-document';
import { readVisitor, resolveLocale } from '@/lib/locales';
import type { Metadata } from 'next';
import { getMessages, getTranslations } from 'next-intl/server';
import { cookies, headers } from 'next/headers';

// unmatched urls never reach app/[locale], so the locale comes from the request
// and the page renders on demand
export const instant = false;

const getRequestLocale = async () =>
  resolveLocale(readVisitor(await headers(), await cookies()));

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const t = await getTranslations({ locale, namespace: 'Seo' });
  return { title: `error 404 | ${t('siteName')}` };
}

export default async function GlobalNotFound() {
  const locale = await getRequestLocale();

  return (
    <AppDocument locale={locale} messages={await getMessages({ locale })}>
      <NotFound />
    </AppDocument>
  );
}
