import 'server-only';

import { AppError } from '@/lib/errors';
import { validateRequest } from '@/lib/auth/lucia';
import { CACHE_TAGS } from '@/lib/cache-tags';
import { db } from '@/server/db';
import { clubs, clubs_to_users } from '@/server/db/schema/clubs';
import { user_notifications } from '@/server/db/schema/notifications';
import { affiliations, players } from '@/server/db/schema/players';
import {
  games,
  players_to_units,
  tournament_units,
  tournaments,
} from '@/server/db/schema/tournaments';
import { sessions, user_preferences, users } from '@/server/db/schema/users';
import { publishUserNotification } from '@/server/events';
import {
  deleteClubFunction,
  promoteSuccessorCoOwners,
} from '@/server/mutations/club-managing';
import { EditProfileFormModel } from '@/server/zod/users';
import { count, eq, inArray, sql } from 'drizzle-orm';
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
  if (!user) throw new AppError('UNAUTHENTICATED');
  if (user.id !== userId) throw new AppError('USER_MISMATCH');

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
      // concurrent deletions could remove more clubs after one fails; stop before starting the next club.
      // react-doctor-disable-next-line react-doctor/async-await-in-loop
      await deleteClubFunction({
        userId,
        clubId: notSelectedClubs[clubId],
        userDeletion: true,
      });
    }
  }

  const clubId = user.selectedClub;

  const promotedUserIds = await db.transaction(async (tx) => {
    const managedClubs = await tx
      .select({ clubId: clubs_to_users.clubId })
      .from(clubs_to_users)
      .where(eq(clubs_to_users.userId, userId));
    const successorIds = await promoteSuccessorCoOwners(tx, {
      userId,
      clubIds: managedClubs.map(({ clubId }) => clubId),
    });

    if (userClubs.includes(clubId)) {
      const selectedClubTournamentIds = tx
        .select({ id: tournaments.id })
        .from(tournaments)
        .where(eq(tournaments.clubId, clubId));

      await tx
        .delete(games)
        .where(inArray(games.tournamentId, selectedClubTournamentIds));
      const selectedClubUnitIds = tx
        .select({ id: tournament_units.id })
        .from(tournament_units)
        .where(
          inArray(tournament_units.tournamentId, selectedClubTournamentIds),
        );

      await tx
        .delete(players_to_units)
        .where(inArray(players_to_units.unitId, selectedClubUnitIds));
      await tx
        .delete(tournament_units)
        .where(
          inArray(tournament_units.tournamentId, selectedClubTournamentIds),
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
    return successorIds;
  });
  for (const promotedUserId of promotedUserIds) {
    publishUserNotification(promotedUserId);
  }
};
