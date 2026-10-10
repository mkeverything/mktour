import { getPageUrls } from '@/lib/page-urls';
import type { Metadata, ResolvingMetadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import ContactContent from './contact-content';

export default function ContactPage() {
  return <ContactContent />;
}

export async function generateMetadata(
  _: unknown,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: 'Seo' });
  const { url, alternates } = await getPageUrls('/info/contact');
  const previous = await parent;

  return {
    title: t('contact.title'),
    description: t('contact.description'),
    alternates,
    openGraph: {
      ...previous.openGraph,
      title: t('contact.title'),
      description: t('contact.description'),
      url,
    },
  };
}
