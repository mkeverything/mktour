import MakeTournamentButton from '@/components/button-make-tournament';
import TeamJoinToaster from '@/components/team-join-toaster';
import TournamentItemIteratee from '@/components/tournament-item';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { publicCaller } from '@/server/api';
import { TournamentWithClubModel } from '@/server/zod/tournaments';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Suspense } from 'react';

const RECENT_TOURNAMENTS_LIMIT = 5;

export default async function Authorized() {
  const tournaments = await publicCaller.auth
    .myTournaments()
    .catch(() => [] as TournamentWithClubModel[]);
  const recentTournaments = tournaments.slice(0, RECENT_TOURNAMENTS_LIMIT);
  const hasAnyTournaments = tournaments.length > 0;

  return (
    <>
      <div
        className={cn(
          'min-h-mk-content-height flex w-full flex-auto flex-col p-4',
          hasAnyTournaments
            ? 'md:h-mk-content-height flex-col-reverse items-center justify-center gap-8 md:min-h-0 md:max-w-none md:flex-row md:items-stretch md:justify-center md:gap-0 md:overflow-hidden md:p-0'
            : 'md:h-mk-content-height items-center justify-center md:overflow-hidden md:px-6',
        )}
      >
        {hasAnyTournaments ? (
          <>
            <div
              className={
                'flex w-full max-w-md shrink-0 flex-col items-center gap-3 md:h-full md:w-1/2 md:max-w-none md:items-stretch md:justify-center md:overflow-hidden md:px-6 md:py-6'
              }
            >
              <RecentTournamentsSection
                recentTournaments={recentTournaments}
                hasAnyTournaments={hasAnyTournaments}
              />
            </div>
            <div className="flex w-full max-w-md shrink-0 justify-center md:h-full md:w-1/2 md:max-w-none md:items-center md:justify-center md:overflow-hidden md:px-6 md:py-6">
              <MakeTournamentButton className="md:max-w-sm" />
            </div>
          </>
        ) : (
          <div className="w-full max-w-md">
            <MakeTournamentButton />
          </div>
        )}
      </div>
      <Suspense fallback={null}>
        <TeamJoinToasterServer />
      </Suspense>
    </>
  );
}

async function RecentTournamentsSection({
  recentTournaments,
  hasAnyTournaments,
}: {
  recentTournaments: TournamentWithClubModel[];
  hasAnyTournaments: boolean;
}) {
  const t = await getTranslations('Home');
  if (!hasAnyTournaments) return null;
  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="flex w-full items-center justify-between gap-2">
        <h2 className="text-muted-foreground text-sm font-medium">
          {t('recent tournaments')}
        </h2>
        <Button variant="ghost" size="sm" asChild className="shrink-0">
          <Link href="/tournaments/my">{t('see all')}</Link>
        </Button>
      </div>
      <ul className="flex w-full flex-col gap-2">
        {recentTournaments.map(({ tournament, club }) => (
          <li key={tournament.id}>
            <TournamentItemIteratee tournament={tournament} club={club} />
          </li>
        ))}
      </ul>
    </div>
  );
}

const TeamJoinToasterServer = async () => {
  const { cookies } = await import('next/headers');
  const isNew = (await cookies()).get('show_new_user_toast');
  if (!isNew) return null;
  return <TeamJoinToaster />;
};
