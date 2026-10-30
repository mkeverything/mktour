import type { Column } from 'drizzle-orm';
import { sql, type SQL } from 'drizzle-orm';

/** lowercased column: `lower(column)`, e.g. for case-insensitive `orderBy`. */
export function lower(column: Column): SQL {
  return sql`lower(${column})`;
}

/** case-insensitive equality: `lower(column) = lower(value)`. */
export function lowerEq(column: Column, value: string): SQL {
  return sql`lower(${column}) = ${value.toLowerCase()}`;
}
