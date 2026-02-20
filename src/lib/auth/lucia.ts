import { CACHE_TAGS } from '@/lib/cache-tags';
import { BASE_URL } from '@/lib/config/urls';
import { adapter } from '@/server/db/lucia-adapter';

import { UserModel } from '@/server/db/zod/users';
import { Lichess } from 'arctic';
import type { Session, User } from 'lucia';
import { Lucia } from 'lucia';
import { cacheLife, cacheTag } from 'next/cache';
import { cookies } from 'next/headers';
import { cache } from 'react';

export const lucia = new Lucia(adapter, {
  sessionCookie: {
    attributes: {
      secure: process.env.NODE_ENV === 'production',
    },
  },
  getUserAttributes: (attributes: Omit<UserModel, 'id'>) => {
    return {
      username: attributes.username,
      name: attributes.name,
      email: attributes.email,
      rating: attributes.rating,
      selectedClub: attributes.selectedClub,
      createdAt: attributes.createdAt,
    };
  },
});

declare module 'lucia' {
  export interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: Omit<UserModel, 'id'>;
  }
}

export const uncachedValidateRequest = async (): Promise<
  { user: User; session: Session } | { user: null; session: null }
> => {
  const cooks = await cookies();
  const sessionId = cooks.get(lucia.sessionCookieName)?.value ?? null;
  if (!sessionId) {
    return {
      user: null,
      session: null,
    };
  }

  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('session validation timeout')), 4000),
    );

    const result = await Promise.race([
      lucia.validateSession(sessionId),
      timeoutPromise,
    ]);

    // next.js throws when you attempt to set cookie when rendering page
    try {
      if (result.session && result.session.fresh) {
        const sessionCookie = lucia.createSessionCookie(result.session.id);
        cooks.set(
          sessionCookie.name,
          sessionCookie.value,
          sessionCookie.attributes,
        );
      }
      if (!result.session) {
        const sessionCookie = lucia.createBlankSessionCookie();
        cooks.set(
          sessionCookie.name,
          sessionCookie.value,
          sessionCookie.attributes,
        );
      }
    } catch {}
    return result;
  } catch (e) {
    console.error('session validation failed:', e);
    return {
      user: null,
      session: null,
    };
  }
};

export const reactCachedValidateRequest = cache(uncachedValidateRequest);

export const validateRequest = cache(async () => {
  const cooks = await cookies();
  const sessionId = cooks.get(lucia.sessionCookieName)?.value ?? null;
  if (!sessionId) {
    return {
      user: null,
      session: null,
    };
  }

  try {
    // timeout prevents hanging on Vercel
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Cached session validation timeout')),
        4000,
      ),
    );

    const result = await Promise.race([
      cachedValidateSession(sessionId),
      timeoutPromise,
    ]);

    // next.js throws when you attempt to set cookie when rendering page
    try {
      if (result.session && result.session.fresh) {
        const sessionCookie = lucia.createSessionCookie(result.session.id);
        cooks.set(
          sessionCookie.name,
          sessionCookie.value,
          sessionCookie.attributes,
        );
      }
      if (!result.session) {
        const sessionCookie = lucia.createBlankSessionCookie();
        cooks.set(
          sessionCookie.name,
          sessionCookie.value,
          sessionCookie.attributes,
        );
      }
    } catch {}
    return result;
  } catch (e) {
    console.error('Cached session validation failed:', e);
    return {
      user: null,
      session: null,
    };
  }
});

const cachedValidateSession = async (sessionId: string) => {
  'use cache';
  cacheLife({
    stale: 1000 * 60 * 60,
    revalidate: 1000 * 60 * 60,
  });
  cacheTag(CACHE_TAGS.AUTH);
  return await lucia.validateSession(sessionId);
};

export const lichess = new Lichess(
  process.env.LICHESS_CLIENT_ID ?? '',
  `${BASE_URL}/login/lichess/callback`,
);
