import { MetadataRoute } from 'next';
import { BASE_URL } from '@/lib/config/urls';

export default function robots(): MetadataRoute.Robots {
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
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
