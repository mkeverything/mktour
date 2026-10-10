import AppDocument from '@/app/app-document';
import JsonLd from '@/components/json-ld';
import { BASE_URL } from '@/lib/config/urls';
import { LOCALES } from '@/lib/locales';
import type { Metadata, Viewport } from 'next';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import { PropsWithChildren } from 'react';

export default async function RootLayout({ children }: PropsWithChildren) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <AppDocument locale={locale} messages={messages}>
      <JsonLd />
      {children}
    </AppDocument>
  );
}

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = BASE_URL || 'https://mktour.org';
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: 'Seo' });

  return {
    metadataBase: new URL(baseUrl),
    title: {
      default: t('homepage.title'),
      template: '%s | mktour',
    },
    description: t('homepage.description'),
    authors: [{ url: 'https://mkeverything.ru' }],
    keywords: [
      'chess',
      'tournament',
      'swiss',
      'round robin',
      'chess tournament',
      'tournament management',
    ],
    creator: 'mktour',
    publisher: 'mktour',
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    openGraph: {
      type: 'website',
      locale: locale === 'ru' ? 'ru_RU' : 'en_US',
      alternateLocale: locale === 'ru' ? 'en_US' : 'ru_RU',
      url: baseUrl,
      siteName: t('siteName'),
      title: t('homepage.title'),
      description: t('homepage.description'),
      images: [
        {
          url: `${baseUrl}/opengraph-image.png`,
          width: 1200,
          height: 630,
          alt: 'mktour - chess tournament management',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      images: [`${baseUrl}/opengraph-image.png`],
    },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};
