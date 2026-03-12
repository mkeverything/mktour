import { OpenApiMeta } from 'trpc-to-openapi';

export const playerMeta = {
  playerInfo: {
    openapi: {
      method: 'GET',
      path: '/players/{playerId}',
      summary: 'get player info',
      tags: ['players'],
    },
  },

  playersCreate: {
    openapi: {
      method: 'POST',
      path: '/players',
      summary: 'create player',
      tags: ['players'],
    },
  },

  playersLastTournaments: {
    openapi: {
      method: 'GET',
      path: '/players/{playerId}/last-tournaments',
      summary: 'get player last tournaments',
      tags: ['players'],
    },
  },

  playersDelete: {
    openapi: {
      method: 'DELETE',
      path: '/players/{playerId}',
      summary: 'delete player',
      tags: ['players'],
    },
  },

  playersPublicStats: {
    openapi: {
      method: 'GET',
      path: '/players/{playerId}/stats',
      summary: 'get player stats',
      tags: ['players'],
    },
  },

  playersAuthStats: {
    openapi: {
      method: 'GET',
      path: '/players/{playerId}/auth-stats',
      summary: 'get player auth stats',
      tags: ['players'],
    },
  },

  playersEdit: {
    openapi: {
      method: 'PATCH',
      path: '/players/{id}',
      summary: 'edit player',
      tags: ['players'],
    },
  },
} as const satisfies Record<string, OpenApiMeta>;
