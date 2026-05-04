import { NextResponse } from 'next/server';

const OAUTH_COOKIE_NAMES = [
  'auth_from',
  'lichess_oauth_state',
  'lichess_oauth_code_validation',
] as const;

export function createOauthRedirectResponse(
  location: string | URL,
  requestUrl?: string,
): NextResponse {
  const destination =
    typeof location === 'string' ? new URL(location, requestUrl) : location;
  const response = NextResponse.redirect(destination, {
    status: 302,
  });

  OAUTH_COOKIE_NAMES.forEach((name) => response.cookies.delete(name));

  return response;
}
