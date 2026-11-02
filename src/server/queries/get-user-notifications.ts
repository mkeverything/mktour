import { db } from '@/server/db';
import { clubs } from '@/server/db/schema/clubs';
import { user_notifications } from '@/server/db/schema/notifications';
import { affiliations, players } from '@/server/db/schema/players';
import { tournaments } from '@/server/db/schema/tournaments';
import { and, count, desc, eq, or } from 'drizzle-orm';

export const getNotificationsCounter = async (userId: string) => {
  return (
    (
      await db
        .select({
          count: count(),
        })
        .from(user_notifications)
        .where(
          and(
            eq(user_notifications.userId, userId),
            eq(user_notifications.isSeen, false),
          ),
        )
    ).at(0)?.count ?? 0
  );
};

export const getAuthNotifications = async ({
  limit,
  offset,
  userId,
}: {
  limit: number;
  offset: number;
  userId: string;
}) => {
  const result = await db
    .select({
      notification: user_notifications,
      player: { id: players.id, nickname: players.nickname },
      club: clubs,
      tournament: { id: tournaments.id, title: tournaments.title },
    })
    .from(user_notifications)
    .where(eq(user_notifications.userId, userId))
    .leftJoin(
      affiliations,
      eq(affiliations.id, user_notifications.affiliationId),
    )
    .leftJoin(players, eq(players.id, affiliations.playerId))
    .leftJoin(
      clubs,
      or(
        eq(clubs.id, affiliations.clubId),
        eq(clubs.id, user_notifications.clubId),
      ),
    )
    .leftJoin(tournaments, eq(tournaments.id, user_notifications.tournamentId))
    .orderBy(desc(user_notifications.createdAt))
    .limit(limit + 1)
    .offset(offset);

  let nextCursor: number | null = null;
  if (result.length > limit) {
    nextCursor = offset + limit;
  }
  return {
    notifications: result.slice(0, limit),
    nextCursor,
  };
};
