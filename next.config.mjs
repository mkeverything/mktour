import withBundleAnalyzer from '@next/bundle-analyzer';
import withPlugins from 'next-compose-plugins';
import createNextIntlPlugin from 'next-intl/plugin';
import nextPWA from 'next-pwa';
import { HTML_LIMITED_BOT_UA_RE } from 'next/dist/shared/lib/router/utils/is-bot.js';

/** @type {import('next').NextConfig} */
const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig = {
  cacheComponents: true,
  htmlLimitedBots: new RegExp(
    `${HTML_LIMITED_BOT_UA_RE.source}|TelegramBot`,
    'i',
  ),
  experimental: {
    turbopackFileSystemCacheForDev: true,
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
};

const withNextIntl = createNextIntlPlugin('./src/components/i18n.ts');

const withPWA = nextPWA({
  dest: 'public',
  mode: process.env.VERCEL_ENV,
  disable:
    process.env.NODE_ENV === 'development' ||
    process.env.VERCEL_ENV === 'development',
  cacheOnFrontEndNav: true,
  reloadOnOnline: true,
  register: true,
});

export default withPlugins(
  [[bundleAnalyzer], [withNextIntl], [withPWA]],
  nextConfig,
);
