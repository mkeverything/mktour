import { db } from '@/server/db';
import { clubs } from '@/server/db/schema/clubs';
import { players } from '@/server/db/schema/players';
import { tournaments } from '@/server/db/schema/tournaments';
import { users } from '@/server/db/schema/users';
import { SearchParamsModel } from '@/server/zod/search';
import { and, desc, eq, ilike, isNotNull, or } from 'drizzle-orm';

export async function globalSearch(params: SearchParamsModel) {
  const { query, filter } = params;
  const queryStr = `%${query}%`;
  if (!query && !filter) return {};
  if (filter && filter.type === 'users') {
    const usersResult = await db
      .select()
      .from(users)
      .where(or(ilike(users.name, queryStr), ilike(users.username, queryStr)))
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
            ilike(players.nickname, queryStr),
            ilike(players.realname, queryStr),
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
        and(ilike(tournaments.title, queryStr), eq(tournaments.clubId, clubId)),
      )
      .limit(15);
    return { tournaments: tournamentsResult };
  }
  const playersDb = db
    .select()
    .from(players)
    .where(ilike(players.nickname, queryStr))
    .orderBy(desc(players.lastSeenAt))
    .limit(5);
  const usersDb = db
    .select()
    .from(users)
    .where(or(ilike(users.name, queryStr), ilike(users.username, queryStr)))
    .limit(5);
  const tournamentsDb = db
    .select()
    .from(tournaments)
    .where(ilike(tournaments.title, queryStr))
    .limit(5);
  const clubsDb = db
    .selectDistinct({
      id: clubs.id,
      name: clubs.name,
      description: clubs.description,
      createdAt: clubs.createdAt,
      lichessTeam: clubs.lichessTeam,
      isPlayerSelfReportingEnabled: clubs.isPlayerSelfReportingEnabled,
    })
    .from(clubs)
    .innerJoin(tournaments, eq(clubs.id, tournaments.clubId))
    .where(and(ilike(clubs.name, queryStr), isNotNull(tournaments.closedAt)))
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
