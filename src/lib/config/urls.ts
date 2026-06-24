import '@/lib/config/env';

import { AppError } from '@/lib/errors';

export const BASE_URL =
  process.env.NODE_ENV === 'production'
    ? process.env.NEXT_PUBLIC_BASE_URL
    : 'http://192.168.1.67:3000';

export const SOCKET_URL =
  process.env.NODE_ENV === 'production'
    ? process.env.NEXT_PUBLIC_SOCKET_URL
    : 'ws://192.168.1.67:7070';

export const getDatabaseUrl = () =>
  process.env.OFFLINE === 'true'
    ? 'http://192.168.1.67:8080'
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
    throw new AppError('CONFIG_ERROR', {
      cause: `operation requires NODE_ENV=test (current: ${process.env.NODE_ENV})`,
    });
  }

  const dbUrl = getDatabaseUrl() ?? '';
  const isTestUrl = dbUrl.toLowerCase().includes('test');

  if (!isTestUrl) {
    throw new AppError('CONFIG_ERROR', {
      cause: `database url does not appear to be a test database: ${dbUrl.substring(0, 50)}...`,
    });
  }

  return true;
};
