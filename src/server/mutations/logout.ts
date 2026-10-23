import 'server-only';

import { lucia, validateRequest } from '@/lib/auth/lucia';
import { cookies } from 'next/headers';

export async function logout(): Promise<{ error: string | null }> {
  const { session } = await validateRequest();
  if (!session) {
    return {
      error: 'Unauthorized',
    };
  }

  await lucia.invalidateSession(session.id);

  const sessionCookie = lucia.createBlankSessionCookie();
  (await cookies()).set(
    sessionCookie.name,
    sessionCookie.value,
    sessionCookie.attributes,
  );
  return {
    error: null,
  };
}
