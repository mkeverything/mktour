import { db } from '@/server/db';
import { sessions, users } from '@/server/db/schema/users';
import { eq, getColumns, lte } from 'drizzle-orm';
import type { Adapter, DatabaseSession, DatabaseUser } from 'lucia';

const toDatabaseSession = (
  session: typeof sessions.$inferSelect,
): DatabaseSession => {
  const { id, userId, expiresAt, ...attributes } = session;
  return {
    id,
    userId,
    expiresAt: new Date(expiresAt * 1000),
    attributes,
  };
};

export const adapter: Adapter = {
  async deleteSession(sessionId) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
  },
  async deleteUserSessions(userId) {
    await db.delete(sessions).where(eq(sessions.userId, userId));
  },
  async getSessionAndUser(sessionId) {
    const [sessionRows, userRows] = await Promise.all([
      db.select().from(sessions).where(eq(sessions.id, sessionId)),
      db
        .select(getColumns(users))
        .from(sessions)
        .innerJoin(users, eq(sessions.userId, users.id))
        .where(eq(sessions.id, sessionId)),
    ]);

    const session = sessionRows[0] ? toDatabaseSession(sessionRows[0]) : null;
    const userRow = userRows[0];
    const user: DatabaseUser | null = userRow
      ? (({ id, ...attributes }) => ({ id, attributes }))(userRow)
      : null;

    return [session, user];
  },
  async getUserSessions(userId) {
    const rows = await db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, userId));
    return rows.map(toDatabaseSession);
  },
  async setSession(session) {
    await db.insert(sessions).values({
      id: session.id,
      userId: session.userId,
      expiresAt: Math.floor(session.expiresAt.getTime() / 1000),
      ...session.attributes,
    });
  },
  async updateSessionExpiration(sessionId, expiresAt) {
    await db
      .update(sessions)
      .set({ expiresAt: Math.floor(expiresAt.getTime() / 1000) })
      .where(eq(sessions.id, sessionId));
  },
  async deleteExpiredSessions() {
    await db
      .delete(sessions)
      .where(lte(sessions.expiresAt, Math.floor(Date.now() / 1000)));
  },
};
