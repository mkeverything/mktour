(process.env as Record<string, string>).NODE_ENV = 'test';
(process.env as Record<string, string>).MKTOURTEST = 'true';

// Verification of test database URL to prevent accidental operations on wrong database
try {
  const { verifyTestDatabase } = await import('@/lib/config/urls');
  verifyTestDatabase();
} catch (e) {
  console.error(e);
  process.exit(1);
}

// skip seeding if SKIP_SEED env var is set
// usage: SKIP_SEED=1 bun test path/to/test.ts
const skipSeed =
  process.env.SKIP_SEED === '1' || process.env.SKIP_SEED === 'true';

if (!skipSeed) {
  const { seedComprehensiveTestData } = await import('../../server/db/seed');
  const { cleanupTestDb } = await import('./utils');

  console.log('cleaning up test database...');
  await cleanupTestDb();
  console.log('🧹 test database cleaned up');

  console.log('seeding test database...');
  await seedComprehensiveTestData();
  console.log('🌱 test database seeded');
} else {
  console.log('⏭️  skipping database seed (SKIP_SEED=1)');
}

export {};
