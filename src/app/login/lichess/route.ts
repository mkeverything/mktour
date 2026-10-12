import 'server-only';

import { lichess } from '@/lib/auth/lucia';
import { COOKIES } from '@/lib/config/constants';
import { generateCodeVerifier, generateState } from 'arctic';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest): Promise<Response> {
  const from = request.nextUrl.searchParams.get('from');
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const url = lichess.createAuthorizationURL(state, codeVerifier, [
    'email:read',
    'team:read',
    'team:write',
  ]);

  const cooks = await cookies();

  cooks.getAll().forEach((cookie) => {
    if (cookie.name !== COOKIES.LOCALE) cooks.delete(cookie.name);
  });

  if (from) {
    cooks.set(COOKIES.AUTH_FROM, from, {
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
  }

  cooks.set(COOKIES.OAUTH_STATE, state, {
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
  });
  cooks.set(COOKIES.OAUTH_CODE_VERIFIER, codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    sameSite: 'lax',
  });

  return Response.redirect(url);
}
