'use client';

import { useGlobalWebsocket } from '@/components/hooks/use-global-websocket';
import { useTRPC } from '@/components/trpc/client';
import { GlobalMessage } from '@/types/notifications';
import { useQuery } from '@tanstack/react-query';
import { createContext, ReactNode, useContext, useMemo } from 'react';

type GlobalWebSocketContextType = {
  sendJsonMessage: (message: GlobalMessage) => void;
  lastJsonMessage: GlobalMessage | null;
  readyState: number;
};

const DEFAULT_GLOBAL_WEBSOCKET_CONTEXT: GlobalWebSocketContextType = {
  sendJsonMessage: () => null,
  lastJsonMessage: null,
  readyState: -1,
};

const GlobalWebSocketContext = createContext<GlobalWebSocketContextType>(
  DEFAULT_GLOBAL_WEBSOCKET_CONTEXT,
);

export const useGlobalWebSocketContext = () =>
  useContext(GlobalWebSocketContext);

interface WebSocketProviderProps {
  children: ReactNode;
}

export const GlobalWebSocketProvider = ({
  children,
}: WebSocketProviderProps) => {
  const trpc = useTRPC();
  const { data: encryptedSession, isLoading } = useQuery({
    ...trpc.auth.encryptedSession.queryOptions(),
    enabled: typeof window !== 'undefined',
    staleTime: Infinity,
    retry: 3,
  });

  // While loading or no session, provide stub context without WebSocket
  if (isLoading || !encryptedSession) {
    return (
      <GlobalWebSocketContext.Provider value={DEFAULT_GLOBAL_WEBSOCKET_CONTEXT}>
        {children}
      </GlobalWebSocketContext.Provider>
    );
  }

  return (
    <WebsocketProvider encryptedSession={encryptedSession}>
      {children}
    </WebsocketProvider>
  );
};

const WebsocketProvider = ({
  children,
  encryptedSession,
}: {
  children: ReactNode;
  encryptedSession: string;
}) => {
  const { sendJsonMessage, lastJsonMessage, readyState } =
    useGlobalWebsocket(encryptedSession);
  const value = useMemo(
    () => ({ sendJsonMessage, lastJsonMessage, readyState }),
    [sendJsonMessage, lastJsonMessage, readyState],
  );
  return (
    <GlobalWebSocketContext.Provider value={value}>
      {children}
    </GlobalWebSocketContext.Provider>
  );
};

export default WebsocketProvider;
