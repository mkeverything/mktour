import { clubs } from '@/server/db/schema/clubs';
import {
  gameResult,
  roundName,
  tournamentFormat,
  tournamentType,
} from '@/server/db/schema/enums';
import { players } from '@/server/db/schema/players';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const tournaments = pgTable(
  'tournament',
  {
    id: text('id').notNull(),
    title: text('title'),
    format: tournamentFormat('format').notNull(),
    type: tournamentType('type').notNull(),
    date: date('date', { mode: 'string' }).notNull(),
    createdAt: timestamp('created_at', {
      withTimezone: true,
      precision: 3,
    }).notNull(),
    clubId: text('club_id')
      .references(() => clubs.id, { onDelete: 'cascade' })
      .notNull(),
    startedAt: timestamp('started_at', { withTimezone: true, precision: 3 }),
    closedAt: timestamp('closed_at', { withTimezone: true, precision: 3 }),
    roundsNumber: integer('rounds_number').notNull(), // necessary even if playing single elimination (final and match_for_third have same number);
    ongoingRound: integer('ongoing_round').default(1).notNull(),
    isRated: boolean('is_rated').notNull().default(true),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    index('tournament_club_date_idx').on(
      table.clubId,
      table.date.desc(),
      table.createdAt.desc(),
      table.id.desc(),
    ),
  ],
);

export const players_to_units = pgTable(
  // ex players_to_tournaments
  'players_to_units',
  {
    playerId: text('player_id')
      .notNull()
      .references(() => players.id),
    unitId: text('unit_id').notNull(),
    tournamentId: text('tournament_id').notNull(),
    numberInUnit: integer('number_in_unit').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.unitId, table.playerId] }),
    uniqueIndex('ptu_tournament_player_unique_idx').on(
      table.tournamentId,
      table.playerId,
    ),
    index('ptu_player_idx').on(table.playerId),
    foreignKey({
      columns: [table.unitId, table.tournamentId],
      foreignColumns: [tournament_units.id, tournament_units.tournamentId],
      name: 'ptu_unit_tournament_fk',
    }).onDelete('cascade'),
  ],
);

export const tournament_units = pgTable(
  // ex players_to_tournaments
  'tournament_units',
  {
    // join table where single tournament participants/teams are stored
    id: text('id').notNull(),
    size: integer('size').notNull(), // unit size (1 for solo, 2 for doubles, 3+ for team)
    tournamentId: text('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    wins: integer('wins').default(0).notNull(),
    losses: integer('losses').default(0).notNull(),
    draws: integer('draws').default(0).notNull(),
    colorIndex: integer('color_index').default(0).notNull(),
    place: integer('place'),
    isOut: boolean('is_out').default(false).notNull(),
    number: integer('number'),
    addedAt: timestamp('added_at', { withTimezone: true, precision: 3 }),
    nickname: text('nickname').notNull(), // team nickname or solo player nickname
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    uniqueIndex('tu_id_tournament_unique_idx').on(table.id, table.tournamentId),
    index('tu_tournament_number_idx').on(table.tournamentId, table.number),
    index('tu_tournament_nickname_idx').on(table.tournamentId, table.nickname),
  ],
);

export const games = pgTable(
  'game',
  {
    id: text('id').notNull(),
    gameNumber: integer('game_number').notNull(),
    roundNumber: integer('round_number').notNull(),
    roundName: roundName('round_name'),
    whiteUnitId: text('white_unit_id').notNull(),
    blackUnitId: text('black_unit_id').notNull(),
    whitePlayerId: text('white_player_id').references(() => players.id), // used when players in a unit have separate games (necessary for rated tournaments)
    blackPlayerId: text('black_player_id').references(() => players.id), // used when players in a unit have separate games (necessary for rated tournaments)
    result: gameResult('result'),
    finishedAt: timestamp('finished_at', { withTimezone: true, precision: 3 }),
    tournamentId: text('tournament_id')
      .references(() => tournaments.id, { onDelete: 'cascade' })
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
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.blackUnitId, table.tournamentId],
      foreignColumns: [tournament_units.id, tournament_units.tournamentId],
      name: 'game_black_unit_tournament_fk',
    }).onDelete('cascade'),
    check(
      'game_units_different',
      sql`${table.whiteUnitId} <> ${table.blackUnitId}`,
    ),
  ],
);
