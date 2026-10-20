import { lower, lowerLike } from '@/lib/sql-sqlite-string';
import { db } from '@/server/db';
import { clubs } from '@/server/db/schema/clubs';
import { player_stats, players } from '@/server/db/schema/players';
import { tournaments } from '@/server/db/schema/tournaments';
import { ClubModel } from '@/server/zod/clubs';
import {
  ClubPlayersFilterModel,
  PlayerRecordModel,
} from '@/server/zod/players';
import {
  and,
  asc,
  countDistinct,
  desc,
  eq,
  or,
  type AnyColumn,
  type SQL,
} from 'drizzle-orm';

type Ordering = [
  column: AnyColumn | SQL,
  direction: ClubPlayersFilterModel['order'],
][];

// rankClubPlayers numbers players in this order, so stored ranks count along the list
const BY_RATING: Ordering = [
  [players.rating, 'desc'],
  [players.ratingDeviation, 'asc'],
  [players.lastSeenAt, 'asc'],
  [players.id, 'asc'],
];

const ORDERINGS: Record<ClubPlayersFilterModel['sortBy'], Ordering> = {
  rating: BY_RATING,
  tournamentsPlayed: [[player_stats.tournamentsPlayed, 'desc'], ...BY_RATING],
  nickname: [
    [lower(players.nickname), 'asc'],
    [players.id, 'asc'],
  ],
};

const selectClubPlayers = () =>
  db
    .select({
      id: players.id,
      nickname: players.nickname,
      realname: players.realname,
      rating: players.rating,
      ratingDeviation: players.ratingDeviation,
      tournamentsPlayed: player_stats.tournamentsPlayed,
      ratingRank: player_stats.ratingRank,
      tournamentsPlayedRank: player_stats.tournamentsPlayedRank,
    })
    .from(players)
    .innerJoin(player_stats, eq(player_stats.playerId, players.id));

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
  const pattern = `%${search}%`;
  const offset = cursor ?? 0;
  const ordering = ORDERINGS[sortBy];
  // asking for the sorted column's other direction reverses the whole list
  const directions =
    order === ordering[0][1] ? { asc, desc } : { asc: desc, desc: asc };
  const result = await selectClubPlayers()
    .where(
      and(
        eq(players.clubId, clubId),
        search
          ? or(
              lowerLike(players.nickname, pattern),
              lowerLike(players.realname, pattern),
            )
          : undefined,
      ),
    )
    .orderBy(
      ...ordering.map(([column, direction]) => directions[direction](column)),
    )
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
}: {
  clubId: string;
  userId: string;
}) => {
  const player = await selectClubPlayers()
    .where(and(eq(players.clubId, clubId), eq(players.userId, userId)))
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
