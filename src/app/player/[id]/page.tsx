import { turboPascal } from '@/app/fonts';
import Loading from '@/app/loading';
import { AffiliateButton } from '@/app/player/[id]/affiliate-button';
import CancelAffiliationByClub from '@/app/player/[id]/cancel-affiliation-by-club';
import CancelAffiliationByUser from '@/app/player/[id]/cancel-affiliation-by-user';
import ClaimPlayer from '@/app/player/[id]/claim-button';
import EditButton from '@/app/player/[id]/edit-button';
import LastTournaments from '@/app/player/[id]/last-tournaments';
import PlayerStats from '@/app/player/[id]/player-stats';
import LichessLogo from '@/components/ui-custom/lichess-logo';
import { Button } from '@/components/ui/button';
import { CardTitle } from '@/components/ui/card';
import { publicCaller } from '@/server/api';
import { PlayerModel } from '@/server/db/zod/players';
import { ChevronRight, User2, Users2, UserX } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FC, Suspense } from 'react';
import 'server-only';

export default async function PlayerPage(props: PlayerPageProps) {
  return (
    <Suspense fallback={<Loading />}>
      <PlayerPageContent {...props} />
    </Suspense>
  );
}

async function PlayerPageContent(props: PlayerPageProps) {
  const { id } = await props.params;
  const [user, playerData] = await Promise.all([
    publicCaller.auth.info(),
    publicCaller.player.info({ playerId: id }),
  ]);
  if (!playerData) notFound();

  const { user: playerUser, club, ...player } = playerData;
  const [status, affiliation] = await Promise.all([
    publicCaller.club.authStatus({
      clubId: club.id,
    }),
    publicCaller.auth.affiliationInClub({ clubId: club.id }),
  ]);
  const playerLastTournaments = await publicCaller.player.lastTournaments({
    playerId: player.id,
  });

  const isOwnPlayer = user && player.userId === user.id;
  const canEdit = status !== null || isOwnPlayer;
  const canClaim = !status && user && !player.userId;
  const canAffiliate = status !== null && !player.userId && !affiliation;
  const t = await getTranslations('Player');

  return (
    <div className="mk-container flex w-full flex-col gap-4">
      {/* Club Context Bar */}
      <Link
        href={`/clubs/${club.id}`}
        className="bg-secondary/50 hover:bg-secondary/70 flex items-center justify-between rounded-lg px-4 py-3 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Users2 className="text-muted-foreground size-4" />
          <span className="text-sm font-medium">{club.name}</span>
        </div>
        <ChevronRight className="text-muted-foreground size-4" />
      </Link>
      <PlayerHeader player={player} />
      {/* Action Toolbar */}
      <div className="flex justify-end gap-2">
        {playerUser && (
          <Button variant="outline" size="icon" className="gap-2" asChild>
            <Link
              href={`https://lichess.org/@/${playerUser.username}`}
              target="_blank"
            >
              <div className="size-4">
                <LichessLogo />
              </div>
            </Link>
          </Button>
        )}
        {playerUser ? (
          <Button variant="outline" className="max-w-3/5 gap-2" asChild>
            <Link href={`/user/${playerUser.username}`}>
              <User2 className="size-4" />
              <span className="truncate">{playerUser.username}</span>
            </Link>
          </Button>
        ) : (
          <Button variant="outline" className="gap-2" disabled>
            <UserX className="size-4" />
            <span className="text-2xs sm:text-xs">{t('not linked')}</span>
          </Button>
        )}
        {canAffiliate && <AffiliateButton player={player} />}
        {status !== null && player.userId ? (
          <CancelAffiliationByClub
            playerId={player.id}
            clubId={club.id}
            isOwnPlayer={!!isOwnPlayer}
          />
        ) : (
          isOwnPlayer && <CancelAffiliationByUser playerId={player.id} />
        )}
        {user && canEdit && <EditButton player={player} status={status} />}
        {canClaim && <ClaimPlayer userId={user.id} clubId={club.id} />}
      </div>
      <PlayerStats player={player} />
      <LastTournaments tournaments={playerLastTournaments} />
    </div>
  );
}

const PlayerHeader: FC<{ player: PlayerModel }> = ({ player }) => (
  <div className="p-mk">
    <div className="flex items-center justify-between">
      <div className="flex flex-col gap-1">
        <CardTitle className={`text-4xl font-light ${turboPascal.className}`}>
          {player.nickname}
        </CardTitle>
        {player.realname && (
          <span className="text-muted-foreground text-sm">
            {player.realname}
          </span>
        )}
      </div>
      <div className="flex flex-col items-end">
        <span className="text-3xl font-bold">{player.rating}</span>
      </div>
    </div>
  </div>
);

export interface PlayerPageProps {
  params: Promise<{ id: string }>;
}
