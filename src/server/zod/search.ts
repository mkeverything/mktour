import { clubsSelectSchema } from '@/server/zod/clubs';
import { playersSelectSchema } from '@/server/zod/players';
import { tournamentSchema } from '@/server/zod/tournaments';
import { usersSelectPublicSchema } from '@/server/zod/users';
import z from 'zod';

export const searchSchema = z.object({
  query: z.string(),
  filter: z
    .object({
      type: z.enum(['users']),
      userId: z.string(),
    })
    .or(
      z.object({
        type: z.enum(['players', 'tournaments']),
        clubId: z.string(),
      }),
    )
    .optional(),
});

export const searchOpenApiSchema = z.object({
  query: z.string(),
  filterType: z.enum(['users', 'players', 'tournaments']).optional(),
  filterUserId: z.string().optional(),
  filterClubId: z.string().optional(),
});

export const searchOutputSchema = z.object({
  users: z.array(usersSelectPublicSchema).optional(),
  players: z.array(playersSelectSchema).optional(),
  tournaments: z.array(tournamentSchema).optional(),
  clubs: z.array(clubsSelectSchema).optional(),
});

export type SearchParamsModel = z.infer<typeof searchSchema>;
