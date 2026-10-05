import { getChangelog } from '@/lib/changelog';
import { BASE_URL } from '@/lib/config/urls';
import type { Metadata, ResolvingMetadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import AboutContent from './about-content';

export default async function AboutPage() {
  const changelog = await getChangelog(3);

  return <AboutContent changelog={changelog} />;
}

export async function generateMetadata(
  _: unknown,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: 'Seo' });
  const baseUrl = BASE_URL || 'https://mktour.org';
  const url = `${baseUrl}/info/about`;
  const previous = await parent;

  return {
    title: t('about.title'),
    description: t('about.description'),
    alternates: {
      canonical: url,
      languages: { en: url, ru: url, 'x-default': url },
    },
    openGraph: {
      ...previous.openGraph,
      title: t('about.title'),
      description: t('about.description'),
      url,
    },
  };
}
