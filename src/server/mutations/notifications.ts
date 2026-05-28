import { AppError } from '@/lib/errors';
import { validateRequest } from '@/lib/auth/lucia';
import { db } from '@/server/db';
import { user_notifications } from '@/server/db/schema/notifications';
import { eq } from 'drizzle-orm';

export const changeNotificationStatus = async ({
  notificationId,
  seen,
}: {
  notificationId: string;
  seen: boolean;
}): Promise<void> => {
  const { user } = await validateRequest();
  if (!user) throw new AppError('UNAUTHENTICATED');
  await db
    .update(user_notifications)
    .set({ isSeen: seen })
    .where(eq(user_notifications.id, notificationId));
};

export async function markAllNotificationsAsSeen(userId: string) {
  const { user } = await validateRequest();
  if (!user) throw new AppError('UNAUTHENTICATED');
  if (user.id !== userId) throw new AppError('UNAUTHENTICATED');
  await db
    .update(user_notifications)
    .set({ isSeen: true })
    .where(eq(user_notifications.userId, userId));
}
