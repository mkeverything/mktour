import { CACHE_TAGS } from '@/lib/cache-tags';
import { lowerLike } from '@/lib/sql-sqlite-string';
import { distanceKm } from '@/lib/geo';
import { getPlace } from '@/lib/geo-place';
import { getTournamentCoordinates } from '@/lib/location';
import { db } from '@/server/db';
import {
  getNearbyClubDistances,
  getNearbyTournamentIds,
  Nearby,
  toNearby,
} from '@/server/queries/get-nearby';
import { clubs } from '@/server/db/schema/clubs';
import { tournament_units, tournaments } from '@/server/db/schema/tournaments';
import {
  TournamentListItemModel,
  TournamentsListFiltersModel,
  TournamentStatusCountsModel,
} from '@/server/zod/discovery';
import { TournamentStatus } from '@/server/zod/enums';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  SQL,
} from 'drizzle-orm';
import { cacheTag } from 'next/cache';

const PODIUM_SIZE = 3;

type Row = Pick<TournamentListItemModel, 'tournament' | 'club'>;

type Ordering = {
  orderBy: SQL[];
  key: (row: Row) => number;
  after: (cursor: number) => SQL;
  at: (cursor: number) => SQL;
};

const toDateString = (cursor: number) =>
  new Date(cursor).toISOString().slice(0, 10);

const ORDERINGS: Record<TournamentStatus | 'all', Ordering> = {
  all: {
    orderBy: [desc(tournaments.createdAt), desc(tournaments.id)],
    key: ({ tournament }) => tournament.createdAt.getTime(),
    after: (cursor) => lt(tournaments.createdAt, new Date(cursor)),
    at: (cursor) => eq(tournaments.createdAt, new Date(cursor)),
  },
  upcoming: {
    orderBy: [asc(tournaments.date), asc(tournaments.id)],
    key: ({ tournament }) => Date.parse(tournament.date),
    after: (cursor) => gt(tournaments.date, toDateString(cursor)),
    at: (cursor) => eq(tournaments.date, toDateString(cursor)),
  },
  live: {
    orderBy: [desc(tournaments.startedAt), desc(tournaments.id)],
    key: ({ tournament }) => tournament.startedAt!.getTime(),
    after: (cursor) => lt(tournaments.startedAt, new Date(cursor)),
    at: (cursor) => eq(tournaments.startedAt, new Date(cursor)),
  },
  finished: {
    orderBy: [desc(tournaments.closedAt), desc(tournaments.id)],
    key: ({ tournament }) => tournament.closedAt!.getTime(),
    after: (cursor) => lt(tournaments.closedAt, new Date(cursor)),
    at: (cursor) => eq(tournaments.closedAt, new Date(cursor)),
  },
};

const statusCondition = (status: TournamentStatus, today: string) => {
  switch (status) {
    case 'upcoming':
      return and(isNull(tournaments.startedAt), gte(tournaments.date, today));
    case 'live':
      return and(
        isNotNull(tournaments.startedAt),
        isNull(tournaments.closedAt),
      );
    case 'finished':
      return isNotNull(tournaments.closedAt);
  }
};

// a tournament is nearby when its own venue is, or when it has none and its club is
async function nearbyCondition(nearby: Nearby | null) {
  if (!nearby) return undefined;
  const [clubDistances, tournamentIds] = await Promise.all([
    getNearbyClubDistances(nearby),
    getNearbyTournamentIds(nearby),
  ]);
  return or(
    and(
      isNull(tournaments.latitude),
      inArray(tournaments.clubId, [...clubDistances.keys()]),
    ),
    inArray(tournaments.id, tournamentIds),
  );
}

const filterConditions = (
  { format, type, rated, search }: TournamentsListFiltersModel,
  nearby: SQL | undefined,
) => [
  format && eq(tournaments.format, format),
  type && eq(tournaments.type, type),
  rated !== undefined ? eq(tournaments.rated, rated) : undefined,
  search
    ? or(
        lowerLike(tournaments.title, `%${search}%`),
        lowerLike(clubs.name, `%${search}%`),
      )
    : undefined,
  nearby,
];

