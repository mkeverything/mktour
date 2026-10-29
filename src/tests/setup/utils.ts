import { appRouter } from '@/server/api';
import { createTRPCContext } from '@/server/api/trpc';

import type { User } from 'lucia';
import { NextRequest } from 'next/server';

export const createAuthenticatedCaller = async (user: User) => {
  const ctx = await createTRPCContext({
    headers: new Headers(),
    req: new NextRequest('http://localhost:3000'),
  });

  ctx.user = user;
  ctx.session = {
    id: `test-session-${user.id}`,
    userId: user.id,
    expiresAt: new Date(Date.now() + 86400000), // tomorrow
    fresh: false,
  };

  return appRouter.createCaller(ctx);
};
