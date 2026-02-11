import '@/lib/config/env';

export const BASE_URL =
  process.env.NODE_ENV === 'production'
    ? process.env.NEXT_PUBLIC_BASE_URL
    : 'http://localhost:3000';

export const SOCKET_URL =
  process.env.NODE_ENV === 'production'
    ? process.env.NEXT_PUBLIC_SOCKET_URL
    : 'ws://localhost:7070';

export const getDatabaseUrl = () =>
  process.env.OFFLINE === 'true'
    ? 'http://localhost:8080'
    : process.env.MKTOURTEST === 'true' || process.env.NODE_ENV === 'test'
      ? process.env.TEST_DATABASE_URL
      : process.env.DATABASE_URL;

export const getDatabaseAuthToken = () =>
  process.env.OFFLINE === 'true'
    ? ' '
    : process.env.MKTOURTEST === 'true' || process.env.NODE_ENV === 'test'
      ? process.env.TEST_DATABASE_AUTH_TOKEN
      : process.env.DATABASE_AUTH_TOKEN;

export const verifyTestDatabase = () => {
  const isTestEnv = process.env.NODE_ENV === 'test';

  if (!isTestEnv) {
    throw new Error(
      `🚨 CRITICAL: Operation requires NODE_ENV=test (current: ${process.env.NODE_ENV})`,
    );
  }

  const dbUrl = getDatabaseUrl() ?? '';
  const isTestUrl = dbUrl.toLowerCase().includes('test');

  if (!isTestUrl) {
    throw new Error(
      `🚨 CRITICAL: Database URL does not appear to be a test database. URL must contain "test". YOUR DATA IS AT RISK. Got: ${dbUrl.substring(0, 50)}...`,
    );
  }

  return true;
};
