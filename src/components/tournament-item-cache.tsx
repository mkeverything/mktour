'use cache';

import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CACHE_TAGS } from '@/lib/cache-tags';
import { publicCaller } from '@/server/api';
import { ClubModel } from '@/server/db/zod/clubs';
import { TournamentModel } from '@/server/db/zod/tournaments';
import { Dot } from 'lucide-react';
import { cacheTag } from 'next/cache';
import Link from 'next/link';

const TournamentItemCache = ({ club, tournament }: Props) => {
  const { id, title } = tournament;
  const details = [0, 1, 2];

  const description = details.map((_, i) => {
    const separator = i !== details.length - 1 && <Dot className="inline" />;
    return (
      <span key={i} className="flex items-center">
        <Skeleton className="h-4 w-16" />
        {separator}
      </span>
    );
  });

  return (
    <Link key={id} href={`/tournaments/${id}`}>
      <Card className="mk-card mk-list-item flex flex-col">
        <CardTitle className="text-sm">{title}</CardTitle>
        {club && (
          <span className="text-muted-foreground text-xs">{club.name}</span>
        )}
        <CardDescription className="flex text-xs">
          {description}
        </CardDescription>
      </Card>
    </Link>
  );
};

const TournamentItemCacheIteratee = ({ club, tournament }: Props) => (
  <TournamentItemCache tournament={tournament} club={club} />
);

type Props = { tournament: TournamentModel; club?: ClubModel };

export default async function TournamentsAllCache() {
  const allTournaments = await publicCaller.tournament.all();
  cacheTag(CACHE_TAGS.ALL_TOURNAMENTS);

  return (
    <>
      {allTournaments.map((props) => (
        <TournamentItemCacheIteratee key={props.tournament.id} {...props} />
      ))}
    </>
  );
}
