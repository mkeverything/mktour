import { lowerLike } from '@/lib/sql-sqlite-string';
import { getPlace } from '@/lib/geo-place';
import { getClubCoordinates } from '@/lib/location';
import { db } from '@/server/db';
import {
  getNearbyClubDistances,
  NearFilter,
  toNearby,
} from '@/server/queries/get-nearby';
import { clubs } from '@/server/db/schema/clubs';
import { players } from '@/server/db/schema/players';
import { tournaments } from '@/server/db/schema/tournaments';
import { ClubModel } from '@/server/zod/clubs';
import { ClubListItemModel, ClubLocationModel } from '@/server/zod/discovery';
import {
  and,
  asc,
  avg,
  count,
  desc,
  eq,
  exists,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
  SQL,
} from 'drizzle-orm';

const MAX_NEARBY_CLUBS = 100;
const MAX_MAP_CLUBS = 500;
const NEW_CLUB_MS = 30 * 24 * 60 * 60 * 1000;

type Filters = NearFilter & { search?: string };

// personal clubs are created for every user, so only clubs that have finished a tournament are listed
const isListed = exists(
  db
    .select({ id: tournaments.id })
    .from(tournaments)
    .where(
      and(eq(tournaments.clubId, clubs.id), isNotNull(tournaments.closedAt)),
    ),
);

const searchCondition = (search?: string) =>
  search ? lowerLike(clubs.name, `%${search}%`) : undefined;

export default async function getAllClubsInfinite({
  limit = 10,
  cursor,
  today,
  ...filters
}: Filters & {
  limit?: number;
  cursor?: number;
  today: string;
}): Promise<{ clubs: ClubListItemModel[]; nextCursor: number | null }> {
  const query = (where?: SQL) =>
    db
      .select()
      .from(clubs)
      .where(and(isListed, searchCondition(filters.search), where))
      .orderBy(desc(clubs.createdAt), desc(clubs.id));

  // nearby clubs are few and sorted by distance, so they come as one page
  const nearby = toNearby(filters);
  if (nearby) {
    const nearbyClubs = await getNearbyClubDistances(nearby);
    const found = await query(inArray(clubs.id, [...nearbyClubs.keys()]));
    return {
      clubs: await withSummaries(
        found
          .toSorted((a, b) => nearbyClubs.get(a.id)! - nearbyClubs.get(b.id)!)
          .slice(0, MAX_NEARBY_CLUBS),
        today,
        nearbyClubs,
      ),
      nextCursor: null,
    };
  }

  const results = await query(
    cursor ? lt(clubs.createdAt, new Date(cursor)) : undefined,
  ).limit(limit + 1);
  if (results.length <= limit) {
    return { clubs: await withSummaries(results, today), nextCursor: null };
  }

  // the cursor is exclusive, so a page can't end in the middle of rows sharing a createdAt
  const extra = results.pop()!;
  const lastCreatedAt = results[results.length - 1].createdAt;
  if (extra.createdAt.getTime() !== lastCreatedAt.getTime()) {
    return {
      clubs: await withSummaries(results, today),
      nextCursor: lastCreatedAt.getTime(),
    };
  }
  const tied = await query(eq(clubs.createdAt, lastCreatedAt));
  return {
    clubs: await withSummaries(
      [...results.filter((club) => club.createdAt > lastCreatedAt), ...tied],
      today,
    ),
    nextCursor: lastCreatedAt.getTime(),
  };
}

export async function getClubLocations(
  filters: Pick<Filters, 'search'>,
): Promise<ClubLocationModel[]> {
  const listed = await db
    .select({
      id: clubs.id,
      name: clubs.name,
      latitude: clubs.latitude,
      longitude: clubs.longitude,
    })
    .from(clubs)
    .where(and(isListed, searchCondition(filters.search)))
    .limit(MAX_MAP_CLUBS);
  return listed.map((club) => ({
    id: club.id,
    name: club.name,
    ...clubPlace(club),
  }));
}

const clubPlace = (club: Parameters<typeof getClubCoordinates>[0]) => {
  const { latitude, longitude } = getClubCoordinates(club);
  return getPlace(latitude, longitude);
};

async function withSummaries(
  page: ClubModel[],
  today: string,
  distances?: Map<string, number>,
): Promise<ClubListItemModel[]> {
  if (!page.length) return [];
  const ids = page.map((club) => club.id);

  const [playerStats, finishedCounts, openTournaments] = await Promise.all([
    db
      .select({
        clubId: players.clubId,
        count: count(),
        averageRating: avg(players.rating),
      })
      .from(players)
      .where(inArray(players.clubId, ids))
      .groupBy(players.clubId),
    db
      .select({ clubId: tournaments.clubId, count: count() })
      .from(tournaments)
      .where(
        and(inArray(tournaments.clubId, ids), isNotNull(tournaments.closedAt)),
      )
      .groupBy(tournaments.clubId),
    db
      .select({
        id: tournaments.id,
        clubId: tournaments.clubId,
        title: tournaments.title,
        date: tournaments.date,
        format: tournaments.format,
        type: tournaments.type,
        startedAt: tournaments.startedAt,
      })
      .from(tournaments)
      .where(
        and(
          inArray(tournaments.clubId, ids),
          isNull(tournaments.closedAt),
          or(isNotNull(tournaments.startedAt), gte(tournaments.date, today)),
        ),
      )
      .orderBy(asc(tournaments.date)),
  ]);

  return page.map((club) => {
    const stats = playerStats.find(({ clubId }) => clubId === club.id);
    const open = openTournaments.filter(({ clubId }) => clubId === club.id);
    const next = open.find(({ startedAt }) => !startedAt);
    return {
      ...club,
      place: clubPlace(club),
      distanceKm: distances?.get(club.id) ?? null,
      playersCount: stats?.count ?? 0,
      averageRating: stats?.averageRating
        ? Math.round(Number(stats.averageRating))
        : null,
      tournamentsCount:
        finishedCounts.find(({ clubId }) => clubId === club.id)?.count ?? 0,
      liveTournamentsCount: open.filter(({ startedAt }) => startedAt).length,
      isNew: Date.now() - club.createdAt.getTime() < NEW_CLUB_MS,
      nextTournament: next
        ? {
            id: next.id,
            title: next.title,
            date: next.date,
            format: next.format,
            type: next.type,
          }
        : null,
    };
  });
}
