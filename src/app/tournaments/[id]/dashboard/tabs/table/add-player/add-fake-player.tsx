import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import { useTournamentAddNewPlayer } from '@/components/hooks/mutation-hooks/use-tournament-add-new-player';
import { useTournamentInfo } from '@/components/hooks/query-hooks/use-tournament-info';
import { Button } from '@/components/ui/button';
import { newid } from '@/lib/utils';
import { PlayerFormModel } from '@/server/zod/players';
import { faker } from '@faker-js/faker';
import { useParams } from 'next/navigation';
import { FC, useContext } from 'react';

const AddFakerPlayer: FC<{ setOpen: (_arg: boolean) => void }> = ({
  setOpen,
}) => {
  const { id } = useParams<{ id: string }>();
  const tournament = useTournamentInfo(id);
  const returnToNewPlayer = () => null;
  const { userId } = useContext(DashboardContext);
  if (!userId) throw new Error('USERID_NOT_FOUND_IN_CONTEXT');
  const { mutate } = useTournamentAddNewPlayer(id, returnToNewPlayer);

  const nickname =
    // eslint-disable-next-line
    Math.round(Math.random()) > 0
      ? faker.internet.username()
      : faker.person.fullName();

  const player: PlayerFormModel & { id: string } = {
    id: newid(),
    nickname,
    realname: null,
    clubId: tournament.data?.club?.id || '',
    rating: faker.number.int({ min: 100, max: 3000 }),
    ratingDeviation: 350,
    ratingVolatility: faker.number.float({ min: 0.5, max: 1.2 }),
    ratingLastUpdateAt: new Date(),
  };

  const onClick = () => {
    setOpen(false);
    const addedAt = new Date();
    mutate({
      player,
      tournamentId: tournament.data?.tournament.id || '',
      addedAt,
    });
  };

  return (
    <Button onClick={onClick} variant="secondary">
      Add faker player (DEV)
    </Button>
  );
};

export default AddFakerPlayer;
