import { createHash, timingSafeEqual } from 'node:crypto';

export function isCronAuthorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('cron authentication rejected: CRON_SECRET is missing');
    return false;
  }

  const expected = createHash('sha256').update(`Bearer ${secret}`).digest();
  const actual = createHash('sha256')
    .update(req.headers.get('Authorization') ?? '')
    .digest();

  return timingSafeEqual(actual, expected);
}
