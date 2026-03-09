'use client';

import { DashboardContext } from '@/app/tournaments/[id]/dashboard/dashboard-context';
import BracketGameItem from '@/app/tournaments/[id]/dashboard/tabs/games/game/bracket-game-item';
import BracketEditableItem from '@/app/tournaments/[id]/dashboard/tabs/games/game/bracket-editable-item';
import BracketGhostItem from '@/app/tournaments/[id]/dashboard/tabs/games/game/bracket-ghost-item';
import { useTournamentInfo } from '@/components/hooks/query-hooks/use-tournament-info';
import { cn } from '@/lib/utils';
import { PlayerTournamentModel } from '@/server/zod/players';
import type { GameModel } from '@/server/zod/tournaments';
import { useParams } from 'next/navigation';
import { FC, useContext, useMemo } from 'react';

export interface EliminationBracketTreeProps {
  games: GameModel[];
  players: PlayerTournamentModel[];
}

function groupGamesByRound(games: GameModel[]): Map<number, GameModel[]> {
  const byRound = new Map<number, GameModel[]>();
  for (const g of games) {
    const r = g.roundNumber;
    if (!byRound.has(r)) byRound.set(r, []);
    byRound.get(r)!.push(g);
  }
  for (const arr of byRound.values()) {
    arr.sort((a, b) => (a.id < b.id ? -1 : 1));
  }
  return byRound;
}

type RoundSlot = GameModel | null;

