import { describe, expect, test } from 'bun:test';

import { APP_ERROR_MESSAGES, APP_ERROR_TRPC_CODES } from '@/lib/errors';
import en from '@/messages/en.json';
import ru from '@/messages/ru.json';

describe('error catalog', () => {
  test('error messages and translations stay in sync', () => {
    const messages = [...APP_ERROR_MESSAGES].sort();

    expect(Object.keys(en.Errors).sort()).toEqual(messages);
    expect(Object.keys(ru.Errors).sort()).toEqual(messages);
  });

  test('all app errors have explicit trpc codes', () => {
    expect(Object.keys(APP_ERROR_TRPC_CODES).sort()).toEqual(
      [...APP_ERROR_MESSAGES].sort(),
    );
  });
});
