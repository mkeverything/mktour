'use client';

import type { MockMode } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import EliminationBracketTree from '@/app/tournaments/[id]/dashboard/tabs/games/elimination-bracket-tree';
import RoundActionButton from '@/app/tournaments/[id]/dashboard/tabs/games/round-action-button';
import RoundBracketList from '@/app/tournaments/[id]/dashboard/tabs/games/round-bracket-list';
import RoundGamesList from '@/app/tournaments/[id]/dashboard/tabs/games/round-games-list';
import type { StandingsGroup } from '@/app/tournaments/[id]/dashboard/tabs/table/table-types';
import { TournamentFormat } from '@/server/zod/enums';
import { PlayerTournamentModel } from '@/server/zod/players';
import { GameModel, TournamentModel } from '@/server/zod/tournaments';
import { FC, useMemo } from 'react';

export interface GamesContentProps {
  roundGames: GameModel[] | undefined;
  allGames?: GameModel[];
  standingsGroups: StandingsGroup[];
  players: PlayerTournamentModel[];
  roundNumber: number;
  tournament: TournamentModel | null | undefined;
  status: 'organizer' | 'player' | 'viewer';
  tournamentId: string;
  mockMode: MockMode;
  isElimination: boolean;
}

function filterGamesByGroup(
  games: GameModel[],
  group: StandingsGroup,
): GameModel[] {
  const playerIds = new Set(group.players.map((p) => p.id));
  return games.filter(
    (g) => playerIds.has(g.whiteId) && playerIds.has(g.blackId),
  );
}

const GamesContent: FC<GamesContentProps> = ({
  roundGames,
  allGames,
  standingsGroups,
  players,
  roundNumber,
  tournament,
  status,
  tournamentId,
  mockMode,
  isElimination,
}) => {
  const ongoingGames = useMemo(
    () => roundGames?.filter((g) => g.result === null).length ?? 0,
    [roundGames],
  );

  const isGrouped = standingsGroups.length > 0;
  const groupsToShow = standingsGroups;

  if (!tournament) return null;

  const { ongoingRound, roundsNumber, closedAt, format } = tournament;
  const renderFinishButton =
    status === 'organizer' && !closedAt && ongoingRound === roundsNumber;
  const renderNewRoundButton =
    roundNumber === ongoingRound &&
    ongoingRound !== roundsNumber &&
    ongoingGames === 0 &&
    status === 'organizer' &&
    (roundGames?.length ?? 0) > 0;

  const actionButton = (
    <RoundActionButton
      renderNewRoundButton={renderNewRoundButton}
      roundNumber={roundNumber}
      roundsNumber={roundsNumber}
      tournamentId={tournamentId}
      renderFinishButton={renderFinishButton}
      format={format as TournamentFormat}
    />
  );

  if (isGrouped) {
    const GameList = isElimination ? RoundBracketList : RoundGamesList;
    return (
      <div className="mk-list px-mk md:px-mk-2 pt-2">
        {actionButton}
        <div className="gap-mk-2 flex flex-col">
          {groupsToShow.map((group) => {
            const groupGames = roundGames
              ? filterGamesByGroup(roundGames, group)
              : [];

            return (
              <section key={group.id}>
                <h3 className="text-muted-foreground mb-2 text-sm font-medium">
                  {group.name}
                </h3>
                <GameList games={groupGames} players={group.players} />
              </section>
            );
          })}
        </div>
      </div>
    );
  }

  if (isElimination) {
    const treeGames =
      allGames && allGames.length > 0 ? allGames : (roundGames ?? []);
    const hasAnyGames = treeGames.length > 0;

    return (
      <div className="mk-list px-mk md:px-mk-2 pt-2">
        {actionButton}
        {hasAnyGames ? (
          <EliminationBracketTree games={treeGames} players={players} />
        ) : (
          <RoundBracketList games={roundGames ?? []} players={players} />
        )}
      </div>
    );
  }

  return (
    <div className="mk-list px-mk md:px-mk-2 pt-2">
      {actionButton}
      <RoundGamesList games={roundGames ?? []} players={players} />
    </div>
  );
};

export default GamesContent;
