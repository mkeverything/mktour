import {
  InfoItem,
  LoadingElement,
} from '@/app/tournaments/[id]/dashboard/tabs/main';
import Winners from '@/app/tournaments/[id]/dashboard/tabs/main/winners';
import { useTournamentSummaryInfo } from '@/components/hooks/query-hooks/use-tournament-info';
import { useIntlError } from '@/components/hooks/use-intl-error';
import SwissRoundsNumber from '@/components/swiss-rounds-number';
import { Card } from '@/components/ui/card';
import {
  formatTournamentDisplayDate,
  parseLocalDateString,
} from '@/lib/local-date';
import {
  CalendarDays,
  ChartNoAxesCombinedIcon,
  Dices,
  HomeIcon,
  Layers,
  UserRound,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FC, memo, ReactNode } from 'react';
import { toast } from 'sonner';

const TournamentInfoList = () => {
  const { id: tournamentId } = useParams<{ id: string }>();
  const { data, isLoading, isError, error } =
    useTournamentSummaryInfo(tournamentId);
  const t = useTranslations('Tournament.Main');
  const { translateError } = useIntlError();
  const locale = useLocale();

  if (isLoading) return <LoadingElement />;
  if (isError) {
    toast.error(
      translateError(error, { fallback: 'TOURNAMENT_INFO_NOT_LOADED' }),
      {
        id: 'query-info',
        duration: 3000,
      },
    );
    return <LoadingElement />;
  }
  if (!data) return 'tournament info is `undefined` somehow';

  const tournamentDateTimestamp = parseLocalDateString(data.date);
  const tournamentDate = tournamentDateTimestamp
    ? new Date(tournamentDateTimestamp)
    : new Date(data.date);
  const formattedDate = formatTournamentDisplayDate(tournamentDate, locale);

  return (
    <>
      <Card className="mb-mk-2 px-4 pt-0 md:hidden">
        <div className="divide-border divide-y">
          <TournamentInfoStat
            icon={HomeIcon}
            label={t('club')}
            value={data.clubName}
            href={`/clubs/${data.clubId}`}
          />
          <TournamentInfoStat
            icon={CalendarDays}
            label={t('date')}
            value={formattedDate}
          />
          <TournamentInfoStat
            icon={Dices}
            label={t('format')}
            value={t(String(data.format))}
          />
          <TournamentInfoStat
            icon={UserRound}
            label={t('type')}
            value={t(`Types.${data.type}`)}
          />
          <TournamentInfoStat
            icon={ChartNoAxesCombinedIcon}
            label={t('rating')}
            value={data.rated ? t('rated') : t('unrated')}
          />
          {data.format === 'swiss' && (
            <TournamentInfoStat
              icon={Layers}
              label={t('number of rounds')}
              value={<SwissRoundsNumber className="text-sm font-medium" />}
            />
          )}
        </div>
      </Card>
      <Winners tournamentId={data.tournamentId} closedAt={data.closedAt} />
      <div className="md:text-muted-foreground gap-y-mk gap-x-mk-2 p-mk hidden flex-col flex-wrap text-xs md:flex md:flex-row md:items-center">
        <InfoItem
          icon={HomeIcon}
          value={data.clubName}
          href={`/clubs/${data.clubId}`}
        />
        <InfoItem icon={UserRound} value={t(`Types.${data.type}`)} />
        <InfoItem icon={Dices} value={data.format} format={true} />
        {data.format === 'swiss' && (
          <div className="flex items-center gap-2">
            <Layers className="text-muted-foreground size-4" />
            <span>{t('number of rounds')}</span>
            <SwissRoundsNumber />
          </div>
        )}
        <InfoItem
          icon={ChartNoAxesCombinedIcon}
          value={data.rated ? t('rated') : t('unrated')}
        />
        <InfoItem icon={CalendarDays} value={formattedDate} />
      </div>
    </>
  );
};

const TournamentInfoStat: FC<{
  icon: FC<{ className?: string }>;
  label: string;
  value: ReactNode;
  href?: string;
}> = ({ icon: Icon, label, value, href }) => (
  <div className="flex min-h-14 items-center gap-3 py-3">
    <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-sm">
      <Icon className="text-muted-foreground size-5" />
    </div>
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="text-muted-foreground text-xs leading-none">
        {label}
      </span>
      {href ? (
        <Link href={href} className="mk-link truncate text-sm font-medium">
          {value}
        </Link>
      ) : (
        <div className="truncate text-sm font-medium">{value}</div>
      )}
    </div>
  </div>
);

export default memo(TournamentInfoList);
