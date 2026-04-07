import { OpenApiMeta } from 'trpc-to-openapi';

export const searchMeta = {
  search: {
    openapi: {
      method: 'GET',
      path: '/search',
      summary: 'global search across tournaments, clubs and players',
      tags: ['search'],
    },
  },
} as const satisfies Record<string, OpenApiMeta>;
