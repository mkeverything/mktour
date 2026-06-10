'use client';
// ws-handler global-ws

import { useTRPC } from '@/components/trpc/client';
import { GlobalMessage } from '@/types/notifications';
import { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export const handleGlobalSocketMessage = (
  message: GlobalMessage,
  queryClient: QueryClient,
  trpc: ReturnType<typeof useTRPC>,
  errorMessage: string,
) => {
  switch (message.type) {
    case 'user':
      queryClient.setQueryData(
        trpc.auth.notifications.counter.queryKey(),
        (cache) => cache && cache + 1,
      );
      queryClient.invalidateQueries({
        queryKey: trpc.auth.notifications.pathKey(),
      });
      break;
    case 'error':
      toast.error(errorMessage, { id: 'wsErrorMessage' });
    default:
      break;
  }
};
