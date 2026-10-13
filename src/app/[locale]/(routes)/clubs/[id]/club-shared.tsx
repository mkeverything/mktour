'use client';

import { useAuthSelectClub } from '@/components/hooks/mutation-hooks/use-auth-select-club';
import { useAuth } from '@/components/hooks/query-hooks/use-user';
import LichessLogo from '@/components/ui-custom/lichess-logo';
import { Button } from '@/components/ui/button';
import { StatusInClub } from '@/server/zod/enums';
import { useQueryClient } from '@tanstack/react-query';
import { Home } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { FC } from 'react';

export const DashboardButton: FC<{
  clubId: string;
  statusInClub: StatusInClub | null;
}> = ({ clubId, statusInClub }) => {
  const t = useTranslations('Club');
  const queryClient = useQueryClient();
  const { data: user } = useAuth();
  const { mutate } = useAuthSelectClub(queryClient);

  if (!user || !statusInClub) return null;
  return (
    <Button variant="outline" className="shrink-0 gap-2" asChild>
      <Link
        prefetch={false}
        onNavigate={() => mutate({ clubId })}
        href="/clubs/my"
      >
        <Home className="size-4" />
        <span className="hidden sm:inline">{t('dashboard')}</span>
      </Link>
    </Button>
  );
};

export const LichessTeamLink: FC<{ team: string }> = ({ team }) => (
  <Link
    href={`https://lichess.org/team/${team}`}
    target="_blank"
    className="transition-opacity hover:opacity-70"
  >
    <LichessLogo className="size-5" />
  </Link>
);
