import { validateRequest } from '@/lib/auth/lucia';
import { authRouter } from '@/server/api/routers/auth';
import { clubRouter } from '@/server/api/routers/club';
import { playerRouter } from '@/server/api/routers/player';
import { search, searchOpenApi } from '@/server/api/routers/search';
import { tournamentRouter } from '@/server/api/routers/tournament';
import { userRouter } from '@/server/api/routers/user';
import { createTRPCRouter } from '@/server/api/trpc';
import { db } from '@/server/db';
import { getUserClubIds } from '@/server/queries/get-user-clubs';

export const appRouter = createTRPCRouter({
  user: userRouter,
  tournament: tournamentRouter,
  club: clubRouter,
  player: playerRouter,
  auth: authRouter,
  search,
  searchOpenApi,
});

export const publicCaller = appRouter.createCaller({
  session: null,
  user: null,
  clubs: null,
  db,
  headers: new Headers(),
});

export const makeProtectedCaller = async () => {
  const { session, user } = await validateRequest();
  const clubs = user ? await getUserClubIds({ userId: user.id }) : {};
  return appRouter.createCaller({
    session,
    user,
    clubs,
    db,
    headers: new Headers(),
  });
};

export type AppRouter = typeof appRouter;
