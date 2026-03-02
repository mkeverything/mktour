import { db } from '@/server/db';
import { club_notifications } from '@/server/db/schema/notifications';
import { affiliations, players } from '@/server/db/schema/players';
import { users } from '@/server/db/schema/users';
import { AnyClubNotificationExtended } from '@/types/notifications';
import { desc, eq, getTableColumns, sql } from 'drizzle-orm';

export default async function getClubNotifications({
  clubId,
  cursor,
  limit,
}: {
  clubId: string;
  cursor: number;
  limit: number;
}) {
  // always read userId and playerId from metadata for consistency
  const result = (await db
    .select({
      ...getTableColumns(club_notifications),
      affiliation: affiliations,
      user: users,
      player: players,
    })
    .from(club_notifications)
    .where(eq(club_notifications.clubId, clubId))
    .leftJoin(
      affiliations,
      sql`json_extract(${club_notifications.metadata}, '$.affiliationId') = ${affiliations.id}`,
    )
    .leftJoin(
      users,
      eq(
        users.id,
        sql`json_extract(${club_notifications.metadata}, '$.userId')`,
      ),
    )
    .leftJoin(
      players,
      eq(
        players.id,
        sql`json_extract(${club_notifications.metadata}, '$.playerId')`,
      ),
    )
    .orderBy(desc(club_notifications.createdAt))
    .limit(limit + 1)
    .offset(cursor)) as unknown as AnyClubNotificationExtended[];

  let nextCursor: number | null = null;
  if (result.length > limit) {
    nextCursor = cursor + limit;
  }
  return {
    notifications: result.slice(0, limit),
    nextCursor,
  };
}
