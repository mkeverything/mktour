'use server';

import { validateRequest } from '@/lib/auth/lucia';
import { CACHE_TAGS } from '@/lib/cache-tags';
import { db } from '@/server/db';
import { clubs, clubs_to_users } from '@/server/db/schema/clubs';
import { user_notifications } from '@/server/db/schema/notifications';
import { affiliations, players } from '@/server/db/schema/players';
import {
  games,
  players_to_tournaments,
  tournaments,
} from '@/server/db/schema/tournaments';
import { sessions, user_preferences, users } from '@/server/db/schema/users';
import { EditProfileFormModel } from '@/server/db/zod/users';
import { deleteClubFunction } from '@/server/mutations/club-managing';
import { and, asc, count, eq, sql } from 'drizzle-orm';
import { revalidateTag } from 'next/cache';

export const editUser = async (
  userId: string,
  values: EditProfileFormModel,
) => {
  const [user] = await db
    .update(users)
    .set(values)
    .where(eq(users.id, userId))
    .returning();
  revalidateTag(CACHE_TAGS.AUTH, 'max');
  return user;
};

export const deleteUser = async ({ userId }: { userId: string }) => {
  const { user } = await validateRequest();
  if (!user) throw new Error('UNAUTHORIZED_REQUEST');
  if (user.id !== userId) throw new Error('USER_NOT_MATCHING');

  const subqueryToFilterMultipleAdmins = db
    .select({
      clubId: clubs_to_users.clubId,
    })
    .from(clubs_to_users)
    .groupBy(clubs_to_users.clubId)
    .having(eq(count(), 1));

  const userClubs = (
    await db
      .select({
        clubId: clubs_to_users.clubId,
      })
      .from(clubs_to_users)
      .where(
        sql`${clubs_to_users.clubId} IN (${subqueryToFilterMultipleAdmins}) AND ${clubs_to_users.userId} = ${userId}`,
      )
  ).map((el) => el.clubId);

  let notSelectedClubs: string[] = [];
  if (userClubs.length !== 0) {
    notSelectedClubs = userClubs.filter(
      (clubId) => clubId !== user.selectedClub,
    );
  }

  if (notSelectedClubs.length !== 0) {
    for (const clubId in notSelectedClubs) {
      await deleteClubFunction({
        userId,
        clubId: notSelectedClubs[clubId],
        userDeletion: true,
      });
    }
  }

  const clubId = user.selectedClub;

  const clubsNeedingPromotion = await db
    .select({
      clubId: clubs_to_users.clubId,
    })
    .from(clubs_to_users)
    .where(
      and(
        eq(clubs_to_users.userId, userId),
        eq(clubs_to_users.status, 'co-owner'),
      ),
    )
    .groupBy(clubs_to_users.clubId);

  const clubsToPromote: string[] = [];
  if (clubsNeedingPromotion.length > 0) {
    const clubIds = clubsNeedingPromotion.map((c) => c.clubId);

    const coOwnerCounts = await db
      .select({
        clubId: clubs_to_users.clubId,
        count: count(),
      })
      .from(clubs_to_users)
      .where(
        and(
          sql`${clubs_to_users.clubId} IN (${sql.join(
            clubIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
          eq(clubs_to_users.status, 'co-owner'),
        ),
      )
      .groupBy(clubs_to_users.clubId);

    for (const { clubId, count } of coOwnerCounts) {
      if (count === 1) {
        clubsToPromote.push(clubId);
      }
    }
  }

  if (clubsToPromote.length > 0) {
    const allAdmins = await db
      .select()
      .from(clubs_to_users)
      .where(
        and(
          sql`${clubs_to_users.clubId} IN (${sql.join(
            clubsToPromote.map((id) => sql`${id}`),
            sql`, `,
          )})`,
          eq(clubs_to_users.status, 'admin'),
        ),
      )
      .orderBy(asc(clubs_to_users.promotedAt));

    const oldestAdminsByClub = new Map<string, (typeof allAdmins)[0]>();
    for (const admin of allAdmins) {
      if (!oldestAdminsByClub.has(admin.clubId)) {
        oldestAdminsByClub.set(admin.clubId, admin);
      }
    }

    const promotionDate = new Date();
    const updatePromises = Array.from(oldestAdminsByClub.values()).map(
      (admin) =>
        db
          .update(clubs_to_users)
          .set({
            status: 'co-owner',
            promotedAt: promotionDate,
          })
          .where(eq(clubs_to_users.id, admin.id)),
    );

    await Promise.all(updatePromises);
  }

  await db.transaction(async (tx) => {
    if (userClubs.includes(clubId)) {
      await tx
        .delete(games)
        .where(
          eq(
            games.tournamentId,
            tx
              .select({ id: tournaments.id })
              .from(tournaments)
              .where(eq(tournaments.clubId, clubId)),
          ),
        );
      await tx
        .delete(players_to_tournaments)
        .where(
          eq(
            players_to_tournaments.tournamentId,
            tx
              .select({ id: tournaments.id })
              .from(tournaments)
              .where(eq(tournaments.clubId, clubId)),
          ),
        );
      await tx.delete(players).where(eq(players.clubId, clubId));
      await tx.delete(tournaments).where(eq(tournaments.clubId, clubId));
    }

    await tx
      .update(players)
      .set({ userId: null })
      .where(eq(players.userId, userId));

    await tx
      .delete(user_notifications)
      .where(eq(user_notifications.userId, userId));

    await tx.delete(affiliations).where(eq(affiliations.userId, userId));

    await tx.delete(clubs_to_users).where(eq(clubs_to_users.userId, userId));
    await tx
      .delete(user_preferences)
      .where(eq(user_preferences.userId, userId));
    await tx.delete(sessions).where(eq(sessions.userId, userId));
    await tx.delete(users).where(eq(users.id, userId));
    if (userClubs.includes(clubId))
      await tx.delete(clubs).where(eq(clubs.id, clubId));
  });
};
