import { MetadataRoute } from 'next';
import { BASE_URL } from '@/lib/config/urls';
import { publicCaller } from '@/server/api';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = BASE_URL || 'https://mktour.org';

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date('2025-01-01'),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/info/about`,
      lastModified: new Date('2025-01-01'),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/info/faq`,
      lastModified: new Date('2025-01-01'),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/info/contact`,
      lastModified: new Date('2025-01-01'),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/for-llms`,
      lastModified: new Date('2026-02-28'),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/clubs/all`,
      lastModified: new Date('2025-01-01'),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/tournaments/all`,
      lastModified: new Date('2025-01-01'),
      changeFrequency: 'daily',
      priority: 0.9,
    },
  ];

  let dynamicPages: MetadataRoute.Sitemap = [];

  try {
    const [{ clubs }, { tournaments: tournamentsData }] = await Promise.all([
      publicCaller.club.all({}),
      publicCaller.tournament.all({}),
    ]);

    const clubPages = clubs.map((club) => ({
      url: `${baseUrl}/clubs/${club.id}`,
      lastModified: new Date(club.createdAt),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));

    const tournamentPages = tournamentsData.map((item) => ({
      url: `${baseUrl}/tournaments/${item.tournament.id}`,
      lastModified: new Date(item.tournament.createdAt),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }));

    dynamicPages = [...clubPages, ...tournamentPages];
  } catch (error) {
    console.error('Failed to generate sitemap dynamic pages:', error);
  }

  return [...staticPages, ...dynamicPages];
}
