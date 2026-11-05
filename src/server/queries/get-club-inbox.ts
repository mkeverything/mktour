import { db } from '@/server/db';
import { club_notifications } from '@/server/db/schema/notifications';
import { affiliations, players } from '@/server/db/schema/players';
import { users } from '@/server/db/schema/users';
import { and, desc, eq, getColumns, or } from 'drizzle-orm';

export default async function getClubInbox({
  clubId,
  cursor,
  limit,
}: {
  clubId: string;
  cursor: number;
  limit: number;
}) {
  const end = cursor + limit;
  const [affiliationItems, notificationItems] = await Promise.all([
    getNewestAffiliations(clubId, end + 1),
    getNewestNotifications(clubId, end + 1),
  ]);
  const items = [...affiliationItems, ...notificationItems].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

  return {
    items: items.slice(cursor, end),
    nextCursor: items.length > end ? end : null,
  };
}

async function getNewestAffiliations(clubId: string, limit: number) {
  const rows = await db
    .select({
      ...getColumns(affiliations),
      user: users,
      player: { id: players.id, nickname: players.nickname },
    })
    .from(affiliations)
    .innerJoin(users, eq(users.id, affiliations.userId))
    .innerJoin(players, eq(players.id, affiliations.playerId))
    .where(eq(affiliations.clubId, clubId))
    .orderBy(desc(affiliations.createdAt), desc(affiliations.id))
    .limit(limit);
  return rows.map((row) => ({ ...row, kind: 'affiliation' as const }));
}

async function getNewestNotifications(clubId: string, limit: number) {
  const rows = await db
    .select({
      ...getColumns(club_notifications),
      user: users,
      player: players,
    })
    .from(club_notifications)
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
    .where(eq(club_notifications.clubId, clubId))
    .orderBy(desc(club_notifications.createdAt), desc(club_notifications.id))
    .limit(limit);
  return rows.map((row) => ({ ...row, kind: 'notification' as const }));
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
