import PlayerStats from '@/components/ui-custom/player-stats';
import { PlayerModel } from '@/server/db/zod/players';

export default function PlayerStatsWrapper({
  player,
}: {
  player: Pick<PlayerModel, 'id' | 'nickname' | 'ratingPeak'>;
}) {
  return <PlayerStats player={player} wrapper="half-card" />;
}
