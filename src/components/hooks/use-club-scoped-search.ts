import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useSearchQuery } from '@/components/hooks/query-hooks/use-search-result';
import { useDebounce } from '@/components/hooks/use-debounce';
import { useTRPC } from '@/components/trpc/client';

type ClubSearchType = 'players' | 'tournaments';

export const useClubScopedSearch = ({
  clubId,
  type,
}: {
  clubId: string;
  type: ClubSearchType;
}) => {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const secondDebouncedSearch = useDebounce(search, 290);
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  const { data } = useSearchQuery({
    query: debouncedSearch,
    filter: {
      type,
      clubId,
    },
  });

  useEffect(() => {
    const queryKeyInput = {
      filter: { type, clubId } as const,
      query: secondDebouncedSearch,
    };
    if (!queryClient.getQueryData(trpc.search.queryKey(queryKeyInput))) {
      queryClient.setQueryData(trpc.search.queryKey(queryKeyInput), data);
      queryClient.invalidateQueries({
        queryKey: trpc.search.queryKey(queryKeyInput),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, queryClient, secondDebouncedSearch, trpc.search, type]);

  return { data, search, setSearch, debouncedSearch };
};
