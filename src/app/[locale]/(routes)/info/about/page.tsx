import { getChangelog } from '@/lib/changelog';
import { getPageUrls } from '@/lib/page-urls';
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
  const { url, alternates } = await getPageUrls('/info/about');
  const previous = await parent;

  return {
    title: t('about.title'),
    description: t('about.description'),
    alternates,
    openGraph: {
      ...previous.openGraph,
      title: t('about.title'),
      description: t('about.description'),
      url,
    },
  };
}
