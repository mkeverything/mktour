import {
  getDatabaseAuthToken,
  getDatabaseUrl,
} from '@/lib/config/non-next-urls';
import { AppError } from '@/lib/errors';
import { createClient } from '@libsql/client';
import type { Client, Transaction } from '@libsql/client';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import crypto from 'node:crypto';
import path from 'node:path';

const MIGRATIONS_FOLDER = path.join(process.cwd(), 'src/server/db/migrations');
const LEDGER = '__drizzle_migrations';
const ARCHIVE = '__drizzle_migrations_v0_archive';
const APPLY_CONFIRMATION = 'rebase-drizzle-v1-ledger';
// sha256 of the audited beta and production hash/created_at ledger rows
const EXPECTED_LEGACY_LEDGER_HASHES = new Set([
  '5b25f83d038f3ea0917f7553fa09076c16e4e5d448e9979ffb4bda7add9899aa',
  'b2b48e295fe17a163e040e5694e90b89b0d921391ad026300bae8af9a0e3d9d2',
]);
// sha256 of the audited beta and production sqlite_master application schemas
const EXPECTED_APPLICATION_SCHEMA_HASHES = new Set([
  '614c9979d4160272f57d7e95d1dfc96a15b57c439948453326115ba5ba647179',
  '527516684c8a8e0b16a16c0b7b7f90a5ee587d6fba6206cb6e9368e9a157a2a6',
]);

type Executor = Pick<Client | Transaction, 'execute'>;

type LedgerColumn = {
  name: string;
};

type LedgerRow = {
  created_at: number | null;
  hash: string;
  name?: string | null;
};

type SchemaObjectRow = {
  name: string;
  sql: string;
  tbl_name: string;
  type: string;
};

const hashRows = (rows: LedgerRow[]) =>
  crypto
    .createHash('sha256')
    .update(rows.map((row) => `${row.hash}|${row.created_at}\n`).join(''))
    .digest('hex');

const getApplicationSchemaHash = async (executor: Executor) => {
  const result = await executor.execute({
    sql: `
      select type, name, tbl_name, coalesce(sql, '') as sql
      from sqlite_master
      where name not like 'sqlite_%' and name not in (?, ?)
      order by type, name
    `,
    args: [LEDGER, ARCHIVE],
  });
  const rows = result.rows as unknown as SchemaObjectRow[];
  return crypto
    .createHash('sha256')
    .update(
      rows
        .map((row) => `${row.type}|${row.name}|${row.tbl_name}|${row.sql}\n`)
        .join(''),
    )
    .digest('hex');
};

const getLegacyLedgerRows = async (executor: Executor) => {
  const result = await executor.execute(
    `select hash, created_at from ${LEDGER} order by created_at, hash`,
  );
  return result.rows as unknown as LedgerRow[];
};

const fail = (cause: string): never => {
  throw new AppError('CONFIG_ERROR', { cause });
};

const getArg = (name: string) => {
  const prefix = `--${name}=`;
  return process.argv
    .find((arg) => arg.startsWith(prefix))
    ?.slice(prefix.length);
};

const apply = process.argv.includes('--apply');
const confirmation = getArg('confirm');
const url = getArg('url') ?? getDatabaseUrl();
const authToken = getArg('auth-token') ?? getDatabaseAuthToken();

if (!url) fail('database url is required');
if (apply && confirmation !== APPLY_CONFIRMATION) {
  fail(`apply requires --confirm=${APPLY_CONFIRMATION}`);
}
if (!apply && confirmation) fail('--confirm is only valid with --apply');

const migrations = readMigrationFiles({ migrationsFolder: MIGRATIONS_FOLDER });
if (migrations.length !== 1) {
  fail(`expected one v1 baseline migration, found ${migrations.length}`);
}
const [baseline] = migrations;
if (!baseline.name.endsWith('_v1_baseline')) {
  fail(`unexpected baseline migration name: ${baseline.name}`);
}

const client = createClient({ url, authToken });

const getTableNames = async () => {
  const result = await client.execute({
    sql: "select name from sqlite_master where type = 'table' and name in (?, ?)",
    args: [LEDGER, ARCHIVE],
  });
  return new Set(result.rows.map((row) => String(row.name)));
};

