import { GET } from '@/app/api/health/route';
import { afterAll, afterEach, describe, expect, spyOn, test } from 'bun:test';
import * as nextServer from 'next/server';

const originalCommit = process.env.MKTOUR_COMMIT;

describe('health response', () => {
  const connection = spyOn(nextServer, 'connection').mockResolvedValue();

  afterAll(() => connection.mockRestore());

  afterEach(() => {
    if (originalCommit === undefined) {
      delete process.env.MKTOUR_COMMIT;
    } else {
      process.env.MKTOUR_COMMIT = originalCommit;
    }
    connection.mockClear();
  });

  test('waits for a request and returns an uncached ok response', async () => {
    delete process.env.MKTOUR_COMMIT;
    const response = await GET();

    expect(connection).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('ok');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('X-Mktour-Commit')).toBeNull();
  });

  test('includes the image commit', async () => {
    process.env.MKTOUR_COMMIT = '0123456789abcdef0123456789abcdef01234567';
    const response = await GET();

    expect(response.headers.get('X-Mktour-Commit')).toBe(
      process.env.MKTOUR_COMMIT,
    );
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  test('omits empty or invalid commits', async () => {
    for (const commit of ['', 'unknown', 'abcdef0', 'g'.repeat(40)]) {
      process.env.MKTOUR_COMMIT = commit;
      expect((await GET()).headers.get('X-Mktour-Commit')).toBeNull();
    }
  });
});
