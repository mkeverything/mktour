import { DashboardContext } from '@/app/[locale]/(routes)/tournaments/[id]/dashboard/dashboard-context';
import { useTournamentAddNewPlayer } from '@/components/hooks/mutation-hooks/tournament-pre-start-hooks/use-tournament-add-new-player';
import { useTournamentInfo } from '@/components/hooks/query-hooks/use-tournament-info';
import { Button } from '@/components/ui/button';
import { AppError } from '@/lib/errors';
import { GLICKO2_CONSTANTS } from '@/lib/glicko2';
import { newid } from '@/lib/utils';
import { PlayerFormModel } from '@/server/zod/players';
import { faker } from '@faker-js/faker';
import { useParams } from 'next/navigation';
import { FC, useContext } from 'react';

const AddFakerPlayer: FC = () => {
  const { id } = useParams<{ id: string }>();
  const tournament = useTournamentInfo(id);
  const returnToNewPlayer = () => null;
  const { userId } = useContext(DashboardContext);
  if (!userId) throw new AppError('USERID_NOT_FOUND_IN_CONTEXT');
  const { mutate } = useTournamentAddNewPlayer(id, returnToNewPlayer);

  const onClick = () => {
    const player: PlayerFormModel & { id: string } = {
      id: newid(),
      nickname:
        Math.round(Math.random()) > 0
          ? faker.internet.username()
          : faker.person.fullName(),
      realname: null,
      clubId: tournament.data?.club?.id || '',
      rating: faker.number.int({
        min: GLICKO2_CONSTANTS.MIN_STARTING_RATING,
        max: GLICKO2_CONSTANTS.MAX_STARTING_RATING,
      }),
    };
    mutate({
      player,
      tournamentId: tournament.data?.tournament.id || '',
      addedAt: new Date(),
    });
  };

  return (
    <Button onClick={onClick} variant="secondary">
      Add faker player (DEV)
    </Button>
  );
};

export default AddFakerPlayer;
