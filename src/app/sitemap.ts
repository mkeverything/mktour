import { MetadataRoute } from 'next';
import { connection } from 'next/server';
import { BASE_URL } from '@/lib/config/urls';
import { LOCALES, LOCALIZED_PATHS } from '@/lib/locales';
import { getLanguageAlternates } from '@/lib/page-metadata';
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
  const staticPages: MetadataRoute.Sitemap = LOCALIZED_PATHS.flatMap((path) => {
    const languages = getLanguageAlternates(path);
    return LOCALES.map((locale) => ({
      url: languages[locale],
      alternates: { languages },
    }));
  });

  let dynamicPages: MetadataRoute.Sitemap = [];

  // the db is read per request, so the build doesn't start queries it then cancels
  await connection();
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
        url: `${BASE_URL}/tournaments/${tournament.id}`,
        lastModified,
      };
    });

    const clubPages = clubs.map((club) => ({
      url: `${BASE_URL}/clubs/${club.id}`,
      lastModified: clubLastModified.get(club.id) ?? club.createdAt,
    }));

    const userPages = users.map((user) => ({
      url: `${BASE_URL}/user/${user.username}`,
    }));

    // guest player pages are noindex: organizer-entered people, thin and not opted in
    dynamicPages = [...clubPages, ...tournamentPages, ...userPages];
  } catch (error) {
    console.error('Failed to generate sitemap dynamic pages:', error);
  }

  return [...staticPages, ...dynamicPages];
}
