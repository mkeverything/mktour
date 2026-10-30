import { afterEach, describe, expect, test } from 'bun:test';
import { BASE_URL, getRequestOrigin } from '@/lib/config/urls';

const base = new URL(BASE_URL);

describe('request origin', () => {
  afterEach(() => {
    delete process.env.MIRROR_HOSTS;
  });

  test('keeps a listed mirror host, with the protocol of the base url', () => {
    process.env.MIRROR_HOSTS = 'ru.mktour.org, ru-beta.mktour.org';
    expect(getRequestOrigin('ru-beta.mktour.org')).toBe(
      `${base.protocol}//ru-beta.mktour.org`,
    );
  });

  test('gives the base url to its own host', () => {
    process.env.MIRROR_HOSTS = 'ru.mktour.org';
    expect(getRequestOrigin(base.host)).toBe(base.origin);
  });

  test('gives the base url to an unlisted host', () => {
    process.env.MIRROR_HOSTS = 'ru.mktour.org';
    expect(getRequestOrigin('evil.example')).toBe(base.origin);
    expect(getRequestOrigin('mktour.org.evil.example')).toBe(base.origin);
  });

  test('gives the base url to every host when no mirrors are set', () => {
    expect(getRequestOrigin('ru.mktour.org')).toBe(base.origin);
  });

  test('gives the base url to a request without a host', () => {
    process.env.MIRROR_HOSTS = 'ru.mktour.org';
    expect(getRequestOrigin(null)).toBe(base.origin);
    expect(getRequestOrigin('')).toBe(base.origin);
  });
});
