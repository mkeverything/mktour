import { useIntlError } from '@/components/hooks/use-intl-error';
import { useTRPC } from '@/components/trpc/client';
import { SOCKET_URL } from '@/lib/config/urls';
import { ERRORS } from '@/lib/errors';
import { handleSocketMessage } from '@/lib/handle-dashboard-socket-message';

import { DashboardMessage } from '@/types/tournament-ws-events';
import { QueryClient } from '@tanstack/react-query';
import { Dispatch, SetStateAction } from 'react';
import useWebSocket from 'react-use-websocket';
import { toast } from 'sonner';

export const useDashboardWebsocket = (
  session: string | null,
  id: string,
  queryClient: QueryClient,
  setRoundInView: Dispatch<SetStateAction<number>>,
) => {
  const { translateCode } = useIntlError();
  const trpc = useTRPC();
  const protocols = session ? session : 'guest';
  return useWebSocket(`${SOCKET_URL}/tournament/${id}`, {
    protocols,
    onOpen: () => {
      setTimeout(() => toast.dismiss('wsError'));
    },
    shouldReconnect: () => true,
    heartbeat: {
      interval: 5000,
      message: '',
    },

    onMessage: (event: MessageEvent<string>) => {
      if (!event.data) return;
      const message: DashboardMessage = JSON.parse(event.data);
      handleSocketMessage(
        message,
        queryClient,
        id,
        translateCode(ERRORS.WEBSOCKET_MESSAGE_NOT_SENT),
        setRoundInView,
        trpc,
      );
    },
    onError: () => {
      setTimeout(() => toast.dismiss('wsSuccess'));
    },
    reconnectInterval: 3000,
    onReconnectStop: () => {
      setTimeout(() => toast.dismiss('wsError'));
      toast.error(translateCode(ERRORS.WEBSOCKET_FAILED), {
        id: 'wsError',
      });
    },
  });
};
