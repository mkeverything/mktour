import { describe, expect, test } from 'bun:test';

import { RoundProps } from '@/lib/pairing-generators/common-generator';
import {
  INITIAL_ONGOING_ROUND,
  PLAYER_NUMBER_FAKEOPTS,
  RANDOM_TOURNAMENTS_COUNT,
  fillRandomResult,
  generatePlayerModel,
  generateRandomDatabaseTournament,
  getGamesBetweenPlayers,
  getPlayerGames,
} from '@/lib/pairing-generators/common-generator.test';
import { generateRoundRobinRound } from '@/lib/pairing-generators/round-robin-generator';
import { generatePreStartRoundGames } from '@/lib/pre-start-round';
import type { UnitModel } from '@/server/zod/tournaments';
import { GameModel } from '@/server/zod/tournaments';
import { faker } from '@faker-js/faker';

describe('pure matching generation test', () => {
  for (
    let tournamentNumber = 0;
    tournamentNumber < RANDOM_TOURNAMENTS_COUNT;
    tournamentNumber++
  ) {
    // initialising the player number for the tournament
    const randomPlayerNumber = faker.number.int(PLAYER_NUMBER_FAKEOPTS);

    // initialising the player list
    const randomPlayers: UnitModel[] = [];
    for (let playerIdx = 0; playerIdx < randomPlayerNumber; playerIdx++) {
      const generatedPlayer = generatePlayerModel();
      randomPlayers.push(generatedPlayer);
    }

    // simple pairing number rating assignment based on array index
    randomPlayers.forEach((matchedEntity, entityIndex) => {
      matchedEntity.number = entityIndex;
    });
    // for the initial case, the previous games are missing
    const previousGames: GameModel[] = [];

    let currentRound = INITIAL_ONGOING_ROUND;

    const gameCount = (randomPlayerNumber / 2) * (randomPlayerNumber - 1);
    // random tournament initialised
    const randomTournament = generateRandomDatabaseTournament();

    while (previousGames.length < gameCount) {
      // generating round info formed
      const nextRoundRobinProps: RoundProps = {
        players: randomPlayers,
        games: previousGames,
        roundNumber: currentRound,
        tournamentId: randomTournament.id,
      };

      const gamesToInsert = generateRoundRobinRound(nextRoundRobinProps);

      // simulating round results
      gamesToInsert.forEach(fillRandomResult);

      previousGames.push(...gamesToInsert);
      currentRound++;
    }

    test(`${tournamentNumber} - game count equality to theoretical`, () => {
      // checking that the game count is equal to theoretical one
      const theoreticalGameCount =
        (randomPlayerNumber / 2) * (randomPlayerNumber - 1);
      expect(previousGames.length).toBe(theoreticalGameCount);
    });
  }
});

// ─── Schedule contract fixtures ───────────────────────────────────────────
//
// WHY THESE EXIST. The count-only test above checks that the tournament ends
// with N*(N-1)/2 games — but says nothing about WHICH pairs played. v1.8.0
// shipped a schedule where round 1 (persisted by the pre-start flow as
// consecutive pairs 0-1, 2-3, …) collided with the rotation generator's round
// 2: some pairs met twice, others never met, and for odd N the bye rotation
// broke — yet the game count stayed correct, so that test stayed green. The
// contracts below pin the round-robin invariants the count cannot see.
//
// HOW THE FIXTURE WORKS. buildFullSchedule(N) replays the production flow in
// miniature: N units numbered 0..N-1 (canonical table order), then round 1,
// 2, … up to the final round via generateRoundRobinRound, feeding the
// accumulated games back each round exactly like the "next round" action does.
// The finished FullSchedule is a read-only snapshot the describe blocks below
// inspect. Schedules are built ONCE per unit count at module scope, so every
// contract for a given N reads the same games.

// unit counts under contract: every supported size from the 2-unit minimum to
// 14, covering both parities and the smallest degenerate cases
const RR_UNIT_COUNTS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

type FullSchedule = {
  // how many units entered the tournament
  unitCount: number;
  // the units in canonical table order (unit.number === array index)
  units: UnitModel[];
  // every game of the finished tournament, rounds 1..totalRounds
  games: GameModel[];
  // rounds a complete round robin needs: N-1 for even N, N for odd N
  totalRounds: number;
};

