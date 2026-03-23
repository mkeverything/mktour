import { OpenApiMeta } from 'trpc-to-openapi';

export const tournamentMeta = {
  tournamentsAll: {
    openapi: {
      method: 'GET',
      path: '/tournaments',
      summary: 'get all tournaments',
      tags: ['tournaments'],
    },
  },

  tournamentsInfo: {
    openapi: {
      method: 'GET',
      path: '/tournaments/{tournamentId}',
      summary: 'get tournament info',
      tags: ['tournaments'],
    },
  },

  tournamentsPlayers: {
    openapi: {
      method: 'GET',
      path: '/tournaments/{tournamentId}/players',
      summary: 'get tournament players',
      tags: ['tournaments'],
    },
  },

  tournamentsGames: {
    openapi: {
      method: 'GET',
      path: '/tournaments/{tournamentId}/games',
      summary: 'get tournament games',
      tags: ['tournaments'],
    },
  },

  tournamentsRoundGames: {
    openapi: {
      method: 'GET',
      path: '/tournaments/{tournamentId}/round-games',
      summary: 'get tournament round games',
      tags: ['tournaments'],
    },
  },

  tournamentsCreate: {
    openapi: {
      method: 'POST',
      path: '/tournaments',
      summary: 'create tournament',
      tags: ['tournaments'],
    },
  },

  tournamentsEdit: {
    openapi: {
      method: 'PATCH',
      path: '/tournaments/{tournamentId}',
      summary: 'edit tournament',
      tags: ['tournaments'],
    },
  },

  tournamentsStart: {
    openapi: {
      method: 'POST',
      path: '/tournaments/{tournamentId}/start',
      summary: 'start tournament',
      tags: ['tournaments'],
    },
  },

  tournamentsReset: {
    openapi: {
      method: 'POST',
      path: '/tournaments/{tournamentId}/reset',
      summary: 'reset tournament',
      tags: ['tournaments'],
    },
  },

  tournamentsResetPlayers: {
    openapi: {
      method: 'POST',
      path: '/tournaments/{tournamentId}/reset-players',
      summary: 'reset tournament players',
      tags: ['tournaments'],
    },
  },

  tournamentsFinish: {
    openapi: {
      method: 'POST',
      path: '/tournaments/{tournamentId}/finish',
      summary: 'finish tournament',
      tags: ['tournaments'],
    },
  },

  tournamentsAuthStatus: {
    openapi: {
      method: 'GET',
      path: '/tournaments/{tournamentId}/auth-status',
      summary: 'get auth user status in tournament',
      tags: ['tournaments'],
    },
  },

  tournamentsSetGameResult: {
    openapi: {
      method: 'POST',
      path: '/tournaments/{tournamentId}/set-game-result',
      summary: 'set game result',
      tags: ['tournaments'],
    },
  },

  tournamentsUpdateSwissRoundsNumber: {
    openapi: {
      method: 'POST',
      path: '/tournaments/{tournamentId}/update-swiss-rounds-number',
      summary: 'update swiss rounds number',
      tags: ['tournaments'],
    },
  },

  tournamentsUpdatePairingNumbers: {
    openapi: {
      method: 'POST',
      path: '/tournaments/{tournamentId}/update-pairing-numbers',
      summary: 'update pairing numbers',
      tags: ['tournaments'],
    },
  },

  tournamentsUpdateRoundsNumber: {
    openapi: {
      method: 'POST',
      path: '/tournaments/{tournamentId}/update-rounds-number',
      summary: 'update rounds number',
      tags: ['tournaments'],
    },
  },

  tournamentsDelete: {
    openapi: {
      method: 'DELETE',
      path: '/tournaments/{tournamentId}',
      summary: 'delete tournament',
      tags: ['tournaments'],
    },
  },
} as const satisfies Record<string, OpenApiMeta>;
