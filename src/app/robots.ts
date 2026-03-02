import { MetadataRoute } from 'next';
import { BASE_URL } from '@/lib/config/urls';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = BASE_URL || 'https://mktour.org';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/profile',
          '/notifications',
          '/clubs/my',
          '/tournaments/my',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