function nextPowerOf2(n: number): number {
  if (n <= 1) return 1;
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function countRoundsUpToFinal(firstSlotCount: number): number {
  if (firstSlotCount <= 1) return 2;
  let depth = 0;
  let s = firstSlotCount;
  while (s > 1) {
    s = Math.floor(s / 2);
    depth += 1;
  }
  return depth + 1;
}

function buildRoundSlots(byRound: Map<number, GameModel[]>): RoundSlot[][] {
  const roundNumbers = [...byRound.keys()];
  const minRound = roundNumbers.length > 0 ? Math.min(...roundNumbers) : 1;
  const firstRoundGames = byRound.get(minRound) ?? [];
  const firstSlotCount = Math.max(
    2,
    nextPowerOf2(Math.max(firstRoundGames.length, 1)),
  );
  const numRounds = countRoundsUpToFinal(firstSlotCount);
  const rows: RoundSlot[][] = [];

  const firstRow: RoundSlot[] = [...firstRoundGames];
  while (firstRow.length < firstSlotCount) firstRow.push(null);
  rows.push(firstRow);

  let prevSlotCount = firstSlotCount;
  for (let r = 1; r < numRounds; r++) {
    const roundNum = minRound + r;
    const games = byRound.get(roundNum) ?? [];
    const isLastRound = r === numRounds - 1;
    const slotCount = isLastRound
      ? 2
      : Math.max(1, Math.floor(prevSlotCount / 2));

    const row: RoundSlot[] = [];
    if (isLastRound && slotCount === 2) {
      const finalGame = games.find((g) => g.roundName === 'final') ?? null;
      const thirdGame =
        games.find((g) => g.roundName === 'match_for_third') ?? null;
      row.push(finalGame, thirdGame);
    } else {
      for (let i = 0; i < slotCount; i++) {
        row.push(games[i] ?? null);
      }
    }
    rows.push(row);
    prevSlotCount = slotCount;
  }
  return rows;
}

function BracketConnectorHorizontal({
  fromSlotCount,
  toSlotCount,
  className,
}: {
  fromSlotCount: number;
  toSlotCount: number;
  className?: string;
}) {
  const fromSlotHeight = 100 / fromSlotCount;
  const toSlotHeight = 100 / toSlotCount;
  const paths: string[] = [];
  const midX = 50;
  if (fromSlotCount === toSlotCount) {
    if (fromSlotCount === 2) {
      paths.push(
        `M 0 25 L ${midX} 25 L ${midX} 50 L 100 25`,
        `M 0 75 L ${midX} 75 L ${midX} 50 L 100 75`,
      );
    } else {
      for (let i = 0; i < fromSlotCount; i++) {
        const cy = (i + 0.5) * fromSlotHeight;
        paths.push(`M 0 ${cy} L 100 ${cy}`);
      }
    }
  } else {
    for (let t = 0; t < toSlotCount; t++) {
      const fromTop = (2 * t + 0.5) * fromSlotHeight;
      const fromBottom = (2 * t + 1.5) * fromSlotHeight;
      const toCenter = (t + 0.5) * toSlotHeight;
      paths.push(
        `M 0 ${fromTop} L ${midX} ${fromTop} L ${midX} ${toCenter} L 100 ${toCenter}`,
        `M 0 ${fromBottom} L ${midX} ${fromBottom} L ${midX} ${toCenter}`,
      );
    }
  }
  return (
    <div className={className} role="presentation">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="text-muted-foreground/40 h-full w-full min-w-[32px]"
      >
        {paths.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
            strokeDasharray="3 2"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    </div>
  );
}

const ROUND_LABELS: Record<string, string> = {
  '1/128': '1/128',
  '1/64': '1/64',
  '1/32': '1/32',
  '1/16': '1/16',
  '1/8': '1/8',
  quarterfinal: 'quarterfinal',
  semifinal: 'semifinal',
  final: 'final',
  match_for_third: '3rd place',
};

function roundColumnLabel(
  roundIndex: number,
  slots: RoundSlot[],
  roundNumber: number,
): string {
  const game = slots.find((s): s is GameModel => s !== null);
  const name = game?.roundName;
  if (name && name in ROUND_LABELS) return ROUND_LABELS[name];
  return `round ${roundNumber}`;
}

const EliminationBracketTree: FC<EliminationBracketTreeProps> = ({
  games,
  players,
}) => {
  const { id: tournamentId } = useParams<{ id: string }>();
  const { data: tournamentInfo } = useTournamentInfo(tournamentId);
  const { status } = useContext(DashboardContext);
  const hasStarted = !!tournamentInfo?.tournament.startedAt;
  const isOrganizer = status === 'organizer';
  const byRound = useMemo(() => groupGamesByRound(games), [games]);
  const roundSlots = useMemo(() => buildRoundSlots(byRound), [byRound]);

  const unpairedPlayers = useMemo(() => {
    if (hasStarted) return [];
    const roundNumbers = [...byRound.keys()];
    const minRound = roundNumbers.length > 0 ? Math.min(...roundNumbers) : 1;
    const firstRoundGames = byRound.get(minRound) ?? [];
    const pairedIds = new Set<string>();
    for (const g of firstRoundGames) {
      pairedIds.add(g.whiteId);
      pairedIds.add(g.blackId);
    }
    return players.filter((p) => !pairedIds.has(p.id));
  }, [byRound, players, hasStarted]);

  if (roundSlots.length === 0) return null;

  const roundNumbers = useMemo(() => {
    const keys = [...byRound.keys()];
    const minR = keys.length > 0 ? Math.min(...keys) : 1;
    return Array.from({ length: roundSlots.length }, (_, i) => minR + i);
  }, [byRound, roundSlots.length]);

  const ITEM_H = 52;
  const GAP = 8;
  const baseSlots = roundSlots[0]?.length ?? 1;
  const baseHeight = baseSlots * ITEM_H + Math.max(0, baseSlots - 1) * GAP;

  return (
    <div className="w-full overflow-auto py-2">
      <div
        className="inline-flex min-h-0 flex-row items-stretch gap-0"
        style={{ minWidth: 'max-content' }}
      >
        {roundSlots.map((slots, colIndex) => {
          let firstColumnExtraIndex = 0;
          const roundNum = roundNumbers[colIndex];
          const isLast = colIndex === roundSlots.length - 1;
          const nextSlotCount = isLast
            ? 0
            : (roundSlots[colIndex + 1]?.length ?? 0);
          const label = roundColumnLabel(colIndex, slots, roundNum);
          return (
            <div key={colIndex} className="flex flex-row items-stretch gap-0">
              <div className="flex min-w-[200px] flex-col gap-2 px-1">
                <div className="text-muted-foreground shrink-0 px-1 pb-1 text-center text-xs font-medium">
                  {label}
                </div>
                <div
                  className="relative w-full max-w-[200px]"
                  style={{ height: baseHeight }}
                >
                  {slots.map((slot, rowIndex) => {
                    let byePlayer: PlayerTournamentModel | null = null;
                    if (
                      !hasStarted &&
                      colIndex === 0 &&
                      !slot &&
                      firstColumnExtraIndex < unpairedPlayers.length
                    ) {
                      byePlayer =
                        unpairedPlayers[firstColumnExtraIndex] ?? null;
                      firstColumnExtraIndex += 1;
                    }
                    const yPct = ((rowIndex + 0.5) / slots.length) * 100;
                    return (
                      <div
                        key={rowIndex}
                        className="absolute right-0 left-0"
                        style={{
                          top: `${yPct}%`,
                          transform: 'translateY(-50%)',
                        }}
                      >
                        {slot ? (
                          hasStarted ? (
                            <BracketGameItem
                              id={slot.id}
                              result={slot.result}
                              playerLeft={{
                                whiteId: slot.whiteId,
                                whiteNickname: slot.whiteNickname,
                              }}
                              playerRight={{
                                blackId: slot.blackId,
                                blackNickname: slot.blackNickname,
                              }}
                              roundNumber={slot.roundNumber}
                            />
                          ) : (
                            <BracketEditableItem game={slot} />
                          )
                        ) : byePlayer ? (
                          <BracketEditableItem byePlayer={byePlayer} />
                        ) : (
                          <BracketGhostItem
                            className={cn(
                              colIndex === 0 && 'pointer-events-none opacity-0',
                              !hasStarted &&
                                isOrganizer &&
                                colIndex !== 0 &&
                                'hover:bg-muted/40 cursor-pointer',
                            )}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              {!isLast && nextSlotCount > 0 && (
                <div className="grid w-10 shrink-0 grid-rows-[auto_1fr] gap-2">
                  <div className="h-[18px]" />
                  <BracketConnectorHorizontal
                    fromSlotCount={slots.length}
                    toSlotCount={nextSlotCount}
                    className="h-full w-full"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EliminationBracketTree;
