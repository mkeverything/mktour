export interface GlickoPlayer {
  rating: number;
  ratingDeviation: number;
  volatility: number;
}

export interface GameResult {
  opponentRating: number;
  opponentRatingDeviation: number;
  score: number; // 1 = win, 0.5 = draw, 0 = loss
}

export interface RatingUpdate {
  newRating: number;
  newRatingDeviation: number;
  newVolatility: number;
}

export const GLICKO2_CONSTANTS = {
  DEFAULT_RATING: 1500,
  DEFAULT_RD: 350,
  DEFAULT_VOLATILITY: 0.06,
  MIN_RD: 30,
  MAX_RD: 350,
  TAU: 0.5,
  EPSILON: 0.000001,
  SCALE_FACTOR: 173.7178,
  STABLE_RD_THRESHOLD: 110,
} as const;

export class Glicko2Calculator {
  private readonly constants = GLICKO2_CONSTANTS;

  public getConstants() {
    return this.constants;
  }

  private toGlicko2Scale(
    rating: number,
    rd: number,
  ): { mu: number; phi: number } {
    const mu =
      (rating - this.constants.DEFAULT_RATING) / this.constants.SCALE_FACTOR;
    const phi = rd / this.constants.SCALE_FACTOR;
    return { mu, phi };
  }

  private fromGlicko2Scale(
    mu: number,
    phi: number,
  ): { rating: number; rd: number } {
    const rating =
      mu * this.constants.SCALE_FACTOR + this.constants.DEFAULT_RATING;
    const rd = phi * this.constants.SCALE_FACTOR;
    return { rating, rd };
  }

  /**
   * the g function - reduces impact of games with high RD
   */
  private g(phi: number): number {
    return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
  }

  /**
   * the E function - expected score
   */
  private E(mu: number, mu_j: number, phi_j: number): number {
    return 1 / (1 + Math.exp(-this.g(phi_j) * (mu - mu_j)));
  }

  /**
   * compute new volatility using the illinois algorithm
   */
  private computeNewVolatility(
    phi: number,
    v: number,
    delta: number,
    sigma: number,
  ): number {
    const tau = this.constants.TAU;
    const epsilon = this.constants.EPSILON;

    const alpha = Math.log(sigma * sigma);
    const phi_sq = phi * phi;
    const delta_sq = delta * delta;

    // define function f(alpha)
    const f = (x: number): number => {
      const exp_x = Math.exp(x);
      const phi_sq_plus = phi_sq + v + exp_x;
      const term1 =
        (exp_x * (delta_sq - phi_sq - v - exp_x)) /
        (2 * phi_sq_plus * phi_sq_plus);
      const term2 = (x - alpha) / (tau * tau);
      return term1 - term2;
    };

    // find bounds for the algorithm
    let A = alpha;
    let B: number;

    if (delta_sq > phi_sq + v) {
      B = Math.log(delta_sq - phi_sq - v);
    } else {
      let k = 1;
      while (f(alpha - k * tau) < 0) {
        k++;
      }
      B = alpha - k * tau;
    }

    // illinois algorithm for finding the root
    let fA = f(A);
    let fB = f(B);

    let iterations = 0;
    const maxIterations = 100;

    while (Math.abs(B - A) > epsilon && iterations < maxIterations) {
      const C = A + ((A - B) * fA) / (fB - fA);
      const fC = f(C);

      if (fC * fB < 0) {
        A = B;
        fA = fB;
      } else {
        fA = fA / 2;
      }

      B = C;
      fB = fC;
      iterations++;
    }

    // fallback to original volatility if algorithm fails
    if (iterations >= maxIterations) {
      return sigma;
    }

    return Math.exp(A / 2);
  }

  /**
   * apply rating period calculations for a player
   */
  public calculateNewRatings(
    player: GlickoPlayer,
    results: GameResult[],
  ): RatingUpdate {
    // if no games played, only apply RD increase
    if (results.length === 0) {
      // apply time-based RD increase (assuming one rating period)
      const phi = player.ratingDeviation / this.constants.SCALE_FACTOR;
      const sigma = player.volatility;
      const phi_new = Math.sqrt(phi * phi + sigma * sigma);
      const newRD = Math.min(
        phi_new * this.constants.SCALE_FACTOR,
        this.constants.MAX_RD,
      );

      return {
        newRating: Math.round(player.rating),
        newRatingDeviation: Math.round(newRD),
        newVolatility: player.volatility,
      };
    }

    // convert to glicko-2 scale
    const { mu, phi } = this.toGlicko2Scale(
      player.rating,
      player.ratingDeviation,
    );
    const sigma = player.volatility;

    // step: 3: compute v (estimated variance of player's rating)
    let v = 0;
    for (const result of results) {
      const { mu: mu_j, phi: phi_j } = this.toGlicko2Scale(
        result.opponentRating,
        result.opponentRatingDeviation,
      );
      const g_phi_j = this.g(phi_j);
      const E_val = this.E(mu, mu_j, phi_j);
      v += g_phi_j * g_phi_j * E_val * (1 - E_val);
    }
    v = 1 / v;

    // step: 4: compute delta (improvement estimation)
    let delta = 0;
    for (const result of results) {
      const { mu: mu_j, phi: phi_j } = this.toGlicko2Scale(
        result.opponentRating,
        result.opponentRatingDeviation,
      );
      const g_phi_j = this.g(phi_j);
      const E_val = this.E(mu, mu_j, phi_j);
      delta += g_phi_j * (result.score - E_val);
    }
    delta *= v;

    // step: 5: determine new volatility
    const sigma_new = this.computeNewVolatility(phi, v, delta, sigma);

    // step: 6: update phi to phi_star
    const phi_star = Math.sqrt(phi * phi + sigma_new * sigma_new);

    // Step 7: Update phi and mu
    const phi_new = 1 / Math.sqrt(1 / (phi_star * phi_star) + 1 / v);

    let mu_new = mu;
    for (const result of results) {
      const { mu: mu_j, phi: phi_j } = this.toGlicko2Scale(
        result.opponentRating,
        result.opponentRatingDeviation,
      );
      const g_phi_j = this.g(phi_j);
      const E_val = this.E(mu, mu_j, phi_j);
      mu_new += phi_new * phi_new * g_phi_j * (result.score - E_val);
    }

    // convert back to original scale
    const { rating, rd } = this.fromGlicko2Scale(mu_new, phi_new);

    // apply constraints and round to integers for rating/RD, keep volatility as float
    const finalRating = Math.round(rating);
    const finalRD = Math.max(
      Math.min(Math.round(rd), this.constants.MAX_RD),
      this.constants.MIN_RD,
    );
    const finalVolatility = sigma_new;

    return {
      newRating: finalRating,
      newRatingDeviation: finalRD,
      newVolatility: finalVolatility,
    };
  }

  /**
   * convert database format to calculation format
   */
  public fromDbFormat(
    rating: number,
    ratingDeviation: number,
    volatility: number,
  ): GlickoPlayer {
    return {
      rating,
      ratingDeviation,
      volatility,
    };
  }

  /**
   * convert calculation format to database format
   */
  public toDbFormat(player: GlickoPlayer): {
    rating: number;
    ratingDeviation: number;
    volatility: number;
  } {
    return {
      rating: Math.round(player.rating),
      ratingDeviation: Math.round(player.ratingDeviation),
      volatility: player.volatility,
    };
  }
}

export const glicko2Calculator = new Glicko2Calculator();
