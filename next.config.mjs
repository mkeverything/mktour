import withBundleAnalyzer from '@next/bundle-analyzer';
import withPlugins from 'next-compose-plugins';
import createNextIntlPlugin from 'next-intl/plugin';
import nextPWA from 'next-pwa';

/** @type {import('next').NextConfig} */
const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig = {
  allowedDevOrigins: ["192.168.1.67"],
  cacheComponents: true,
  experimental: {
    useCache: true,
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
