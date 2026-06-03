import { clubs, clubs_to_users } from '@/server/db/schema/clubs';
import { getClubByLichessTeam } from '@/server/queries/get-club-by-lichess-team';
import { clubIdInputSchema } from '@/server/zod/common';
import { statusInClubEnum } from '@/server/zod/enums';
import { usersSelectMinimalSchema } from '@/server/zod/users';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import z from 'zod';

export const clubsSelectSchema = createSelectSchema(clubs);

export const publicPopularClubSchema = clubsSelectSchema.pick({
  id: true,
  name: true,
  description: true,
  createdAt: true,
  lichessTeam: true,
});

export const clubsToUsersSelectSchema = createSelectSchema(clubs_to_users, {
  status: statusInClubEnum,
});

const clubsInsertSchemaBase = createInsertSchema(clubs, {
  name: (s) =>
    s
      .min(3, { error: 'SHORT_CLUB_NAME' })
      .max(100, { error: 'LONG_CLUB_NAME' }),
  lichessTeam: (s) => s.optional(),
  description: z.string().nullish(),
}).omit({ id: true, createdAt: true });

async function validateLichessTeamLink(
  ctx: z.RefinementCtx,
  {
    lichessTeam,
    clubId,
    path,
  }: { lichessTeam?: string | null; clubId?: string; path: string[] },
) {
  const team = await getClubByLichessTeam({
    lichessTeam,
    excludeClubId: clubId,
  });
  if (!team) return;

  ctx.addIssue({
    code: 'custom',
    path,
    message: `LINK_TEAM_ERROR@%!!(&${team.id}@%!!(&${team.name}`,
  });
}

export const clubsInsertSchema = clubsInsertSchemaBase.superRefine(
  async ({ lichessTeam }, ctx) => {
    await validateLichessTeamLink(ctx, { lichessTeam, path: ['lichessTeam'] });
  },
);

export const clubsEditSchema = clubIdInputSchema
  .extend(clubsInsertSchemaBase.partial().shape)
  .superRefine(async ({ clubId, lichessTeam }, ctx) => {
    if (lichessTeam === undefined) return;
    await validateLichessTeamLink(ctx, {
      lichessTeam,
      clubId,
      path: ['lichessTeam'],
    });
  });

export const clubManagersSchema = z.object({
  user: usersSelectMinimalSchema,
  clubs_to_users: clubsToUsersSelectSchema,
});

export const clubStatsSchema = z.object({
  playersCount: z.number(),
  tournamentsCount: z.number(),
  mostActivePlayers: z.array(
    z.object({
      id: z.string(),
      nickname: z.string(),
      rating: z.number(),
      tournamentsPlayed: z.number(),
    }),
  ),
});

export type ClubManagerModel = z.infer<typeof clubManagersSchema>;
export type ClubEditModel = z.infer<typeof clubsEditSchema>;
export type ClubFormModel = z.infer<typeof clubsInsertSchema>;
export type ClubStatsModel = z.infer<typeof clubStatsSchema>;

export type ClubModel = z.infer<typeof clubsSelectSchema>;
export type ClubUpdateModel = z.infer<typeof clubsEditSchema>;
export type ClubInsertModel = z.infer<typeof clubsInsertSchema>;

export type ClubToUserModel = z.infer<typeof clubsToUsersSelectSchema>;
export type ClubToUserInsertModel = z.infer<typeof clubsToUsersSelectSchema>;
