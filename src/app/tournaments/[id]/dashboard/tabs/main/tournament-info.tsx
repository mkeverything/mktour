import {
  InfoItem,
  LoadingElement,
} from '@/app/tournaments/[id]/dashboard/tabs/main';
import Winners from '@/app/tournaments/[id]/dashboard/tabs/main/winners';
import { useTournamentSummaryInfo } from '@/components/hooks/query-hooks/use-tournament-info';
import { useIntlError } from '@/components/hooks/use-intl-error';
import SwissRoundsNumber from '@/components/swiss-rounds-number';
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
import { FC, memo } from 'react';
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
      <div className="p-mk pt-mk-2 pb-mk-2 gap-mk-2 flex flex-col md:hidden">
        <div className="gap-mk-2 flex flex-col text-sm">
          <span className="flex items-center gap-2">
            <HomeIcon className="text-muted-foreground size-4 shrink-0" />
            <Link
              href={`/clubs/${data.clubId}`}
              className="mk-link truncate font-medium"
            >
              {data.clubName}
            </Link>
          </span>
          <span className="text-muted-foreground flex items-center gap-2">
            <CalendarDays className="size-4 shrink-0" />
            {formattedDate}
          </span>
        </div>
        <div className="gap-mk flex flex-wrap">
          <MetaChip icon={Dices} label={t(String(data.format))} />
          <MetaChip icon={UserRound} label={t(`Types.${data.type}`)} />
          <MetaChip
            icon={ChartNoAxesCombinedIcon}
            label={data.rated ? t('rated') : t('unrated')}
          />
        </div>
        {data.format === 'swiss' && (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Layers className="size-4 shrink-0" />
            <span>{t('number of rounds')}</span>
            <SwissRoundsNumber className="text-foreground text-sm font-medium" />
          </div>
        )}
      </div>
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

const MetaChip: FC<{
  icon: FC<{ className?: string }>;
  label: string;
}> = ({ icon: Icon, label }) => (
  <span className="bg-muted text-muted-foreground flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium">
    <Icon className="size-3.5" />
    {label}
  </span>
);

export default memo(TournamentInfoList);
