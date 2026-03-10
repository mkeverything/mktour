import { CACHE_TAGS } from '@/lib/cache-tags';
import { db } from '@/server/db';
import { clubs } from '@/server/db/schema/clubs';
import { tournaments } from '@/server/db/schema/tournaments';
import type {
  TournamentFormat,
  TournamentStatus,
  TournamentType,
} from '@/server/zod/enums';
import {
  type SQLWrapper,
  and,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
  sql,
} from 'drizzle-orm';
import { cacheTag } from 'next/cache';

export default async function getAllTournaments({
  limit = 10,
  cursor,
  filter,
}: {
  limit?: number;
  cursor?: number;
  filter?: AllTournamentsFilter;
} = {}) {
  'use cache';
  cacheTag(CACHE_TAGS.ALL_TOURNAMENTS);
  const cursorDate = cursor ? new Date(cursor) : undefined;

  const whereConditions: SQLWrapper[] = [];

  if (cursorDate) {
    whereConditions.push(lt(tournaments.createdAt, cursorDate));
  }

  const trimmedSearch = filter?.search?.trim();
  if (trimmedSearch) {
    const searchPattern = `%${trimmedSearch}%`;
    const searchCondition = or(
      sql`lower(${tournaments.title}) like lower(${searchPattern})`,
      sql`lower(${clubs.name}) like lower(${searchPattern})`,
    );
    if (searchCondition) whereConditions.push(searchCondition);
  }

  if (filter?.rated !== undefined && filter.rated !== null) {
    whereConditions.push(eq(tournaments.rated, filter.rated));
  }

  if (filter?.formats && filter.formats.length > 0) {
    whereConditions.push(inArray(tournaments.format, filter.formats));
  }

  if (filter?.types && filter.types.length > 0) {
    whereConditions.push(inArray(tournaments.type, filter.types));
  }

  if (filter?.statuses && filter.statuses.length > 0) {
    const statusConditions: SQLWrapper[] = [];

    if (filter.statuses.includes('upcoming')) {
      const upcomingCondition = and(
        isNull(tournaments.startedAt),
        isNull(tournaments.closedAt),
      );
      if (upcomingCondition) statusConditions.push(upcomingCondition);
    }

    if (filter.statuses.includes('ongoing')) {
      const ongoingCondition = and(
        isNotNull(tournaments.startedAt),
        isNull(tournaments.closedAt),
      );
      if (ongoingCondition) statusConditions.push(ongoingCondition);
    }

    if (filter.statuses.includes('finished')) {
      statusConditions.push(isNotNull(tournaments.closedAt));
    }

    if (statusConditions.length > 0) {
      const statusCondition = or(...statusConditions);
      if (statusCondition) whereConditions.push(statusCondition);
    }
  }

  const where =
    whereConditions.length > 0 ? and(...whereConditions) : undefined;

  const results = await db
    .select()
    .from(tournaments)
    .innerJoin(clubs, eq(tournaments.clubId, clubs.id))
    .where(where)
    .orderBy(desc(tournaments.createdAt))
    .limit(limit + 1);

  let nextCursor: number | null = null;
  if (results.length > limit) {
    const nextItem = results.pop();
    nextCursor = nextItem?.tournament.createdAt.getTime() ?? null;
  }

  return {
    tournaments: results,
    nextCursor,
  };
}

type AllTournamentsFilter = {
  search?: string;
  rated?: boolean | null;
  formats?: TournamentFormat[];
  types?: TournamentType[];
  statuses?: TournamentStatus[];
};
