import { AppError } from '@/lib/errors';
import { getDatabaseUrl, TEST_DATABASE_URL } from '@/lib/config/non-next-urls';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

const runMigrate = async () => {
  (process.env as Record<string, string>).NODE_ENV = 'development';
  const DATABASE_URL = getDatabaseUrl();

  if (!TEST_DATABASE_URL) {
    throw new AppError('CONFIG_ERROR', {
      cause: 'TEST_DATABASE_URL is not defined',
    });
  }

  if (DATABASE_URL === TEST_DATABASE_URL) {
    throw new AppError('CONFIG_ERROR', {
      cause: 'DATABASE_URL and TEST_DATABASE_URL are the same',
    });
  }

  const db = drizzle(DATABASE_URL);
  const dbTest = drizzle(TEST_DATABASE_URL);

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
