import { db } from '@/server/db';
import { clubs } from '@/server/db/schema/clubs';
import { ClubModel } from '@/server/db/zod/clubs';
import { asc } from 'drizzle-orm';

export default async function getAllClubs() {
  // page: number = 1,
  // pageSize: number = 10
  const allClubs = await db
    .select()
    .from(clubs)
    .orderBy(asc(clubs.createdAt))
    // .limit(pageSize)
    // .offset((page - 1) * pageSize)
    .$dynamic();
  return allClubs as ClubModel[];
}
