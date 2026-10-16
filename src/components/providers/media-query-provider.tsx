'use client';

import {
  MediaQueryContext,
  MediaQueryContextType,
} from '@/components/providers/media-query-context';
import {
  FC,
  PropsWithChildren,
  useCallback,
  useMemo,
  useSyncExternalStore,
} from 'react';

const DEFAULT_CONTEXT: MediaQueryContextType = {
  isMobile: true,
  isTablet: true,
  isDesktop: false,
};

const MediaQueryProvider: FC<PropsWithChildren> = ({ children }) => {
  const isMobile = useMediaQuery(
    '(max-width: 640px)',
    DEFAULT_CONTEXT.isMobile,
  );
  const isTablet = useMediaQuery(
    '(max-width: 767px)',
    DEFAULT_CONTEXT.isTablet,
  ); // NB: this probably should be 1023px
  const isDesktop = useMediaQuery(
    '(min-width: 768px)',
    DEFAULT_CONTEXT.isDesktop,
  ); // whilst this should be 1024px

  const value = useMemo(
    () => ({ isMobile, isTablet, isDesktop }),
    [isMobile, isTablet, isDesktop],
  );

  return (
    <MediaQueryContext.Provider value={value}>
      {children}
    </MediaQueryContext.Provider>
  );
};

function useMediaQuery(query: string, defaultMatches: boolean) {
  const mediaQuery = useMemo(
    () => (typeof window === 'undefined' ? null : window.matchMedia(query)),
    [query],
  );

  const subscribe = useCallback(
    (onChange: () => void) => {
      mediaQuery?.addEventListener('change', onChange);
      return () => mediaQuery?.removeEventListener('change', onChange);
    },
    [mediaQuery],
  );

  return useSyncExternalStore(
    subscribe,
    () => mediaQuery?.matches ?? defaultMatches,
    () => defaultMatches,
  );
}

export default MediaQueryProvider;
