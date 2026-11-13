import { describe, expect, test } from 'bun:test';

import { GLOBE_ICON_PATH } from '@/lib/club-links';
import { getLinkIconPath, resolveLinkIcon } from '@/server/club-links';
import { clubsInsertSchema } from '@/server/zod/clubs';

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

describe('resolveLinkIcon', () => {
  test('matches domain exceptions and brand domains', () => {
    expect(resolveLinkIcon('https://t.me/x')).toBe('telegram');
    expect(resolveLinkIcon('https://www.chess.com/club/x')).toBe('chessdotcom');
    expect(resolveLinkIcon('https://club.substack.com/')).toBe('substack');
  });

  test('ignores hosted sites, second-level suffixes and unknown domains', () => {
    expect(resolveLinkIcon('https://ourclub.github.io/')).toBeNull();
    expect(resolveLinkIcon('https://something.org.uk/')).toBeNull();
    expect(resolveLinkIcon('https://ourchessclub.ru/')).toBeNull();
  });
});

describe('getLinkIconPath', () => {
  test('falls back to the globe for unknown slugs', () => {
    expect(getLinkIconPath('telegram')).not.toBe(GLOBE_ICON_PATH);
    expect(getLinkIconPath('not-a-slug')).toBe(GLOBE_ICON_PATH);
    expect(getLinkIconPath(null)).toBe(GLOBE_ICON_PATH);
  });
});
