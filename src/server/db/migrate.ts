import { AppError, ERRORS } from '@/lib/errors';
import {
  getDatabaseAuthToken,
  getDatabaseUrl,
  TEST_DATABASE_AUTH_TOKEN,
  TEST_DATABASE_URL,
} from '@/lib/config/non-next-urls';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';

const runMigrate = async () => {
  (process.env as Record<string, string>).NODE_ENV = 'development';
  const DATABASE_URL = getDatabaseUrl();
  const DATABASE_AUTH_TOKEN = getDatabaseAuthToken();

  if (!DATABASE_URL) {
    throw new AppError(ERRORS.CONFIG_ERROR, {
      cause: 'DATABASE_URL is not defined',
    });
  }

  if (!TEST_DATABASE_URL) {
    throw new AppError(ERRORS.CONFIG_ERROR, {
      cause: 'TEST_DATABASE_URL is not defined',
    });
  }

  if (DATABASE_AUTH_TOKEN == TEST_DATABASE_AUTH_TOKEN) {
    throw new AppError(ERRORS.CONFIG_ERROR, {
      cause: 'DATABASE_AUTH_TOKEN and TEST_DATABASE_AUTH_TOKEN are the same',
    });
  }

  const client = createClient({
    url: DATABASE_URL,
    authToken: DATABASE_AUTH_TOKEN,
  });
  const db = drizzle(client);

  const clientTest = createClient({
    url: TEST_DATABASE_URL,
    authToken: TEST_DATABASE_AUTH_TOKEN,
  });
  const dbTest = drizzle(clientTest);

  console.log('running migrations for development db...');
  const start = Date.now();
  await migrate(db, { migrationsFolder: 'src/server/db/migrations' });
  const end = Date.now();
  console.log('migrations completed in', end - start, 'ms');

  console.log('running migrations for test db...');
  const startTest = Date.now();
  await migrate(dbTest, { migrationsFolder: 'src/server/db/migrations' });
  const endTest = Date.now();
  console.log('migrations completed in', endTest - startTest, 'ms');

  process.exit(0);
};

runMigrate().catch((err) => {
  console.error('migration failed');
  console.error(err);
  process.exit(1);
});
