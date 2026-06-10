import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

const keyPattern = /^(\s*)"((?:[^"\\]|\\.)+)"\s*:/;

const getLineKeys = (filePath: string) =>
  readFileSync(filePath, 'utf8')
    .split('\n')
    .map((line, index) => {
      const match = keyPattern.exec(line);

      return {
        line: index + 1,
        key: match ? `${match[1].length}:${match[2]}` : null,
      };
    });

describe('messages', () => {
  test('russian keys stay on the same lines as english keys', () => {
    const enKeys = getLineKeys(join(process.cwd(), 'src/messages/en.json'));
    const ruKeys = getLineKeys(join(process.cwd(), 'src/messages/ru.json'));

    expect(ruKeys).toEqual(enKeys);
  });
});
