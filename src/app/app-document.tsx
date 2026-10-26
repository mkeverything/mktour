import ErrorFallback from '@/components/providers/error-boundary';
import IntlProvider from '@/components/providers/intl-provider';
import MediaQueryProvider from '@/components/providers/media-query-provider';
import MotionProvider from '@/components/providers/motion-provider';
import ThemeProvider from '@/components/providers/theme-provider';
import { TRPCReactProvider } from '@/components/trpc/client';
import { Toaster } from '@/components/ui/sonner';

import type { Locale } from '@/lib/locales';
import { appleSplashStartupImages } from '@/lib/splash-screens';
import '@/styles/globals.css';
import { AbstractIntlMessages } from 'next-intl';
import { PropsWithChildren } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

export default function AppDocument({
  locale,
  messages,
  children,
}: PropsWithChildren<{ locale: Locale; messages: AbstractIntlMessages }>) {
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        {appleSplashStartupImages.map((img) => (
          <link
            key={img.url}
            rel="apple-touch-startup-image"
            href={img.url}
            media={img.media}
          />
        ))}
      </head>
      <body className="small-scrollbar">
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <ThemeProvider>
            <MediaQueryProvider>
              <TRPCReactProvider>
                <IntlProvider messages={messages} locale={locale}>
                  <MotionProvider>
                    {children}
                    <Toaster richColors />
                  </MotionProvider>
                </IntlProvider>
              </TRPCReactProvider>
            </MediaQueryProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
