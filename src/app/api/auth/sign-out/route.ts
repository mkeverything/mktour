import { CACHE_TAGS } from '@/lib/cache-tags';
import { logout } from '@/server/mutations/logout';
import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

export const POST = async (request: Request) => {
  await logout();
  revalidateTag(CACHE_TAGS.AUTH, 'max');
  return NextResponse.redirect(new URL('/sign-in', request.url));
};
