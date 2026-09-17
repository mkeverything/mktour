import {
  getCurrentRatingDeviation,
  GLICKO2_CONSTANTS,
  glicko2Calculator,
  isEstablishedRating,
  type GlickoGameResult,
} from '@/lib/glicko2';
import { describe, expect, it } from 'bun:test';

describe('glicko-2', () => {
  it('requires rd strictly below 110 for establishment', () => {
    expect(isEstablishedRating(109.999)).toBe(true);
    expect(isEstablishedRating(110)).toBe(false);
    expect(isEstablishedRating(110.001)).toBe(false);
  });

  // test case 1: new player plays 5 games with mixed results
  it('should calculate ratings correctly for a new player', () => {
    const newPlayer = {
      rating: 1500,
      ratingDeviation: 350,
      volatility: 0.06,
    };

    const results: GlickoGameResult[] = [
      { opponentRating: 1000, opponentRatingDeviation: 50, score: 1.0 }, // Win against lower-rated
      { opponentRating: 1500, opponentRatingDeviation: 60, score: 0.5 }, // Draw against equal-rated
      { opponentRating: 1900, opponentRatingDeviation: 70, score: 0.0 }, // Loss against higher-rated
      { opponentRating: 1350, opponentRatingDeviation: 55, score: 1.0 }, // Win against slightly lower
      { opponentRating: 1550, opponentRatingDeviation: 65, score: 1.0 }, // Win against slightly higher
    ];

    const update = glicko2Calculator.calculateNewRatings(newPlayer, results);

    // expected: rating should increase (performed well), RD should decrease significantly
    const expectedRatingRange = { min: 1600, max: 1650 };
    const expectedRDRange = { min: 150, max: 200 };

    expect(update.newRating).toBeGreaterThanOrEqual(expectedRatingRange.min);
    expect(update.newRating).toBeLessThanOrEqual(expectedRatingRange.max);

    expect(update.newRatingDeviation).toBeGreaterThanOrEqual(
      expectedRDRange.min,
    );
    expect(update.newRatingDeviation).toBeLessThanOrEqual(expectedRDRange.max);

    expect(update.newRating).toBeGreaterThan(newPlayer.rating);
    expect(update.newRatingDeviation).toBeLessThan(newPlayer.ratingDeviation);
  });

  // test case 2: established player with volatile performance
  it('should handle volatile performance for an established player', () => {
    const establishedPlayer = {
      rating: 1800,
      ratingDeviation: 50,
      volatility: 0.06,
    };

    const results: GlickoGameResult[] = [
      { opponentRating: 1600, opponentRatingDeviation: 50, score: 0.0 }, // Unexpected loss
      { opponentRating: 2000, opponentRatingDeviation: 60, score: 1.0 }, // Unexpected win
      { opponentRating: 1800, opponentRatingDeviation: 50, score: 0.0 }, // Unexpected loss
    ];

    const update = glicko2Calculator.calculateNewRatings(
      establishedPlayer,
      results,
    );

    // expected: rating might decrease slightly, RD should increase, volatility should increase
    const expectedRatingRange = { min: 1780, max: 1800 };
    const expectedRDRange = { min: 45, max: 55 };
    const expectedVolatilityMin = 0.055;

    expect(update.newRating).toBeGreaterThanOrEqual(expectedRatingRange.min);
    expect(update.newRating).toBeLessThanOrEqual(expectedRatingRange.max);

    expect(update.newRatingDeviation).toBeGreaterThanOrEqual(
      expectedRDRange.min,
    );
    expect(update.newRatingDeviation).toBeLessThanOrEqual(expectedRDRange.max);

    expect(update.newVolatility).toBeGreaterThanOrEqual(expectedVolatilityMin);
  });

  // test case 3: player with no games leaves the calculation untouched;
  // inactivity growth is the caller's job via getCurrentRatingDeviation
  it('should return the player unchanged when there are no results', () => {
    const inactivePlayer = {
      rating: 1600,
      ratingDeviation: 80,
      volatility: 0.06,
    };

    const update = glicko2Calculator.calculateNewRatings(inactivePlayer, []);

    expect(update.newRating).toBe(inactivePlayer.rating);
    expect(update.newRatingDeviation).toBe(inactivePlayer.ratingDeviation);
    expect(update.newVolatility).toBe(inactivePlayer.volatility);
  });

  // test case 4: database format conversion
  it('should correctly convert between DB and calculation formats', () => {
    // test conversion from database format
    const dbPlayer = glicko2Calculator.fromDbFormat(1500, 350, 0.06);

    expect(dbPlayer.rating).toBe(1500);
    expect(dbPlayer.ratingDeviation).toBe(350);
    expect(dbPlayer.volatility).toBe(0.06);

    // test conversion to database format
    const calcPlayer = {
      rating: 1525.7,
      ratingDeviation: 325.3,
      volatility: 0.058,
    };

    const dbFormat = glicko2Calculator.toDbFormat(calcPlayer);

    expect(Math.abs(dbFormat.volatility - calcPlayer.volatility)).toBeLessThan(
      0.001,
    );
    expect(dbFormat.rating).toBe(Math.round(calcPlayer.rating));
    // rd stays fractional through storage; rounding is for presentation only
    expect(dbFormat.ratingDeviation).toBe(calcPlayer.ratingDeviation);
  });

  // test case 5: extreme opponent ratings
  it('should handle extreme opponent ratings gracefully', () => {
    const player = {
      rating: 1500,
      ratingDeviation: 200,
      volatility: 0.06,
    };

    const resultsHigh: GlickoGameResult[] = [
      { opponentRating: 3000, opponentRatingDeviation: 50, score: 0.0 }, // Expected loss
    ];

    const updateHigh = glicko2Calculator.calculateNewRatings(
      player,
      resultsHigh,
    );
    // should lose very little rating for losing to a much stronger player
    expect(Math.abs(updateHigh.newRating - player.rating)).toBeLessThan(5);

    const resultsLow: GlickoGameResult[] = [
      { opponentRating: 500, opponentRatingDeviation: 50, score: 1.0 }, // Expected win
    ];

    const updateLow = glicko2Calculator.calculateNewRatings(player, resultsLow);
    // Should gain very little rating for beating a much weaker player
    expect(updateLow.newRating - player.rating).toBeLessThan(5);
  });

  // test case 6: winning streak
  it('should reward winning streaks with higher rating gains', () => {
    const player = {
      rating: 1500,
      ratingDeviation: 200,
      volatility: 0.06,
    };

    // 5 wins against equal opponents
    const results: GlickoGameResult[] = Array(5).fill({
      opponentRating: 1500,
      opponentRatingDeviation: 50,
      score: 1.0,
    });

    const update = glicko2Calculator.calculateNewRatings(player, results);

    expect(update.newRating - player.rating).toBeGreaterThan(50); // significant gain
    expect(update.newVolatility).toBeGreaterThan(0.06); // volatility likely increases due to consistent overperformance
  });
});

