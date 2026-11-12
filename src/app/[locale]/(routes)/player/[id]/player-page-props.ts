import type { ClubModel } from '@/server/zod/clubs';
import type { PlayerModel } from '@/server/zod/players';
import type { ReactNode } from 'react';

export type PlayerPageDesignProps = {
  player: PlayerModel;
  club: Pick<ClubModel, 'id' | 'name'>;
  /** claim, edit and link buttons the viewer is allowed to use */
  actions: ReactNode;
};
