import MaintenanceNotice from '@/components/maintenance-notice';
import Navigation from '@/components/navigation';
import UserEvents from '@/components/user-events';
import { PropsWithChildren } from 'react';

export default function AppShell({ children }: PropsWithChildren) {
  return (
    <>
      <UserEvents />
      <Navigation />
      <div className="pt-mk-navbar-total-height">{children}</div>
      <MaintenanceNotice />
    </>
  );
}
