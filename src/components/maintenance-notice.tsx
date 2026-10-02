'use client';

import { useTRPC } from '@/components/trpc/client';
import type { MaintenanceStartsAt } from '@/server/zod/maintenance';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useSyncExternalStore } from 'react';

const subscribe = (callback: () => void) => {
  const interval = setInterval(callback, 1000);
  return () => clearInterval(interval);
};

export default function MaintenanceNotice() {
  const trpc = useTRPC();
  const { data } = useQuery({
    ...trpc.maintenanceStartsAt.queryOptions(),
    staleTime: Infinity,
  });

  return data ? <ScheduledMaintenance startsAt={data} /> : null;
}

function ScheduledMaintenance({
  startsAt,
}: {
  startsAt: NonNullable<MaintenanceStartsAt>;
}) {
  const t = useTranslations('Maintenance');
  const minutes = useSyncExternalStore(
    subscribe,
    () => Math.max(Math.ceil((startsAt.getTime() - Date.now()) / 60000), 0),
    () => null,
  );
  if (!minutes || minutes > 30) return null;

  return (
    <p className="text-muted-foreground pointer-events-none fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-4 z-50 text-xs">
      {t('scheduled', { minutes })}
    </p>
  );
}