const tableNames = await getTableNames();
if (!tableNames.has(LEDGER)) fail(`${LEDGER} does not exist`);

const columnResult = await client.execute(`pragma table_info(${LEDGER})`);
const columnNames = columnResult.rows.map((row) =>
  String((row as unknown as LedgerColumn).name),
);

const ledgerResult = await client.execute(
  `select hash, created_at${columnNames.includes('name') ? ', name' : ''} from ${LEDGER} order by created_at, hash`,
);
const ledgerRows = ledgerResult.rows as unknown as LedgerRow[];
const isV1Ledger = ['id', 'hash', 'created_at', 'name', 'applied_at'].every(
  (column) => columnNames.includes(column),
);
const applicationSchemaHash = await getApplicationSchemaHash(client);
if (!EXPECTED_APPLICATION_SCHEMA_HASHES.has(applicationSchemaHash)) {
  fail(`unexpected application schema: ${applicationSchemaHash}`);
}

if (isV1Ledger) {
  const [row] = ledgerRows;
  if (
    ledgerRows.length === 1 &&
    row?.hash === baseline.hash &&
    row.name === baseline.name &&
    tableNames.has(ARCHIVE)
  ) {
    console.log(`ledger already rebased to ${baseline.name}`);
    client.close();
    process.exit(0);
  }
  fail('refusing unexpected v1 migration ledger state');
}

if (columnNames.join(',') !== 'id,hash,created_at') {
  fail(`unexpected legacy ledger columns: ${columnNames.join(',')}`);
}
if (tableNames.has(ARCHIVE)) fail(`${ARCHIVE} already exists`);
if (ledgerRows.some((row) => !row.hash || row.created_at === null)) {
  fail('legacy ledger contains an incomplete row');
}
const legacyLedgerHash = hashRows(ledgerRows);
if (!EXPECTED_LEGACY_LEDGER_HASHES.has(legacyLedgerHash)) {
  fail(`unexpected legacy ledger history: ${legacyLedgerHash}`);
}

console.log(
  `${apply ? 'applying' : 'dry-run'} ledger rebase: ${ledgerRows.length} legacy rows -> ${baseline.name}`,
);
console.log(`legacy ledger archive: ${ARCHIVE}`);

if (!apply) {
  console.log(
    `no changes made; rerun with --apply --confirm=${APPLY_CONFIRMATION}`,
  );
  client.close();
  process.exit(0);
}

const transaction = await client.transaction('write');
try {
  const currentTables = await transaction.execute({
    sql: "select name from sqlite_master where type = 'table' and name in (?, ?)",
    args: [LEDGER, ARCHIVE],
  });
  const currentTableNames = new Set(
    currentTables.rows.map((row) => String(row.name)),
  );
  if (!currentTableNames.has(LEDGER) || currentTableNames.has(ARCHIVE)) {
    fail('migration ledger state changed before apply');
  }

  const currentLedgerHash = hashRows(await getLegacyLedgerRows(transaction));
  if (currentLedgerHash !== legacyLedgerHash) {
    fail('migration ledger changed before apply');
  }
  const currentApplicationSchemaHash =
    await getApplicationSchemaHash(transaction);
  if (currentApplicationSchemaHash !== applicationSchemaHash) {
    fail('application schema changed before apply');
  }

  await transaction.execute(`alter table ${LEDGER} rename to ${ARCHIVE}`);
  await transaction.execute(`
    create table ${LEDGER} (
      id integer primary key,
      hash text not null,
      created_at numeric,
      name text,
      applied_at text
    )
  `);
  await transaction.execute({
    sql: `insert into ${LEDGER} (hash, created_at, name, applied_at) values (?, ?, ?, ?)`,
    args: [
      baseline.hash,
      baseline.folderMillis,
      baseline.name,
      new Date().toISOString(),
    ],
  });
  await transaction.commit();
  console.log(
    `ledger rebased to ${baseline.name}; domain tables were not changed`,
  );
} catch (error) {
  if (!transaction.closed) await transaction.rollback();
  throw error;
} finally {
  transaction.close();
  client.close();
}
