import FinishTournamentButton from '@/app/tournaments/[id]/dashboard/finish-tournament-button';
import DeleteTournamentButton from '@/app/tournaments/[id]/dashboard/tabs/main/delete-tournament-button';
import ResetTournamentPButton from '@/app/tournaments/[id]/dashboard/tabs/main/reset-players-button';
import ResetTournamentButton from '@/app/tournaments/[id]/dashboard/tabs/main/reset-tournament-button';
import StartTournamentButton from '@/app/tournaments/[id]/dashboard/tabs/main/start-tournament-button';
import { TournamentModel } from '@/server/db/zod/tournaments';
import { TournamentAuthStatus } from '@/server/db/zod/enums';
import { FC } from 'react';

const ActionButtonsRoot: FC<{
  status: TournamentAuthStatus;
  tournament: TournamentModel;
}> = ({ status, tournament }) => {
  if (status !== 'organizer') return null;

  const { closedAt, roundsNumber, ongoingRound, startedAt } = tournament;

  if (closedAt) {
    return (
      <>
        <ResetTournamentButton />
        <DeleteTournamentButton />
      </>
    );
  }

  if (startedAt && roundsNumber === ongoingRound) {
    return (
      <>
        <FinishTournamentButton lastRoundNumber={roundsNumber} />
        <ResetTournamentButton />
      </>
    );
  }

  if (startedAt) return <ResetTournamentButton />;

  return (
    <>
      <StartTournamentButton />
      <DeleteTournamentButton />
      <ResetTournamentPButton />
    </>
  );
};

const ActionButtons: FC<{
  status: TournamentAuthStatus;
  tournament: TournamentModel;
}> = (props) => (
  <div className="flex flex-col gap-2 p-2 max-md:w-full md:max-w-md md:flex-row md:items-center">
    <ActionButtonsRoot {...props} />
  </div>
);

export default ActionButtons;