export async function getTournamentStatusCounts(
  filters: TournamentsListFiltersModel,
  today: string,
): Promise<TournamentStatusCountsModel> {
  'use cache';
  cacheTag(CACHE_TAGS.ALL_TOURNAMENTS);
  const nearby = await nearbyCondition(toNearby(filters));
  const countStatus = async (status: TournamentStatus) => {
    const [result] = await db
      .select({ count: count() })
      .from(tournaments)
      .innerJoin(clubs, eq(tournaments.clubId, clubs.id))
      .where(
        and(
          ...filterConditions(filters, nearby),
          statusCondition(status, today),
        ),
      );
    return result?.count ?? 0;
  };
  const [upcoming, live, finished] = await Promise.all([
    countStatus('upcoming'),
    countStatus('live'),
    countStatus('finished'),
  ]);
  return { upcoming, live, finished };
}

export default async function getAllTournamentsInfinite({
  limit = 10,
  cursor,
  status,
  today,
  ...filters
}: TournamentsListFiltersModel & {
  limit?: number;
  cursor?: number;
  status?: TournamentStatus;
  today: string;
}): Promise<{
  tournaments: TournamentListItemModel[];
  nextCursor: number | null;
}> {
  'use cache';
  cacheTag(CACHE_TAGS.ALL_TOURNAMENTS);
  const ordering = ORDERINGS[status ?? 'all'];
  const nearby = toNearby(filters);
  const baseConditions = [
    ...filterConditions(filters, await nearbyCondition(nearby)),
    status && statusCondition(status, today),
  ];
  const query = (where?: SQL) =>
    db
      .select()
      .from(tournaments)
      .innerJoin(clubs, eq(tournaments.clubId, clubs.id))
      .where(and(...baseConditions, where))
      .orderBy(...ordering.orderBy);

  const { rows, nextCursor } = await paginate(
    await query(cursor ? ordering.after(cursor) : undefined).limit(limit + 1),
    limit,
    ordering.key,
    (lastKey) => query(ordering.at(lastKey)),
  );

  return {
    tournaments: await withSummaries(rows, nearby),
    nextCursor,
  };
}

// the cursor is exclusive, so a page can't end in the middle of rows sharing a key
async function paginate(
  results: Row[],
  limit: number,
  key: (row: Row) => number,
  fetchTied: (lastKey: number) => Promise<Row[]>,
) {
  if (results.length <= limit) return { rows: results, nextCursor: null };

  const extra = results.pop()!;
  const lastKey = key(results[results.length - 1]);
  if (key(extra) !== lastKey) return { rows: results, nextCursor: lastKey };

  const tied = await fetchTied(lastKey);
  return {
    rows: [...results.filter((row) => key(row) !== lastKey), ...tied],
    nextCursor: lastKey,
  };
}

async function withSummaries(
  rows: Row[],
  nearby: Nearby | null,
): Promise<TournamentListItemModel[]> {
  if (!rows.length) return [];
  const ids = rows.map(({ tournament }) => tournament.id);
  const finishedIds = rows
    .filter(({ tournament }) => tournament.closedAt)
    .map(({ tournament }) => tournament.id);

  const [unitCounts, podiumUnits] = await Promise.all([
    db
      .select({ tournamentId: tournament_units.tournamentId, count: count() })
      .from(tournament_units)
      .where(inArray(tournament_units.tournamentId, ids))
      .groupBy(tournament_units.tournamentId),
    finishedIds.length
      ? db
          .select({
            id: tournament_units.id,
            tournamentId: tournament_units.tournamentId,
            nickname: tournament_units.nickname,
            place: tournament_units.place,
            wins: tournament_units.wins,
            draws: tournament_units.draws,
          })
          .from(tournament_units)
          .where(
            and(
              inArray(tournament_units.tournamentId, finishedIds),
              lte(tournament_units.place, PODIUM_SIZE),
            ),
          )
          .orderBy(asc(tournament_units.place))
      : [],
  ]);

  const countByTournament = new Map(
    unitCounts.map(({ tournamentId, count }) => [tournamentId, count]),
  );
  return rows.map(({ tournament, club }) => {
    const coordinates = getTournamentCoordinates(tournament, club);
    return {
      tournament,
      club,
      place: getPlace(coordinates.latitude, coordinates.longitude),
      distanceKm: nearby ? distanceKm(nearby.point, coordinates) : null,
      playersCount: countByTournament.get(tournament.id) ?? 0,
      podium: podiumUnits
        .filter((unit) => unit.tournamentId === tournament.id)
        .map(({ id, nickname, place, wins, draws }) => ({
          id,
          nickname,
          place: place!,
          score: wins + draws / 2,
        })),
    };
  });
}
