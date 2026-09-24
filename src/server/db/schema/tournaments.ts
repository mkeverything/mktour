import { clubs } from '@/server/db/schema/clubs';
import { players } from '@/server/db/schema/players';
import {
  GameResult,
  RoundName,
  TournamentFormat,
  TournamentType,
} from '@/server/zod/enums';
import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const tournaments = sqliteTable(
  'tournament',
  {
    id: text('id').notNull(),
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
  },
  (table) => [primaryKey({ columns: [table.id] })],
);

export const players_to_units = sqliteTable(
  // ex players_to_tournaments
  'players_to_units',
  {
    id: text('id').notNull(),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id),
    unitId: text('unit_id')
      .notNull()
      .references(() => tournament_units.id),
    numberInUnit: integer('number_in_unit').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    index('ptu_unit_idx').on(table.unitId),
    index('ptu_player_idx').on(table.playerId),
  ],
);

export const tournament_units = sqliteTable(
  // ex players_to_tournaments
  'tournament_units',
  {
    // join table where single tournament participants/teams are stored
    id: text('id').notNull(),
    size: integer('size').notNull(), // unit size (1 for solo, 2 for doubles, 3+ for team)
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
    number: integer('number'),
    addedAt: integer('added_at', { mode: 'timestamp_ms' }),
    nickname: text('nickname').notNull(), // team nickname or solo player nickname
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    uniqueIndex('tu_id_tournament_unique_idx').on(table.id, table.tournamentId),
    index('tu_tournament_number_idx').on(table.tournamentId, table.number),
    index('tu_tournament_nickname_idx').on(table.tournamentId, table.nickname),
  ],
);

export const games = sqliteTable(
  'game',
  {
    id: text('id').notNull(),
    gameNumber: integer('game_number').notNull(),
    roundNumber: integer('round_number').notNull(),
    roundName: text('round_name').$type<RoundName>(),
    whiteUnitId: text('white_unit_id')
      .notNull()
      .references(() => tournament_units.id),
    blackUnitId: text('black_unit_id')
      .notNull()
      .references(() => tournament_units.id),
    whitePlayerId: text('white_player_id').references(() => players.id), // used when players in a unit have separate games (necessary for rated tournaments)
    blackPlayerId: text('black_player_id').references(() => players.id), // used when players in a unit have separate games (necessary for rated tournaments)
    whitePrevGameId: text('white_prev_game_id'),
    blackPrevGameId: text('black_prev_game_id'),
    result: text('result').$type<GameResult>(),
    finishedAt: integer('finished_at', { mode: 'timestamp' }),
    tournamentId: text('tournament_id')
      .references(() => tournaments.id)
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    uniqueIndex('game_tournament_number_unique_idx').on(
      table.tournamentId,
      table.gameNumber,
    ),
    index('game_tournament_round_idx').on(
      table.tournamentId,
      table.roundNumber,
    ),
    index('game_white_unit_idx').on(table.whiteUnitId),
    index('game_black_unit_idx').on(table.blackUnitId),
    index('game_white_player_idx').on(table.whitePlayerId),
    index('game_black_player_idx').on(table.blackPlayerId),
    foreignKey({
      columns: [table.whiteUnitId, table.tournamentId],
      foreignColumns: [tournament_units.id, tournament_units.tournamentId],
      name: 'game_white_unit_tournament_fk',
    }),
    foreignKey({
      columns: [table.blackUnitId, table.tournamentId],
      foreignColumns: [tournament_units.id, tournament_units.tournamentId],
      name: 'game_black_unit_tournament_fk',
    }),
    check(
      'game_units_different',
      sql`${table.whiteUnitId} <> ${table.blackUnitId}`,
    ),
  ],
);
