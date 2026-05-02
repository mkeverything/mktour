import type { Column } from 'drizzle-orm';
import { sql, type SQL } from 'drizzle-orm';

/** Sqlite case-insensitive equality: `lower(column) = lower(value)`. */
export function lowerEq(column: Column, value: string): SQL {
  return sql`lower(${column}) = ${value.toLowerCase()}`;
}
