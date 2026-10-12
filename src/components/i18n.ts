import { isLocale } from '@/lib/locales';
import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { locale as rootLocale } from 'next/root-params';

export default getRequestConfig(async ({ locale }) => {
  const requested = locale ?? (await rootLocale());
  if (!isLocale(requested)) notFound();

  return {
    locale: requested,
    messages: (await import(`../messages/${requested}.json`)).default,
  };
});
