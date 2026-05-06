import { PostHog } from 'posthog-node';

function getPostHogIngestHost(): string {
  return process.env.NEXT_PUBLIC_POSTHOG_API_HOST ?? 'https://eu.i.posthog.com';
}

/** runs capture/identify then flushes; safe for serverless (vercel) */
export async function withPostHogServer(
  fn: (_client: PostHog) => void | Promise<void>,
): Promise<void> {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;

  const client = new PostHog(key, {
    host: getPostHogIngestHost(),
    flushAt: 1,
    flushInterval: 0,
  });
  try {
    await fn(client);
  } finally {
    await client.shutdown();
  }
}
