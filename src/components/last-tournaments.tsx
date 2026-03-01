import FormattedMessage from '@/components/formatted-message';
import { useTournamentFallbackTitle } from '@/components/hooks/use-tournament-fallback-title';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { PlayerToTournamentModel } from '@/server/zod/tournaments';
import { ChevronRight, Trophy } from 'lucide-react';
import Link from 'next/link';
import { FC } from 'react';

const LastTournaments: FC<{ tournaments: PlayerToTournamentModel[] }> = ({
  tournaments,
}) => {
  if (!tournaments || tournaments.length === 0) return null;

  return (
    <Card className="max-sm:mx-mk">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="size-4" />
          <FormattedMessage id="Player.last tournaments" />
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="flex flex-col">
          {tournaments.map((tournament, index) => (
            <li key={tournament?.tournament?.id}>
              {index > 0 && <Separator />}
              <TournamentLi {...tournament} />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};

const TournamentLi = ({ tournament }: PlayerToTournamentModel) => {
  const fallbackTitle = useTournamentFallbackTitle(tournament);
  const title = tournament.title || fallbackTitle;

  return (
    <Link
      href={`/tournaments/${tournament?.id}`}
      className="hover:bg-muted/50 -mx-2 flex items-center justify-between rounded-lg px-2 py-3 transition-colors"
    >
      <span className="text-sm font-medium">{title}</span>
      <ChevronRight className="text-muted-foreground size-4" />
    </Link>
  );
};

export default LastTournaments;
