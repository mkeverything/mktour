import { useTRPC } from '@/components/trpc/client';
import { useQuery } from '@tanstack/react-query';

export const usePlayerStats = (playerId: string) => {
  const trpc = useTRPC();
  return useQuery(trpc.player.stats.public.queryOptions({ playerId }));
};

export const usePlayerAuthStats = (
  playerId: string,
  enabled: boolean = true,
) => {
  const trpc = useTRPC();
  return useQuery(
    trpc.player.stats.auth.queryOptions({ playerId }, { enabled }),
  );
};
