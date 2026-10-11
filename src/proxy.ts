import {
  DEFAULT_LOCALE,
  isLocalizedPath,
  keepsPrefixedUrl,
  LOCALE_COOKIE,
  readVisitor,
  resolveLocale,
  splitLocalePrefix,
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
    return routeLocale(request, isRead);
  }

  const headers = new Headers({ 'Cache-Control': 'no-store' });
  if (active.endsAt !== null) {
    const seconds = (active.endsAt - now) / 1000;
    headers.set('Retry-After', String(Math.ceil(seconds)));
  }

  if (!isRead || pathname === '/api' || pathname.startsWith('/api/')) {
    return Response.json({ error: 'MAINTENANCE' }, { status: 503, headers });
  }

  const locale =
    splitLocalePrefix(pathname).locale ??
    resolveLocale(readVisitor(request.headers, request.cookies));
  const url = new URL(`/${locale}/maintenance`, request.url);
  if (active.endsAt !== null) {
    url.searchParams.set('endsAt', new Date(active.endsAt).toISOString());
  }
  return NextResponse.rewrite(url, { status: 503, headers });
}

function routeLocale(request: NextRequest, isRead: boolean) {
  const { pathname, search } = request.nextUrl;
  if (isUnlocalized(pathname)) return NextResponse.next();

  const visitor = readVisitor(request.headers, request.cookies);
  const prefixed = splitLocalePrefix(pathname);
  if (!prefixed.locale) {
    const locale = resolveLocale(visitor);
    const internal = `/${locale}${pathname === '/' ? '' : pathname}`;
    return NextResponse.rewrite(new URL(`${internal}${search}`, request.url));
  }

  if (!isRead) return NextResponse.next();

  const unprefixed = new URL(`${prefixed.pathname}${search}`, request.url);
  if (prefixed.locale === DEFAULT_LOCALE) {
    return NextResponse.redirect(unprefixed, 308);
  }
  if (
    !isLocalizedPath(prefixed.pathname) ||
    !keepsPrefixedUrl(visitor, prefixed.locale)
  ) {
    return NextResponse.redirect(unprefixed);
  }

  const response = NextResponse.next();
  if (!visitor.isCrawler && !visitor.savedLocale) {
    // keeps the language on unprefixed links for the rest of the visit. no
    // max-age, unlike the switcher's one-year cookie: one search result
    // shouldn't become a lasting choice
    response.cookies.set(LOCALE_COOKIE, prefixed.locale, {
      path: '/',
      sameSite: 'lax',
    });
  }
  return response;
}

const isUnlocalized = (pathname: string) =>
  pathname.startsWith('/_') ||
  UNLOCALIZED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

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
