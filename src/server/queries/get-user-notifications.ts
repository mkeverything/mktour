import { db } from '@/server/db';
import { clubs } from '@/server/db/schema/clubs';
import { user_notifications } from '@/server/db/schema/notifications';
import { affiliations, players } from '@/server/db/schema/players';
import { users } from '@/server/db/schema/users';
import { AnyUserNotificationExtended } from '@/types/notifications';
import { and, count, desc, eq, or, sql } from 'drizzle-orm';

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
}): Promise<{
  notifications: AnyUserNotificationExtended[];
  nextCursor: number | null;
}> => {
  const result = (await db
    .select({
      event: user_notifications.event,
      affiliation: affiliations,
      notification: user_notifications,
      metadata: user_notifications.metadata,
      player: { nickname: players.nickname, id: players.id },
      club: clubs,
    })
    .from(user_notifications)
    .where(eq(user_notifications.userId, userId))
    .leftJoin(
      affiliations,
      eq(
        affiliations.id,
        sql`${user_notifications.metadata}->>'affiliationId'`,
      ),
    )
    .leftJoin(users, eq(users.id, affiliations.userId))
    .leftJoin(players, eq(players.id, affiliations.playerId))
    .leftJoin(
      clubs,
      or(
        eq(clubs.id, affiliations.clubId),
        eq(clubs.id, sql`${user_notifications.metadata}->>'clubId'`),
      ),
    )
    .orderBy(desc(user_notifications.createdAt))
    .limit(limit + 1)
    .offset(offset)) as unknown as AnyUserNotificationExtended[];

  let nextCursor: number | null = null;
  if (result.length > limit) {
    nextCursor = offset + limit;
  }
  return {
    notifications: result.slice(0, limit),
    nextCursor,
  };
};
