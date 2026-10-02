import { get } from '@vercel/global-config';
import { NextRequest, NextResponse, type ProxyConfig } from 'next/server';

type Maintenance = {
  enabled?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
};

const OPERATIONAL_PATHS = new Set([
  '/api/db/migrate',
  '/api/auth/delete-expired-sessions',
]);

const CONFIG_TIMEOUT_MS = 500;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isRead = request.method === 'GET' || request.method === 'HEAD';
  if (OPERATIONAL_PATHS.has(pathname)) return NextResponse.next();

  const now = Date.now();
  const active = getActiveMaintenance(await getMaintenance(), now);
  if (!active) {
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

async function getMaintenance() {
  if (!(process.env.GLOBAL_CONFIG ?? process.env.EDGE_CONFIG)) return;

  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      get<Maintenance>('maintenance'),
      new Promise<undefined>((resolve) => {
        timeout = setTimeout(() => {
          console.error('maintenance config read timed out');
          resolve(undefined);
        }, CONFIG_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    console.error('failed to read maintenance config:', error);
  } finally {
    clearTimeout(timeout);
  }
}

function getActiveMaintenance(
  maintenance: Maintenance | undefined,
  now: number,
) {
  if (maintenance?.enabled !== true) return;

  const startsAt = parseTime(maintenance.startsAt);
  const endsAt = parseTime(maintenance.endsAt);
  if (Number.isNaN(startsAt) || Number.isNaN(endsAt)) return;
  if (startsAt !== null && now < startsAt) return;
  if (endsAt !== null && now >= endsAt) return;

  return { endsAt };
}

function parseTime(value: unknown) {
  if (value === null || value === undefined) return null;
  return typeof value === 'string' ? Date.parse(value) : NaN;
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