function buildFullSchedule(unitCount: number): FullSchedule {
  const tournament = generateRandomDatabaseTournament();

  // units numbered 0..N-1 in creation order — the canonical numbering the
  // pre-start flow assigns from the tournament table order
  const units: UnitModel[] = [];
  for (let unitIndex = 0; unitIndex < unitCount; unitIndex++) {
    const unit = generatePlayerModel();
    unit.number = unitIndex;
    units.push(unit);
  }

  // even N: everyone plays every round, so N-1 rounds cover all pairs.
  // odd N: one unit byes each round, so N rounds are needed.
  let totalRounds = unitCount;
  if (unitCount % 2 === 0) {
    totalRounds = unitCount - 1;
  }

  // generate every round the way production does: each call receives the games
  // played so far and returns only the new round's games
  const games: GameModel[] = [];
  let currentRound = INITIAL_ONGOING_ROUND;
  while (currentRound <= totalRounds) {
    const newGames = generateRoundRobinRound({
      players: units,
      games,
      roundNumber: currentRound,
      tournamentId: tournament.id,
    });
    // the generator reads prior games' results to compute colour balance and
    // float history, so each round must carry a result before the next round
    // is generated. The results themselves are irrelevant to the pair and bye
    // contracts below (they inspect only unit ids and round numbers).
    newGames.forEach(fillRandomResult);
    games.push(...newGames);
    currentRound++;
  }

  return { unitCount, units, games, totalRounds };
}

// one finished tournament per unit count, shared by all contract blocks below
const schedules = RR_UNIT_COUNTS.map(buildFullSchedule);
// odd-N schedules are the only ones with byes, so the bye contract reads these
const oddSchedules = schedules.filter(
  (schedule) => schedule.unitCount % 2 !== 0,
);

describe('round robin: every pair plays exactly once', () => {
  // the defining invariant of a round robin — and precisely what v1.8.0
  // violated: some pairs met twice while others never met, with the total
  // count still correct. Quantified over every unordered pair, so a failure
  // names the exact pair that met the wrong number of times.
  for (const schedule of schedules) {
    test(`N=${schedule.unitCount}`, () => {
      for (let firstIdx = 0; firstIdx < schedule.units.length; firstIdx++) {
        for (
          let secondIdx = firstIdx + 1;
          secondIdx < schedule.units.length;
          secondIdx++
        ) {
          const firstUnit = schedule.units[firstIdx];
          const secondUnit = schedule.units[secondIdx];

          const meetings = getGamesBetweenPlayers(
            schedule.games,
            firstUnit.id,
            secondUnit.id,
          );

          expect(meetings).toHaveLength(1);
        }
      }
    });
  }
});

describe('round robin: odd unit count gives every unit exactly one bye', () => {
  // with an odd field one unit sits out each round, and a fair schedule
  // rotates that bye through the whole field: every unit plays in all rounds
  // but one. v1.8.0 also broke this — some units sat out twice while others
  // never did.
  for (const schedule of oddSchedules) {
    test(`N=${schedule.unitCount}`, () => {
      for (const unit of schedule.units) {
        const playedGames = getPlayerGames(schedule.games, unit.id);

        expect(playedGames).toHaveLength(schedule.totalRounds - 1);
      }
    });
  }
});

describe('round robin: pre-start round 1 matches generator round 1', () => {
  // THE SEAM WHERE v1.8.0 BROKE. Before a tournament starts, the pre-start
  // flow persists round 1 via generatePreStartRoundGames (consecutive boards:
  // table neighbours play each other). Once the tournament runs, every round —
  // including a round-1 regeneration — comes from generateRoundRobinRound.
  // If the two disagree about round 1, the persisted round 1 is effectively a
  // foreign round and the rotation later replays some of its pairs (that was
  // the v1.8.0 defect). The contract: both produce the SAME matchups.
  for (const schedule of schedules) {
    test(`N=${schedule.unitCount}`, () => {
      const tournament = generateRandomDatabaseTournament();
      const preStartGames = generatePreStartRoundGames({
        units: schedule.units,
        tournamentId: tournament.id,
      });

      const generatorRound1Games = schedule.games.filter(
        (game) => game.roundNumber === 1,
      );

      // same number of boards...
      expect(generatorRound1Games).toHaveLength(preStartGames.length);
      // ...and for every persisted pre-start board there is exactly one
      // generator round-1 game between the same two units
      for (const preStartGame of preStartGames) {
        const matchingGames = getGamesBetweenPlayers(
          generatorRound1Games,
          preStartGame.whiteUnitId,
          preStartGame.blackUnitId,
        );

        expect(matchingGames).toHaveLength(1);
      }
    });
  }
});
