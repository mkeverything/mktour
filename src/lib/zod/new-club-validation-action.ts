'use server';

import { getClubByLichessTeam } from '@/server/queries/get-club-by-lichess-team';

export async function validateLichessTeam({
  lichessTeam,
}: {
  lichessTeam?: string | null;
}) {
  return await getClubByLichessTeam({ lichessTeam });
}
