import Loading from '@/app/loading';
import JsonLd from '@/components/json-ld';
import Navigation from '@/components/navigation';
import PwaHead from '@/components/pwa-head';
import ErrorFallback from '@/components/providers/error-boundary';
import IntlProvider from '@/components/providers/intl-provider';
import MediaQueryProvider from '@/components/providers/media-query-provider';
import ThemeProvider from '@/components/providers/theme-provider';
import { GlobalWebSocketProvider } from '@/components/providers/websocket-provider';
import { TRPCReactProvider } from '@/components/trpc/client';
import { Toaster } from '@/components/ui/sonner';
import { BASE_URL } from '@/lib/config/urls';
import '@/styles/globals.css';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import type { Metadata, Viewport } from 'next';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import Script from 'next/script';
import { PropsWithChildren, Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

async function LayoutContent({ children }: PropsWithChildren) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <IntlProvider messages={messages} locale={locale}>
      <GlobalWebSocketProvider>
        <JsonLd />
        <Navigation />
        <div className="pt-14">{children}</div>
        <Analytics />
        <SpeedInsights />
        <Toaster richColors />
        {process.env.NODE_ENV === 'development' && (
          <Script
            src="https://unpkg.com/react-scan/dist/install-hook.global.js"
            strategy="beforeInteractive"
          />
        )}
      </GlobalWebSocketProvider>
    </IntlProvider>
  );
}

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <PwaHead />
      </head>
      <body className="small-scrollbar">
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <MediaQueryProvider>
              <TRPCReactProvider>
                <Suspense fallback={<Loading />}>
                  <LayoutContent>{children}</LayoutContent>
                </Suspense>
              </TRPCReactProvider>
            </MediaQueryProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
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
      'elimination',
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
    alternates: {
      canonical: baseUrl,
      languages: {
        en: baseUrl,
        ru: baseUrl,
        'x-default': baseUrl,
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
      title: t('homepage.title'),
      description: t('homepage.description'),
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
