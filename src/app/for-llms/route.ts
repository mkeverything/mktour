import { cacheLife } from 'next/cache';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function getLlmsContent() {
  'use cache';
  cacheLife('max');
  return readFile(join(process.cwd(), 'public/llms.txt'), 'utf8');
}

export async function GET() {
  return new Response(await getLlmsContent(), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
    },
  });
}
