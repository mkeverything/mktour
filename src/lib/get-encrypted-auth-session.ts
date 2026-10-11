'use server';

import { COOKIES } from '@/lib/config/constants';
import { cookies } from 'next/headers';
import { encrypt } from './encrypt-decrypt';

export const getEncryptedAuthSession = async (): Promise<string | null> => {
  const session = (await cookies()).get(COOKIES.SESSION)?.value;
  if (!session) return null;
  return encrypt(session);
};
