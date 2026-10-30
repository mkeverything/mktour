import withBundleAnalyzer from '@next/bundle-analyzer';
import { getPattern } from 'isbot';
import withPlugins from 'next-compose-plugins';
import createNextIntlPlugin from 'next-intl/plugin';

/** @type {import('next').NextConfig} */
const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig = {
  output: 'standalone',
  outputFileTracingIncludes: {
    '/api/db/migrate': ['./src/server/db/migrations/**/*'],
  },
  cacheComponents: true,
  htmlLimitedBots: getPattern(),
  experimental: {
    globalNotFound: true,
    turbopackFileSystemCacheForDev: true,
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
};

const withNextIntl = createNextIntlPlugin('./src/components/i18n.ts');

export default withPlugins([[bundleAnalyzer], [withNextIntl]], nextConfig);
