import {
  getDatabaseAuthToken,
  getDatabaseUrl,
} from '@/lib/config/non-next-urls';
import { Config, defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/server/db/schema/index.ts',
  out: './src/server/db/migrations',
  dialect: 'turso',
  dbCredentials: {
    url: getDatabaseUrl(),
    authToken: getDatabaseAuthToken(),
  },
} satisfies Config);
