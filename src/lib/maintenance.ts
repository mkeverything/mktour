import { maintenanceConfigSchema } from '@/server/zod/maintenance';
import { get } from '@vercel/global-config';
import { readFile } from 'node:fs/promises';

const CONFIG_TIMEOUT_MS = 500;

export async function getMaintenance() {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    let value: unknown;
    if (process.env.NODE_ENV === 'development') {
      try {
        value = JSON.parse(await readFile('maintenance.local.json', 'utf8'));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }

    if (value === undefined) {
      if (!(process.env.GLOBAL_CONFIG ?? process.env.EDGE_CONFIG)) return;
      value = await Promise.race([
        get<unknown>('maintenance'),
        new Promise<undefined>((resolve) => {
          timeout = setTimeout(() => {
            console.error('maintenance config read timed out');
            resolve(undefined);
          }, CONFIG_TIMEOUT_MS);
        }),
      ]);
    }
    const result = maintenanceConfigSchema.safeParse(value);
    if (!result.success || result.data.enabled !== true) return;

    const startsAt = result.data.startsAt ?? null;
    const endsAt = result.data.endsAt ?? null;
    if (startsAt !== null && endsAt !== null && endsAt <= startsAt) return;

    return { startsAt, endsAt };
  } catch (error) {
    console.error('failed to read maintenance config:', error);
  } finally {
    clearTimeout(timeout);
  }
}
