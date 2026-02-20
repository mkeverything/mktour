import { useTRPC } from '@/components/trpc/client';
import {
  AnyClubNotificationExtended,
  AnyUserNotificationExtended,
} from '@/types/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export const useChangeNotificationStatusMutation = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.auth.notifications.changeStatus.mutationOptions({
      onMutate: async ({ notificationId, seen }) => {
        await queryClient.cancelQueries({
          queryKey: trpc.auth.notifications.infinite.infiniteQueryKey({}),
        });

        const prevCache = queryClient.getQueryData(
          trpc.auth.notifications.infinite.infiniteQueryKey({}),
        );

        const counterPrevCache = queryClient.getQueryData(
          trpc.auth.notifications.counter.queryKey(),
        );

        queryClient.setQueryData(
          trpc.auth.notifications.infinite.infiniteQueryKey({}),
          (cache) => {
            if (!cache) return cache;

            return {
              ...cache,
              pages: cache.pages.map((page) => ({
                ...page,
                notifications: page.notifications.map((item) => {
                  if (item.notification.id === notificationId) {
                    return {
                      ...item,
                      notification: {
                        ...item.notification,
                        isSeen: seen,
                      },
                    };
                  }
                  return item;
                }) as AnyUserNotificationExtended[],
              })),
            };
          },
        );

        queryClient.setQueryData(
          trpc.auth.notifications.counter.queryKey(),
          (cache) => {
            if (cache === undefined) return cache;
            return seen ? cache - 1 : cache + 1;
          },
        );

        return { prevCache, counterPrevCache };
      },
      onError: (_err, _variables, context) => {
        if (context?.prevCache) {
          queryClient.setQueryData(
            trpc.auth.notifications.infinite.infiniteQueryKey({}),
            context.prevCache,
          );
        }

        if (context?.counterPrevCache !== undefined) {
          queryClient.setQueryData(
            trpc.auth.notifications.counter.queryKey(),
            context.counterPrevCache,
          );
        }
      },
      onSettled: () => {
        if (
          queryClient.isMutating({
            mutationKey: trpc.auth.notifications.pathKey(),
          }) === 1
        ) {
          queryClient.invalidateQueries({
            queryKey: trpc.auth.notifications.pathKey(),
          });
        }
      },
    }),
  );
};

export const useMarkAllNotificationAsSeenMutation = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.auth.notifications.markAllAsSeen.mutationOptions({
      onMutate: async () => {
        await queryClient.cancelQueries({
          queryKey: trpc.auth.notifications.pathKey(),
        });

        const prevCache = queryClient.getQueryData(
          trpc.auth.notifications.infinite.infiniteQueryKey({}),
        );

        const counterPrevCache = queryClient.getQueryData(
          trpc.auth.notifications.counter.queryKey(),
        );

        queryClient.setQueryData(
          trpc.auth.notifications.infinite.infiniteQueryKey({}),
          (cache) => {
            if (!cache) return cache;

            return {
              ...cache,
              pages: cache.pages.map((page) => ({
                ...page,
                notifications: page.notifications.map((item) => ({
                  ...item,
                  notification: {
                    ...item.notification,
                    isSeen: true,
                  },
                })) as typeof page.notifications,
              })),
            };
          },
        );

        queryClient.setQueryData(
          trpc.auth.notifications.counter.queryKey(),
          (cache) => {
            if (cache === undefined) return cache;
            return 0;
          },
        );

        return { prevCache, counterPrevCache };
      },
      onError: (_err, _variables, context) => {
        if (context?.prevCache) {
          queryClient.setQueryData(
            trpc.auth.notifications.infinite.infiniteQueryKey({}),
            context.prevCache,
          );
        }
        if (context?.counterPrevCache !== undefined) {
          queryClient.setQueryData(
            trpc.auth.notifications.counter.queryKey(),
            context.counterPrevCache,
          );
        }
      },
      onSuccess: () => {
        if (
          queryClient.isMutating({
            mutationKey: trpc.auth.notifications.markAllAsSeen.mutationKey(),
          }) === 1
        ) {
          queryClient.invalidateQueries({
            queryKey: trpc.auth.notifications.pathKey(),
          });
        }
      },
    }),
  );
};

export const useChangeClubNotificationStatusMutation = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.club.notifications.toggleSeen.mutationOptions({
      onMutate: async ({ notificationId, isSeen, clubId }) => {
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
                notifications: page.notifications.map((item) => {
                  if (item.id === notificationId) {
                    return {
                      ...item,
                      isSeen,
                    };
                  }
                  return item;
                }) as AnyClubNotificationExtended[],
              })),
            };
          },
        );

        return { prevCache };
      },
      onError: (_err, { clubId }, context) => {
        if (context?.prevCache) {
          queryClient.setQueryData(
            trpc.club.notifications.all.infiniteQueryKey({ clubId }),
            context.prevCache,
          );
        }
      },
      onSettled: () => {
        if (
          queryClient.isMutating({
            mutationKey: trpc.club.notifications.toggleSeen.mutationKey(),
          }) === 1
        ) {
          queryClient.invalidateQueries({
            queryKey: trpc.club.notifications.pathKey(),
          });
        }
      },
    }),
  );
};
