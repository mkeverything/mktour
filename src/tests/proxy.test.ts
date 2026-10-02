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
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const getMock = mock<(key: string) => Promise<unknown>>();
mock.module('@vercel/global-config', () => ({ get: getMock }));

const { getMaintenance } = await import('@/lib/maintenance');
const { config, proxy } = await import('@/proxy');
const { publicCaller } = await import('@/server/api');

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
    expect(await publicCaller.maintenanceStartsAt()).toBeNull();
  });

  test('rewrites pages to the maintenance route with 503', async () => {
    getMock.mockResolvedValue({ enabled: true, startsAt: null, endsAt: null });
    const response = await request('/clubs/all');

    expect(response.status).toBe(503);
    expect(response.headers.get('x-middleware-rewrite')).toBe(
      'https://mktour.org/maintenance',
    );
    expect(response.headers.get('Retry-After')).toBeNull();
    expect(await publicCaller.maintenanceStartsAt()).toBeNull();
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
    expect(await publicCaller.maintenanceStartsAt()).toEqual(
      new Date('2026-08-10T21:00:00Z'),
    );

    setSystemTime(new Date('2026-08-10T21:00:00Z'));
    expect(await publicCaller.maintenanceStartsAt()).toBeNull();

    setSystemTime(new Date(endsAt));
    expect(isPassedThrough(await request('/'))).toBe(true);
    expect(await publicCaller.maintenanceStartsAt()).toBeNull();
  });

  test('never blocks operational routes', async () => {
    getMock.mockResolvedValue({ enabled: true });

    for (const response of [
      await request('/api/db/migrate', { method: 'POST' }),
      await request('/api/auth/delete-expired-sessions'),
    ]) {
      expect(isPassedThrough(response)).toBe(true);
    }
    expect(getMock).not.toHaveBeenCalled();
  });

  test('redirects direct maintenance reads home when maintenance is inactive', async () => {
    for (const maintenance of [
      { enabled: false },
      { enabled: true, startsAt: '2026-08-10T21:30:00Z' },
      { enabled: true, endsAt: NOW.toISOString() },
    ]) {
      getMock.mockResolvedValue(maintenance);
      for (const method of ['GET', 'HEAD']) {
        const response = await request('/maintenance?endsAt=stale', {
          method,
        });
        expect(response.status).toBe(307);
        expect(response.headers.get('Location')).toBe('https://mktour.org/');
        expect(response.headers.get('Cache-Control')).toBe('no-store');
      }
    }
  });

  test('returns 503 for direct maintenance reads with the configured end time', async () => {
    const endsAt = '2026-08-10T21:30:00Z';
    getMock.mockResolvedValue({ enabled: true, endsAt });

    for (const method of ['GET', 'HEAD']) {
      const response = await request('/maintenance?endsAt=stale', { method });
      expect(response.status).toBe(503);
      expect(response.headers.get('x-middleware-rewrite')).toBe(
        `https://mktour.org/maintenance?endsAt=${encodeURIComponent('2026-08-10T21:30:00.000Z')}`,
      );
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(response.headers.get('Retry-After')).toBe('1200');
    }
  });

  test('fails open when global config is unavailable or invalid', async () => {
    getMock.mockRejectedValue(new Error('unavailable'));
    expect(isPassedThrough(await request('/'))).toBe(true);

    for (const value of [
      { enabled: 'false' },
      { enabled: true, endsAt: 'not a date' },
      { enabled: true, startsAt: 0 },
      {
        enabled: true,
        startsAt: '2026-08-10T21:30:00Z',
        endsAt: '2026-08-10T21:00:00Z',
      },
    ]) {
      getMock.mockResolvedValue(value);
      expect(isPassedThrough(await request('/'))).toBe(true);
      expect(await publicCaller.maintenanceStartsAt()).toBeNull();
    }

    delete process.env.GLOBAL_CONFIG;
    getMock.mockResolvedValue({ enabled: true });
    expect(isPassedThrough(await request('/'))).toBe(true);
  });

  test('fails open when global config read stalls', async () => {
    getMock.mockReturnValue(new Promise(() => {}));
    expect(isPassedThrough(await request('/'))).toBe(true);
  });

  test('uses fresh local config only in development, with remote fallback', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'mktour-maintenance-'));
    const cwd = process.cwd();
    const nodeEnv = process.env.NODE_ENV;
    const connection = process.env.GLOBAL_CONFIG;
    try {
      process.chdir(directory);
      Object.assign(process.env, { NODE_ENV: 'development' });
      getMock.mockResolvedValue({ enabled: true });
      expect(await getMaintenance()).toEqual({ startsAt: null, endsAt: null });
      expect(getMock).toHaveBeenCalledWith('maintenance');
      getMock.mockClear();
      delete process.env.GLOBAL_CONFIG;

      const startsAt = '2026-08-10T21:30:00Z';
      await writeFile(
        'maintenance.local.json',
        JSON.stringify({ enabled: true, startsAt }),
      );
      expect(await publicCaller.maintenanceStartsAt()).toEqual(
        new Date(startsAt),
      );
      expect(isPassedThrough(await request('/'))).toBe(true);

      for (const value of ['{"enabled":false}', '{']) {
        await writeFile('maintenance.local.json', value);
        expect(await getMaintenance()).toBeUndefined();
      }
      expect(getMock).not.toHaveBeenCalled();

      process.env.GLOBAL_CONFIG = connection;
      Object.assign(process.env, { NODE_ENV: 'production' });
      expect(await getMaintenance()).toEqual({ startsAt: null, endsAt: null });
      expect(getMock).toHaveBeenCalledWith('maintenance');
    } finally {
      process.chdir(cwd);
      Object.assign(process.env, { NODE_ENV: nodeEnv });
      process.env.GLOBAL_CONFIG = connection;
      await rm(directory, { recursive: true });
    }
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
