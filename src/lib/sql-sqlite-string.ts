import type { Column } from 'drizzle-orm';
import { sql, type SQL } from 'drizzle-orm';

/** sqlite case-insensitive equality: `lower(column) = lower(value)`. */
export function lowerEq(column: Column, value: string): SQL {
  return sql`lower(${column}) = ${value.toLowerCase()}`;
}

/**
 * sqlite case-insensitive `like`: `lower(column) like lower(pattern)`.
 * pass a pattern that already includes `%` wildcards (e.g. `%${query}%`).
 */
export function lowerLike(column: Column, likePattern: string): SQL {
  return sql`lower(${column}) like lower(${likePattern})`;
}
