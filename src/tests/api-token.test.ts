import { appRouter } from '@/server/api/index';
import { createTRPCContext } from '@/server/api/trpc';
import { fixtures } from '@/server/db/seed';
import { describe, expect, it } from 'bun:test';
import { NextRequest } from 'next/server';

describe('API Token Auth', () => {
  const userId = fixtures.users.next().value!.id;
  let token: string;
  let tokenId: string;

  it('should generate a token', async () => {
    const ctx = await createTRPCContext({
      headers: new Headers(),
      req: new NextRequest('http://localhost:3000'),
    });

    ctx.user = {
      id: userId,
      name: 'Test User',
      email: 'test@example.com',
      username: 'testuser',
      rating: 1500,
      createdAt: new Date(),
      selectedClub: '',
    };

    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.apiToken.generate({ name: 'Test Token' });

    expect(result.token).toBeDefined();
    expect(result.token.startsWith('mktour_')).toBe(true);
    token = result.token;
    tokenId = token.split('_')[1];
  });

  it('should authenticate with the token', async () => {
    if (!token) return;

    const headers = new Headers();
    headers.set('Authorization', `Bearer ${token}`);

    const ctx = await createTRPCContext({
      headers,
      req: new NextRequest('http://localhost:3000'),
    });

    expect(ctx.user).toBeDefined();
    expect(ctx.user?.id).toBe(userId);
  });

  it('should list tokens', async () => {
    const headers = new Headers();
    headers.set('Authorization', `Bearer ${token}`);
    const ctx = await createTRPCContext({
      headers,
      req: new NextRequest('http://localhost:3000'),
    });

    const caller = appRouter.createCaller(ctx);
    const tokens = await caller.auth.apiToken.list();

    expect(tokens.length).toBeGreaterThan(0);
    const foundToken = tokens.find((t) => t.id === tokenId);
    expect(foundToken).toBeDefined();
  });

  it('should revoke the token', async () => {
    const headers = new Headers();
    headers.set('Authorization', `Bearer ${token}`);
    const ctx = await createTRPCContext({
      headers,
      req: new NextRequest('http://localhost:3000'),
    });

    const caller = appRouter.createCaller(ctx);
    await caller.auth.apiToken.revoke({ id: tokenId });

    const tokens = await caller.auth.apiToken.list();
    expect(tokens.find((t) => t.id === tokenId)).toBeUndefined();
  });

  it('should fail authentication after revocation', async () => {
    if (!token) return;

    const headers = new Headers();
    headers.set('Authorization', `Bearer ${token}`);

    const ctx = await createTRPCContext({
      headers,
      req: new NextRequest('http://localhost:3000'),
    });

    expect(ctx.user).toBeNull();
  });
});
