import { BASE_URL } from '@/lib/config/urls';
import { getLocale, getTranslations } from 'next-intl/server';

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
      url: `${baseUrl}/app-icon.png`,
      width: 512,
      height: 512,
    },
    description: t('homepage.description'),
    sameAs: [
      'https://lichess.org/team/mktour',
      'https://github.com/mkeverything/mktour',
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

export async function getSoftwareApplicationSchema() {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: 'Seo' });
  const baseUrl = BASE_URL || 'https://mktour.org';

  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'mktour',
    url: baseUrl,
    applicationCategory: 'SportsApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0.00',
      priceCurrency: 'USD',
    },
    description: t('homepage.description'),
    featureList: [
      'Chess Tournament Management',
      'Automatic Rating Calculation',
      'Swiss System, Round-Robin, Single & Double Elimination',
      'Free Open API',
      'Made by Chess Players and Organizers',
    ],
  };
}
