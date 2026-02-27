import { publicProcedure } from '@/server/api/trpc';
import { globalSearch } from '@/server/queries/search';
import meta from '@/server/api/meta';
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

export type SearchParamsModel = z.infer<typeof searchSchema>;

export const search = publicProcedure
  .meta(meta.search)
  .input(searchSchema)
  //   .output(
  // z.object({
  //   users: z.array(usersSelectSchema).optional(),
  //   players: z.array(playersSelectSchema).optional(),
  //   tournaments: z.array(tournamentSelectSchema).optional(),
  //   clubs: z.array(clubSelectSchema).optional(),
  // }),
  //   )
  .query(async ({ input }) => {
    return await globalSearch(input);
  });
