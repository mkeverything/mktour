import { getMaintenance } from '@/lib/maintenance';
import { NextRequest, NextResponse, type ProxyConfig } from 'next/server';

const OPERATIONAL_PATHS = new Set([
  '/api/db/migrate',
  '/api/auth/delete-expired-sessions',
]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isRead = request.method === 'GET' || request.method === 'HEAD';
  if (OPERATIONAL_PATHS.has(pathname)) return NextResponse.next();

  const now = Date.now();
  const active = await getMaintenance();
  if (
    !active ||
    (active.startsAt !== null && now < active.startsAt) ||
    (active.endsAt !== null && now >= active.endsAt)
  ) {
    if (isRead && pathname === '/maintenance') {
      return NextResponse.redirect(new URL('/', request.url), {
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    return NextResponse.next();
  }

  const headers = new Headers({ 'Cache-Control': 'no-store' });
  if (active.endsAt !== null) {
    const seconds = (active.endsAt - now) / 1000;
    headers.set('Retry-After', String(Math.ceil(seconds)));
  }

  if (!isRead || pathname === '/api' || pathname.startsWith('/api/')) {
    return Response.json({ error: 'MAINTENANCE' }, { status: 503, headers });
  }

  const url = new URL('/maintenance', request.url);
  if (active.endsAt !== null) {
    url.searchParams.set('endsAt', new Date(active.endsAt).toISOString());
  }
  return NextResponse.rewrite(url, { status: 503, headers });
}

export const config: ProxyConfig = {
  matcher: [
    // trpc paths contain dots, so api is matched separately from the static file exclusion
    '/api/:path*',
    // server actions can target any url, including file-like dynamic paths
    { source: '/:path*', has: [{ type: 'header', key: 'next-action' }] },
    { source: '/:path*', has: [{ type: 'header', key: 'content-type' }] },
    '/((?!api/|_next/static|_next/image|.*\\.\\w+$).*)',
  ],
};
