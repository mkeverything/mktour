import { describe, expect, test } from 'bun:test';
import {
  getAcceptedLocales,
  isLocalizedPath,
  readVisitor,
  resolveLocale,
  splitLocalePrefix,
  toPublicPath,
  type Visitor,
} from '@/lib/locales';
import { NextRequest } from 'next/server';

describe('locales', () => {
  test('orders accepted locales by quality and drops unsupported ones', () => {
    expect(getAcceptedLocales('de-DE,de;q=0.9')).toEqual([]);
    expect(getAcceptedLocales('en-US;q=0.5,ru-RU,de;q=0.9')).toEqual([
      'ru',
      'en',
    ]);
    expect(getAcceptedLocales('ru;q=0,en')).toEqual(['en']);
  });

  test('localizes only our own public pages', () => {
    for (const path of [
      '/',
      '/info/about',
      '/info/faq',
      '/info/contact',
      '/clubs/all',
      '/tournaments/all',
    ]) {
      expect(isLocalizedPath(path)).toBe(true);
    }
    for (const path of [
      '/clubs/abc',
      '/tournaments/abc',
      '/user/magnus',
      '/clubs/my',
      '/clubs/create',
      '/tournaments/my',
      '/tournaments/create',
      '/tournaments/abc/edit',
      '/player/abc',
      '/profile',
      '/info',
    ]) {
      expect(isLocalizedPath(path)).toBe(false);
    }
  });

  test('adds and strips locale prefixes', () => {
    expect(toPublicPath('/', 'en')).toBe('/');
    expect(toPublicPath('/', 'ru')).toBe('/ru');
    expect(toPublicPath('/clubs/all', 'ru')).toBe('/ru/clubs/all');
    expect(splitLocalePrefix('/ru')).toEqual({ locale: 'ru', pathname: '/' });
    expect(splitLocalePrefix('/ru/clubs/all')).toEqual({
      locale: 'ru',
      pathname: '/clubs/all',
    });
    expect(splitLocalePrefix('/rus/clubs')).toEqual({ pathname: '/rus/clubs' });
  });

  test('reads the visitor from request headers and cookies', () => {
    const visit = (headers: Record<string, string>) => {
      const request = new NextRequest('https://mktour.org', { headers });
      return readVisitor(request.headers, request.cookies);
    };

    expect(
      visit({
        'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)',
        'accept-language': 'en-US;q=0.5,ru-RU',
        cookie: 'NEXT_LOCALE=ru; auth_session=abc',
      }),
    ).toEqual({
      isCrawler: true,
      isSignedIn: true,
      savedLocale: 'ru',
      acceptedLocales: ['ru', 'en'],
    });
    expect(visit({ 'accept-language': ' ', cookie: 'NEXT_LOCALE=de' })).toEqual(
      visitor(),
    );
    expect(visit({ 'accept-language': 'de' })).toEqual(
      visitor({ acceptedLocales: [] }),
    );
  });

  test('resolves the saved choice, then the browser, then the default', () => {
    expect(resolveLocale(visitor({ acceptedLocales: ['ru', 'en'] }))).toBe(
      'ru',
    );
    expect(
      resolveLocale(visitor({ savedLocale: 'en', acceptedLocales: ['ru'] })),
    ).toBe('en');
    expect(resolveLocale(visitor({ acceptedLocales: [] }))).toBe('en');
    expect(resolveLocale(visitor())).toBe('en');
    expect(
      resolveLocale(
        visitor({
          isCrawler: true,
          savedLocale: 'ru',
          acceptedLocales: ['ru'],
        }),
      ),
    ).toBe('en');
  });
});

const visitor = (overrides: Partial<Visitor> = {}): Visitor => ({
  isCrawler: false,
  isSignedIn: false,
  savedLocale: undefined,
  acceptedLocales: undefined,
  ...overrides,
});
