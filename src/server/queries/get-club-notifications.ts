import { db } from '@/server/db';
import { club_notifications } from '@/server/db/schema/notifications';
import { affiliations, players } from '@/server/db/schema/players';
import { users } from '@/server/db/schema/users';
import { and, desc, eq, getColumns, or } from 'drizzle-orm';

export default async function getClubNotifications({
  clubId,
  cursor,
  limit,
}: {
  clubId: string;
  cursor: number;
  limit: number;
}) {
  const result = await db
    .select({
      ...getColumns(club_notifications),
      user: users,
      player: players,
    })
    .from(club_notifications)
    .where(eq(club_notifications.clubId, clubId))
    .leftJoin(
      affiliations,
      eq(affiliations.id, club_notifications.affiliationId),
    )
    .leftJoin(
      users,
      or(
        eq(users.id, club_notifications.userId),
        eq(users.id, affiliations.userId),
      ),
    )
    .leftJoin(
      players,
      or(
        eq(players.id, club_notifications.playerId),
        eq(players.id, affiliations.playerId),
      ),
    )
    .orderBy(desc(club_notifications.createdAt))
    .limit(limit + 1)
    .offset(cursor);

  let nextCursor: number | null = null;
  if (result.length > limit) {
    nextCursor = cursor + limit;
  }
  return {
    notifications: result.slice(0, limit),
    nextCursor,
  };
}

export async function getClubInboxCounter(clubId: string) {
  const [requests, notifications] = await Promise.all([
    db.$count(
      affiliations,
      and(
        eq(affiliations.clubId, clubId),
        eq(affiliations.status, 'requested'),
      ),
    ),
    db.$count(
      club_notifications,
      and(
        eq(club_notifications.clubId, clubId),
        eq(club_notifications.isSeen, false),
      ),
    ),
  ]);
  return { requests, notifications };
}
