'use client';

import Desktop from '@/components/navigation/desktop';
import Mobile from '@/components/navigation/mobile';
import { MediaQueryContext } from '@/components/providers/media-query-context';
import MktourNavbar from '@/components/ui-custom/mktour-logo-navbar';
import { FC, useContext, useEffect, useState } from 'react';

const Navigation: FC = () => {
  const { isTablet } = useContext(MediaQueryContext);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line
    setMounted(true);
  }, []);

  const showMobile = mounted ? isTablet : true;

  return (
    <nav className="bg-background p-mk md:p-mk-2 h-mk-navbar fixed z-50 flex w-full items-center justify-between border-b">
      <MktourNavbar />
      {showMobile ? <Mobile /> : <Desktop />}
    </nav>
  );
};

export default Navigation;
