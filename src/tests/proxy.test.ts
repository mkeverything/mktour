import {
  afterAll,
  beforeEach,
  describe,
  expect,
  mock,
  setSystemTime,
  test,
} from 'bun:test';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { NextRequest } from 'next/server';

const getMock = mock<(key: string) => Promise<unknown>>();
mock.module('@vercel/global-config', () => ({ get: getMock }));

const { config, proxy } = await import('@/proxy');

const NOW = new Date('2026-08-10T21:10:00Z');

const request = (
  path: string,
  init?: ConstructorParameters<typeof NextRequest>[1],
) => proxy(new NextRequest(`https://mktour.org${path}`, init));

const isPassedThrough = (response: Response) =>
  response.headers.get('x-middleware-next') === '1';

describe('maintenance proxy', () => {
  const originalGlobalConfig = process.env.GLOBAL_CONFIG;

  beforeEach(() => {
    process.env.GLOBAL_CONFIG =
      'https://global-config.vercel.com/ecfg_test?token=test';
    setSystemTime(NOW);
    getMock.mockReset();
  });

  afterAll(() => {
    process.env.GLOBAL_CONFIG = originalGlobalConfig;
    setSystemTime();
  });

  test('passes through when maintenance is disabled', async () => {
    getMock.mockResolvedValue({ enabled: false });
    expect(isPassedThrough(await request('/'))).toBe(true);
  });

  test('rewrites pages to the maintenance route with 503', async () => {
    getMock.mockResolvedValue({ enabled: true, startsAt: null, endsAt: null });
    const response = await request('/clubs/all');

    expect(response.status).toBe(503);
    expect(response.headers.get('x-middleware-rewrite')).toBe(
      'https://mktour.org/maintenance',
    );
    expect(response.headers.get('Retry-After')).toBeNull();
  });

  test('returns 503 json without rewriting api and post requests', async () => {
    getMock.mockResolvedValue({ enabled: true });

    for (const response of [
      await request('/api/trpc/auth.info'),
      await request('/api'),
      await request('/tournaments/my', {
        method: 'POST',
        headers: { 'next-action': 'abc' },
      }),
      await request('/clubs/all', {
        method: 'POST',
        headers: { 'content-type': 'multipart/form-data; boundary=x' },
      }),
      await request('/maintenance', { method: 'POST' }),
    ]) {
      expect(response.status).toBe(503);
      expect(response.headers.get('x-middleware-rewrite')).toBeNull();
      expect(await response.json()).toEqual({ error: 'MAINTENANCE' });
    }
  });

  test('applies the scheduled window with retry-after', async () => {
    const endsAt = '2026-08-10T21:30:00Z';
    getMock.mockResolvedValue({
      enabled: true,
      startsAt: '2026-08-10T21:00:00Z',
      endsAt,
    });
    const response = await request('/');

    expect(response.status).toBe(503);
    expect(response.headers.get('Retry-After')).toBe('1200');
    expect(response.headers.get('x-middleware-rewrite')).toBe(
      `https://mktour.org/maintenance?endsAt=${encodeURIComponent('2026-08-10T21:30:00.000Z')}`,
    );

    setSystemTime(new Date('2026-08-10T20:59:59Z'));
    expect(isPassedThrough(await request('/'))).toBe(true);

    setSystemTime(new Date(endsAt));
    expect(isPassedThrough(await request('/'))).toBe(true);
  });

  test('never blocks operational routes or reading the maintenance page', async () => {
    getMock.mockResolvedValue({ enabled: true });

    for (const response of [
      await request('/maintenance'),
      await request('/maintenance', { method: 'HEAD' }),
      await request('/api/db/migrate', { method: 'POST' }),
      await request('/api/auth/delete-expired-sessions'),
    ]) {
      expect(isPassedThrough(response)).toBe(true);
    }
  });

  test('fails open when global config is unavailable or invalid', async () => {
    getMock.mockRejectedValue(new Error('unavailable'));
    expect(isPassedThrough(await request('/'))).toBe(true);

    for (const value of [
      { enabled: 'false' },
      { enabled: true, endsAt: 'not a date' },
      { enabled: true, startsAt: 0 },
    ]) {
      getMock.mockResolvedValue(value);
      expect(isPassedThrough(await request('/'))).toBe(true);
    }

    delete process.env.GLOBAL_CONFIG;
    getMock.mockResolvedValue({ enabled: true });
    expect(isPassedThrough(await request('/'))).toBe(true);
  });

  test('fails open when global config read stalls', async () => {
    getMock.mockReturnValue(new Promise(() => {}));
    expect(isPassedThrough(await request('/'))).toBe(true);
  });
});

describe('maintenance proxy matcher', () => {
  const matches = (url: string, headers?: Record<string, string>) =>
    unstable_doesMiddlewareMatch({ config, url, headers });

  test('runs for pages, api and server actions on file-like urls', () => {
    expect(matches('/')).toBe(true);
    expect(matches('/clubs/all')).toBe(true);
    expect(matches('/api')).toBe(true);
    expect(matches('/api/trpc/auth.info,user.info')).toBe(true);
    expect(matches('/tournaments/review.json', { 'next-action': 'abc' })).toBe(
      true,
    );
    expect(
      matches('/tournaments/review.json', {
        'content-type': 'multipart/form-data; boundary=x',
      }),
    ).toBe(true);
    expect(
      matches('/tournaments/review.json', {
        'content-type': 'application/x-www-form-urlencoded',
      }),
    ).toBe(true);
  });

  test('skips static assets', () => {
    expect(matches('/_next/static/chunks/main.js')).toBe(false);
    expect(matches('/favicon.ico')).toBe(false);
    expect(matches('/sw.js')).toBe(false);
  });
});
