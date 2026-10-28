'use client';

import { useAuth } from '@/components/hooks/query-hooks/use-user';
import { useTRPC } from '@/components/trpc/client';
import { handleUserEvent } from '@/lib/handle-user-event';
import { skipToken, useQueryClient } from '@tanstack/react-query';
import { useSubscription } from '@trpc/tanstack-react-query';

export default function UserEvents() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: user } = useAuth();

  useSubscription(
    trpc.auth.events.subscriptionOptions(user ? undefined : skipToken, {
      onData: (event) => handleUserEvent(event, queryClient, trpc),
    }),
  );

  return null;
}
