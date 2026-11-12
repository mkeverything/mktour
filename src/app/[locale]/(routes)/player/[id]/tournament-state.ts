import type { TournamentModel } from '@/server/zod/tournaments';

export const getTournamentState = ({
  startedAt,
  closedAt,
}: Pick<TournamentModel, 'startedAt' | 'closedAt'>) =>
  closedAt ? 'finished' : startedAt ? 'live' : 'upcoming';
