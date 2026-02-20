import { useTRPC } from '@/components/trpc/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function useDeleteClubManagerMutation() {
  //   setOpen: Dispatch<SetStateAction<boolean>>,
  //   const t = useTranslations('Toasts');
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.club.managers.delete.mutationOptions({
      onMutate: ({ userId }) => {
        queryClient.cancelQueries({
          queryKey: trpc.club.managers.all.queryKey(),
        });
        const previousState = queryClient.getQueryData(
          trpc.club.managers.all.queryKey(),
        );
        queryClient.setQueryData(
          trpc.club.managers.all.queryKey(),
          (cache) =>
            cache && cache.filter((manager) => manager.user.id !== userId),
        );
        return { previousState };
      },
      onSuccess: () => {
        toast.success('club manager deleted');
        if (
          queryClient.isMutating({
            mutationKey: trpc.club.managers.delete.mutationKey(),
          }) === 1
        ) {
          queryClient.invalidateQueries({
            queryKey: trpc.club.managers.all.queryKey(),
          });
        }
        // setOpen(false);
      },
      onError: (error, _, context) => {
        queryClient.setQueryData(
          trpc.club.managers.all.queryKey(),
          context?.previousState,
        );
        toast.error('sorry! server error happened', { id: 'serverError' });
        console.error(error);
      },
    }),
  );
}
