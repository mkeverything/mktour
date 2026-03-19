import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import AddPairTeam, {
  type PairTeamInitialValues,
} from '@/app/tournaments/[id]/dashboard/tabs/table/add-player/add-pair-team';
import PairPlayerCard from '@/app/tournaments/[id]/dashboard/tabs/table/add-player/pair-player-card';
import {
  DeleteButton,
  WithdrawButtonWithConfirmation,
} from '@/app/tournaments/[id]/dashboard/tabs/table/destructive-buttons';
import FormattedMessage from '@/components/formatted-message';
import { useTournamentEditPairTeam } from '@/components/hooks/mutation-hooks/use-tournament-edit-pair-team';
import {
  Close,
  Content,
  Description,
  Header,
  Root,
  Title,
} from '@/components/ui-custom/combo-modal';
import SideDrawer from '@/components/ui-custom/side-drawer';
import { Button } from '@/components/ui/button';
import { PlayerTournamentModel } from '@/server/zod/players';
import { TournamentFormat } from '@/server/zod/enums';
import { Pencil, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FC, useContext, useState } from 'react';

const PlayerDrawer: FC<{
  player: PlayerTournamentModel;
  setSelectedPlayer: (_arg: null) => void;
  handleDelete: () => void;
  handleWithdraw: () => void;
  hasEnded: boolean;
  hasStarted: boolean;
  format: TournamentFormat;
}> = ({
  player,
  setSelectedPlayer,
  hasEnded,
  hasStarted,
  handleDelete,
  handleWithdraw,
  format,
}) => {
  const open = !!player;
  const { status, sendJsonMessage } = useContext(DashboardContext);
  const t = useTranslations('Tournament.AddPlayer');
  const { id: tournamentId } = useParams<{ id: string }>();
  const editPairTeam = useTournamentEditPairTeam(tournamentId, sendJsonMessage);
  const isDoublesTeam = (player.pairPlayers?.length ?? 0) > 0;
  const [isEditingTeam, setIsEditingTeam] = useState(false);

  const closeDrawer = () => setSelectedPlayer(null);
  const comboOpen = open && !isEditingTeam;
  const pairPlayers = player.pairPlayers ?? [];
  const canEditTeam =
    status === 'organizer' && !hasStarted && !hasEnded && isDoublesTeam;
  const editInitialValues: PairTeamInitialValues | null =
    pairPlayers.length === 2
      ? {
          nickname: player.teamNickname ?? player.nickname,
          firstPlayer: pairPlayers[0],
          secondPlayer: pairPlayers[1],
        }
      : null;

  return (
    <Root
      open={comboOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isEditingTeam) closeDrawer();
      }}
    >
      <Content>
        <Header>
          <div className="flex items-center justify-start gap-4">
            <Title className="flex items-baseline gap-2">
              {player.nickname}
              {!isDoublesTeam && player.rating != null && (
                <span className="text-muted-foreground text-sm font-normal">
                  {player.rating}
                </span>
              )}
            </Title>
            {canEditTeam && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setIsEditingTeam(true)}
              >
                <Pencil className="size-4" />
              </Button>
            )}
          </div>
          <Description>{player?.username}</Description>
        </Header>
        <>
          {isDoublesTeam ? (
            <>
              <div className="space-y-2">
                {pairPlayers.map((pairPlayer, index) => (
                  <PairPlayerCard
                    key={pairPlayer.id}
                    player={pairPlayer}
                    label={index === 0 ? '#1' : '#2'}
                    href={`/player/${pairPlayer.id}`}
                  />
                ))}
              </div>
            </>
          ) : (
            <Button className="flex w-full gap-2" size="lg" asChild>
              <Link
                href={
                  player.username
                    ? `/user/${player.username}`
                    : `/player/${player.id}`
                }
              >
                <UserRound />
                <FormattedMessage id="Tournament.Table.Player.profile" />
              </Link>
            </Button>
          )}

          {status === 'organizer' && (
            <DestructiveButton
              hasEnded={hasEnded}
              hasStarted={hasStarted}
              player={player}
              format={format}
              handleDelete={handleDelete}
              handleWithdraw={handleWithdraw}
              closeDrawer={closeDrawer}
            />
          )}

          <Close asChild>
            <Button size="lg" variant="outline">
              <FormattedMessage id="Common.close" />
            </Button>
          </Close>
        </>
      </Content>

      {canEditTeam && editInitialValues && (
        <SideDrawer
          open={isEditingTeam}
          setOpen={(nextOpen) => {
            setIsEditingTeam(nextOpen);
            if (!nextOpen) {
              closeDrawer();
            }
          }}
        >
          <AddPairTeam
            handleClose={() => setIsEditingTeam(false)}
            initialValues={editInitialValues}
            submitLabel={t('save')}
            isSubmitting={editPairTeam.isPending}
            onSubmitValues={(values) => {
              setIsEditingTeam(false);
              closeDrawer();
              editPairTeam.mutate({
                tournamentId,
                currentTeamPlayerId: player.id,
                ...values,
              });
            }}
          />
        </SideDrawer>
      )}
    </Root>
  );
};

const DestructiveButton = ({
  hasEnded,
  hasStarted,
  handleDelete,
  handleWithdraw,
  closeDrawer,
  player,
  format,
}: {
  hasEnded: boolean;
  hasStarted: boolean;
  handleDelete: () => void;
  handleWithdraw: () => void;
  closeDrawer: () => void;
  player: PlayerTournamentModel;
  format: TournamentFormat;
}) => {
  if (hasEnded) return null;
  if (hasStarted && format === 'swiss' && !player.isOut) {
    return (
      <WithdrawButtonWithConfirmation
        selectedPlayer={player}
        handleWithdraw={() => {
          closeDrawer();
          handleWithdraw();
        }}
      />
    );
  }
  if (hasStarted) return null;
  return (
    <DeleteButton
      handleDelete={() => {
        closeDrawer();
        handleDelete();
      }}
    />
  );
};

export default PlayerDrawer;
