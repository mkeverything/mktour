import 'server-only';

import { db } from '@/server/db';
import { clubs_to_users } from '@/server/db/schema/clubs';
import type { TournamentEventModel, UserEventModel } from '@/server/zod/events';
import { eq } from 'drizzle-orm';
import { EventEmitter, on } from 'node:events';

type Topics = {
  [topic: `tournament:${string}`]: [TournamentEventModel];
  [topic: `user:${string}`]: [UserEventModel];
};

// one bus per process: next can evaluate this module more than once (dev reloads,
// separate route bundles), and every copy has to reach the same listeners
declare global {
  var eventBus: EventEmitter<Topics> | undefined;
}

const bus = (globalThis.eventBus ??= new EventEmitter<Topics>().setMaxListeners(
  0,
));

export const publishTournamentEvent = (
  tournamentId: string,
  event: TournamentEventModel,
) => {
  bus.emit(`tournament:${tournamentId}`, event);
};

export const publishUserNotification = (userId: string) => {
  bus.emit(`user:${userId}`, { event: 'user-notification' });
};

// best effort like every publish: a failed lookup must not fail the mutation
// whose writes already committed
export const publishClubNotification = (clubId: string) => {
  db.select({ userId: clubs_to_users.userId })
    .from(clubs_to_users)
    .where(eq(clubs_to_users.clubId, clubId))
    .then((managers) => {
      for (const { userId } of managers) {
        bus.emit(`user:${userId}`, { event: 'club-notification', clubId });
      }
    })
    .catch((error) => console.error('club notification not published', error));
};

export async function* listen<T extends keyof Topics>(
  topic: T,
  signal: AbortSignal | undefined,
): AsyncGenerator<Topics[T][0]> {
  for await (const [event] of on(bus, topic, { signal })) yield event;
}
