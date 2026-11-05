/*
one-off reshape of beta's postgres database, imported before reshape-affiliations.ts
existed, into the shape of the affiliations migration. read README.md first. its old
statuses and events would fail the migration's enum casts, so the rows are stashed in a
`reshape` schema, the tables migrated empty, and the stash reshaped back into them. a
failed reshape leaves the stash in place, and a rerun resumes from it.
*/
import { AppError } from '@/lib/errors';
import { relations } from '@/server/db/relations';
import * as schema from '@/server/db/schema';
import { getTableName, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { boolean, jsonb, pgSchema, text, timestamp } from 'drizzle-orm/pg-core';
import {
  assertLinksMatchAffiliations,
  reshapeAffiliations,
} from './reshape-affiliations';

const INSERT_CHUNK_SIZE = 1000;

const targetUrl = process.env.TARGET_DATABASE_URL;
if (!targetUrl) {
  console.error(
    'usage: TARGET_DATABASE_URL=<postgres url> bun scripts/temporary/postgres-cutover/reshape-beta-in-place.ts',
  );
  process.exit(1);
}

const fail = (cause: string): never => {
  throw new AppError('DATABASE_MIGRATION_ERROR', { cause });
};

const stash = pgSchema('reshape');
const createdAt = timestamp('created_at', {
  withTimezone: true,
  precision: 3,
}).notNull();
const stashedAffiliations = stash.table('affiliation', {
  id: text().notNull(),
  userId: text('user_id').notNull(),
  clubId: text('club_id').notNull(),
  playerId: text('player_id').notNull(),
  status: text().notNull(),
  createdAt,
  updatedAt: timestamp('updated_at', {
    withTimezone: true,
    precision: 3,
  }).notNull(),
});
const notificationColumns = {
  id: text().notNull(),
  createdAt,
  event: text().notNull(),
  isSeen: boolean('is_seen').notNull(),
  metadata: jsonb().$type<Record<string, unknown>>().notNull(),
};
const stashedClubNotifications = stash.table('club_notification', {
  ...notificationColumns,
  ownerId: text('club_id').notNull(),
});
const stashedUserNotifications = stash.table('user_notification', {
  ...notificationColumns,
  ownerId: text('user_id').notNull(),
});

const db = drizzle({ connection: targetUrl, relations });

const { rows: stashes } = await db.execute(
  sql`select 1 from information_schema.schemata where schema_name = 'reshape'`,
);
if (stashes.length === 0) {
  const { rows: oldStatuses } = await db.execute(
    sql`select 1 from pg_enum join pg_type on pg_type.oid = pg_enum.enumtypid
      where pg_type.typname = 'affiliation_status' and pg_enum.enumlabel = 'active'`,
  );
  if (oldStatuses.length === 0) fail('the database is already reshaped');

  await db.transaction(async (tx) => {
    await tx.execute(sql`create schema reshape`);
    await tx.execute(sql`create table reshape.affiliation as
      select id, user_id, club_id, player_id, status::text as status, created_at, updated_at
      from affiliation`);
    await tx.execute(sql`create table reshape.club_notification as
      select id, created_at, club_id, event::text as event, is_seen, metadata
      from club_notification`);
    await tx.execute(sql`create table reshape.user_notification as
      select id, created_at, user_id, event::text as event, is_seen, metadata
      from user_notification`);
    await tx.delete(schema.club_notifications);
    await tx.delete(schema.user_notifications);
    await tx.delete(schema.affiliations);
  });
}

await migrate(db, { migrationsFolder: 'src/server/db/migrations' });

const counts = await db.transaction(async (tx) => {
  for (const table of [
    schema.affiliations,
    schema.club_notifications,
    schema.user_notifications,
  ]) {
    if ((await tx.$count(table)) > 0) {
      fail(`${getTableName(table)} has rows the stash doesn't`);
    }
  }

  const ids = async (
    table: typeof schema.clubs | typeof schema.users | typeof schema.players,
  ) =>
    new Set(
      (await tx.select({ id: table.id }).from(table)).map(({ id }) => id),
    );
  const reshaped = reshapeAffiliations({
    affiliations: await tx.select().from(stashedAffiliations),
    clubNotifications: await tx.select().from(stashedClubNotifications),
    userNotifications: await tx.select().from(stashedUserNotifications),
    existing: {
      clubs: await ids(schema.clubs),
      users: await ids(schema.users),
      players: await ids(schema.players),
    },
  });

  const reshapedCounts: Record<string, number> = {};
  for (const [table, rows] of [
    [schema.affiliations, reshaped.affiliations],
    [schema.club_notifications, reshaped.clubNotifications],
    [schema.user_notifications, reshaped.userNotifications],
  ] as const) {
    for (let i = 0; i < rows.length; i += INSERT_CHUNK_SIZE) {
      await tx.insert(table).values(rows.slice(i, i + INSERT_CHUNK_SIZE));
    }
    reshapedCounts[getTableName(table)] = await tx.$count(table);
  }
  reshapedCounts['left out request notifications'] =
    reshaped.requestNotifications;
  reshapedCounts['dropped notifications'] = reshaped.droppedNotifications;

  await assertLinksMatchAffiliations(tx);
  await tx.execute(sql`drop schema reshape cascade`);
  return reshapedCounts;
});

console.table(counts);
await db.$client.end();
