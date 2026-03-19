import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import { DrawerProps } from '@/app/tournaments/[id]/dashboard/tabs/table/add-player';
import { useTournamentAddExistingPlayer } from '@/components/hooks/mutation-hooks/use-tournament-add-existing-player';
import { useTournamentPossiblePlayers } from '@/components/hooks/query-hooks/use-tournament-possible-players';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { PlayerWithUsernameModel } from '@/server/zod/players';
import { useQueryClient } from '@tanstack/react-query';
import { UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useContext } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { toast } from 'sonner';

const AddPlayer = ({
  value,
  setValue,
  handleClose,
  onPlayerSelected,
  excludePlayerIds,
}: DrawerProps & {
  onPlayerSelected?: (_player: PlayerWithUsernameModel) => void;
  excludePlayerIds?: string[];
}) => {
  const { id } = useParams<{ id: string }>();
  const possiblePlayers = useTournamentPossiblePlayers(id);
  const queryClient = useQueryClient();
  const { userId } = useContext(DashboardContext);
  const { mutate } = useTournamentAddExistingPlayer(id, queryClient);
  const t = useTranslations('Tournament.AddPlayer');
  const excludeSet = excludePlayerIds?.length
    ? new Set(excludePlayerIds)
    : null;
  const filteredPlayers =
    possiblePlayers.data?.filter((player) => {
      if (excludeSet?.has(player.id)) return false;
      if (!value) return true;

      const search = value.toLowerCase();

      return (
        player.nickname.toLowerCase().includes(search) ||
        player.username?.toLowerCase().includes(search)
      );
    }) ?? [];

  const handlePlayerSelect = (player: PlayerWithUsernameModel) => {
    setValue('');
    document.getElementById('possible-players-search')?.focus();

    if (onPlayerSelected) {
      onPlayerSelected(player);
      return;
    }

    if (!userId) {
      console.log('not found user id in context');
      return;
    }

    const addedAt = new Date();
    mutate({ tournamentId: id, player, userId, addedAt });
  };

  useHotkeys('escape', () => handleClose, { enableOnFormTags: true });
  useHotkeys(
    'enter',
    () => {
      if (!filteredPlayers || value === '' || filteredPlayers.length !== 1)
        return;
      handlePlayerSelect(filteredPlayers[0]);
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
      {filteredPlayers.length === 0 && (
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
                  handlePlayerSelect(player);
                }}
                className="p-0"
              >
                <TableCell>
                  <p className="line-clamp-2 break-all">{player.nickname}</p>{' '}
                  {player.username && (
                    <small className="text-2xs text-muted-foreground flex items-center gap-1">
                      <UserRound size={12} />
                      <span>{player.username}</span>
                    </small>
                  )}
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
