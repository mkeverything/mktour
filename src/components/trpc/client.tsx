'use client';
// ^-- to make sure we can mount the Provider from a server component
import { AppError } from '@/lib/errors';
import type { AppRouter } from '@/server/api';
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import {
  createTRPCClient,
  httpBatchLink,
  httpSubscriptionLink,
  retryLink,
  splitLink,
} from '@trpc/client';
import { createTRPCContext } from '@trpc/tanstack-react-query';
import { useState } from 'react';
import SuperJSON from 'superjson';
import { makeQueryClient } from './query-client';

const REQUEST_TIMEOUT_MS = 20_000;

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();
let browserQueryClient: QueryClient;
function getQueryClient() {
  if (typeof window === 'undefined') {
    return makeQueryClient();
  }
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}
function getUrl() {
  const base = (() => {
    if (typeof window !== 'undefined') return '';
    return 'http://localhost:3000';
  })();
  return `${base}/api/trpc`;
}
export function TRPCReactProvider(
  props: Readonly<{
    children: React.ReactNode;
  }>,
) {
  // NOTE: Avoid useState when initializing the query client if you don't
  //       have a suspense boundary between this and the code that may
  //       suspend because React will throw away the client on the initial
  //       render if it suspends and there is no boundary
  const queryClient = getQueryClient();
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        splitLink({
          condition: (op) => op.type === 'subscription',
          true: [
            // errors from the server carry data and are final; a lost connection is retried
            retryLink({
              retry: ({ error }) => !error.data,
              retryDelayMs: () => 2_000,
            }),
            httpSubscriptionLink({
              transformer: SuperJSON,
              url: getUrl(),
            }),
          ],
          false: httpBatchLink({
            transformer: SuperJSON,
            url: getUrl(),
            // a request on a connection that died while the page was hidden can hang for minutes
            fetch: (url, init) => {
              const controller = new AbortController();
              setTimeout(
                () => controller.abort(new AppError('REQUEST_TIMEOUT')),
                REQUEST_TIMEOUT_MS,
              );
              return fetch(url, { ...init, signal: controller.signal });
            },
          }),
        }),
      ],
    }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <ReactQueryDevtools buttonPosition="bottom-left" />
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {props.children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
