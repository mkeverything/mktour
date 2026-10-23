import { COOKIES } from '@/lib/config/constants';
import {
  DEFAULT_LOCALE,
  isLocalizedPath,
  isUnder,
  readVisitor,
  resolveLocale,
  splitLocalePrefix,
  toInternalPath,
} from '@/lib/locales';
import { getMaintenance } from '@/lib/maintenance';
import { NextRequest, NextResponse, type ProxyConfig } from 'next/server';

const OPERATIONAL_PATHS = new Set([
  '/api/db/migrate',
  '/api/auth/delete-expired-sessions',
]);

// route handlers that live outside app/[locale]
const UNLOCALIZED_PATHS = ['/api', '/login', '/for-llms'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (OPERATIONAL_PATHS.has(pathname)) return NextResponse.next();

  const maintenance = await getMaintenance();
  const now = Date.now();
  const isMaintenanceActive =
    maintenance !== undefined &&
    (maintenance.startsAt ?? -Infinity) <= now &&
    now < (maintenance.endsAt ?? Infinity);
  if (isMaintenanceActive) return serveMaintenance(request, maintenance.endsAt);

  if (isRead(request) && pathname === '/maintenance') {
    return NextResponse.redirect(new URL('/', request.url), {
      headers: { 'Cache-Control': 'no-store' },
    });
  }
  return routeLocale(request);
}

function serveMaintenance(request: NextRequest, endsAt: number | null) {
  const { pathname } = request.nextUrl;
  const headers = new Headers({ 'Cache-Control': 'no-store' });
  if (endsAt !== null) {
    const seconds = (endsAt - Date.now()) / 1000;
    headers.set('Retry-After', String(Math.ceil(seconds)));
  }

  if (!isRead(request) || isUnder(pathname, '/api')) {
    return Response.json({ error: 'MAINTENANCE' }, { status: 503, headers });
  }

  const locale =
    splitLocalePrefix(pathname).locale ??
    resolveLocale(readVisitor(request.headers, request.cookies));
  const url = new URL(toInternalPath('/maintenance', locale), request.url);
  if (endsAt !== null) {
    url.searchParams.set('endsAt', new Date(endsAt).toISOString());
  }
  return NextResponse.rewrite(url, { status: 503, headers });
}

function routeLocale(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isUnlocalized(pathname)) return NextResponse.next();

  const visitor = readVisitor(request.headers, request.cookies);
  const prefixed = splitLocalePrefix(pathname);
  if (!prefixed.locale) {
    const internal = toInternalPath(pathname, resolveLocale(visitor));
    return NextResponse.rewrite(new URL(`${internal}${search}`, request.url));
  }

  if (!isRead(request)) return NextResponse.next();

  const unprefixed = new URL(`${prefixed.pathname}${search}`, request.url);
  if (prefixed.locale === DEFAULT_LOCALE) {
    return NextResponse.redirect(unprefixed, 308);
  }
  // a saved language wins over the url, and the unprefixed url renders it
  if (!isLocalizedPath(prefixed.pathname) || visitor.savedLocale) {
    return NextResponse.redirect(unprefixed);
  }

  const response = NextResponse.next();
  if (!visitor.isCrawler) {
    // keeps the language on unprefixed links for the rest of the visit. no
    // max-age, unlike the switcher's one-year cookie: one search result
    // shouldn't become a lasting choice
    response.cookies.set(COOKIES.LOCALE, prefixed.locale, {
      path: '/',
      sameSite: 'lax',
    });
  }
  return response;
}

const isRead = (request: NextRequest) =>
  request.method === 'GET' || request.method === 'HEAD';

const isUnlocalized = (pathname: string) =>
  pathname.startsWith('/_') ||
  UNLOCALIZED_PATHS.some((path) => isUnder(pathname, path));

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
