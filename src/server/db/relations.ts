import * as schema from '@/server/db/schema';
import { defineRelations } from 'drizzle-orm';

export const relations = defineRelations(schema, (r) => ({
  clubs: {
    tournaments: r.many.tournaments(),
    players: r.many.players(),
    notifications: r.many.club_notifications(),
    affiliations: r.many.affiliations(),
  },
  players: {
    club: r.one.clubs({
      from: r.players.clubId,
      to: r.clubs.id,
    }),
    units: r.many.players_to_units(),
    gamesAsWhite: r.many.games({ alias: 'gameWhitePlayer' }),
    gamesAsBlack: r.many.games({ alias: 'gameBlackPlayer' }),
    ratingEvents: r.many.rating_events(),
  },
  affiliations: {
    user: r.one.users({
      from: r.affiliations.userId,
      to: r.users.id,
    }),
    club: r.one.clubs({
      from: r.affiliations.clubId,
      to: r.clubs.id,
    }),
    player: r.one.players({
      from: r.affiliations.playerId,
      to: r.players.id,
    }),
  },
  tournaments: {
    club: r.one.clubs({
      from: r.tournaments.clubId,
      to: r.clubs.id,
    }),
    units: r.many.tournament_units(),
    games: r.many.games(),
    ratingEvents: r.many.rating_events(),
  },
  tournament_units: {
    tournament: r.one.tournaments({
      from: r.tournament_units.tournamentId,
      to: r.tournaments.id,
    }),
    memberRows: r.many.players_to_units(),
    gamesAsWhite: r.many.games({ alias: 'gameWhiteUnit' }),
    gamesAsBlack: r.many.games({ alias: 'gameBlackUnit' }),
  },
  players_to_units: {
    unit: r.one.tournament_units({
      from: r.players_to_units.unitId,
      to: r.tournament_units.id,
    }),
    player: r.one.players({
      from: r.players_to_units.playerId,
      to: r.players.id,
    }),
  },
  games: {
    tournament: r.one.tournaments({
      from: r.games.tournamentId,
      to: r.tournaments.id,
    }),
    whiteUnit: r.one.tournament_units({
      from: r.games.whiteUnitId,
      to: r.tournament_units.id,
      alias: 'gameWhiteUnit',
    }),
    blackUnit: r.one.tournament_units({
      from: r.games.blackUnitId,
      to: r.tournament_units.id,
      alias: 'gameBlackUnit',
    }),
    whitePlayer: r.one.players({
      from: r.games.whitePlayerId,
      to: r.players.id,
      alias: 'gameWhitePlayer',
    }),
    blackPlayer: r.one.players({
      from: r.games.blackPlayerId,
      to: r.players.id,
      alias: 'gameBlackPlayer',
    }),
  },
  user_notifications: {
    user: r.one.users({
      from: r.user_notifications.userId,
      to: r.users.id,
    }),
  },
  club_notifications: {
    club: r.one.clubs({
      from: r.club_notifications.clubId,
      to: r.clubs.id,
    }),
  },
  rating_events: {
    player: r.one.players({
      from: r.rating_events.playerId,
      to: r.players.id,
    }),
    sourceTournament: r.one.tournaments({
      from: r.rating_events.sourceTournamentId,
      to: r.tournaments.id,
    }),
  },
}));
