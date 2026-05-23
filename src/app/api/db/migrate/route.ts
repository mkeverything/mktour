import { getDatabaseAuthToken, getDatabaseUrl } from '@/lib/config/urls';
import { ERRORS } from '@/lib/errors';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { Logger } from 'drizzle-orm/logger';
import path from 'path';

class QueryLogger implements Logger {
  queries: string[] = [];

  logQuery(query: string, params: unknown[]): void {
    const formatted = params.length
      ? `${query} -- params: ${JSON.stringify(params)}`
      : query;
    this.queries.push(formatted);
  }
}

export async function POST(req: Request) {
  if (
    req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return Response.json({ error: ERRORS.UNAUTHENTICATED }, { status: 401 });
  }

  const url = getDatabaseUrl();
  const authToken = getDatabaseAuthToken();

  if (!url) {
    return Response.json({ error: ERRORS.CONFIG_ERROR }, { status: 500 });
  }

  const logger = new QueryLogger();

  try {
    const client = createClient({ url, authToken });
    const db = drizzle(client, { logger });

    console.log('running migrations...');
    const start = Date.now();
    const migrationsFolder = path.join(
      process.cwd(),
      'src/server/db/migrations',
    );

    await migrate(db, { migrationsFolder });

    const duration = Date.now() - start;
    console.log('migrations completed in', duration, 'ms');

    return Response.json({
      success: true,
      duration,
      queriesExecuted: logger.queries.length,
      queries: logger.queries,
    });
  } catch (error) {
    console.error('migration failed:', error);
    return Response.json(
      {
        error: ERRORS.DATABASE_MIGRATION_ERROR,
        queriesExecuted: logger.queries.length,
        queries: logger.queries,
      },
      { status: 500 },
    );
  }
}
