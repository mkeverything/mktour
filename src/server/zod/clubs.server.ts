import { getClubByLichessTeam } from '@/server/queries/get-club-by-lichess-team';
import { clubsEditSchema, clubsInsertSchema } from '@/server/zod/clubs';
import z from 'zod';

async function validateLichessTeamLink(
  ctx: z.RefinementCtx,
  { lichessTeam, clubId }: { lichessTeam?: string | null; clubId?: string },
) {
  const team = await getClubByLichessTeam({
    lichessTeam,
    excludeClubId: clubId,
  });
  if (!team) return;

  ctx.addIssue({
    code: 'custom',
    path: ['lichessTeam'],
    message: `LINK_TEAM_ERROR@%!!(&${team.id}@%!!(&${team.name}`,
  });
}

export const clubsInsertServerSchema = clubsInsertSchema.superRefine(
  async ({ lichessTeam }, ctx) => {
    await validateLichessTeamLink(ctx, { lichessTeam });
  },
);

export const clubsEditServerSchema = clubsEditSchema.superRefine(
  async ({ clubId, lichessTeam }, ctx) => {
    if (lichessTeam === undefined) return;
    await validateLichessTeamLink(ctx, {
      lichessTeam,
      clubId,
    });
  },
);
