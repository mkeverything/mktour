import { glicko2Calculator, type GameResult } from '@/lib/glicko2';
import { describe, expect, it } from 'bun:test';

describe('glicko-2', () => {
  // test case 1: new player plays 5 games with mixed results
  it('should calculate ratings correctly for a new player', () => {
    const newPlayer = {
      rating: 1500,
      ratingDeviation: 350,
      volatility: 0.06,
    };

    const results: GameResult[] = [
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

    const results: GameResult[] = [
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

  // test case 3: player with no games (inactivity)
  it('should increase RD for inactive players', () => {
    const inactivePlayer = {
      rating: 1600,
      ratingDeviation: 80,
      volatility: 0.06,
    };

    const results: GameResult[] = []; // No games played

    const update = glicko2Calculator.calculateNewRatings(
      inactivePlayer,
      results,
    );

    // expected: rating unchanged, RD increased slightly, volatility unchanged
    expect(update.newRating).toBe(inactivePlayer.rating);
    expect(update.newRatingDeviation).toBeGreaterThan(
      inactivePlayer.ratingDeviation,
    );
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
    expect(dbFormat.ratingDeviation).toBe(
      Math.round(calcPlayer.ratingDeviation),
    );
  });

  // test case 5: extreme opponent ratings
  it('should handle extreme opponent ratings gracefully', () => {
    const player = {
      rating: 1500,
      ratingDeviation: 200,
      volatility: 0.06,
    };

    const resultsHigh: GameResult[] = [
      { opponentRating: 3000, opponentRatingDeviation: 50, score: 0.0 }, // Expected loss
    ];

    const updateHigh = glicko2Calculator.calculateNewRatings(
      player,
      resultsHigh,
    );
    // should lose very little rating for losing to a much stronger player
    expect(Math.abs(updateHigh.newRating - player.rating)).toBeLessThan(5);

    const resultsLow: GameResult[] = [
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
    const results: GameResult[] = Array(5).fill({
      opponentRating: 1500,
      opponentRatingDeviation: 50,
      score: 1.0,
    });

    const update = glicko2Calculator.calculateNewRatings(player, results);

    expect(update.newRating - player.rating).toBeGreaterThan(50); // significant gain
    expect(update.newVolatility).toBeGreaterThan(0.06); // volatility likely increases due to consistent overperformance
  });
});
