import FaqContent from './faq-content';
import { getLocale, getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { BASE_URL } from '@/lib/config/urls';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: 'Seo' });
  const baseUrl = BASE_URL || 'https://mktour.org';
  const url = `${baseUrl}/info/faq`;

  return {
    title: t('faq.title'),
    description: t('faq.description'),
    alternates: {
      canonical: url,
      languages: { en: url, ru: url, 'x-default': url },
    },
    openGraph: {
      title: t('faq.title'),
      description: t('faq.description'),
      url,
    },
  };
}

export default function FaqPage() {
  return <FaqContent />;
}
