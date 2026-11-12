import { AffiliateButton } from '@/app/[locale]/(routes)/player/[id]/affiliate-button';
import ClaimPlayer from '@/app/[locale]/(routes)/player/[id]/claim-button';
import EditButton from '@/app/[locale]/(routes)/player/[id]/edit-button';
import Ledger from '@/app/[locale]/(routes)/player/[id]/ledger/ledger';
import { getPageMetadata } from '@/lib/page-metadata';
import { publicCaller } from '@/server/api';
import { getQueryClient, trpc } from '@/server/api/query-client';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import type { ResolvingMetadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound, permanentRedirect } from 'next/navigation';
import 'server-only';

export default async function PlayerPage(props: PlayerPageProps) {
  const { id } = await props.params;
  const [user, playerData] = await Promise.all([
    publicCaller.auth.info(),
    publicCaller.player.info({ playerId: id }),
  ]);
  if (!playerData) notFound();
  if (playerData.user) permanentRedirect(`/user/${playerData.user.username}`);

  const { club, ...player } = playerData;
  const queryClient = getQueryClient();
  const [status, affiliation, requestedByOther] = await Promise.all([
    publicCaller.club.authStatus({ clubId: club.id }),
    publicCaller.auth.affiliationInClub({ clubId: club.id }),
    publicCaller.player.affiliation.requestedByOther({ playerId: player.id }),
    queryClient.prefetchQuery(
      trpc.player.stats.public.queryOptions({ playerId: player.id }),
    ),
    queryClient.prefetchQuery(
      trpc.player.stats.auth.queryOptions({ playerId: player.id }),
    ),
    queryClient.prefetchQuery(
      trpc.player.ratingHistory.queryOptions({ playerId: player.id }),
    ),
    queryClient.prefetchInfiniteQuery(
      trpc.player.results.infiniteQueryOptions(
        { playerId: player.id, cursor: undefined },
        { getNextPageParam: (lastPage) => lastPage.nextCursor },
      ),
    ),
    queryClient.prefetchQuery(
      trpc.club.stats.queryOptions({ clubId: club.id }),
    ),
  ]);

  const canEdit = status !== null;
  const canClaim = !status && user && !player.userId;
  const canAffiliate =
    status !== null && !player.userId && !affiliation && !requestedByOther;
  const actions = (
    <>
      {canAffiliate && <AffiliateButton player={player} />}
      {user && canEdit && (
        <EditButton
          player={{ playerId: player.id, ...player }}
          status={status}
        />
      )}
      {canClaim && (
        <ClaimPlayer clubId={club.id} requestedByOther={requestedByOther} />
      )}
    </>
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Ledger player={player} club={club} actions={actions} />
    </HydrationBoundary>
  );
}

export async function generateMetadata(
  props: {
    params: Promise<{ id: string }>;
  },
  parent: ResolvingMetadata,
) {
  const params = await props.params;
  const t = await getTranslations('Seo');

  const playerData = await publicCaller.player.info({ playerId: params.id });

  if (!playerData) notFound();
  if (playerData.user) permanentRedirect(`/user/${playerData.user.username}`);

  const { club, ...player } = playerData;

  return getPageMetadata(parent, {
    path: `/player/${params.id}`,
    title: t('player.page.title', { nickname: player.nickname }),
    description: t('player.page.description', {
      nickname: player.nickname,
      rating: player.rating,
      club: club.name,
    }),
    // guest players are added by organizers without consent, often with real names
    robots: { index: false, follow: true },
  });
}

export interface PlayerPageProps {
  params: Promise<{ id: string }>;
}
