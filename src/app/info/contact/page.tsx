import ContactContent from './contact-content';
import { getLocale, getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { BASE_URL } from '@/lib/config/urls';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: 'Seo' });
  const baseUrl = BASE_URL || 'https://mktour.org';
  const url = `${baseUrl}/info/contact`;

  return {
    title: t('contact.title'),
    description: t('contact.description'),
    alternates: {
      canonical: url,
      languages: { en: url, ru: url, 'x-default': url },
    },
    openGraph: {
      title: t('contact.title'),
      description: t('contact.description'),
      url,
    },
  };
}

export default function ContactPage() {
  return <ContactContent />;
}
