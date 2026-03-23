import { OpenApiMeta } from 'trpc-to-openapi';

export const authMeta = {
  authInfo: {
    openapi: {
      method: 'GET',
      path: '/auth',
      summary: 'get my public info',
      tags: ['auth'],
    },
  },

  authClubs: {
    openapi: {
      method: 'GET',
      path: '/auth/clubs',
      summary: 'get clubs where i am an admin',
      tags: ['auth'],
    },
  },

  authDelete: {
    openapi: {
      method: 'DELETE',
      path: '/auth',
      summary: 'delete user',
      tags: ['auth'],
    },
  },

  authEdit: {
    openapi: {
      method: 'PATCH',
      path: '/auth',
      summary: 'edit my account',
      tags: ['auth'],
    },
  },

  myAffiliations: {
    openapi: {
      method: 'GET',
      path: '/auth/affiliations',
      summary: 'get my affiliations',
      tags: ['auth'],
    },
  },

  authAffiliationRequests: {
    openapi: {
      method: 'GET',
      path: '/auth/affiliation-requests',
      summary: 'get my affiliation requests',
      tags: ['auth'],
    },
  },

  authNotifications: {
    openapi: {
      method: 'GET',
      path: '/auth/notifications',
      summary: 'get my notifications',
      tags: ['auth'],
    },
  },

  authNotificationStatus: {
    openapi: {
      method: 'PATCH',
      path: '/auth/notifications/{notificationId}',
      summary: 'change notification status',
      tags: ['auth'],
    },
  },

  authMarkAllNotificationsAsSeen: {
    openapi: {
      method: 'PATCH',
      path: '/auth/notifications/mark-all-as-seen',
      summary: 'mark all my notifications as seen',
      tags: ['auth'],
    },
  },

  authNotificationCounter: {
    openapi: {
      method: 'GET',
      path: '/auth/notifications/counter',
      summary: 'get my notifications counter',
      tags: ['auth'],
    },
  },

  authLogout: {
    openapi: {
      method: 'POST',
      path: '/auth/logout',
      summary: 'logout user',
      tags: ['auth'],
    },
  },

  authSelectClub: {
    openapi: {
      method: 'POST',
      path: '/auth/select-club',
      summary: 'select club',
      tags: ['auth'],
    },
  },
} as const satisfies Record<string, OpenApiMeta>;
