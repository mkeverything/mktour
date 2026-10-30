import './env';

import { AppError } from '@/lib/errors';

export const getDatabaseUrl = () => {
  const variable =
    process.env.MKTOURTEST === 'true' || process.env.NODE_ENV === 'test'
      ? 'TEST_DATABASE_URL'
      : 'DATABASE_URL';
  const url = process.env[variable];
  if (!url) {
    throw new AppError('CONFIG_ERROR', { cause: `${variable} is not defined` });
  }
  return url;
};

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
