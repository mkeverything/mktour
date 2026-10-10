import { MetadataRoute } from 'next';
import { BASE_URL } from '@/lib/config/urls';
import { publicCaller } from '@/server/api';

const PAGE_SIZE = 100;

async function collectPages<T>(
  fetchPage: (cursor?: number) => Promise<[T[], number | null]>,
) {
  const items: T[] = [];
  let cursor: number | undefined;
  do {
    const [page, nextCursor] = await fetchPage(cursor);
    items.push(...page);
    cursor = nextCursor ?? undefined;
  } while (cursor !== undefined);
  return items;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = BASE_URL || 'https://mktour.org';

  const staticPages: MetadataRoute.Sitemap = [
    baseUrl,
    `${baseUrl}/info/about`,
    `${baseUrl}/info/faq`,
    `${baseUrl}/info/contact`,
    `${baseUrl}/clubs/all`,
    `${baseUrl}/tournaments/all`,
  ].map((url) => ({ url }));

  let dynamicPages: MetadataRoute.Sitemap = [];

  try {
    const [clubs, tournaments, users] = await Promise.all([
      collectPages(async (cursor) => {
        const page = await publicCaller.club.all({ limit: PAGE_SIZE, cursor });
        return [page.clubs, page.nextCursor];
      }),
      collectPages(async (cursor) => {
        const page = await publicCaller.tournament.all({
          limit: PAGE_SIZE,
          cursor,
        });
        return [page.tournaments, page.nextCursor];
      }),
      publicCaller.user.all(),
    ]);

    const clubLastModified = new Map<string, Date>();
    const tournamentPages = tournaments.map(({ tournament }) => {
      const lastModified =
        tournament.closedAt ?? tournament.startedAt ?? tournament.createdAt;
      const clubLatest = clubLastModified.get(tournament.clubId);
      if (!clubLatest || clubLatest < lastModified) {
        clubLastModified.set(tournament.clubId, lastModified);
      }
      return {
        url: `${baseUrl}/tournaments/${tournament.id}`,
        lastModified,
      };
    });

    const clubPages = clubs.map((club) => ({
      url: `${baseUrl}/clubs/${club.id}`,
      lastModified: clubLastModified.get(club.id) ?? club.createdAt,
    }));

    const userPages = users.map((user) => ({
      url: `${baseUrl}/user/${user.username}`,
    }));

    // guest player pages are noindex: organizer-entered people, thin and not opted in
    dynamicPages = [...clubPages, ...tournamentPages, ...userPages];
  } catch (error) {
    console.error('Failed to generate sitemap dynamic pages:', error);
  }

  return [...staticPages, ...dynamicPages];
}
