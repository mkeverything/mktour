import { getChangelog } from '@/lib/changelog';
import AboutContent from './about-content';
import { getLocale, getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { BASE_URL } from '@/lib/config/urls';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: 'Seo' });
  const baseUrl = BASE_URL || 'https://mktour.org';
  const url = `${baseUrl}/info/about`;

  return {
    title: t('about.title'),
    description: t('about.description'),
    alternates: {
      canonical: url,
      languages: { en: url, ru: url, 'x-default': url },
    },
    openGraph: {
      title: t('about.title'),
      description: t('about.description'),
      url,
    },
  };
}

export default async function AboutPage() {
  const changelog = await getChangelog(3);

  return <AboutContent changelog={changelog} />;
}
