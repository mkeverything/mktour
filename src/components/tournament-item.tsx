import { Card, CardTitle } from '@/components/ui/card';
import { getTournamentDisplayName } from '@/lib/tournament-display';
import { ClubModel } from '@/server/db/zod/clubs';
import { TournamentModel } from '@/server/db/zod/tournaments';
import { Dot } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';

const TournamentItem = ({ club, tournament }: Props) => {
  const { date, type, format, id } = tournament;
  const formatUtil = useFormatter();
  const t = useTranslations('MakeTournament');
  const tournamentDisplayName = getTournamentDisplayName(
    tournament,
    t,
    formatUtil,
  );
  const localizedDate = formatUtil.dateTime(new Date(date), {
    dateStyle: 'short',
  });
  const details = [
    tournament.rated ? t('rated') : t('unrated'),
    t(format),
    t(`Types.${type}`),
    localizedDate,
  ];

  const description = details.map((detail, i) => {
    const separator = i !== details.length - 1 && (
      <div className="relative inline max-h-4 w-4">
        <Dot className="absolute top-0 bottom-0 m-auto w-full" />
      </div>
    );
    return (
      <span key={i} className="flex items-center">
        {detail}
        {separator}
      </span>
    );
  });

  return (
    <Link key={id} href={`/tournaments/${id}`}>
      <Card className="mk-card flex flex-col">
        <CardTitle className="text-base">{tournamentDisplayName}</CardTitle>
        {club && (
          <span className="text-muted-foreground text-xs">{club.name}</span>
        )}
        <div className="text-muted-foreground flex text-xs">{description}</div>
      </Card>
    </Link>
  );
};

const TournamentItemIteratee = ({ club, tournament }: Props) => (
  <TournamentItem tournament={tournament} club={club} />
);

type Props = { tournament: TournamentModel; club?: ClubModel };

export default TournamentItemIteratee;
