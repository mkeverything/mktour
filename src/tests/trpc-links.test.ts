import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  mock,
  spyOn,
  test,
} from 'bun:test';
import { TRPCClientError } from '@trpc/client';
import { observable, type Observer } from '@trpc/server/observable';

const capture = mock();
mock.module('posthog-js', () => ({ default: { capture } }));

const { fetchWithTimeout, retrySubscriptionLink } =
  await import('@/components/trpc/links');

const connectionLost = new TRPCClientError('connection lost');
const started = { result: { type: 'started' } };

const subscribe = () => {
  const connections: Observer<unknown, unknown>[] = [];
  const next = () =>
    observable((observer) => {
      connections.push(observer);
      return () => {};
    });
  const onError = mock();
  const subscription = retrySubscriptionLink({} as never)({
    op: {},
    next,
  } as never).subscribe({ error: onError });
  return { connections, onError, subscription };
};

describe('subscription retry link', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('retries a lost connection with a growing delay', () => {
    const { connections } = subscribe();

    connections[0].error(connectionLost);
    jest.advanceTimersByTime(1_999);
    expect(connections).toHaveLength(1);
    jest.advanceTimersByTime(1);
    expect(connections).toHaveLength(2);

    connections[1].error(connectionLost);
    jest.advanceTimersByTime(3_999);
    expect(connections).toHaveLength(2);
    jest.advanceTimersByTime(1);
    expect(connections).toHaveLength(3);
  });

  test('starts the backoff over once a connection opens', () => {
    const { connections } = subscribe();
    for (let i = 0; i < 6; i++) {
      connections[i].error(connectionLost);
      jest.advanceTimersByTime(30_000);
    }
    expect(connections).toHaveLength(7);

    connections[6].next(started);
    connections[6].error(connectionLost);
    jest.advanceTimersByTime(2_000);
    expect(connections).toHaveLength(8);
  });

  test('gives a server error to the caller without a retry', () => {
    const { connections, onError } = subscribe();
    const serverError = { data: { code: 'NOT_FOUND' } };

    connections[0].error(serverError);
    jest.advanceTimersByTime(60_000);
    expect(onError).toHaveBeenCalledWith(serverError);
    expect(connections).toHaveLength(1);
  });

  test('stops retrying once unsubscribed', () => {
    const { connections, subscription } = subscribe();

    connections[0].error(connectionLost);
    subscription.unsubscribe();
    jest.advanceTimersByTime(60_000);
    expect(connections).toHaveLength(1);
  });
});

describe('fetch with timeout', () => {
  const url = '/api/trpc/tournament.setGameResult,tournament.units?batch=1';

  beforeEach(() => {
    jest.useFakeTimers();
    capture.mockClear();
    spyOn(globalThis, 'fetch').mockImplementation(
      ((_url: string, init: RequestInit) =>
        new Promise((_, reject) =>
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          ),
        )) as never,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    mock.restore();
  });

  test('fails a request with no answer and records it', async () => {
    const request = fetchWithTimeout(url, { method: 'POST' });
    jest.advanceTimersByTime(20_000);

    await expect(request).rejects.toMatchObject({
      message: 'REQUEST_TIMEOUT',
    });
    expect(capture).toHaveBeenCalledWith('request_timed_out', {
      procedures: 'tournament.setGameResult,tournament.units',
    });
  });

  test('fails a request whose body stalls after the headers', async () => {
    spyOn(globalThis, 'fetch').mockImplementation(((
      _url: string,
      init: RequestInit,
    ) =>
      Promise.resolve(
        new Response(
          new ReadableStream({
            start: (controller) =>
              init.signal?.addEventListener('abort', () =>
                controller.error(new DOMException('aborted', 'AbortError')),
              ),
          }),
        ),
      )) as never);

    const request = fetchWithTimeout(url, { method: 'POST' });
    await Promise.resolve();
    jest.advanceTimersByTime(20_000);

    await expect(request).rejects.toMatchObject({
      message: 'REQUEST_TIMEOUT',
    });
    expect(capture).toHaveBeenCalledWith('request_timed_out', {
      procedures: 'tournament.setGameResult,tournament.units',
    });
  });

  test('keeps an abort from the caller as it is', async () => {
    const controller = new AbortController();
    const request = fetchWithTimeout(url, { signal: controller.signal });
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(capture).not.toHaveBeenCalled();
  });

  test('gives the response when it comes in time', async () => {
    spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"ok":true}', { status: 207 }),
    );

    const response = await fetchWithTimeout(url);
    expect(response.status).toBe(207);
    expect(await response.json()).toEqual({ ok: true });
  });
});
