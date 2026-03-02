import { validateLichessTeam } from '@/lib/zod/new-club-validation-action';
import { clubs, clubs_to_users } from '@/server/db/schema/clubs';
import { statusInClubEnum } from '@/server/zod/enums';
import { usersSelectMinimalSchema } from '@/server/zod/users';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import z from 'zod';

export const clubsSelectSchema = createSelectSchema(clubs);
export const clubsToUsersSelectSchema = createSelectSchema(clubs_to_users, {
  status: statusInClubEnum,
});

export const clubsInsertSchema = createInsertSchema(clubs, {
  name: (s) =>
    s
      .min(3, { error: 'short club name' })
      .max(100, { error: 'long club name' }),
  lichessTeam: (s) =>
    s
      .superRefine(async (lichessTeam, ctx) => {
        if (!lichessTeam) return;
        const team = await validateLichessTeam({ lichessTeam });

        if (team) {
          ctx.addIssue({
            code: 'custom',
            message: `LINK_TEAM_ERROR@%!!(&${team.id}@%!!(&${team.name}`,
          });
        }
      })
      .optional(),
  description: z.string().nullish(),
}).omit({ id: true, createdAt: true });

export const clubsEditSchema = clubsInsertSchema.partial();

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
