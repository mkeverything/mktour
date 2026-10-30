import { isCronAuthorised } from '@/lib/auth/cron';
import { GET } from '@/app/api/auth/delete-expired-sessions/route';
import { POST } from '@/app/api/db/migrate/route';
import { afterAll, afterEach, describe, expect, spyOn, test } from 'bun:test';

const originalSecret = process.env.CRON_SECRET;
const request = (authorization?: string) =>
  new Request('http://localhost/api/cron', {
    headers:
      authorization === undefined ? {} : { Authorization: authorization },
  });

describe('cron authentication', () => {
  const errorLog = spyOn(console, 'error').mockImplementation(() => {});

  afterAll(() => errorLog.mockRestore());

  afterEach(() => {
    if (originalSecret === undefined) {
      Reflect.deleteProperty(process.env, 'CRON_SECRET');
    } else {
      process.env.CRON_SECRET = originalSecret;
    }
    errorLog.mockClear();
  });

  for (const secret of [undefined, '']) {
    test(`rejects every request when the secret is ${secret === undefined ? 'unset' : 'empty'}`, () => {
      if (secret === undefined) {
        Reflect.deleteProperty(process.env, 'CRON_SECRET');
      } else {
        process.env.CRON_SECRET = secret;
      }

      for (const header of [
        undefined,
        'Bearer undefined',
        'Bearer ',
        'Bearer secret',
      ]) {
        expect(isCronAuthorised(request(header))).toBe(false);
      }
      expect(errorLog).toHaveBeenCalledTimes(4);
      expect(
        errorLog.mock.calls.every(
          ([message]) =>
            message === 'cron authentication rejected: CRON_SECRET is missing',
        ),
      ).toBe(true);
    });
  }

  test('rejects missing, empty, wrong and literal undefined credentials', () => {
    process.env.CRON_SECRET = 'local-test-secret';
    for (const header of [
      undefined,
      '',
      'Bearer ',
      'Bearer wrong',
      'Bearer undefined',
      'local-test-secret',
    ]) {
      expect(isCronAuthorised(request(header))).toBe(false);
    }
  });

  test('accepts the correct bearer secret', () => {
    process.env.CRON_SECRET = 'local-test-secret';
    expect(isCronAuthorised(request('Bearer local-test-secret'))).toBe(true);
  });

  test("preserves both routes' unauthorised responses", async () => {
    Reflect.deleteProperty(process.env, 'CRON_SECRET');

    const sessions = await GET(request('Bearer undefined'));
    expect(sessions.status).toBe(401);
    expect(await sessions.text()).toBe('Unauthorized');

    const migration = await POST(request('Bearer undefined'));
    expect(migration.status).toBe(401);
    expect(await migration.json()).toEqual({ error: 'UNAUTHENTICATED' });
  });
});
