import { clubs } from '@/server/db/schema/clubs';
import { players } from '@/server/db/schema/players';
import {
  GameResult,
  RoundName,
  TournamentFormat,
  TournamentType,
} from '@/server/db/zod/enums';
import { relations } from 'drizzle-orm';
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const tournaments = sqliteTable('tournament', {
  id: text('id').primaryKey(),
  title: text('name'),
  format: text('format').$type<TournamentFormat>().notNull(),
  type: text('type').$type<TournamentType>().notNull(),
  date: text('date').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  clubId: text('club_id')
    .references(() => clubs.id)
    .notNull(),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  closedAt: integer('closed_at', { mode: 'timestamp' }),
  roundsNumber: integer('rounds_number'), // necessary even if playing single elimination (final and match_for_third have same number);
  ongoingRound: integer('ongoing_round')
    .$default(() => 1)
    .notNull(),
  rated: integer('rated', { mode: 'boolean' })
    .notNull()
    .$default(() => true),
});

export const players_to_tournaments = sqliteTable('players_to_tournaments', {
  // join table where single tournament participants are stored
  id: text('id').primaryKey(),
  playerId: text('player_id')
    .notNull()
    .references(() => players.id),
  tournamentId: text('tournament_id')
    .notNull()
    .references(() => tournaments.id),
  wins: integer('wins')
    .$default(() => 0)
    .notNull(),
  losses: integer('losses')
    .$default(() => 0)
    .notNull(),
  draws: integer('draws')
    .$default(() => 0)
    .notNull(),
  colorIndex: integer('color_index')
    .$default(() => 0)
    .notNull(),
  place: integer('place'),
  isOut: integer('is_out', { mode: 'boolean' }),
  pairingNumber: integer('pairing_number'),
  ratingChange: integer('rating_change'),
  ratingDeviationChange: integer('rating_deviation_change'),
  volatilityChange: real('volatility_change'),
});

export const games = sqliteTable('game', {
  id: text('id').primaryKey(),
  gameNumber: integer('game_number').notNull(),
  roundNumber: integer('round_number').notNull(),
  roundName: text('round_name').$type<RoundName>(),
  whiteId: text('white_id')
    .references(() => players.id)
    .notNull(),
  blackId: text('black_id')
    .references(() => players.id)
    .notNull(),
  whitePrevGameId: text('white_prev_game_id'),
  blackPrevGameId: text('black_prev_game_id'),
  result: text('result').$type<GameResult>(),
  finishedAt: integer('finished_at', { mode: 'timestamp' }),
  tournamentId: text('tournament_id')
    .references(() => tournaments.id)
    .notNull(),
});

export const tournaments_relations = relations(
  tournaments,
  ({ one, many }) => ({
    club: one(clubs, { fields: [tournaments.clubId], references: [clubs.id] }),
    players: many(players_to_tournaments),
  }),
);

export const players_to_tournaments_relations = relations(
  players_to_tournaments,
  ({ one }) => ({
    player: one(players, {
      fields: [players_to_tournaments.playerId],
      references: [players.id],
    }),
    tournament: one(tournaments, {
      fields: [players_to_tournaments.tournamentId],
      references: [tournaments.id],
    }),
  }),
);
