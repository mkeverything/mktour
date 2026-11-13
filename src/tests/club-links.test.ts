import { describe, expect, test } from 'bun:test';

import { GLOBE_ICON_PATH } from '@/lib/club-links';
import { getLinkIconPath } from '@/server/club-links';
import { clubsInsertSchema } from '@/server/zod/clubs';
import { siChessdotcom, siSubstack, siTelegram } from 'simple-icons';

const parseLinks = (...urls: string[]) =>
  clubsInsertSchema
    .pick({ links: true })
    .safeParse({ links: urls.map((url) => ({ url })) });

const issueMessages = (...urls: string[]) =>
  parseLinks(...urls).error?.issues.map(({ message }) => message);

describe('club link validation', () => {
  test('adds https to links without a scheme', () => {
    expect(parseLinks(' instagram.com/x ').data?.links).toEqual([
      { url: 'https://instagram.com/x' },
    ]);
  });

  test('rejects non-web schemes and hosts without a dot', () => {
    expect(issueMessages('javascript:alert(1)')).toEqual(['INVALID_LINK']);
    expect(issueMessages('ftp://x.org')).toEqual(['INVALID_LINK']);
    expect(issueMessages('hello')).toEqual(['INVALID_LINK']);
  });

  test('catches duplicates after normalising', () => {
    expect(
      parseLinks('instagram.com/x', 'https://instagram.com/x').error?.issues,
    ).toMatchObject([{ message: 'DUPLICATE_LINK', path: ['links', 1, 'url'] }]);
  });
});

describe('getLinkIconPath', () => {
  test('matches domain exceptions and brand domains', () => {
    expect(getLinkIconPath('https://t.me/x')).toBe(siTelegram.path);
    expect(getLinkIconPath('https://www.chess.com/club/x')).toBe(
      siChessdotcom.path,
    );
    expect(getLinkIconPath('https://club.substack.com/')).toBe(siSubstack.path);
  });

  test('falls back to the globe for hosted sites, second-level suffixes and unknown domains', () => {
    expect(getLinkIconPath('https://ourclub.github.io/')).toBe(GLOBE_ICON_PATH);
    expect(getLinkIconPath('https://something.org.uk/')).toBe(GLOBE_ICON_PATH);
    expect(getLinkIconPath('https://ourchessclub.ru/')).toBe(GLOBE_ICON_PATH);
  });
});
