import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import {
  DeleteButton,
  WithdrawButtonWithConfirmation,
} from '@/app/tournaments/[id]/dashboard/tabs/table/destructive-buttons';
import FormattedMessage from '@/components/formatted-message';
import {
  Close,
  Content,
  Description,
  Header,
  Root,
  Title,
} from '@/components/ui-custom/combo-modal';
import { Button } from '@/components/ui/button';
import { PlayerTournamentModel } from '@/server/db/zod/players';
import { UserRound } from 'lucide-react';
import Link from 'next/link';
import { Dispatch, FC, SetStateAction, useContext } from 'react';

const PlayerDrawer: FC<{
  player: PlayerTournamentModel | null;
  setSelectedPlayer: (_arg: null) => void;
  handleDelete: () => void;
  hasEnded: boolean;
  hasStarted: boolean;
}> = ({ player, setSelectedPlayer, hasEnded, hasStarted, handleDelete }) => {
  const open = !!player;
  const { status } = useContext(DashboardContext);

  return (
    <Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setSelectedPlayer(null);
      }}
    >
      <Content>
        <Header>
          <Title>{player?.nickname}</Title>
          <Description hidden />
        </Header>

        {player && (
          <>
            <Button className="flex w-full gap-2" size="lg" asChild>
              <Link href={`/player/${player.id}`}>
                <UserRound />
                <FormattedMessage id="Tournament.Table.Player.profile" />
              </Link>
            </Button>

            {status === 'organizer' && (
              <DestructiveButton
                hasEnded={hasEnded}
                hasStarted={hasStarted}
                player={player}
                handleDelete={handleDelete}
                setOpen={() => setSelectedPlayer(null)}
              />
            )}

            <Close asChild>
              <Button size="lg" variant="outline">
                <FormattedMessage id="Common.close" />
              </Button>
            </Close>
          </>
        )}
      </Content>
    </Root>
  );
};

const DestructiveButton = ({
  hasEnded,
  hasStarted,
  player,
  handleDelete,
  setOpen,
}: {
  hasEnded: boolean;
  hasStarted: boolean;
  player: PlayerTournamentModel;
  handleDelete: () => void;
  setOpen: Dispatch<SetStateAction<boolean>>;
}) => {
  if (hasEnded) return null;
  // prettier-ignore
  return hasStarted 
      ? <WithdrawButtonWithConfirmation selectedPlayer={player} />
      : <DeleteButton handleDelete={() => { setOpen(false); handleDelete() }} />;
};

export default PlayerDrawer;
