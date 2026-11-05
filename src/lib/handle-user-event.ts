'use client';

import { countPendingInboxMutations } from '@/components/hooks/query-hooks/use-club-inbox';
import { useTRPC } from '@/components/trpc/client';
import type { UserEventModel } from '@/server/zod/events';
import { QueryClient } from '@tanstack/react-query';

export const handleUserEvent = (
  event: UserEventModel,
  queryClient: QueryClient,
  trpc: ReturnType<typeof useTRPC>,
) => {
  switch (event.event) {
    case 'user-notification':
      queryClient.setQueryData(
        trpc.auth.notifications.counter.queryKey(),
        (cache) => cache && cache + 1,
      );
      queryClient.invalidateQueries({
        queryKey: trpc.auth.notifications.pathKey(),
      });
      break;
    case 'club-notification':
      queryClient.invalidateQueries({
        queryKey: trpc.club.inbox.counter.queryKey({
          clubId: event.clubId,
        }),
      });
      if (!countPendingInboxMutations(queryClient, trpc))
        queryClient.invalidateQueries({
          queryKey: trpc.club.inbox.all.infiniteQueryKey({
            clubId: event.clubId,
          }),
        });
      break;
  }
};
