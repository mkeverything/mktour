import 'server-only';

import { db } from '@/server/db';
import { users } from '@/server/db/schema/users';
import { eq } from 'drizzle-orm';

const selectClub = async ({
  clubId,
  userId,
}: {
  clubId: string;
  userId: string;
}) => {
  const [updatedUser] = await db
    .update(users)
    .set({ selectedClub: clubId })
    .where(eq(users.id, userId))
    .returning({ selectedClub: users.selectedClub });
  return updatedUser;
};

export default selectClub;
