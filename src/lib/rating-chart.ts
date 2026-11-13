import type { RatingHistoryEventModel } from '@/server/zod/players';

export type RatingPoint = RatingHistoryEventModel & {
  /** change from the rating published before it; null for the starting one */
  delta: number | null;
};

type Domain = readonly [min: number, max: number];

const RATING_TICK_STEPS = [10, 25, 50, 100, 200, 500];
const MONTH_TICK_STEPS = [1, 2, 3, 6, 12];
// a few points of noise must not look like a climb, so the rating axis never zooms in further
const MIN_RATING_SPAN = 120;
const RATING_PADDING = 0.14;

export const toRatingPoints = (
  events: RatingHistoryEventModel[],
): RatingPoint[] =>
  events.map((event, i) => ({
    ...event,
    delta: i === 0 ? null : event.rating - events[i - 1].rating,
  }));

/** the first point that reached the highest established rating */
export const findPeak = (points: RatingPoint[]) =>
  points.reduce<RatingPoint | null>(
    (peak, point) =>
      point.isEstablished && (!peak || point.rating > peak.rating)
        ? point
        : peak,
    null,
  );

/** a rating holds until the next one is published: the index of the point in force at `time` */
export const getIndexAt = (points: RatingPoint[], time: number) =>
  Math.max(
    0,
    points.findLastIndex((point) => point.publishedAt.getTime() <= time),
  );

export const getRatingDomain = (ratings: number[]): Domain => {
  const min = Math.min(...ratings);
  const max = Math.max(...ratings);
  const span = Math.max(max - min, MIN_RATING_SPAN);
  const middle = (min + max) / 2;
  const half = (span / 2) * (1 + RATING_PADDING);
  return [middle - half, middle + half];
};

const countTicks = ([min, max]: Domain, step: number) =>
  Math.floor(max / step) - Math.ceil(min / step) + 1;

export const getRatingTicks = (domain: Domain, maxCount: number) => {
  const step =
    RATING_TICK_STEPS.find((step) => countTicks(domain, step) <= maxCount) ??
    1000;
  const first = Math.ceil(domain[0] / step) * step;
  return Array.from(
    { length: Math.max(0, countTicks(domain, step)) },
    (_, i) => first + i * step,
  );
};

/** starts of months within the domain, thinned out until at most `maxCount` remain */
export const getMonthTicks = ([start, end]: Domain, maxCount: number) => {
  const first = new Date(start);
  const months: Date[] = [];
  for (
    let month = new Date(first.getFullYear(), first.getMonth() + 1, 1);
    month.getTime() <= end;
    month = new Date(month.getFullYear(), month.getMonth() + 1, 1)
  ) {
    months.push(month);
  }
  const step =
    MONTH_TICK_STEPS.find((step) => months.length / step <= maxCount) ?? 24;
  const years = months.filter((month) => month.getMonth() === 0);
  // between years a half-year tick only repeats one month's name, so once two years show they mark the axis alone
  if (step === 6 && years.length >= 2) return years;
  return months.filter((month) => month.getMonth() % step === 0);
};

export const scaleLinear =
  ([d0, d1]: Domain, [r0, r1]: Domain) =>
  (value: number) =>
    r0 + ((value - d0) / (d1 - d0)) * (r1 - r0);

/** a staircase through the points that holds the last value until `endX` */
export const getStepPath = (points: { x: number; y: number }[], endX: number) =>
  points
    .map(({ x, y }, i) => (i === 0 ? `M${x},${y}` : `H${x}V${y}`))
    .join('') + `H${endX}`;

/** stretches of consecutive established ratings, as inclusive index pairs */
export const getEstablishedRuns = (points: RatingPoint[]) => {
  const runs: [first: number, last: number][] = [];
  points.forEach((point, i) => {
    if (!point.isEstablished) return;
    const run = runs.at(-1);
    if (run?.[1] === i - 1) run[1] = i;
    else runs.push([i, i]);
  });
  return runs;
};
