import { lower, lowerLike } from '@/lib/sql-sqlite-string';
import { db } from '@/server/db';
import { clubs } from '@/server/db/schema/clubs';
import { player_stats, players } from '@/server/db/schema/players';
import { tournaments } from '@/server/db/schema/tournaments';
import { ClubModel } from '@/server/zod/clubs';
import {
  ClubPlayersFilterModel,
  ClubPlayersSortModel,
  PlayerRecordModel,
} from '@/server/zod/players';
import {
  asc,
  countDistinct,
  desc,
  eq,
  getColumns,
  or,
  sql,
  SQL,
} from 'drizzle-orm';

const BY_NICKNAME = [asc(lower(players.nickname)), asc(players.id)];
const BY_RATING = [desc(players.rating), ...BY_NICKNAME];

// how each column ranks players; the other order lists the same ranking reversed, so positions never change
const RANKINGS: Record<
  ClubPlayersSortModel['sortBy'],
  { order: ClubPlayersSortModel['order']; by: SQL[] }
> = {
  rating: { order: 'desc', by: BY_RATING },
  tournamentsPlayed: {
    order: 'desc',
    by: [desc(player_stats.tournamentsPlayed), ...BY_RATING],
  },
  nickname: { order: 'asc', by: BY_NICKNAME },
};

// ranks the whole club before anything filters it, so searched or single players keep their real position
const rankedClubPlayers = (
  clubId: PlayerRecordModel['clubId'],
  sortBy: ClubPlayersSortModel['sortBy'],
) => {
  const rankBy = sql.join(RANKINGS[sortBy].by, sql`, `);
  const position = sql<number>`row_number() over (order by ${rankBy})`;
  return db
    .select({
      ...getColumns(players),
      tournamentsPlayed: player_stats.tournamentsPlayed,
      position: position.as('position'),
    })
    .from(players)
    .innerJoin(player_stats, eq(player_stats.playerId, players.id))
    .where(eq(players.clubId, clubId))
    .as('ranked');
};

export const getClubInfo = async (id: ClubModel['id']) => {
  const data = (await db.select().from(clubs).where(eq(clubs.id, id)))?.at(0);
  if (!data) return null;
  return data;
};

export const getClubPlayers = async (
  clubId: PlayerRecordModel['clubId'],
  limit: number,
  cursor: number | null | undefined,
  { sortBy, order, search }: ClubPlayersFilterModel,
) => {
  const ranked = rankedClubPlayers(clubId, sortBy);
  const direction = order === RANKINGS[sortBy].order ? asc : desc;
  const pattern = `%${search}%`;
  const offset = cursor ?? 0;
  const result = await db
    .select()
    .from(ranked)
    .where(
      search
        ? or(
            lowerLike(ranked.nickname, pattern),
            lowerLike(ranked.realname, pattern),
          )
        : undefined,
    )
    .orderBy(direction(ranked.position))
    .offset(offset)
    .limit(limit + 1);

  return {
    players: result.slice(0, limit),
    nextCursor: result.length > limit ? offset + limit : null,
  };
};

export const getUserClubPlayer = async ({
  clubId,
  userId,
  sortBy,
}: {
  clubId: string;
  userId: string;
  sortBy: ClubPlayersSortModel['sortBy'];
}) => {
  const ranked = rankedClubPlayers(clubId, sortBy);
  const player = await db
    .select()
    .from(ranked)
    .where(eq(ranked.userId, userId))
    .get();

  return player ?? null;
};

export const getPublicPopularClubs = async (limit: number) => {
  return await db
    .select({
      id: clubs.id,
      name: clubs.name,
      description: clubs.description,
      createdAt: clubs.createdAt,
      lichessTeam: clubs.lichessTeam,
      // allowPlayersSetResults: clubs.allowPlayersSetResults, // this is internal setting, why to include here?
    })
    .from(clubs)
    .leftJoin(tournaments, eq(clubs.id, tournaments.clubId))
    .leftJoin(players, eq(clubs.id, players.clubId))
    .groupBy(clubs.id)
    .orderBy(
      desc(countDistinct(tournaments.id)),
      desc(countDistinct(players.id)),
    )
    .limit(limit);
};
