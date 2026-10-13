import PlayerStats from '@/components/ui-custom/player-stats';
import { PlayerModel } from '@/server/zod/players';

export default function PlayerStatsWrapper({
  player,
  clubName,
}: {
  clubName: string;
  player: Pick<PlayerModel, 'id' | 'nickname' | 'ratingPeak'>;
}) {
  return (
    <PlayerStats clubName={clubName} player={player} wrapper="half-card" />
  );
}
