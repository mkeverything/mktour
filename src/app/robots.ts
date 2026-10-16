import { MetadataRoute } from 'next';
import { BASE_URL, IS_INDEXABLE } from '@/lib/config/urls';

// private pages are not disallowed here: crawlers have to fetch them to see their noindex
export default function robots(): MetadataRoute.Robots {
  if (!IS_INDEXABLE) return { rules: [{ userAgent: '*', disallow: '/' }] };

  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/'] }],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
