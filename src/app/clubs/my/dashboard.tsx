'use client';

import ClubDashboardDesktop from '@/app/clubs/my/desktop/dashboard-desktop';
import ClubDashboardMobile from '@/app/clubs/my/mobile/dashboard-mobile';
import { MediaQueryContext } from '@/components/providers/media-query-context';
import { StatusInClub } from '@/server/zod/enums';
import { useContext } from 'react';

export default function Dashboard({
  userId,
  statusInClub,
}: {
  userId: string;
  statusInClub: StatusInClub | null;
}) {
  const { isDesktop } = useContext(MediaQueryContext);
  const Component = isDesktop ? ClubDashboardDesktop : ClubDashboardMobile;

  return <Component userId={userId} statusInClub={statusInClub} />;
}
