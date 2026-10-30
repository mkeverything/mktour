import { connection } from 'next/server';

export async function GET() {
  await connection();

  const headers = new Headers({ 'Cache-Control': 'no-store' });
  const commit = process.env.MKTOUR_COMMIT;
  if (commit && /^[a-f0-9]{40}$/i.test(commit)) {
    headers.set('X-Mktour-Commit', commit);
  }

  return new Response('ok', { headers });
}
