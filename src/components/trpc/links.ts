import { AppError } from '@/lib/errors';
import type { AppRouter } from '@/server/api';
import type { TRPCLink } from '@trpc/client';
import { observable, type Unsubscribable } from '@trpc/server/observable';
import posthog from 'posthog-js';

const MAX_RETRY_DELAY_MS = 30_000;
const REQUEST_TIMEOUT_MS = 20_000;

// errors from the server carry data and are final; a lost connection is retried.
// the backoff starts over once a connection opens, so a later drop reconnects quickly.
// unlike trpc's retryLink, it does not resume `tracked()` event ids
export const retrySubscriptionLink: TRPCLink<AppRouter> =
  () =>
  ({ op, next }) =>
    observable((observer) => {
      let attempts = 0;
      let subscription: Unsubscribable | undefined;
      let retryTimeout: ReturnType<typeof setTimeout> | undefined;
      const connect = () => {
        subscription = next(op).subscribe({
          next: (envelope) => {
            if (envelope.result.type === 'started') attempts = 0;
            observer.next(envelope);
          },
          error: (error) => {
            if (error.data) return observer.error(error);
            attempts++;
            retryTimeout = setTimeout(
              connect,
              Math.min(1000 * 2 ** attempts, MAX_RETRY_DELAY_MS),
            );
          },
          complete: () => observer.complete(),
        });
      };
      connect();
      return () => {
        clearTimeout(retryTimeout);
        subscription?.unsubscribe();
      };
    });

// a request on a dead connection (e.g. after ios safari resumes a page) can hang
// for minutes; failing it lets the user try again
export const fetchWithTimeout = async (
  url: RequestInfo | URL,
  init?: RequestInit,
) => {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (init?.signal?.aborted) abort();
  init?.signal?.addEventListener('abort', abort, { once: true });
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    abort();
  }, REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (!timedOut) throw error;
    posthog.capture('request_timed_out', {
      procedures: String(url).split('?')[0].split('/').at(-1),
    });
    throw new AppError('REQUEST_TIMEOUT', { cause: error });
  } finally {
    clearTimeout(timeout);
  }
};
