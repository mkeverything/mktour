'use client';

import {
  findPeak,
  getEstablishedRuns,
  getIndexAt,
  getMonthTicks,
  getRatingDomain,
  getRatingTicks,
  getStepPath,
  scaleLinear,
  type RatingPoint,
} from '@/lib/rating-chart';
import { cn } from '@/lib/utils';
import {
  animate,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion';
import * as m from 'framer-motion/m';
import { useFormatter, useTranslations } from 'next-intl';
import {
  FC,
  KeyboardEvent,
  PointerEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

// room around the plot for the peak label, the rating labels and the month labels
const GUTTER = { top: 18, right: 38, bottom: 22 };
const DAY_MS = 24 * 60 * 60 * 1000;
// a touch scrubs once it moves sideways or rests this long, so a vertical swipe still scrolls the page
const TOUCH_HOLD_MS = 120;
const TOUCH_SLOP_PX = 6;
const CURSOR_SPRING = { bounce: 0, visualDuration: 0.3 };

type Size = { width: number; height: number };

/**
 * a player's rating over time as a staircase: a rating holds from the tournament
 * that published it until the next one, and until today after the last
 */
const RatingChart: FC<{
  points: RatingPoint[];
  /** how far back from today to show, in milliseconds; the whole history when omitted */
  period?: number;
  /** index of the highlighted point, owned by the parent so it can show the readout */
  activeIndex: number | null;
  onActiveIndexChange: (_index: number | null) => void;
  label: string;
  className?: string;
}> = ({
  points,
  period,
  activeIndex,
  onActiveIndexChange,
  label,
  className,
}) => {
  const format = useFormatter();
  const containerRef = useRef<HTMLDivElement>(null);
  const touchRef = useRef<{ startX: number; timer: number } | null>(null);
  const [size, setSize] = useState<Size | null>(null);
  const [pointerX, setPointerX] = useState<number | null>(null);
  const [now] = useState(() => Date.now());

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const firstTime = points[0].publishedAt.getTime();
  const startTarget = Math.max(period ? now - period : firstTime, firstTime);
  const end = Math.max(now, startTarget + DAY_MS);
  const [minTarget, maxTarget] = getRatingDomain(
    points.slice(getIndexAt(points, startTarget)).map(({ rating }) => rating),
  );
  const [start, ratingMin, ratingMax] = useEased(
    startTarget,
    minTarget,
    maxTarget,
  );

  const plotWidth = Math.max(0, (size?.width ?? 0) - GUTTER.right);
  const activePoint = activeIndex === null ? null : points[activeIndex];

  const scrubTo = (clientX: number) => {
    const container = containerRef.current;
    if (!container || !plotWidth) return;
    const x = Math.min(
      Math.max(clientX - container.getBoundingClientRect().left, 0),
      plotWidth,
    );
    setPointerX(x);
    onActiveIndexChange(
      getIndexAt(points, start + (x / plotWidth) * (end - start)),
    );
  };
  const release = () => {
    window.clearTimeout(touchRef.current?.timer);
    touchRef.current = null;
    setPointerX(null);
    onActiveIndexChange(null);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') return scrubTo(event.clientX);
    const { clientX } = event;
    touchRef.current = {
      startX: clientX,
      timer: window.setTimeout(() => scrubTo(clientX), TOUCH_HOLD_MS),
    };
  };
  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const touch = touchRef.current;
    if (event.pointerType !== 'mouse') {
      if (!touch) return;
      const isScrubbing = pointerX !== null;
      if (
        !isScrubbing &&
        Math.abs(event.clientX - touch.startX) < TOUCH_SLOP_PX
      ) {
        return;
      }
      window.clearTimeout(touch.timer);
    }
    scrubTo(event.clientX);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = points.length - 1;
    const current = activeIndex ?? last;
    const next = {
      ArrowLeft: current - 1,
      ArrowRight: current + 1,
      Home: 0,
      End: last,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setPointerX(null);
    onActiveIndexChange(Math.min(Math.max(next, 0), last));
  };

  return (
    <div
      ref={containerRef}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={points.length - 1}
      aria-valuenow={activeIndex ?? points.length - 1}
      aria-valuetext={`${format.dateTime(
        (activePoint ?? points[points.length - 1]).publishedAt,
        { dateStyle: 'medium' },
      )}: ${(activePoint ?? points[points.length - 1]).rating}`}
      className={cn(
        'focus-visible:ring-ring/50 relative touch-pan-y rounded-md outline-none select-none focus-visible:ring-[3px]',
        className,
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => event.pointerType !== 'mouse' && release()}
      onPointerLeave={(event) => event.pointerType === 'mouse' && release()}
      onPointerCancel={release}
      onKeyDown={handleKeyDown}
      onBlur={release}
    >
      {size && plotWidth > 0 && (
        <Plot
          points={points}
          size={size}
          time={[start, end]}
          rating={[ratingMin, ratingMax]}
          activeIndex={activeIndex}
          pointerX={pointerX}
        />
      )}
    </div>
  );
};

const Plot: FC<{
  points: RatingPoint[];
  size: Size;
  time: readonly [number, number];
  rating: readonly [number, number];
  activeIndex: number | null;
  pointerX: number | null;
}> = ({ points, size, time, rating, activeIndex, pointerX }) => {
  const t = useTranslations('Player.Rating');
  const format = useFormatter();
  const clipId = useId();
  const width = size.width - GUTTER.right;
  const height = size.height - GUTTER.top - GUTTER.bottom;
  const x = scaleLinear(time, [0, width]);
  const y = scaleLinear(rating, [height, 0]);

  const coords = points.map((point) => ({
    x: x(point.publishedAt.getTime()),
    y: y(point.rating),
  }));
  const line = getStepPath(coords, width);
  const established = getEstablishedRuns(points).map(([first, last]) =>
    getStepPath(coords.slice(first, last + 1), coords[last + 1]?.x ?? width),
  );
  const peakPoint = findPeak(points);
  const peak = peakPoint && coords[points.indexOf(peakPoint)];
  const lastCoord = coords[coords.length - 1];
  const active = activeIndex === null ? null : coords[activeIndex];
  // a pointer is followed exactly; a point picked any other way is marked where it was published
  const targetX = active && Math.max(0, pointerX ?? active.x);
  const cursorX = useCursorX(targetX, pointerX !== null);
  // the marker rides the staircase, so on its way between two points it stays on the line
  const cursorY = useTransform(
    cursorX,
    (value) => (coords.findLast((coord) => coord.x <= value) ?? coords[0]).y,
  );

  return (
    <svg
      width={size.width}
      height={size.height}
      className="text-2xs block overflow-visible tabular-nums"
      aria-hidden
    >
      <defs>
        <clipPath id={clipId}>
          <rect y={-GUTTER.top} width={width} height={height + GUTTER.top} />
        </clipPath>
        <clipPath id={`${clipId}-past`}>
          {targetX === null ? (
            <rect y={-GUTTER.top} width={width} height={height + GUTTER.top} />
          ) : (
            <m.rect
              y={-GUTTER.top}
              width={cursorX}
              height={height + GUTTER.top}
            />
          )}
        </clipPath>
        <linearGradient id={`${clipId}-fade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.07" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g transform={`translate(0,${GUTTER.top})`}>
        {getRatingTicks(rating, Math.max(3, Math.floor(height / 44))).map(
          (tick) => (
            <g key={tick} transform={`translate(0,${y(tick)})`}>
              <line x2={width} className="stroke-border" />
              <text
                x={width + 8}
                dominantBaseline="central"
                className="fill-muted-foreground"
              >
                {tick}
              </text>
            </g>
          ),
        )}
        {getMonthTicks(time, Math.max(3, Math.floor(width / 64))).map(
          (month) => (
            <text
              key={month.getTime()}
              x={x(month.getTime())}
              y={height + 16}
              className="fill-muted-foreground lowercase"
            >
              {month.getMonth() === 0
                ? format.dateTime(month, { year: 'numeric' })
                : format.dateTime(month, { month: 'short' })}
            </text>
          ),
        )}
        <g clipPath={`url(#${clipId})`}>
          {/* what came after the cursor steps back, so the eye stays on the picked moment */}
          <g className={cn(targetX !== null && 'opacity-30')}>
            <ChartLine line={line} established={established} />
          </g>
          <g clipPath={`url(#${clipId}-past)`}>
            <path
              d={`${line}V${height}H${coords[0].x}Z`}
              fill={`url(#${clipId}-fade)`}
            />
            <ChartLine line={line} established={established} />
          </g>
          {peak && (
            <g transform={`translate(${peak.x},${peak.y})`}>
              <circle r={2.5} className="fill-background stroke-foreground" />
              <text
                y={-8}
                textAnchor={
                  peak.x < 48 ? 'start' : peak.x > width - 48 ? 'end' : 'middle'
                }
                className="fill-muted-foreground"
              >
                {t('peak', { rating: peakPoint.rating })}
              </text>
            </g>
          )}
        </g>
        {targetX !== null ? (
          <m.g style={{ x: cursorX }}>
            <line
              y1={-GUTTER.top}
              y2={height}
              className="stroke-foreground/40"
            />
            <m.circle
              cy={cursorY}
              r={4}
              className="fill-foreground stroke-background stroke-2"
            />
          </m.g>
        ) : (
          <circle
            cx={width}
            cy={lastCoord.y}
            r={3.5}
            className="fill-foreground stroke-background stroke-2"
          />
        )}
      </g>
    </svg>
  );
};

// the whole staircase is drawn faint and dashed, and its established stretches solid on top
const ChartLine: FC<{ line: string; established: string[] }> = ({
  line,
  established,
}) => (
  <g fill="none" strokeLinejoin="round">
    <path d={line} strokeDasharray="1 3" className="stroke-muted-foreground" />
    {established.map((path) => (
      <path
        key={path}
        d={path}
        strokeWidth={1.5}
        className="stroke-foreground"
      />
    ))}
  </g>
);

/** where the cursor is drawn: glued to a pointer, gliding between points picked any other way */
function useCursorX(target: number | null, isPointerDriven: boolean) {
  const shouldReduceMotion = useReducedMotion();
  const x = useSpring(target ?? 0, CURSOR_SPRING);
  const isShownRef = useRef(false);

  useLayoutEffect(() => {
    if (target === null) {
      isShownRef.current = false;
      return;
    }
    // it has nowhere to glide from when it has only just appeared
    if (isPointerDriven || shouldReduceMotion || !isShownRef.current) {
      x.jump(target);
    } else {
      x.set(target);
    }
    isShownRef.current = true;
  }, [target, isPointerDriven, shouldReduceMotion, x]);

  return x;
}

/** eases the drawn domain towards a new one, from wherever it is at that moment */
function useEased(start: number, min: number, max: number) {
  const shouldReduceMotion = useReducedMotion();
  const [values, setValues] = useState([start, min, max]);
  const valuesRef = useRef(values);

  useEffect(() => {
    const from = valuesRef.current;
    const to = [start, min, max];
    if (shouldReduceMotion || to.every((value, i) => value === from[i])) {
      valuesRef.current = to;
      return;
    }
    const controls = animate(0, 1, {
      type: 'spring',
      bounce: 0,
      duration: 0.5,
      onUpdate: (progress) => {
        valuesRef.current = to.map(
          (value, i) => from[i] + (value - from[i]) * progress,
        );
        setValues(valuesRef.current);
      },
    });
    return () => controls.stop();
  }, [start, min, max, shouldReduceMotion]);

  return shouldReduceMotion ? [start, min, max] : values;
}

export default RatingChart;
