import meta from '@/server/api/meta';
import { publicProcedure } from '@/server/api/trpc';
import {
  searchOpenApiSchema,
  searchOutputSchema,
  searchSchema,
} from '@/server/db/zod/search';
import { globalSearch } from '@/server/queries/search';

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
