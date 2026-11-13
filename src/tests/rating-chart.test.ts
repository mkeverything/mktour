import { describe, expect, test } from 'bun:test';

import {
  findPeak,
  getEstablishedRuns,
  getIndexAt,
  getMonthTicks,
  getRatingDomain,
  getRatingTicks,
  getStepPath,
  toRatingPoints,
} from '@/lib/rating-chart';

const DAY = 24 * 60 * 60 * 1000;
const START = Date.UTC(2026, 0, 1);

const event = (day: number, rating: number, isEstablished = true) => ({
  id: `event-${day}`,
  publishedAt: new Date(START + day * DAY),
  rating,
  isStarting: day === 0,
  isEstablished,
  tournament: null,
});

// two provisional ratings, then three established ones
const points = toRatingPoints([
  event(0, 1500, false),
  event(7, 1420, false),
  event(14, 1480),
  event(21, 1530),
  event(28, 1510),
]);

describe('rating chart', () => {
  test('each point carries its change from the rating before it', () => {
    expect(points.map(({ delta }) => delta)).toEqual([null, -80, 60, 50, -20]);
  });

  test('the peak is the highest established rating, however high a provisional one went', () => {
    expect(findPeak(points)?.rating).toBe(1530);
    expect(findPeak(points.slice(0, 2))).toBeNull();
  });

  test('a rating stays in force until the next one is published', () => {
    const indexOn = (day: number) => getIndexAt(points, START + day * DAY);
    expect([-1, 0, 6.9, 7, 100].map(indexOn)).toEqual([0, 0, 0, 1, 4]);
  });

  test('established stretches are runs of consecutive established points', () => {
    expect(getEstablishedRuns(points)).toEqual([[2, 4]]);
    expect(
      getEstablishedRuns(
        toRatingPoints([
          event(0, 1500),
          event(7, 1500, false),
          event(14, 1500),
        ]),
      ),
    ).toEqual([
      [0, 0],
      [2, 2],
    ]);
  });

  test('the rating axis does not zoom in on noise, and its ticks are round ratings that fit', () => {
    const [min, max] = getRatingDomain([1500, 1504]);
    expect(max - min).toBeGreaterThanOrEqual(120);
    expect(getRatingTicks([1217, 1519], 3)).toEqual([1300, 1400, 1500]);
    expect(getRatingTicks([1217, 1519], 2)).toEqual([1400]);
  });

  test('month ticks thin out until they fit, down to years alone once two show', () => {
    const ticks = getMonthTicks(
      [new Date(2025, 2, 8).getTime(), new Date(2026, 10, 12).getTime()],
      4,
    );
    expect(
      ticks.map((month) => [month.getFullYear(), month.getMonth() + 1]),
    ).toEqual([
      [2025, 7],
      [2026, 1],
      [2026, 7],
    ]);
    expect(
      getMonthTicks(
        [new Date(2023, 5, 1).getTime(), new Date(2026, 10, 12).getTime()],
        8,
      ).map((month) => month.getFullYear()),
    ).toEqual([2024, 2025, 2026]);
  });

  test('the staircase holds each rating until the next one, and the last until the end', () => {
    expect(
      getStepPath(
        [
          { x: 0, y: 10 },
          { x: 5, y: 4 },
          { x: 8, y: 6 },
        ],
        12,
      ),
    ).toBe('M0,10H5V4H8V6H12');
  });
});
