import { turboPascal } from '@/app/fonts';
import Loading from '@/app/loading';
import { AffiliateButton } from '@/app/player/[id]/affiliate-button';
import ClaimPlayer from '@/app/player/[id]/claim-button';
import EditButton from '@/app/player/[id]/edit-button';
import PlayerStats from '@/app/player/[id]/player-stats';
import LastTournaments from '@/components/last-tournaments';
import { CardTitle } from '@/components/ui/card';
import { publicCaller } from '@/server/api';
import { PlayerModel } from '@/server/db/zod/players';
import { ChevronRight, Users2 } from 'lucide-react';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
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
  if (playerData.user) permanentRedirect(`/user/${playerData.user.username}`);

  const { club, ...player } = playerData;
  const [status, affiliation] = await Promise.all([
    publicCaller.club.authStatus({
      clubId: club.id,
    }),
    publicCaller.auth.affiliationInClub({ clubId: club.id }),
  ]);
  const playerLastTournaments = await publicCaller.player.lastTournaments({
    playerId: player.id,
  });

  const canEdit = status !== null;
  const canClaim = !status && user && !player.userId;
  const canAffiliate = status !== null && !player.userId && !affiliation;

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
        {canAffiliate && <AffiliateButton player={player} />}
        {user && canEdit && <EditButton player={player} status={status} />}
        {canClaim && <ClaimPlayer userId={user.id} clubId={club.id} />}
      </div>
      <PlayerStats clubName={club.name} player={player} />
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
