import MakeTournamentButton from '@/components/button-make-tournament';
import TeamJoinToaster from '@/components/team-join-toaster';
import TournamentItemIteratee from '@/components/tournament-item';
import { Button } from '@/components/ui/button';
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

  return (
    <div className="min-h-mk-content-height flex w-full flex-auto flex-col items-center justify-center gap-8 p-4 md:gap-10 md:px-6">
      <div className="mk-container flex w-full max-w-md flex-col items-center gap-8 md:items-stretch md:gap-10">
        <RecentTournamentsSection
          recentTournaments={recentTournaments}
          hasAnyTournaments={tournaments.length > 0}
        />
        <MakeTournamentButton />
      </div>
      <Suspense fallback={null}>
        <TeamJoinToasterServer />
      </Suspense>
    </div>
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
    <div className="flex w-full flex-col items-center gap-3 md:items-stretch">
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
