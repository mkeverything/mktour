import { describe, expect, test } from 'bun:test';

import { ERRORS } from '@/lib/errors';
import en from '@/messages/en.json';
import ru from '@/messages/ru.json';

describe('error catalog', () => {
  test('error messages and translations stay in sync', () => {
    const messages = Object.values(ERRORS).sort();

    expect(Object.keys(en.Errors).sort()).toEqual(messages);
    expect(Object.keys(ru.Errors).sort()).toEqual(messages);

    for (const [key, value] of Object.entries(ERRORS)) {
      expect(key).toBe(value);
    }
  });
});
