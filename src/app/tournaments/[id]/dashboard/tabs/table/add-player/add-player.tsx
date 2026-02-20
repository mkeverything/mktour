import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import { DrawerProps } from '@/app/tournaments/[id]/dashboard/tabs/table/add-player';
import { useTournamentAddExistingPlayer } from '@/components/hooks/mutation-hooks/use-tournament-add-existing-player';
import { useTournamentPossiblePlayers } from '@/components/hooks/query-hooks/use-tournament-possible-players';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { PlayerModel } from '@/server/db/zod/players';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useContext } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { toast } from 'sonner';

const AddPlayer = ({ value, setValue, handleClose }: DrawerProps) => {
  const { id } = useParams<{ id: string }>();
  const possiblePlayers = useTournamentPossiblePlayers(id);
  const queryClient = useQueryClient();
  const { sendJsonMessage, userId } = useContext(DashboardContext);
  const { mutate } = useTournamentAddExistingPlayer(
    id,
    queryClient,
    sendJsonMessage,
  );
  const t = useTranslations('Tournament.AddPlayer');
  const filteredPlayers =
    possiblePlayers.data?.filter((player: PlayerModel) => {
      const regex = new RegExp(value, 'i');
      if (value === '') return player;
      return regex.test(player.nickname);
    }) ?? [];

  useHotkeys('escape', () => handleClose, { enableOnFormTags: true });
  useHotkeys(
    'enter',
    () => {
      if (
        !filteredPlayers ||
        value === '' ||
        filteredPlayers.length !== 1 ||
        !userId
      )
        return;
      setValue('');
      document.getElementById('possible-players-search')?.focus();
      mutate({ tournamentId: id, player: filteredPlayers[0], userId });
    },
    { enableOnFormTags: true },
  );

  if (possiblePlayers.status === 'pending')
    return (
      <div className="flex flex-col gap-3">
        <Input
          id="possible-players-search"
          value={value}
          placeholder={t('search')}
          onChange={(e) => setValue(e.target.value)}
        />
        <Skeleton className="h-svh w-full pt-8" />
      </div>
    );
  if (possiblePlayers.status === 'error') {
    toast.error(t('possible players error'), {
      id: 'query-possible-players',
      duration: 3000,
    });
    return (
      <div className="flex flex-col gap-3">
        <Input
          id="possible-players-search"
          value={value}
          placeholder={t('search')}
          onChange={(e) => setValue(e.target.value)}
        />
        <Skeleton className="h-svh w-full pt-8" />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <Input
        className="drop-shadow-md"
        id="possible-players-search"
        value={value}
        placeholder={t('search')}
        onChange={(e) => setValue(e.target.value)}
      />
      {possiblePlayers.data?.length === 0 && (
        <p className="text-muted-foreground px-8 pt-8 text-center text-sm text-balance">
          {t('no players')}
        </p>
      )}
      <ScrollArea className="rounded-2 h-[calc(100dvh-6rem)] w-full rounded-b-md">
        <Table>
          <TableBody>
            {filteredPlayers?.map((player) => (
              <TableRow
                key={player.id}
                onClick={() => {
                  if (!userId) {
                    console.log('not found user id in context');
                    return;
                  }
                  setValue('');
                  document.getElementById('possible-players-search')?.focus();
                  mutate({ tournamentId: id, player, userId });
                }}
                className="p-0"
              >
                <TableCell>
                  <p className="line-clamp-2 break-all">{player.nickname}</p>{' '}
                  {/* FIXME This wraps real names badly */}
                </TableCell>
                <TableCell>{player.rating}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="h-24 w-full grow" />
      </ScrollArea>
    </div>
  );
};

export default AddPlayer;
