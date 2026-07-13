import { clubPlayerStatsTag } from '@/lib/cache-tags';
import { revalidateTag } from 'next/cache';

export function revalidateClubPlayerStats(clubId: string) {
  try {
    revalidateTag(clubPlayerStatsTag(clubId), 'max');
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') throw error;
  }
}
