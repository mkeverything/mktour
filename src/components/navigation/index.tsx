'use client';

import Desktop from '@/components/navigation/desktop';
import Mobile from '@/components/navigation/mobile';
import { MediaQueryContext } from '@/components/providers/media-query-context';
import MktourNavbar from '@/components/ui-custom/mktour-logo-navbar';
import { FC, Suspense, useContext } from 'react';

const Navigation: FC = () => {
  const { isTablet } = useContext(MediaQueryContext);

  return (
    <nav className="mk-navbar bg-background fixed top-0 z-50 flex w-full items-center justify-between border-b">
      <MktourNavbar />
      <Suspense>{isTablet ? <Mobile /> : <Desktop />}</Suspense>
    </nav>
  );
};

export default Navigation;
