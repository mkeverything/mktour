'use client';
// ws-handler

import { useTRPC } from '@/components/trpc/client';
import { PlayerModel, PlayerTournamentModel } from '@/server/db/zod/players';
import type { DashboardMessage } from '@/types/tournament-ws-events';
import { QueryClient } from '@tanstack/react-query';
import { Dispatch, SetStateAction } from 'react';
import { toast } from 'sonner';

export const handleSocketMessage = (
  message: DashboardMessage,
  queryClient: QueryClient,
  tournamentId: string,
  errorMessage: string,
  setRoundInView: Dispatch<SetStateAction<number>>,
  trpc: ReturnType<typeof useTRPC>,
) => {
  switch (message.event) {
    case 'add-new-player':
      queryClient.cancelQueries({
        queryKey: trpc.tournament.playersIn.queryKey({ tournamentId }),
      });
      queryClient.setQueryData(
        trpc.tournament.playersIn.queryKey({ tournamentId }),
        (cache) => {
          if (cache) return cache.concat(message.body);
        },
      );
      queryClient.invalidateQueries({
        queryKey: trpc.tournament.playersIn.queryKey({ tournamentId }),
      });
      break;
    case 'add-existing-player':
      queryClient.cancelQueries({
        queryKey: trpc.tournament.playersIn.queryKey({ tournamentId }),
      });
      queryClient.cancelQueries({
        queryKey: trpc.tournament.playersOut.queryKey({ tournamentId }),
      });
      queryClient.setQueryData(
        trpc.tournament.playersIn.queryKey({ tournamentId }),
        (cache) => {
          if (cache) return cache.concat(message.body);
        },
      );
      queryClient.setQueryData(
        trpc.tournament.playersOut.queryKey({ tournamentId }),
        (cache) => {
          if (cache) return cache.filter((pl) => pl.id !== message.body.id);
        },
      );
      queryClient.invalidateQueries({
        queryKey: trpc.tournament.playersIn.queryKey({ tournamentId }),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.tournament.playersOut.queryKey({ tournamentId }),
      });
      break;
    case 'remove-player':
      queryClient.cancelQueries({
        queryKey: trpc.tournament.playersIn.queryKey({ tournamentId }),
      });
      const addedPlayers = queryClient.getQueryData(
        trpc.tournament.playersIn.queryKey({ tournamentId }),
      );
      if (!addedPlayers) break;
      const removedPlayer = addedPlayers.find(
        (player: PlayerTournamentModel) => player.id === message.id,
      );

      queryClient.setQueryData(
        trpc.tournament.playersIn.queryKey({ tournamentId }),
        (cache) => cache && cache.filter((player) => player.id !== message.id),
      );
      if (removedPlayer) {
        const removedPlayerDb: PlayerModel = {
          id: removedPlayer.id,
          nickname: removedPlayer.nickname,
          realname: removedPlayer.realname ?? null,
          rating: removedPlayer.rating,
          ratingPeak: null,
          clubId: '',
          userId: null,
          lastSeenAt: new Date(),
          ratingDeviation: 0,
          ratingVolatility: 0,
          ratingLastUpdateAt: new Date(),
        };
        queryClient.setQueryData(
          trpc.tournament.playersOut.queryKey({ tournamentId }),
          (cache) => cache && cache.concat(removedPlayerDb),
        );
      }
      queryClient.invalidateQueries({
        queryKey: trpc.tournament.playersIn.queryKey({ tournamentId }),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.tournament.playersOut.queryKey({ tournamentId }),
      });
      break;
    case 'set-game-result':
      queryClient.setQueryData(
        trpc.tournament.roundGames.queryKey({
          tournamentId,
          roundNumber: message.roundNumber,
        }),
        (cache) => {
          if (!cache) return cache;
          const index = cache.findIndex((obj) => obj.id == message.gameId);
          cache[index].result = message.result;
          return cache;
        },
      );
      queryClient.invalidateQueries({
        queryKey: trpc.tournament.roundGames.queryKey({
          tournamentId,
          roundNumber: message.roundNumber,
        }),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.tournament.playersIn.queryKey({ tournamentId }),
      });
      break;
    case 'start-tournament':
      queryClient.setQueryData(
        trpc.tournament.info.queryKey({ tournamentId }),
        (cache) => {
          if (!cache) return cache;
          cache.tournament.startedAt = message.startedAt;
          return cache;
        },
      );
      queryClient.invalidateQueries({
        queryKey: trpc.tournament.info.queryKey({ tournamentId }),
      });
      break;
    case 'reset-tournament':
      queryClient.setQueryData(
        trpc.tournament.info.queryKey({ tournamentId }),
        (cache) => {
          if (!cache) return cache;
          cache.tournament.startedAt = null;
          return cache;
        },
      );
      queryClient.invalidateQueries({
        queryKey: trpc.tournament.info.queryKey({ tournamentId }),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.tournament.allGames.queryKey({ tournamentId }),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.tournament.playersIn.queryKey({ tournamentId }),
      });
      setRoundInView(1);
      break;
    case 'new-round':
      queryClient.setQueryData(
        trpc.tournament.roundGames.queryKey({
          tournamentId,
          roundNumber: message.roundNumber,
        }),
        message.newGames,
      );
      queryClient.invalidateQueries({
        queryKey: trpc.tournament.allGames.queryKey({ tournamentId }),
      });
      if (message.isTournamentGoing) {
        queryClient.invalidateQueries({
          queryKey: trpc.tournament.info.queryKey({ tournamentId }),
        });
      }
      if (message.isTournamentGoing) {
        setRoundInView(message.roundNumber);
      }
      break;
    case 'finish-tournament':
      queryClient.setQueryData(
        trpc.tournament.info.queryKey({ tournamentId }),
        (cache) => {
          if (!cache) return cache;
          cache.tournament.closedAt = message.closedAt;
          return cache;
        },
      );
      queryClient.invalidateQueries({
        queryKey: trpc.tournament.info.queryKey({ tournamentId }),
      });
      break;
    case 'swiss-new-rounds-number':
      queryClient.setQueryData(
        trpc.tournament.info.queryKey({ tournamentId }),
        (cache) => {
          if (!cache) return cache;
          cache.tournament.roundsNumber = message.roundsNumber;
          return cache;
        },
      );
      queryClient.invalidateQueries({
        queryKey: trpc.tournament.info.queryKey({ tournamentId }),
      });
      break;
    case 'error':
      toast.error(errorMessage, { id: 'wsErrorMessage' });
    default:
      break;
  }
};
