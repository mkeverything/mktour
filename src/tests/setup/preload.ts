import { mock } from 'bun:test';
import { AsyncLocalStorage } from 'node:async_hooks';

mock.module('server-only', () => ({}));

(process.env as Record<string, string>).NODE_ENV = 'test';
(process.env as Record<string, string>).MKTOURTEST = 'true';

// next internals patch console and expect the global that the next runtime normally sets
Object.assign(globalThis, { AsyncLocalStorage });

// next's cache and lucia's session need a request, which tests don't have:
// cache calls do nothing, and every test acts as the fixture organizer
const nextCache = await import('next/cache');
mock.module('next/cache', () => ({
  ...nextCache,
  cacheTag: () => {},
  revalidateTag: () => {},
}));
const lucia = await import('@/lib/auth/lucia');
const { fixtures, seedComprehensiveTestData } =
  await import('@/server/db/seed');
mock.module('@/lib/auth/lucia', () => ({
  ...lucia,
  validateRequest: async () => ({
    user: fixtures.organizer,
    session: { id: 'test', userId: fixtures.organizer.id },
  }),
}));

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
  console.log('seeding test database...');
  await seedComprehensiveTestData();
  console.log('🌱 test database seeded');
} else {
  console.log('⏭️  skipping database seed (SKIP_SEED=1)');
}

export {};
