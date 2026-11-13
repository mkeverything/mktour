import { lower } from '@/lib/sql-lower';
import { reverse, sortExpressions, type Ordering } from '@/lib/sql-order';
import { getLinkIconPath } from '@/server/club-links';
import { db } from '@/server/db';
import { clubs } from '@/server/db/schema/clubs';
import { player_stats, players } from '@/server/db/schema/players';
import { tournaments } from '@/server/db/schema/tournaments';
import { RANK_ORDERS } from '@/server/mutations/player-stats';
import { ClubModel } from '@/server/zod/clubs';
import {
  ClubPlayersFilterModel,
  ClubPlayersInputModel,
} from '@/server/zod/players';
import { and, countDistinct, desc, eq, ilike, or } from 'drizzle-orm';

const ORDERINGS: Record<ClubPlayersFilterModel['sortBy'], Ordering> = {
  rating: RANK_ORDERS.ratingRank,
  tournamentsPlayed: RANK_ORDERS.tournamentsPlayedRank,
  nickname: [[lower(players.nickname), 'asc']],
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
  const [club] = await db.select().from(clubs).where(eq(clubs.id, id));

  if (!club) return null;

  return {
    ...club,
    links: club.links.map((url) => ({
      url,
      path: getLinkIconPath(url),
    })),
  };
};

export const getClubPlayers = async (input: ClubPlayersInputModel) => {
  const { clubId, limit, cursor, sortBy, order, search } = input;
  const pattern = `%${search}%`;
  const offset = cursor ?? 0;
  const ordering = ORDERINGS[sortBy];
  const [, defaultOrder] = ordering[0];
  const result = await selectClubPlayers()
    .where(
      and(
        eq(players.clubId, clubId),
        search
          ? or(
              ilike(players.nickname, pattern),
              ilike(players.realname, pattern),
            )
          : undefined,
      ),
    )
    .orderBy(
      ...sortExpressions(order === defaultOrder ? ordering : reverse(ordering)),
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
    .then((rows) => rows.at(0));

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
      // isPlayerSelfReportingEnabled: clubs.isPlayerSelfReportingEnabled, // this is internal setting, why to include here?
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
