import { LoadingSpinner } from '@/app/loading';
import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import { DrawerProps } from '@/app/tournaments/[id]/dashboard/tabs/table/add-player';
import { useTournamentAddNewPlayer } from '@/components/hooks/mutation-hooks/use-tournament-add-new-player';
import { useTournamentInfo } from '@/components/hooks/query-hooks/use-tournament-info';
import { useTRPC } from '@/components/trpc/client';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { newid } from '@/lib/utils';
import { PlayerFormModel, playerFormSchema } from '@/server/zod/players';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useContext, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useHotkeys } from 'react-hotkeys-hook';
import { toast } from 'sonner';

const AddNewPlayer = ({
  value,
  setValue,
  returnToNewPlayer,
  handleClose,
}: AddNewPlayerProps) => {
  const { id } = useParams<{ id: string }>();
  const tournament = useTournamentInfo(id);
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const { sendJsonMessage } = useContext(DashboardContext);
  const { mutate } = useTournamentAddNewPlayer(
    id,
    queryClient,
    sendJsonMessage,
    returnToNewPlayer,
  );
  const t = useTranslations('Tournament.AddPlayer');
  useHotkeys('escape', handleClose, { enableOnFormTags: true });

  const form = useForm<PlayerFormModel>({
    resolver: zodResolver(playerFormSchema),
    defaultValues: {
      nickname: value,
      rating: 1500,
      clubId: tournament.data?.club?.id,
    },
    reValidateMode: 'onSubmit',
  });

  const nickname = form.getValues('nickname');

  useEffect(() => {
    setValue(nickname);
  }, [nickname, setValue]);

  async function onSubmit(player: PlayerFormModel) {
    const validation = await queryClient.fetchQuery(
      trpc.auth.validatePlayerNickname.queryOptions({
        nickname: player.nickname,
        clubId: player.clubId,
      }),
    );
    if (!validation.valid) {
      form.setError('nickname', {
        type: 'manual',
        message: t('player exists error'),
      });
      return;
    }
    const playerWithId = { ...player, id: newid() };
    setValue('');
    form.reset();
    form.setFocus('nickname');
    mutate(
      { tournamentId: id, player: playerWithId },
      {
        onError: () => {
          form.reset(player);
          form.setFocus('nickname');
        },
        onSuccess: () => {
          toast.success(t('player added', { name: player.nickname }));
        },
      },
    );
  }
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="h-svh space-y-8">
        <FormField
          control={form.control}
          name="nickname"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  className="drop-shadow-md"
                  placeholder={t('name')}
                  {...field}
                  autoComplete="off"
                  autoFocus
                  onKeyUp={() => {
                    form.clearErrors();
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="rating"
          render={({ field: { value, onChange } }) => (
            <FormItem>
              <legend>
                {t('estimated rating')}: {value}
              </legend>
              <FormControl>
                <Slider
                  data-vaul-no-drag
                  step={50}
                  min={0}
                  max={3000}
                  className="w-full"
                  value={[value ?? 1500]}
                  onValueChange={(vals) => {
                    onChange(vals[0]);
                  }}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <Button
          type="submit"
          className="w-full"
          disabled={form.formState.isSubmitting || form.formState.isValidating}
        >
          {form.formState.isSubmitting || form.formState.isValidating ? (
            <>
              <LoadingSpinner />
              {t('save')}
            </>
          ) : (
            <>
              <Save />
              {t('save')}
            </>
          )}
        </Button>
      </form>
    </Form>
  );
};

interface AddNewPlayerProps extends DrawerProps {
  returnToNewPlayer: (_player: PlayerFormModel & { id?: string }) => void;
  handleClose: () => void;
}

export default AddNewPlayer;
