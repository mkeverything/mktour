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
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
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

const rewriteOf = (response: Response) =>
  response.headers.get('x-middleware-rewrite');

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
    expect(rewriteOf(await request('/'))).toBe('https://mktour.org/en');
    expect(await publicCaller.maintenanceStartsAt()).toBeNull();
  });

  test('rewrites pages to the maintenance route with 503', async () => {
    getMock.mockResolvedValue({ enabled: true, startsAt: null, endsAt: null });
    const response = await request('/clubs/all');

    expect(response.status).toBe(503);
    expect(response.headers.get('x-middleware-rewrite')).toBe(
      'https://mktour.org/en/maintenance',
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
      `https://mktour.org/en/maintenance?endsAt=${encodeURIComponent('2026-08-10T21:30:00.000Z')}`,
    );

    setSystemTime(new Date('2026-08-10T20:59:59Z'));
    expect(rewriteOf(await request('/'))).toBe('https://mktour.org/en');
    expect(await publicCaller.maintenanceStartsAt()).toEqual(
      new Date('2026-08-10T21:00:00Z'),
    );

    setSystemTime(new Date('2026-08-10T21:00:00Z'));
    expect(await publicCaller.maintenanceStartsAt()).toBeNull();

    setSystemTime(new Date(endsAt));
    expect(rewriteOf(await request('/'))).toBe('https://mktour.org/en');
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
        `https://mktour.org/en/maintenance?endsAt=${encodeURIComponent('2026-08-10T21:30:00.000Z')}`,
      );
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(response.headers.get('Retry-After')).toBe('1200');
    }
  });

  test('fails open when global config is unavailable or invalid', async () => {
    getMock.mockRejectedValue(new Error('unavailable'));
    expect(rewriteOf(await request('/'))).toBe('https://mktour.org/en');

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
      expect(rewriteOf(await request('/'))).toBe('https://mktour.org/en');
      expect(await publicCaller.maintenanceStartsAt()).toBeNull();
    }

    delete process.env.GLOBAL_CONFIG;
    getMock.mockResolvedValue({ enabled: true });
    expect(rewriteOf(await request('/'))).toBe('https://mktour.org/en');
  });

  test('fails open when global config read stalls', async () => {
    getMock.mockReturnValue(new Promise(() => {}));
    expect(rewriteOf(await request('/'))).toBe('https://mktour.org/en');
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
      expect(rewriteOf(await request('/'))).toBe('https://mktour.org/en');

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

describe('locale proxy', () => {
  const GOOGLEBOT =
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
  const read = (path: string, headers?: Record<string, string>) =>
    request(path, { headers });

  beforeEach(() => {
    getMock.mockReset();
    getMock.mockResolvedValue({ enabled: false });
  });

  test('rewrites unprefixed pages to the saved or accepted locale', async () => {
    expect(rewriteOf(await read('/clubs/all?page=2'))).toBe(
      'https://mktour.org/en/clubs/all?page=2',
    );
    expect(
      rewriteOf(await read('/clubs/all', { cookie: 'NEXT_LOCALE=ru' })),
    ).toBe('https://mktour.org/ru/clubs/all');
    expect(
      rewriteOf(await read('/', { 'accept-language': 'de-DE,ru;q=0.8' })),
    ).toBe('https://mktour.org/ru');
    expect(
      rewriteOf(
        await read('/', {
          cookie: 'NEXT_LOCALE=en',
          'accept-language': 'ru-RU,ru',
        }),
      ),
    ).toBe('https://mktour.org/en');
    expect(
      rewriteOf(
        await read('/', { cookie: 'NEXT_LOCALE=de', 'accept-language': 'ru' }),
      ),
    ).toBe('https://mktour.org/ru');
  });

  test('gives crawlers the default locale on unprefixed urls', async () => {
    expect(
      rewriteOf(
        await read('/info/about', {
          'user-agent': GOOGLEBOT,
          'accept-language': 'ru',
          cookie: 'NEXT_LOCALE=ru',
        }),
      ),
    ).toBe('https://mktour.org/en/info/about');
  });

  test('passes route handlers outside the locale segment through', async () => {
    const entries = await readdir(join(process.cwd(), 'src/app'), {
      withFileTypes: true,
    });
    const handlers = entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('['))
      .map((entry) => `/${entry.name}`);

    expect(handlers.length).toBeGreaterThan(0);
    for (const path of [...handlers, '/login/lichess/callback', '/_vercel/x']) {
      expect(isPassedThrough(await read(path))).toBe(true);
    }
  });

  test('redirects default locale prefixes permanently', async () => {
    for (const [path, location] of [
      ['/en', 'https://mktour.org/'],
      ['/en/info/faq?x=1', 'https://mktour.org/info/faq?x=1'],
    ]) {
      const response = await read(path);
      expect(response.status).toBe(308);
      expect(response.headers.get('Location')).toBe(location);
    }
  });

  test('serves prefixed public pages to crawlers and matching visitors', async () => {
    const visitors: (Record<string, string> | undefined)[] = [
      undefined,
      { 'accept-language': 'en-US,en;q=0.9,ru;q=0.8' },
      { 'user-agent': GOOGLEBOT, 'accept-language': 'en-US' },
      { 'user-agent': GOOGLEBOT, cookie: 'auth_session=abc' },
    ];
    for (const headers of visitors) {
      for (const path of ['/ru', '/ru/tournaments/abc', '/ru/user/magnus']) {
        expect(isPassedThrough(await read(path, headers))).toBe(true);
      }
    }
  });

  test('keeps the prefixed language for the visit without saving it', async () => {
    const visitors: Record<string, string>[] = [
      { 'accept-language': 'en-US,en;q=0.9,ru;q=0.8' },
      { 'accept-language': 'ru', cookie: 'NEXT_LOCALE=de' },
    ];
    for (const headers of visitors) {
      const response = await read('/ru/clubs/all', headers);
      const cookie = response.headers.get('set-cookie') ?? '';

      expect(isPassedThrough(response)).toBe(true);
      expect(cookie).toContain('NEXT_LOCALE=ru');
      expect(cookie).toContain('Path=/');
      expect(cookie).not.toMatch(/max-age|expires/i);
    }
  });

  test('never sets the language cookie for crawlers or over a valid one', async () => {
    const crawler = await read('/ru/clubs/all', { 'user-agent': GOOGLEBOT });
    expect(isPassedThrough(crawler)).toBe(true);
    expect(crawler.headers.get('set-cookie')).toBeNull();

    const saved = await read('/ru/clubs/all', {
      'accept-language': 'ru',
      cookie: 'NEXT_LOCALE=en',
    });
    expect(saved.status).toBe(307);
    expect(saved.headers.get('set-cookie')).toBeNull();
  });

  test('sends everyone else to the unprefixed url', async () => {
    for (const [path, headers] of [
      ['/ru/clubs/all', { 'accept-language': 'en-US,en' }],
      ['/ru/clubs/all', { cookie: 'auth_session=abc' }],
      ['/ru/clubs/all', { cookie: 'NEXT_LOCALE=en', 'accept-language': 'ru' }],
      ['/ru', { cookie: 'NEXT_LOCALE=ru' }],
      ['/ru/clubs/my', { 'user-agent': GOOGLEBOT }],
      ['/ru/profile', undefined],
    ] as const) {
      const response = await read(path, headers);
      const unprefixed = path.replace('/ru', '') || '/';
      expect(response.status).toBe(307);
      expect(response.headers.get('Location')).toBe(
        `https://mktour.org${unprefixed}`,
      );
    }
  });

  test('passes prefixed non-read requests through', async () => {
    const response = await request('/ru/clubs/my', {
      method: 'POST',
      headers: { 'next-action': 'abc', 'accept-language': 'en' },
    });
    expect(isPassedThrough(response)).toBe(true);
  });

  test('keeps the url locale on the maintenance page', async () => {
    getMock.mockResolvedValue({ enabled: true });
    const original = process.env.GLOBAL_CONFIG;
    process.env.GLOBAL_CONFIG =
      'https://global-config.vercel.com/ecfg_test?token=test';
    try {
      expect(rewriteOf(await read('/ru/info/about'))).toBe(
        'https://mktour.org/ru/maintenance',
      );
      expect(
        rewriteOf(await read('/clubs/all', { cookie: 'NEXT_LOCALE=ru' })),
      ).toBe('https://mktour.org/ru/maintenance');
    } finally {
      process.env.GLOBAL_CONFIG = original;
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
