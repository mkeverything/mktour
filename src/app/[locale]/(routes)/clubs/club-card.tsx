'use client';

import ClubCrest from '@/components/discovery/club-crest';
import PlaceLabel from '@/components/discovery/place-label';
import { useFormatDate } from '@/components/hooks/use-format-date';
import LichessLogo from '@/components/ui-custom/lichess-logo';
import { Card } from '@/components/ui/card';
import { ClubListItemModel } from '@/server/zod/discovery';
import { CalendarDays } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { FC } from 'react';

const ClubCard: FC<{ club: ClubListItemModel }> = ({ club }) => {
  const t = useTranslations('Discovery');
  const tMake = useTranslations('MakeTournament');
  const formatDate = useFormatDate();
  const next = club.nextTournament;

  return (
    <Card className="mk-card hover:bg-accent/40 relative flex h-full flex-col gap-3 shadow-sm transition-colors">
      <div className="flex items-start gap-3">
        <ClubCrest id={club.id} name={club.name} />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2">
            <Link
              href={`/clubs/${club.id}`}
              className="truncate text-base font-semibold after:absolute after:inset-0 after:content-['']"
            >
              {club.name}
            </Link>
            {club.lichessTeam && (
              <span className="size-4 shrink-0">
                <LichessLogo />
              </span>
            )}
            {club.isNew && (
              <span className="bg-primary/10 rounded-full px-2 py-0.5 text-xs">
                {t('new')}
              </span>
            )}
          </div>
          <PlaceLabel
            place={club.place}
            distanceKm={club.distanceKm}
            className="text-muted-foreground truncate text-xs"
          />
        </div>
        {club.liveTournamentsCount > 0 && (
          <span className="bg-destructive/10 text-destructive flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium">
            <span className="bg-destructive size-1.5 rounded-full motion-safe:animate-pulse" />
            {t('live now', { count: club.liveTournamentsCount })}
          </span>
        )}
      </div>
      {club.description && (
        <p className="text-muted-foreground line-clamp-2 text-sm">
          {club.description}
        </p>
      )}
      <dl className="mt-auto grid grid-cols-3 border-t pt-3">
        <Stat label={t('players')} value={club.playersCount} />
        <Stat label={t('tournaments')} value={club.tournamentsCount} />
        <Stat label={t('avg rating')} value={club.averageRating ?? '–'} />
      </dl>
      {next && (
        <Link
          href={`/tournaments/${next.id}`}
          className="bg-muted hover:bg-accent relative z-10 flex items-center justify-between gap-2 rounded-md px-3 py-2 text-xs transition-colors"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <CalendarDays className="size-3.5 shrink-0" />
            <span className="truncate">
              {t('next', { title: next.title || tMake(next.format) })}
            </span>
          </span>
          <span className="text-muted-foreground shrink-0">
            {formatDate(next.date, 'short')}
          </span>
        </Link>
      )}
    </Card>
  );
};

const Stat: FC<{ label: string; value: number | string }> = ({
  label,
  value,
}) => (
  <div className="flex flex-col-reverse">
    <dt className="text-muted-foreground text-xs">{label}</dt>
    <dd className="font-mono text-sm tabular-nums">{value}</dd>
  </div>
);

export default ClubCard;
