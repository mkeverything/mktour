import { lowerLike } from '@/lib/sql-sqlite-string';
import { db } from '@/server/db';
import { clubs } from '@/server/db/schema/clubs';
import { players } from '@/server/db/schema/players';
import { tournaments } from '@/server/db/schema/tournaments';
import { users } from '@/server/db/schema/users';
import { SearchParamsModel } from '@/server/zod/search';
import { and, desc, eq, isNotNull, or } from 'drizzle-orm';

export async function globalSearch(params: SearchParamsModel) {
  const { query, filter } = params;
  const queryStr = `%${query}%`;
  if (!query && !filter) return {};
  if (filter && filter.type === 'users') {
    const usersResult = await db
      .select()
      .from(users)
      .where(
        or(
          lowerLike(users.name, queryStr),
          lowerLike(users.username, queryStr),
        ),
      )
      .limit(15);
    return { users: usersResult };
  }
  if (filter && filter.type === 'players') {
    const { clubId } = filter;
    const playersResult = await db
      .select()
      .from(players)
      .where(
        and(
          or(
            lowerLike(players.nickname, queryStr),
            lowerLike(players.realname, queryStr),
          ),
          eq(players.clubId, clubId),
        ),
      )
      .orderBy(desc(players.lastSeenAt))
      .limit(15);
    return { players: playersResult };
  }
  if (filter && filter.type === 'tournaments') {
    const { clubId } = filter;
    if (!query) {
      const tournamentsResult = await db
        .select()
        .from(tournaments)
        .where(eq(tournaments.clubId, clubId))
        .limit(15);
      return { tournaments: tournamentsResult };
    }
    const tournamentsResult = await db
      .select()
      .from(tournaments)
      .where(
        and(
          lowerLike(tournaments.title, queryStr),
          eq(tournaments.clubId, clubId),
        ),
      )
      .limit(15);
    return { tournaments: tournamentsResult };
  }
  const playersDb = db
    .select()
    .from(players)
    .where(lowerLike(players.nickname, queryStr))
    .orderBy(desc(players.lastSeenAt))
    .limit(5);
  const usersDb = db
    .select()
    .from(users)
    .where(
      or(lowerLike(users.name, queryStr), lowerLike(users.username, queryStr)),
    )
    .limit(5);
  const tournamentsDb = db
    .select()
    .from(tournaments)
    .where(lowerLike(tournaments.title, queryStr))
    .limit(5);
  const clubsDb = db
    .selectDistinct({
      id: clubs.id,
      name: clubs.name,
      description: clubs.description,
      createdAt: clubs.createdAt,
      lichessTeam: clubs.lichessTeam,
      allowPlayersSetResults: clubs.allowPlayersSetResults,
    })
    .from(clubs)
    .innerJoin(tournaments, eq(clubs.id, tournaments.clubId))
    .where(
      and(lowerLike(clubs.name, queryStr), isNotNull(tournaments.closedAt)),
    )
    .limit(5);

  const [playersResult, usersResult, tournamentsResult, clubsResult] =
    await Promise.all([playersDb, usersDb, tournamentsDb, clubsDb]);

  const data = {
    players: playersResult,
    users: usersResult,
    tournaments: tournamentsResult,
    clubs: clubsResult,
  };
  return data;
}
