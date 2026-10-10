import { getPageUrls } from '@/lib/page-urls';
import type { Metadata, ResolvingMetadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import FaqContent from './faq-content';

export default function FaqPage() {
  return <FaqContent />;
}

export async function generateMetadata(
  _: unknown,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: 'Seo' });
  const { url, alternates } = await getPageUrls('/info/faq');
  const previous = await parent;

  return {
    title: t('faq.title'),
    description: t('faq.description'),
    alternates,
    openGraph: {
      ...previous.openGraph,
      title: t('faq.title'),
      description: t('faq.description'),
      url,
    },
  };
}
