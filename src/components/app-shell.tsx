import MaintenanceNotice from '@/components/maintenance-notice';
import Navigation from '@/components/navigation';
import { GlobalWebSocketProvider } from '@/components/providers/websocket-provider';
import { PropsWithChildren } from 'react';

export default function AppShell({ children }: PropsWithChildren) {
  return (
    <GlobalWebSocketProvider>
      <Navigation />
      <div className="pt-mk-navbar-total-height">{children}</div>
      <MaintenanceNotice />
    </GlobalWebSocketProvider>
  );
}
