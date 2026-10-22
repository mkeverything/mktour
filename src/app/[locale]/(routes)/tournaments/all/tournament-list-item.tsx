'use client';

import TournamentStatusBadge from '@/app/[locale]/(routes)/tournaments/all/tournament-status-badge';
import PlaceLabel from '@/components/discovery/place-label';
import { useFormatDate } from '@/components/hooks/use-format-date';
import { useTournamentFallbackTitle } from '@/components/hooks/use-tournament-fallback-title';
import { Card } from '@/components/ui/card';
import { getTournamentStatus } from '@/lib/discovery-params';
import { TournamentListItemModel } from '@/server/zod/discovery';
import { Crown, Users2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { FC } from 'react';

type Props = { item: TournamentListItemModel };

const TournamentListItem: FC<Props> = ({ item }) => {
  const { tournament, club, place, distanceKm } = item;
  const fallbackTitle = useTournamentFallbackTitle(tournament);
  const title = tournament.title || fallbackTitle;

  return (
    <Link href={`/tournaments/${tournament.id}`} className="group">
      <Card className="mk-card flex flex-col gap-1.5 shadow-sm md:hidden">
        <div className="flex items-center justify-between gap-2">
          <StatusBadge item={item} />
          <PlayersCount item={item} />
        </div>
        <span className="text-base leading-tight font-semibold">{title}</span>
        <span className="text-muted-foreground text-xs">
          {club.name}
          <PlaceLabel
            place={place}
            distanceKm={distanceKm}
            className="before:mx-1 before:content-['·']"
          />
        </span>
        <Details item={item} />
        <Outcome item={item} />
      </Card>
      <div className="group-hover:bg-accent/50 hidden grid-cols-[7rem_minmax(0,1fr)_7rem_minmax(0,13rem)] items-center gap-4 border-b px-4 py-3 text-sm transition-colors md:grid">
        <StatusBadge item={item} />
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-semibold">{title}</span>
          <span className="text-muted-foreground truncate text-xs">
            {club.name}
            <PlaceLabel
              place={place}
              distanceKm={distanceKm}
              className="before:mx-1 before:content-['·']"
            />
          </span>
          <Details item={item} />
        </div>
        <PlayersCount item={item} />
        <Outcome item={item} podium />
      </div>
    </Link>
  );
};

const StatusBadge: FC<Props> = ({ item: { tournament } }) => {
  const t = useTranslations('Discovery');
  const formatDate = useFormatDate();
  const status = getTournamentStatus(tournament);
  const date = formatDate(tournament.date, 'short');

  if (status === 'live') {
    return (
      <TournamentStatusBadge status="live">{t('live')}</TournamentStatusBadge>
    );
  }
  return <TournamentStatusBadge status={status}>{date}</TournamentStatusBadge>;
};

const PlayersCount: FC<Props> = ({ item: { tournament, playersCount } }) => {
  const t = useTranslations('Discovery');
  return (
    <span className="text-muted-foreground flex items-center gap-1 text-xs whitespace-nowrap">
      <Users2 className="size-3.5" />
      {t(tournament.type === 'doubles' ? 'teams count' : 'players count', {
        count: playersCount,
      })}
    </span>
  );
};

const Details: FC<Props> = ({ item: { tournament } }) => {
  const t = useTranslations('MakeTournament');
  return (
    <span className="text-muted-foreground flex flex-wrap gap-x-1 text-xs">
      {[
        t(tournament.format),
        t(`Types.${tournament.type}`),
        tournament.rated ? t('rated') : t('unrated'),
      ].join(' · ')}
    </span>
  );
};

const Outcome: FC<Props & { podium?: boolean }> = ({ item, podium }) => {
  const t = useTranslations('Discovery');
  const { tournament } = item;
  const status = getTournamentStatus(tournament);

  if (status === 'live') {
    const round = tournament.ongoingRound;
    const total = tournament.roundsNumber;
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs">
          {total ? t('round of', { round, total }) : t('round', { round })}
        </span>
        {total ? (
          <span className="bg-muted h-1 overflow-hidden rounded-full">
            <span
              className="bg-destructive block h-full rounded-full"
              style={{ width: `${Math.min(round / total, 1) * 100}%` }}
            />
          </span>
        ) : null}
      </div>
    );
  }

  if (status === 'finished') {
    const [winner, ...rest] = item.podium;
    if (!winner) return <span />;
    return (
      <div className="flex min-w-0 flex-col gap-0.5 text-xs">
        <span className="flex min-w-0 items-center gap-1.5">
          <Crown className="size-3.5 shrink-0 text-amber-500" />
          <span className="truncate font-medium">{winner.nickname}</span>
          <span className="text-muted-foreground whitespace-nowrap">
            {t('points', { score: winner.score })}
          </span>
        </span>
        {podium && rest.length > 0 && (
          <span className="text-muted-foreground truncate">
            {rest
              .map(
                ({ place, nickname, score }) =>
                  `${place}. ${nickname} ${score}`,
              )
              .join(' · ')}
          </span>
        )}
      </div>
    );
  }

  return <span />;
};

export default TournamentListItem;
