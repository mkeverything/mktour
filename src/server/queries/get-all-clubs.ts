import { db } from '@/server/db';
import { clubs } from '@/server/db/schema/clubs';
import { ClubModel } from '@/server/zod/clubs';
import { desc } from 'drizzle-orm';

export default async function getAllClubs() {
  // page: number = 1,
  // pageSize: number = 10
  const allClubs = await db
    .select()
    .from(clubs)
    .orderBy(desc(clubs.createdAt))
    // .limit(pageSize)
    // .offset((page - 1) * pageSize)
    .$dynamic();
  return allClubs as ClubModel[];
}
