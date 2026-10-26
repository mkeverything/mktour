import { maintenanceConfigSchema } from '@/server/zod/maintenance';
import { readFile } from 'node:fs/promises';

export async function getMaintenance() {
  const file =
    process.env.MAINTENANCE_FILE ??
    (process.env.NODE_ENV === 'development'
      ? 'maintenance.local.json'
      : undefined);
  if (!file) return;

  try {
    const result = maintenanceConfigSchema.safeParse(
      JSON.parse(await readFile(/* turbopackIgnore: true */ file, 'utf8')),
    );
    if (!result.success || result.data.enabled !== true) return;

    const startsAt = result.data.startsAt ?? null;
    const endsAt = result.data.endsAt ?? null;
    if (startsAt !== null && endsAt !== null && endsAt <= startsAt) return;

    return { startsAt, endsAt };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    console.error('failed to read maintenance config:', error);
  }
}
