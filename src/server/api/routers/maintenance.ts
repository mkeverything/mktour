import { getMaintenance } from '@/lib/maintenance';
import { publicProcedure } from '@/server/api/trpc';
import { maintenanceStartsAtSchema } from '@/server/zod/maintenance';

export const maintenanceStartsAt = publicProcedure
  .output(maintenanceStartsAtSchema)
  .query(async () => {
    const maintenance = await getMaintenance();
    const startsAt = maintenance?.startsAt;
    return startsAt != null && startsAt > Date.now()
      ? new Date(startsAt)
      : null;
  });
