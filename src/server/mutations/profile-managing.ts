import 'server-only';

import { AppError } from '@/lib/errors';
import { validateRequest } from '@/lib/auth/lucia';
import { db } from '@/server/db';
import { lockClubs } from '@/server/db/locks';
import { clubs_to_users } from '@/server/db/schema/clubs';
import { users } from '@/server/db/schema/users';
import { publishUserNotification } from '@/server/events';
import {
  deleteClubFunction,
  deleteClubRows,
  promoteSuccessorCoOwners,
} from '@/server/mutations/club-managing';
import { EditProfileFormModel } from '@/server/zod/users';
import { count, eq, sql } from 'drizzle-orm';

export const editUser = async (
  userId: string,
  values: EditProfileFormModel,
) => {
  const [user] = await db
    .update(users)
    .set(values)
    .where(eq(users.id, userId))
    .returning();
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
    const managedClubIds = (
      await tx
        .select({ clubId: clubs_to_users.clubId })
        .from(clubs_to_users)
        .where(eq(clubs_to_users.userId, userId))
    ).map(({ clubId }) => clubId);
    await lockClubs(tx, managedClubIds);
    const successorIds = await promoteSuccessorCoOwners(tx, {
      userId,
      clubIds: managedClubIds,
    });

    await tx.delete(users).where(eq(users.id, userId));
    if (userClubs.includes(clubId)) await deleteClubRows(tx, clubId);
    return successorIds;
  });
  for (const promotedUserId of promotedUserIds) {
    publishUserNotification(promotedUserId);
  }
};
