import ClubCard from '@/app/clubs/club-card';
import { ClubModel } from '@/server/db/zod/clubs';
import { FC } from 'react';

const ClubsIteratee: FC<{ clubs: ClubModel[] }> = ({ clubs }) =>
  clubs.map((club) => <ClubCard key={club.id} club={club} />);

export default ClubsIteratee;
