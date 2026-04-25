import {
  InfoItem,
  LoadingElement,
} from '@/app/tournaments/[id]/dashboard/tabs/main';
import Winners from '@/app/tournaments/[id]/dashboard/tabs/main/winners';
import { useTournamentSummaryInfo } from '@/components/hooks/query-hooks/use-tournament-info';
import SwissRoundsNumber from '@/components/swiss-rounds-number';
import {
  CalendarDays,
  ChartNoAxesCombinedIcon,
  Dices,
  HomeIcon,
  Layers,
  UserRound,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { memo } from 'react';
import { toast } from 'sonner';

const TournamentInfoList = () => {
  const { id: tournamentId } = useParams<{ id: string }>();
  const { data, isLoading, isError } = useTournamentSummaryInfo(tournamentId);
  const t = useTranslations('Tournament.Main');
  const locale = useLocale();

  if (isLoading) return <LoadingElement />;
  if (isError) {
    toast.error("couldn't get tournament info from server", {
      id: 'query-info',
      duration: 3000,
    });
    return <LoadingElement />;
  }
  if (!data) return 'tournament info is `undefined` somehow';

  const dateArr = data.date.split('-');
  const formattedDate = new Date(
    Number(dateArr[0]),
    Number(dateArr[1]) - 1, // month is 0-indexed 2025-01-01 is (2025, 0, 1) = first of january
    Number(dateArr[2]),
  ).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'long',
  });
  const decapitalizedWeekday =
    formattedDate.charAt(0).toLowerCase() + formattedDate.slice(1);

  return (
    <div className="md:text-muted-foreground gap-y-mk gap-x-mk-2 p-mk flex flex-col flex-wrap text-xs md:flex-row md:items-center">
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
      <InfoItem icon={CalendarDays} value={decapitalizedWeekday} />
      <Winners tournamentId={data.tournamentId} closedAt={data.closedAt} />
    </div>
  );
};

export default memo(TournamentInfoList);
