import type { Locale } from '@/lib/locales';

declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale;
  }
}
