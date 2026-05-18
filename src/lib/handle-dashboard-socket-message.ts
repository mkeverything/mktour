'use client';
// ws-handler

import { useTRPC } from '@/components/trpc/client';
import { baselineUnitSort } from '@/lib/tournament-results';
import { settlePendingGamesAsForfeit } from '@/lib/utils';
import type { UnitModel } from '@/server/zod/tournaments';
import type { DashboardMessage } from '@/types/tournament-ws-events';
import { QueryClient } from '@tanstack/react-query';
import { Dispatch, SetStateAction } from 'react';
import { toast } from 'sonner';

function parseUnitBody(
  body: UnitModel & { addedAt?: Date | string | null },
): UnitModel {
  return {
    ...body,
    addedAt: body.addedAt != null ? new Date(body.addedAt as string) : null,
  };
}

function parseUnitsBody(
  body: Array<UnitModel & { addedAt?: Date | string | null }>,
): UnitModel[] {
  return body.map(parseUnitBody);
}

export const handleSocketMessage = (
  message: DashboardMessage,
  queryClient: QueryClient,
  tournamentId: string,
  errorMessage: string,
  setRoundInView: Dispatch<SetStateAction<number>>,
  trpc: ReturnType<typeof useTRPC>,
) => {
  switch (message.event) {
    case 'edit-doubles-unit': {
      const body = parseUnitBody(message.body);
      queryClient.cancelQueries({
        queryKey: trpc.tournament.units.queryKey({ tournamentId }),
      });
      queryClient.setQueryData(
        trpc.tournament.units.queryKey({ tournamentId }),
        (cache) => {
          if (!cache) return cache;
          const result = cache.map((p) =>
            p.id === message.previousId ? body : p,
          );
          if (body.id !== message.previousId) {
            // FIXME TODO
            return result
              .filter((p) => p.id !== body.id || (p.players?.length ?? 0) > 0)
              .sort(baselineUnitSort);
          }
          return result.sort(baselineUnitSort);
        },
      );
      queryClient.invalidateQueries({
        queryKey: trpc.tournament.units.queryKey({ tournamentId }),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.tournament.playersOut.queryKey({ tournamentId }),
      });
      break;
    }
    case 'prestart-round-updated': {
      const units = parseUnitsBody(message.units);
      const roundGamesQueryKey = trpc.tournament.roundGames.queryKey({
        tournamentId,
        roundNumber: message.roundNumber,
      });
      queryClient.cancelQueries({
        queryKey: trpc.tournament.units.queryKey({ tournamentId }),
      });
      queryClient.cancelQueries({ queryKey: roundGamesQueryKey });
      queryClient.setQueryData(
        trpc.tournament.units.queryKey({ tournamentId }),
        units,
      );
      queryClient.setQueryData(roundGamesQueryKey, message.games);
      queryClient.invalidateQueries({
        queryKey: trpc.tournament.units.queryKey({ tournamentId }),
      });
      queryClient.invalidateQueries({ queryKey: roundGamesQueryKey });
      queryClient.invalidateQueries({
        queryKey: trpc.tournament.allGames.queryKey({ tournamentId }),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.tournament.playersOut.queryKey({ tournamentId }),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.tournament.info.queryKey({ tournamentId }),
      });
      break;
    }
    case 'withdraw-unit':
      queryClient.cancelQueries({
        queryKey: trpc.tournament.units.queryKey({ tournamentId }),
      });
      queryClient.cancelQueries({
        queryKey: trpc.tournament.allGames.queryKey({ tournamentId }),
      });
      queryClient.setQueryData(
        trpc.tournament.units.queryKey({ tournamentId }),
        (cache) =>
          cache?.map((unit) =>
            unit.id === message.id ? { ...unit, isOut: true } : unit,
          ),
      );
      const currentAllGames = queryClient.getQueryData(
        trpc.tournament.allGames.queryKey({ tournamentId }),
      );
      if (currentAllGames !== undefined) {
        const nextAllGames = settlePendingGamesAsForfeit(
          currentAllGames,
          message.id,
        );
        queryClient.setQueryData(
          trpc.tournament.allGames.queryKey({ tournamentId }),
          nextAllGames,
        );
      }
      const ongoingRound =
        queryClient.getQueryData(
          trpc.tournament.info.queryKey({ tournamentId }),
        )?.tournament.ongoingRound ?? null;
      if (ongoingRound != null) {
        const roundGamesKey = trpc.tournament.roundGames.queryKey({
          tournamentId,
          roundNumber: ongoingRound,
        });
        queryClient.cancelQueries({ queryKey: roundGamesKey });
        const currentRoundGames = queryClient.getQueryData(roundGamesKey);
        if (currentRoundGames !== undefined) {
          const nextRoundGames = settlePendingGamesAsForfeit(
            currentRoundGames,
            message.id,
          );
          queryClient.setQueryData(roundGamesKey, nextRoundGames);
        }
        queryClient.invalidateQueries({ queryKey: roundGamesKey });
      }
      queryClient.invalidateQueries({
        queryKey: trpc.tournament.allGames.queryKey({ tournamentId }),
      });
      queryClient.invalidateQueries({ queryKey: trpc.tournament.pathKey() });
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
        queryKey: trpc.tournament.units.queryKey({ tournamentId }),
      });
      break;
    case 'start-tournament':
      queryClient.setQueryData(
        trpc.tournament.info.queryKey({ tournamentId }),
        (cache) => {
          if (!cache) return cache;
          cache.tournament.startedAt = new Date(message.startedAt);
          return cache;
        },
      );
      queryClient.setQueryData(
        trpc.tournament.roundGames.queryKey({
          tournamentId,
          roundNumber: 1,
        }),
        message.games,
      );
      queryClient.invalidateQueries({
        queryKey: trpc.tournament.info.queryKey({ tournamentId }),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.tournament.allGames.queryKey({ tournamentId }),
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
        queryKey: trpc.tournament.roundGames.queryKey({
          tournamentId,
          roundNumber: 1,
        }),
      });
      queryClient.invalidateQueries({
        queryKey: trpc.tournament.units.queryKey({ tournamentId }),
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
          cache.tournament.closedAt = new Date(message.closedAt);
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
