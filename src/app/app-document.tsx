import ErrorFallback from '@/components/providers/error-boundary';
import IntlProvider from '@/components/providers/intl-provider';
import MediaQueryProvider from '@/components/providers/media-query-provider';
import ThemeProvider from '@/components/providers/theme-provider';
import SpeedInsights from '@/components/speed-insights';
import { TRPCReactProvider } from '@/components/trpc/client';
import { Toaster } from '@/components/ui/sonner';
import { appleSplashStartupImages } from '@/lib/splash-screens';
import '@/styles/globals.css';
import { Analytics } from '@vercel/analytics/react';
import { AbstractIntlMessages } from 'next-intl';
import Script from 'next/script';
import { PropsWithChildren } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

export default function AppDocument({
  locale,
  messages,
  children,
}: PropsWithChildren<{ locale: string; messages: AbstractIntlMessages }>) {
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
        {process.env.NODE_ENV === 'development' && (
          <Script
            src="https://unpkg.com/react-scan/dist/install-hook.global.js"
            strategy="beforeInteractive"
          />
        )}
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <MediaQueryProvider>
              <TRPCReactProvider>
                <IntlProvider messages={messages} locale={locale}>
                  {children}
                  <Analytics />
                  <SpeedInsights />
                  <Toaster richColors />
                </IntlProvider>
              </TRPCReactProvider>
            </MediaQueryProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
