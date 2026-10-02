'use client';

import ClubMain from '@/app/(routes)/clubs/my/(tabs)/main';
import ClubInbox from '@/app/(routes)/clubs/my/(tabs)/notifications';
import ClubSettings from '@/app/(routes)/clubs/my/(tabs)/settings';
import ClubPlayersList from '@/app/(routes)/clubs/players';
import ClubDashboardTournaments from '@/app/(routes)/clubs/tournaments';
import { StatusInClub } from '@/server/zod/enums';
import { FC } from 'react';

export const tabMap: Record<ClubDashboardTab, FC<ClubTabProps>> = {
  main: ClubMain,
  players: ClubPlayersList,
  tournaments: ClubDashboardTournaments,
  notifications: ClubInbox,
  settings: ClubSettings,
};

export type ClubDashboardTab =
  'main' | 'players' | 'tournaments' | 'notifications' | 'settings';

export type ClubTabProps = {
  selectedClub: string;
  userId: string;
  statusInClub?: StatusInClub | null;
  isInView?: boolean;
};
