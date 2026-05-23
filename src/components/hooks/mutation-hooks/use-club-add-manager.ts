import { useGlobalWebSocketContext } from '@/components/providers/websocket-provider';
import { getAppErrorCode } from '@/lib/errors';
import { useTRPC } from '@/components/trpc/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

export const useClubAddManagerMutation = ({
  onSuccess,
}: {
  onSuccess: () => void;
}) => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const { sendJsonMessage } = useGlobalWebSocketContext();
  const tErrors = useTranslations('Errors');
  return useMutation(
    trpc.club.managers.add.mutationOptions({
      onSuccess: (_data, { userId }) => {
        toast.success('manager added');
        queryClient.invalidateQueries({
          queryKey: trpc.club.managers.all.queryKey(),
        });
        sendJsonMessage({
          type: 'user',
          event: 'became_club_manager',
          recipientId: userId,
        });
        onSuccess();
      },
      onError: (error) => toast.error(tErrors(getAppErrorCode(error))),
    }),
  );
};
