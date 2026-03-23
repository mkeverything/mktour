import { OpenApiMeta } from 'trpc-to-openapi';

export const userMeta = {
  usersAll: {
    openapi: {
      method: 'GET',
      path: '/users',
      summary: 'get all users',
      tags: ['users'],
    },
  },

  usersInfo: {
    openapi: {
      method: 'GET',
      path: '/users/{userId}',
      summary: 'get user by id',
      tags: ['users'],
    },
  },

  userClubs: {
    openapi: {
      method: 'GET',
      path: '/users/{userId}/clubs',
      summary: 'get user clubs',
      tags: ['users'],
    },
  },

  userPlayerClubs: {
    openapi: {
      method: 'GET',
      path: '/users/{userId}/player-clubs',
      summary: 'get clubs where user has players',
      tags: ['users'],
    },
  },

  usersInfoByUsername: {
    openapi: {
      method: 'GET',
      path: '/users/username/{username}',
      summary: 'get user by username',
      tags: ['users'],
    },
  },

  usersTournaments: {
    openapi: {
      method: 'GET',
      path: '/users/{userId}/tournaments',
      summary: 'get user tournaments',
      tags: ['users'],
    },
  },
} as const satisfies Record<string, OpenApiMeta>;
