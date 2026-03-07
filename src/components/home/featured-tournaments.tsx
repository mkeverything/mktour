'use client';

import FormattedMessage from '@/components/formatted-message';
import { usePublicFeaturedTournaments } from '@/components/hooks/query-hooks/use-public-featured-tournaments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { TournamentWithClubModel } from '@/server/zod/tournaments';
import { Trophy } from 'lucide-react';
import Link from 'next/link';
import { FC } from 'react';

const FeaturedTournaments: FC<{ limit?: number }> = ({ limit = 5 }) => {
  const { data: tournaments, isLoading } = usePublicFeaturedTournaments(limit);

  if (isLoading) {
    return null;
  }

  if (!tournaments?.length) {
    return null;
  }

  return (
    <Card className="max-sm:mx-mk">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="size-4" />
          <FormattedMessage id="Home.featured tournaments" />
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="flex flex-col">
          {tournaments.map((tournament, index) => (
            <li key={tournament.tournament.id}>
              {index > 0 && <Separator />}
              <TournamentLi {...tournament} />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};

const TournamentLi = ({ tournament, club }: TournamentWithClubModel) => {
  const title = tournament.title || tournament.format;

  return (
    <Link
      href={`/tournaments/${tournament.id}`}
      className="hover:bg-muted/50 -mx-2 flex items-center justify-between rounded-lg px-2 py-3 transition-colors"
    >
      <div className="flex flex-col">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-muted-foreground text-xs">{club.name}</span>
      </div>
      <span className="text-muted-foreground text-xs">{tournament.format}</span>
    </Link>
  );
};

export default FeaturedTournaments;
