'use server';

import { CACHE_TAGS } from '@/lib/cache-tags';
import { db } from '@/server/db';
import { clubs, clubs_to_users } from '@/server/db/schema/clubs';
import { tournaments } from '@/server/db/schema/tournaments';
import { StatusInClub } from '@/server/zod/enums';
import { and, eq, exists, isNotNull, sql } from 'drizzle-orm';
import { cacheLife, cacheTag } from 'next/cache';
import { cache } from 'react';

export async function getUserClubNames({ userId }: { userId: string }) {
  return await db
    .select({
      id: clubs.id,
      name: clubs.name,
      status: clubs_to_users.status,
      hasFinishedTournaments: exists(
        db
          .select({ one: sql`1` })
          .from(tournaments)
          .where(
            and(
              eq(tournaments.clubId, clubs.id),
              isNotNull(tournaments.closedAt),
            ),
          )
          .limit(1),
      ).mapWith(Boolean),
    })
    .from(clubs_to_users)
    .where(eq(clubs_to_users.userId, userId))
    .innerJoin(clubs, eq(clubs_to_users.clubId, clubs.id));
}

export async function getUserClubs({ userId }: { userId: string }) {
  return (
    await db
      .select()
      .from(clubs_to_users)
      .where(eq(clubs_to_users.userId, userId))
      .innerJoin(clubs, eq(clubs_to_users.clubId, clubs.id))
  ).map((el) => el.club);
}

export const getUserClubIds = cache(async ({ userId }: { userId: string }) => {
  'use cache';
  cacheLife({
    stale: 1000 * 60 * 60,
    revalidate: 1000 * 60 * 60,
  });
  cacheTag(`${CACHE_TAGS.USER_CLUBS}:${userId}`);
  return (
    await db
      .select({
        id: clubs.id,
        status: clubs_to_users.status,
      })
      .from(clubs_to_users)
      .where(eq(clubs_to_users.userId, userId))
      .innerJoin(clubs, eq(clubs_to_users.clubId, clubs.id))
  ).reduce(
    (acc, curr) => {
      acc[curr.id] = curr.status;
      return acc;
    },
    {} as Record<string, StatusInClub>,
  );
});
