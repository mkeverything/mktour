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

const { seedComprehensiveTestData } = await import('../../server/db/seed');
const { cleanupTestDb } = await import('./utils');

console.log('cleaning up test database...');
await cleanupTestDb();
console.log('🧹 test database cleaned up');

console.log('seeding test database...');
await seedComprehensiveTestData();
console.log('🌱 test database seeded');

export {};
