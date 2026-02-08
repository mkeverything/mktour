/* eslint-disable @typescript-eslint/no-explicit-any */

import { verifyTestDatabase } from '@/lib/config/urls';
import { appRouter } from '@/server/api';
import { createTRPCContext } from '@/server/api/trpc';
import { db } from '@/server/db';
import * as schema from '@/server/db/schema';
import { eq } from 'drizzle-orm';

import type { User } from 'lucia';
import { NextRequest } from 'next/server';

export const cleanupTestDb = async () => {
  verifyTestDatabase();

  // cleaning all tables in correct order to handle foreign key constraints
  await db.delete(schema.user_notifications);
  await db.delete(schema.club_notifications);
  await db.delete(schema.apiTokens);
  await db.delete(schema.sessions);
  await db.delete(schema.user_preferences);
  await db.delete(schema.games);
  await db.delete(schema.players_to_tournaments);
  await db.delete(schema.affiliations);
  await db.delete(schema.players);
  await db.delete(schema.tournaments);
  await db.delete(schema.clubs_to_users);
  await db.delete(schema.users);
  await db.delete(schema.clubs);
};

export const getSeededTestData = async () => {
  const users = await db.select().from(schema.users).limit(5);
  const clubs = await db.select().from(schema.clubs).limit(3);
  const tournaments = await db.select().from(schema.tournaments).limit(3);
  const players = await db.select().from(schema.players).limit(10);

  return {
    users,
    clubs,
    tournaments,
    players,
    firstUser: users[0],
    firstClub: clubs[0],
    firstTournament: tournaments[0],
    firstPlayer: players[0],
  };
};

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

export const createUnauthenticatedCaller = async () => {
  const ctx = await createTRPCContext({
    headers: new Headers(),
    req: new NextRequest('http://localhost:3000'),
  });

  return appRouter.createCaller(ctx);
};

export const createExpiredSessionCaller = async (user: User) => {
  const ctx = await createTRPCContext({
    headers: new Headers(),
    req: new NextRequest('http://localhost:3000'),
  });

  ctx.user = user;
  ctx.session = {
    id: `expired-session-${user.id}`,
    userId: user.id,
    expiresAt: new Date(Date.now() - 86400000), // expired
    fresh: false,
  };

  return appRouter.createCaller(ctx);
};

export const isValidPublicUserSchema = (user: any): boolean => {
  const requiredFields = [
    'id',
    'username',
    'name',
    'rating',
    'selectedClub',
    'createdAt',
  ];
  const forbiddenFields = ['email'];

  return (
    requiredFields.every((field) => field in user) &&
    forbiddenFields.every((field) => !(field in user))
  );
};

export const isValidMinimalUserSchema = (user: any): boolean => {
  const requiredFields = ['id', 'username', 'name'];
  const forbiddenFields = ['email', 'rating', 'selectedClub', 'createdAt'];

  return (
    requiredFields.every((field) => field in user) &&
    forbiddenFields.every((field) => !(field in user))
  );
};

export const isValidClubSchema = (club: any): boolean => {
  const requiredFields = ['id', 'name'];
  const forbiddenFields = ['description', 'lichessTeam', 'createdAt'];

  return (
    requiredFields.every((field) => field in club) &&
    forbiddenFields.every((field) => !(field in club))
  );
};

export const findUserWithClubs = async () => {
  const testData = await getSeededTestData();

  for (const user of testData.users) {
    const userClubs = await db
      .select()
      .from(schema.clubs_to_users)
      .where(eq(schema.clubs_to_users.userId, user.id));

    if (userClubs.length > 0) {
      return user;
    }
  }

  return testData.firstUser;
};

export const findUserWithoutClubs = async () => {
  const testData = await getSeededTestData();

  for (const user of testData.users) {
    const userClubs = await db
      .select()
      .from(schema.clubs_to_users)
      .where(eq(schema.clubs_to_users.userId, user.id));

    if (userClubs.length === 0) {
      return user;
    }
  }

  // if all users have clubs, return the last user (least likely to have many)
  return testData.users[testData.users.length - 1];
};
