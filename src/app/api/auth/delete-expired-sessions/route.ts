import { isCronAuthorised } from '@/lib/auth/cron';
import { lucia } from '@/lib/auth/lucia';

export async function GET(req: Request) {
  if (!isCronAuthorised(req)) {
    return new Response('Unauthorized', { status: 401 });
  }
  await lucia.deleteExpiredSessions();
  return new Response(null, { status: 204 });
}
