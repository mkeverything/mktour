import { getPageMetadata } from '@/lib/page-metadata';
import type { ResolvingMetadata } from 'next';
import { getTranslations } from 'next-intl/server';
import ContactContent from './contact-content';

export default function ContactPage() {
  return <ContactContent />;
}

export async function generateMetadata(_: unknown, parent: ResolvingMetadata) {
  const t = await getTranslations('Seo');
  return getPageMetadata(parent, {
    path: '/info/contact',
    title: t('contact.title'),
    description: t('contact.description'),
  });
}
