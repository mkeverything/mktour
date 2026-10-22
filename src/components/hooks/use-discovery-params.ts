import { DiscoveryParam, parseDiscoveryParams } from '@/lib/discovery-params';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export const useDiscoveryParams = () => {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const setParams = (patch: Partial<Record<DiscoveryParam, string | null>>) => {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(patch).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  return { params: parseDiscoveryParams(searchParams), setParams };
};
