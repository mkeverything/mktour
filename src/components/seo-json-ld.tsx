import { BASE_URL } from '@/lib/config/urls';
import { getLocale, getTranslations } from 'next-intl/server';

export async function getOrganizationSchema() {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: 'Seo' });

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'mktour',
    url: BASE_URL,
    logo: {
      '@type': 'ImageObject',
      url: `${BASE_URL}/app-icon.png`,
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
      email: 'hello@mktour.org',
      contactType: 'customer service',
    },
  };
}

export async function getWebsiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'mktour',
    alternateName: 'мктур',
    url: BASE_URL,
  };
}

export async function getSoftwareApplicationSchema() {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: 'Seo' });

  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'mktour',
    url: BASE_URL,
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
      'Swiss System and Round-Robin Pairings',
      'Free Open API',
      'Made by Chess Players and Organizers',
    ],
  };
}
