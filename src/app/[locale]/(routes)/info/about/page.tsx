import { getChangelog } from '@/lib/changelog';
import { getPageMetadata } from '@/lib/page-metadata';
import type { ResolvingMetadata } from 'next';
import { getTranslations } from 'next-intl/server';
import AboutContent from './about-content';

export default async function AboutPage() {
  const changelog = await getChangelog(3);

  return <AboutContent changelog={changelog} />;
}

export async function generateMetadata(_: unknown, parent: ResolvingMetadata) {
  const t = await getTranslations('Seo');
  return getPageMetadata(parent, {
    path: '/info/about',
    title: t('about.title'),
    description: t('about.description'),
  });
}
