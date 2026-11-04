import { db } from '@/server/db';
import { user_notifications } from '@/server/db/schema/notifications';
import { and, eq } from 'drizzle-orm';

export const changeNotificationStatus = async ({
  notificationId,
  seen,
  userId,
}: {
  notificationId: string;
  seen: boolean;
  userId: string;
}): Promise<void> => {
  await db
    .update(user_notifications)
    .set({ isSeen: seen })
    .where(
      and(
        eq(user_notifications.id, notificationId),
        eq(user_notifications.userId, userId),
      ),
    );
};

export async function markAllNotificationsAsSeen(userId: string) {
  await db
    .update(user_notifications)
    .set({ isSeen: true })
    .where(eq(user_notifications.userId, userId));
}
