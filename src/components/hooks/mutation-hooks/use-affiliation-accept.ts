import { useTRPC } from '@/components/trpc/client';
import { AnyClubNotificationExtended } from '@/types/notifications';
import { QueryClient, useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

export default function useAffiliationAcceptByClubMutation({
  queryClient,
}: {
  queryClient: QueryClient;
}) {
  const t = useTranslations('Toasts');
  const trpc = useTRPC();
  return useMutation(
    trpc.player.affiliation.acceptByClub.mutationOptions({
      onMutate: async ({ clubId, notificationId }) => {
        await queryClient.cancelQueries({
          queryKey: trpc.club.notifications.all.infiniteQueryKey({ clubId }),
        });

        const prevCache = queryClient.getQueryData(
          trpc.club.notifications.all.infiniteQueryKey({ clubId }),
        );

        queryClient.setQueryData(
          trpc.club.notifications.all.infiniteQueryKey({ clubId }),
          (cache) => {
            if (!cache) return cache;

            return {
              ...cache,
              pages: cache.pages.map((page) => ({
                ...page,
                notifications: page.notifications.map((item) =>
                  item.id === notificationId
                    ? ({
                        ...item,
                        event: 'affiliation_request_approved',
                        isSeen: true,
                      } as AnyClubNotificationExtended)
                    : item,
                ),
              })),
            };
          },
        );

        return { prevCache };
      },
      onError: (_err, { clubId }, context) => {
        toast.error(t('server error'));
        if (context?.prevCache) {
          queryClient.setQueryData(
            trpc.club.notifications.all.infiniteQueryKey({ clubId }),
            context.prevCache,
          );
        }
      },
      onSettled: (_, __, { clubId }) => {
        if (
          queryClient.isMutating({
            mutationKey: trpc.player.affiliation.acceptByClub.mutationKey(),
          }) === 1
        ) {
          queryClient.invalidateQueries({
            queryKey: trpc.club.notifications.all.infiniteQueryKey({ clubId }),
          });
        }
      },
    }),
  );
}
