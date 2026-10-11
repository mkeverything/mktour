import { getPageMetadata } from '@/lib/page-metadata';
import type { ResolvingMetadata } from 'next';
import { getTranslations } from 'next-intl/server';
import FaqContent from './faq-content';

export default function FaqPage() {
  return <FaqContent />;
}

export async function generateMetadata(_: unknown, parent: ResolvingMetadata) {
  const t = await getTranslations('Seo');
  return getPageMetadata(parent, {
    path: '/info/faq',
    title: t('faq.title'),
    description: t('faq.description'),
  });
}
