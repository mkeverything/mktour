'use server';

import { AppError, ERRORS } from '@/lib/errors';
import { validateRequest } from '@/lib/auth/lucia';
import { db } from '@/server/db';
import { users } from '@/server/db/schema/users';
import { eq } from 'drizzle-orm';

const selectClub = async ({ clubId }: { clubId: string }) => {
  const { user } = await validateRequest();
  if (!user) throw new AppError(ERRORS.UNAUTHENTICATED);
  return await db
    .update(users)
    .set({ selectedClub: clubId })
    .where(eq(users.id, user.id))
    .returning({ selectedClub: users.selectedClub })
    .get();
};

export default selectClub;
