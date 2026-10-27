import { lucia } from '@/lib/auth/lucia';

export async function GET(req: Request) {
  if (
    req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return new Response('Unauthorized', { status: 401 });
  }
  await lucia.deleteExpiredSessions();
  return new Response(null, { status: 204 });
}
