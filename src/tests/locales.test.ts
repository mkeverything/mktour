import { describe, expect, test } from 'bun:test';
import {
  getAcceptedLocales,
  isLocalizedPath,
  localizePath,
  resolveLocale,
  splitLocalePrefix,
} from '@/lib/locales';

describe('locales', () => {
  test('orders accepted locales by quality and drops unsupported ones', () => {
    expect(getAcceptedLocales(null)).toEqual([]);
    expect(getAcceptedLocales('de-DE,de;q=0.9')).toEqual([]);
    expect(getAcceptedLocales('en-US;q=0.5,ru-RU,de;q=0.9')).toEqual([
      'ru',
      'en',
    ]);
    expect(getAcceptedLocales('ru;q=0,en')).toEqual(['en']);
  });

  test('localizes only public indexable pages', () => {
    for (const path of [
      '/',
      '/info/about',
      '/clubs/all',
      '/clubs/abc',
      '/tournaments/all',
      '/tournaments/abc',
      '/user/magnus',
    ]) {
      expect(isLocalizedPath(path)).toBe(true);
    }
    for (const path of [
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
    expect(localizePath('/', 'en')).toBe('/');
    expect(localizePath('/', 'ru')).toBe('/ru');
    expect(localizePath('/clubs/all', 'ru')).toBe('/ru/clubs/all');
    expect(splitLocalePrefix('/ru')).toEqual({ locale: 'ru', pathname: '/' });
    expect(splitLocalePrefix('/ru/clubs/all')).toEqual({
      locale: 'ru',
      pathname: '/clubs/all',
    });
    expect(splitLocalePrefix('/rus/clubs')).toEqual({ pathname: '/rus/clubs' });
  });

  test('resolves the saved choice, then the browser, then the default', () => {
    const browser = (headers: Record<string, string>) => new Headers(headers);
    const russian = browser({ 'accept-language': 'ru-RU,ru;q=0.9,en;q=0.8' });

    expect(resolveLocale(russian, undefined)).toBe('ru');
    expect(resolveLocale(russian, 'en')).toBe('en');
    expect(resolveLocale(russian, 'de')).toBe('ru');
    expect(resolveLocale(browser({ 'accept-language': 'de' }), 'de')).toBe(
      'en',
    );
    expect(
      resolveLocale(
        browser({
          'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)',
          'accept-language': 'ru',
        }),
        'ru',
      ),
    ).toBe('en');
  });
});