describe('elapsed-time rating deviation', () => {
  const WEEK = GLICKO2_CONSTANTS.RATING_PERIOD_MS;
  const now = new Date('2026-06-01T00:00:00.000Z');
  const weeksAgo = (weeks: number) => new Date(now.getTime() - weeks * WEEK);

  const rdAfter = (weeks: number, ratingDeviation = 60) =>
    getCurrentRatingDeviation(
      {
        ratingDeviation,
        ratingVolatility: 0.06,
        ratingLastUpdateAt: weeksAgo(weeks),
      },
      now,
    );

  it('grows continuously with fractional weeks, capped at the maximum', () => {
    expect(rdAfter(0)).toBe(60);
    expect(rdAfter(0.5)).toBeGreaterThan(60);
    // variance grows linearly with time
    expect(rdAfter(2) ** 2 - 60 ** 2).toBeCloseTo(
      2 * (rdAfter(1) ** 2 - 60 ** 2),
      6,
    );
    expect(rdAfter(5000)).toBe(GLICKO2_CONSTANTS.MAX_RD);
  });

  it('matches the documented calibration: rd 60 -> ~80 after six months, ~110 after eighteen', () => {
    expect(rdAfter(26)).toBeCloseTo(80.2, 0);
    expect(rdAfter(78)).toBeCloseTo(109.9, 0);
  });

  // weekly-schedule oracle: with exactly one period elapsed, elapsed-time growth
  // followed by result incorporation reproduces standard glicko-2, checked
  // against the worked example in glickman's glicko-2 paper
  it('reproduces the glicko-2 paper example when exactly one period has elapsed', () => {
    const stored = {
      rating: 1500,
      ratingDeviation: 200,
      ratingVolatility: 0.06,
      ratingLastUpdateAt: weeksAgo(1),
    };
    const results: GlickoGameResult[] = [
      { opponentRating: 1400, opponentRatingDeviation: 30, score: 1 },
      { opponentRating: 1550, opponentRatingDeviation: 100, score: 0 },
      { opponentRating: 1700, opponentRatingDeviation: 300, score: 0 },
    ];

    const update = glicko2Calculator.calculateNewRatings(
      {
        rating: stored.rating,
        ratingDeviation: getCurrentRatingDeviation(stored, now),
        volatility: stored.ratingVolatility,
      },
      results,
    );

    expect(update.newRating).toBe(1464);
    expect(update.newRatingDeviation).toBeCloseTo(151.52, 1);
    expect(update.newVolatility).toBeCloseTo(0.05999, 4);
  });

  it('does not add a fixed drift per tournament when no time has elapsed', () => {
    const player = { rating: 1500, ratingDeviation: 200, volatility: 0.06 };
    const results: GlickoGameResult[] = [
      { opponentRating: 1500, opponentRatingDeviation: 50, score: 0.5 },
    ];
    // three closures at the same instant: variance only shrinks, never grows
    let rd = player.ratingDeviation;
    for (let i = 0; i < 3; i++) {
      const update = glicko2Calculator.calculateNewRatings(
        { ...player, ratingDeviation: rd },
        results,
      );
      expect(update.newRatingDeviation).toBeLessThan(rd);
      rd = update.newRatingDeviation;
    }
  });
});
