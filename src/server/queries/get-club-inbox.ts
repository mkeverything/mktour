import { db } from '@/server/db';
import { club_notifications } from '@/server/db/schema/notifications';
import { affiliations, players } from '@/server/db/schema/players';
import { users } from '@/server/db/schema/users';
import { and, desc, eq, getColumns, inArray, or, sql } from 'drizzle-orm';
import { unionAll } from 'drizzle-orm/pg-core';

type InboxKind = 'affiliation' | 'notification';

export default async function getClubInbox({
  clubId,
  cursor,
  limit,
}: {
  clubId: string;
  cursor: number;
  limit: number;
}) {
  const page = await unionAll(
    db
      .select({
        id: affiliations.id,
        kind: sql<InboxKind>`'affiliation'`.as('kind'),
        createdAt: affiliations.createdAt,
      })
      .from(affiliations)
      .where(eq(affiliations.clubId, clubId)),
    db
      .select({
        id: club_notifications.id,
        kind: sql<InboxKind>`'notification'`.as('kind'),
        createdAt: club_notifications.createdAt,
      })
      .from(club_notifications)
      .where(eq(club_notifications.clubId, clubId)),
  )
    .orderBy(desc(affiliations.createdAt))
    .limit(limit + 1)
    .offset(cursor);

  const idsOf = (kind: InboxKind) =>
    page
      .slice(0, limit)
      .filter((row) => row.kind === kind)
      .map((row) => row.id);

  const [affiliationRows, notificationRows] = await Promise.all([
    db
      .select({
        ...getColumns(affiliations),
        user: users,
        player: { id: players.id, nickname: players.nickname },
      })
      .from(affiliations)
      .innerJoin(users, eq(users.id, affiliations.userId))
      .innerJoin(players, eq(players.id, affiliations.playerId))
      .where(inArray(affiliations.id, idsOf('affiliation'))),
    db
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
      .where(inArray(club_notifications.id, idsOf('notification'))),
  ]);

  const items = [
    ...affiliationRows.map((row) => ({ ...row, kind: 'affiliation' as const })),
    ...notificationRows.map((row) => ({
      ...row,
      kind: 'notification' as const,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return {
    items,
    nextCursor: page.length > limit ? cursor + limit : null,
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
