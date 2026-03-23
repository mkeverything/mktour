import { OpenApiMeta } from 'trpc-to-openapi';

export const clubMeta = {
  clubsAll: {
    openapi: {
      method: 'GET',
      path: '/clubs',
      summary: 'get all clubs',
      tags: ['clubs'],
    },
  },

  clubInfo: {
    openapi: {
      method: 'GET',
      path: '/clubs/{clubId}',
      summary: 'get club info',
      tags: ['clubs'],
    },
  },

  clubPlayers: {
    openapi: {
      method: 'GET',
      path: '/clubs/{clubId}/players',
      summary: 'get club players',
      tags: ['clubs'],
    },
  },

  clubTournaments: {
    openapi: {
      method: 'GET',
      path: '/clubs/{clubId}/tournaments',
      summary: 'get club tournaments',
      tags: ['clubs'],
    },
  },

  clubCreate: {
    openapi: {
      method: 'POST',
      path: '/clubs',
      summary: 'create club',
      tags: ['clubs'],
    },
  },

  clubEdit: {
    openapi: {
      method: 'PATCH',
      path: '/clubs/{clubId}',
      summary: 'edit club',
      tags: ['clubs'],
    },
  },

  clubDelete: {
    openapi: {
      method: 'DELETE',
      path: '/clubs/{clubId}',
      summary: 'delete club',
      description: `in case user is deleting their account, \`userDeletion\` should 
          is set to \`true\`. otherwise endpoint checks for other clubs where 
          user is a \`co-owner\` and rejects the operation if none found.`,
      tags: ['clubs'],
      protect: true,
    },
  },

  clubLeave: {
    openapi: {
      method: 'POST',
      path: '/clubs/{clubId}/leave',
      summary: 'leave club',
      tags: ['clubs'],
    },
  },

  clubAuthAffiliation: {
    openapi: {
      method: 'GET',
      path: '/clubs/{clubId}/auth-affiliation',
      summary: 'get auth user affiliation',
      tags: ['clubs'],
    },
  },

  clubAuthPlayer: {
    openapi: {
      method: 'GET',
      path: '/clubs/{clubId}/auth-player',
      summary: 'get auth user player in club',
      tags: ['clubs'],
    },
  },

  clubAuthStatus: {
    openapi: {
      method: 'GET',
      path: '/clubs/{clubId}/auth-status',
      summary: 'get auth user status in club',
      tags: ['clubs'],
    },
  },

  clubAffiliatedUsers: {
    openapi: {
      method: 'GET',
      path: '/clubs/{clubId}/affiliated-users',
      summary: 'get club affiliated users',
      tags: ['clubs'],
    },
  },

  clubManagers: {
    openapi: {
      method: 'GET',
      path: '/clubs/{clubId}/managers',
      summary: 'get club managers',
      tags: ['clubs'],
    },
  },

  clubAddManager: {
    openapi: {
      method: 'POST',
      path: '/clubs/{clubId}/managers',
      summary: 'add club manager',
      tags: ['clubs'],
    },
  },

  clubDeleteManager: {
    openapi: {
      method: 'DELETE',
      path: '/clubs/{clubId}/managers/{userId}',
      summary: 'delete club manager',
      tags: ['clubs'],
    },
  },

  clubNotifications: {
    openapi: {
      method: 'GET',
      path: '/clubs/{clubId}/notifications',
      summary: 'get club notifications',
      tags: ['clubs'],
    },
  },

  clubToggleSeen: {
    openapi: {
      method: 'POST',
      path: '/clubs/{clubId}/toggle-seen',
      summary: 'change notifications "isSeen" parameter',
      tags: ['clubs'],
    },
  },
} as const satisfies Record<string, OpenApiMeta>;
