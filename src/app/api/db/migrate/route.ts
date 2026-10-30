import { isCronAuthorised } from '@/lib/auth/cron';
import { getDatabaseUrl } from '@/lib/config/non-next-urls';
import { Logger } from 'drizzle-orm/logger';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
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
  if (!isCronAuthorised(req)) {
    return Response.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  }

  const logger = new QueryLogger();
  const db = drizzle({ connection: getDatabaseUrl(), logger });

  try {
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
        error: 'DATABASE_MIGRATION_ERROR',
        queriesExecuted: logger.queries.length,
        queries: logger.queries,
      },
      { status: 500 },
    );
  } finally {
    await db.$client.end();
  }
}
