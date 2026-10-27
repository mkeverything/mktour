import '@/lib/config/env';

import { AppError } from '@/lib/errors';

export const BASE_URL =
  process.env.NODE_ENV === 'production'
    ? process.env.NEXT_PUBLIC_BASE_URL
    : 'http://localhost:3000';

// only production is indexed; beta and other previews duplicate it
export const IS_INDEXABLE = process.env.DEPLOY_ENV === 'prod';

// hostnames that serve this deployment besides the base url's, like ru.mktour.org for
// visitors who cannot reach cloudflare. a request to any other host gets the base url
export const getRequestOrigin = (host: string | null) => {
  // react-doctor-disable-next-line react-doctor/no-unguarded-throwing-parse-call
  const base = new URL(BASE_URL);
  const mirrors = process.env.MIRROR_HOSTS?.split(',').map((h) => h.trim());
  return host && mirrors?.includes(host)
    ? `${base.protocol}//${host}`
    : base.origin;
};

// the ws server is behind /ws of whichever host served the page, so one image serves
// every hostname. NEXT_PUBLIC_SOCKET_URL overrides it where nothing proxies /ws, like vercel.
// browser only: useWebSocket calls it when connecting, never during render
export const getSocketUrl = () => {
  if (process.env.NODE_ENV !== 'production') return 'ws://localhost:7070';
  if (process.env.NEXT_PUBLIC_SOCKET_URL) {
    return process.env.NEXT_PUBLIC_SOCKET_URL;
  }
  return `wss://${window.location.host}/ws`;
};

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
