import AppShell from '@/components/app-shell';
import { PropsWithChildren } from 'react';

export default function RoutesLayout({ children }: PropsWithChildren) {
  return <AppShell>{children}</AppShell>;
}
