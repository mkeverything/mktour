import { SearchParamsModel } from '@/server/db/zod/search';
import { db } from '@/server/db';
import { clubs } from '@/server/db/schema/clubs';
import { players } from '@/server/db/schema/players';
import { tournaments } from '@/server/db/schema/tournaments';
import { users } from '@/server/db/schema/users';
import { and, eq, or, sql } from 'drizzle-orm';

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
          sql`lower(${users.name}) like lower(${queryStr})`,
          sql`lower(${users.username}) like lower(${queryStr})`,
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
            sql`lower(${players.nickname}) like lower(${queryStr})`,
            sql`lower(${players.realname}) like lower(${queryStr})`,
          ),
          eq(players.clubId, clubId),
        ),
      )
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
          sql`lower(${tournaments.title}) like lower(${queryStr})`,
          eq(tournaments.clubId, clubId),
        ),
      )
      .limit(15);
    return { tournaments: tournamentsResult };
  }
  const playersDb = db
    .select()
    .from(players)
    .where(sql`lower(${players.nickname}) like lower(${queryStr})`)
    .limit(5);
  const usersDb = db
    .select()
    .from(users)
    .where(
      or(
        sql`lower(${users.name}) like lower(${queryStr})`,
        sql`lower(${users.username}) like lower(${queryStr})`,
      ),
    )
    .limit(5);
  const tournamentsDb = db
    .select()
    .from(tournaments)
    .where(sql`lower(${tournaments.title}) like lower(${queryStr})`)
    .limit(5);
  const clubsDb = db
    .select()
    .from(clubs)
    .where(sql`lower(${clubs.name}) like lower(${queryStr})`)
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
