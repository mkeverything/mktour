import { AppError, ERRORS } from '@/lib/errors';
import meta from '@/server/api/meta';
import { createTRPCRouter, publicProcedure } from '@/server/api/trpc';
import { db } from '@/server/db';
import { users } from '@/server/db/schema/users';
import { getUserClubNames } from '@/server/queries/get-user-clubs';
import { getUserInfoByUsername } from '@/server/queries/get-user-data';
import { getUserLastTournaments } from '@/server/queries/get-user-last-tmts';
import { getUserPlayerClubs } from '@/server/queries/get-user-player-clubs';
import {
  clubsSelectSchema,
  clubsToUsersSelectSchema,
} from '@/server/zod/clubs';
import { userIdInputSchema } from '@/server/zod/common';
import { userPlayerClubSchema } from '@/server/zod/players';
import { tournamentSchema } from '@/server/zod/tournaments';
import { usersSelectPublicSchema, usersSelectSchema } from '@/server/zod/users';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

export const userRouter = createTRPCRouter({
  all: publicProcedure
    .meta(meta.usersAll)
    .output(
      z.array(usersSelectSchema.pick({ username: true, name: true, id: true })),
    )
    .query(async () => {
      const usersDb = await db.select().from(users);
      return usersDb;
    }),
  info: publicProcedure
    .meta(meta.usersInfo)
    .input(userIdInputSchema)
    .output(
      usersSelectSchema
        .pick({ username: true, name: true, rating: true })
        .optional(),
    )
    .query(async (opts) => {
      const { input } = opts;
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, input.userId));
      return user;
    }),
  infoByUsername: publicProcedure
    .meta(meta.usersInfoByUsername)
    .output(usersSelectPublicSchema)
    .input(z.object({ username: z.string() }))
    .query(async (opts) => {
      const { input } = opts;
      const user = await getUserInfoByUsername(input.username);
      if (!user) throw new AppError(ERRORS.USER_NOT_FOUND);
      return user;
    }),
  clubs: publicProcedure
    .meta(meta.userClubs)
    .output(
      z.array(
        clubsSelectSchema.pick({ id: true, name: true }).extend({
          status: clubsToUsersSelectSchema.shape.status,
          hasFinishedTournaments: z.boolean(),
        }),
      ),
    )
    .input(userIdInputSchema)
    .query(async (opts) => {
      const { input } = opts;
      const userClubs = await getUserClubNames(input);
      return userClubs;
    }),
  playerClubs: publicProcedure
    .meta(meta.userPlayerClubs)
    .output(z.array(userPlayerClubSchema))
    .input(userIdInputSchema)
    .query(async (opts) => {
      const { input } = opts;
      const playerClubs = await getUserPlayerClubs(input);
      return playerClubs;
    }),
  lastTournaments: publicProcedure
    .meta(meta.usersTournaments)
    .input(userIdInputSchema)
    .output(z.array(tournamentSchema))
    .query(async (opts) => {
      const { input } = opts;
      return await getUserLastTournaments(input.userId);
    }),
});
