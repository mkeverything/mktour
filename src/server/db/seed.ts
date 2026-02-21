import { sqlite } from '@/server/db/index';
import * as schema from '@/server/db/schema';
import { and, eq, notInArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { reset, seed } from 'drizzle-seed';

import { verifyTestDatabase } from '@/lib/config/urls';

export const seedComprehensiveTestData = async () => {
  if (verifyTestDatabase()) {
    const db = drizzle(sqlite);

    await reset(db, schema);

    await seed(
      db,
      {
        users: schema.users,
        clubs: schema.clubs,
        clubsToUsers: schema.clubs_to_users,
        players: schema.players,
      },
      { seed: 12345 },
    ).refine((f) => ({
      users: {
        count: 20,
        columns: {
          name: f.fullName(),
          email: f.email(),
          username: f.firstName(),
          rating: f.int({ minValue: 1200, maxValue: 2800 }),
          createdAt: f.timestamp(),
        },
        with: {
          clubsToUsers: 2,
        },
      },
      clubs: {
        count: 6,
        columns: {
          name: f.companyName(),
          description: f.loremIpsum({ sentencesCount: 2 }),
          lichessTeam: f.string(),
          createdAt: f.timestamp(),
        },
        with: {
          players: [
            { weight: 0.6, count: [4, 5, 8] },
            { weight: 0.4, count: [12, 16, 24] },
          ],
        },
      },
      clubsToUsers: {
        columns: {
          status: f.valuesFromArray({ values: ['admin', 'co-owner'] }),
        },
      },
      players: {
        columns: {
          nickname: f.firstName(),
          realname: f.fullName(),
          userId: f.weightedRandom([
            {
              weight: 0.99, // 95% of rows
              value: f.default({ defaultValue: null }), // or your default value
            },
            {
              weight: 0.01, // 5% of rows (1 in 20)
              value: f.string(),
            },
          ]),
          rating: f.int({ minValue: 1200, maxValue: 2800 }),
          ratingDeviation: f.int({ minValue: 50, maxValue: 300 }),
          ratingVolatility: f.number({
            minValue: 0.05,
            maxValue: 0.07,
            precision: 100,
          }),
          createdAt: f.timestamp(),
        },
      },
    }));

    const clubUserRelations = await db.select().from(schema.clubs_to_users);

    for (const relation of clubUserRelations) {
      await db
        .update(schema.users)
        .set({ selectedClub: relation.clubId })
        .where(eq(schema.users.id, relation.userId));
    }

    const users = await db.select().from(schema.users).limit(5);
    const players = await db.select().from(schema.players).limit(10);

    // link first 3 players to first user
    if (users[0] && players[0]) {
      await db
        .update(schema.players)
        .set({ userId: users[0].id })
        .where(eq(schema.players.id, players[0].id));
    }
    if (users[0] && players[1]) {
      await db
        .update(schema.players)
        .set({ userId: users[0].id })
        .where(eq(schema.players.id, players[1].id));
    }
    if (users[0] && players[2]) {
      await db
        .update(schema.players)
        .set({ userId: users[0].id })
        .where(eq(schema.players.id, players[2].id));
    }

    // link one player to second user
    if (users[1] && players[3]) {
      await db
        .update(schema.players)
        .set({ userId: users[1].id })
        .where(eq(schema.players.id, players[3].id));
    }

    const usersWithValidSelectedClub = db
      .select({ id: schema.users.id })
      .from(schema.users)
      .innerJoin(
        schema.clubs_to_users,
        and(
          eq(schema.users.id, schema.clubs_to_users.userId),
          eq(schema.users.selectedClub, schema.clubs_to_users.clubId),
        ),
      );

    await db
      .delete(schema.clubs_to_users)
      .where(
        notInArray(schema.clubs_to_users.userId, usersWithValidSelectedClub),
      );

    await db
      .delete(schema.users)
      .where(notInArray(schema.users.id, usersWithValidSelectedClub));
  }
};
