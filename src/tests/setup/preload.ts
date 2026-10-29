import { mock } from 'bun:test';
import { AsyncLocalStorage } from 'node:async_hooks';

mock.module('server-only', () => ({}));

(process.env as Record<string, string>).NODE_ENV = 'test';
(process.env as Record<string, string>).MKTOURTEST = 'true';

// next internals patch console and expect the global that the next runtime normally sets
Object.assign(globalThis, { AsyncLocalStorage });

// Verification of test database URL to prevent accidental operations on wrong database
try {
  const { verifyTestDatabase } = await import('@/lib/config/urls');
  verifyTestDatabase();
} catch (e) {
  console.error(e);
  process.exit(1);
}

// skip seeding for tests that don't touch the db; a test that uses the db is
// expected to fail. usage: SKIP_SEED=1 bun test path/to/test.ts
const skipSeed =
  process.env.SKIP_SEED === '1' || process.env.SKIP_SEED === 'true';

if (!skipSeed) {
  const { seedComprehensiveTestData } = await import('../../server/db/seed');

  console.log('seeding test database...');
  await seedComprehensiveTestData();
  console.log('🌱 test database seeded');
} else {
  console.log('⏭️  skipping database seed (SKIP_SEED=1)');
}

export {};
