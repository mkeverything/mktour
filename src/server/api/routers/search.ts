import meta from '@/server/api/meta';
import { publicProcedure } from '@/server/api/trpc';
import { clubsSelectSchema } from '@/server/db/zod/clubs';
import { playersSelectSchema } from '@/server/db/zod/players';
import { tournamentSchema } from '@/server/db/zod/tournaments';
import { usersSelectPublicSchema } from '@/server/db/zod/users';
import { globalSearch } from '@/server/queries/search';
import z from 'zod';

const searchSchema = z.object({
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

const searchOpenApiSchema = z.object({
  query: z.string(),
  filterType: z.enum(['users', 'players', 'tournaments']).optional(),
  filterUserId: z.string().optional(),
  filterClubId: z.string().optional(),
});

const searchOutputSchema = z.object({
  users: z.array(usersSelectPublicSchema).optional(),
  players: z.array(playersSelectSchema).optional(),
  tournaments: z.array(tournamentSchema).optional(),
  clubs: z.array(clubsSelectSchema).optional(),
});

export type SearchParamsModel = z.infer<typeof searchSchema>;

export const search = publicProcedure
  .input(searchSchema)
  .output(searchOutputSchema)
  .query(async ({ input }) => {
    return await globalSearch(input);
  });

export const searchOpenApi = publicProcedure
  .meta(meta.search)
  .input(searchOpenApiSchema)
  .output(searchOutputSchema)
  .query(async ({ input }) => {
    const { query, filterType, filterUserId, filterClubId } = input;
    const filter =
      filterType === 'users' && filterUserId
        ? { type: filterType, userId: filterUserId }
        : filterType && filterClubId
          ? {
              type: filterType as 'players' | 'tournaments',
              clubId: filterClubId,
            }
          : undefined;
    return await globalSearch({ query, filter });
  });
