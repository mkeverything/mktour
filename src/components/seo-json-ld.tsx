import { getLocale, getTranslations } from 'next-intl/server';
import { BASE_URL } from '@/lib/config/urls';

export async function getOrganizationSchema() {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: 'Seo' });
  const baseUrl = BASE_URL || 'https://mktour.org';

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'mktour',
    url: baseUrl,
    logo: {
      '@type': 'ImageObject',
      url: `${baseUrl}/logo-square.png`,
      width: 1024,
      height: 1024,
    },
    description: t('homepage.description'),
    sameAs: [
      'https://lichess.org/team/mktour',
      'https://github.com/sukalov/mktour',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'mkevrthng@gmail.com',
      contactType: 'customer service',
    },
  };
}

export async function getWebsiteSchema() {
  const baseUrl = BASE_URL || 'https://mktour.org';

  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'mktour',
    url: baseUrl,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${baseUrl}/api/search?query={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}
