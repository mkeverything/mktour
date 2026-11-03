import { type AnyColumn, type SQL, asc, desc, sql } from 'drizzle-orm';

export type Ordering = [column: AnyColumn | SQL, direction: 'asc' | 'desc'][];

/** `asc`/`desc` expressions to spread into `orderBy` */
export const sortExpressions = (ordering: Ordering) =>
  ordering.map(([column, direction]) =>
    direction === 'asc' ? asc(column) : desc(column),
  );

/** the same ordering with every direction flipped */
export const reverse = (ordering: Ordering): Ordering =>
  ordering.map(([column, direction]) => [
    column,
    direction === 'asc' ? 'desc' : 'asc',
  ]);

/** `row_number() over (order by …)`: 1, 2, 3… along `ordering` */
export const rowNumber = (ordering: Ordering) =>
  sql<number>`row_number() over (order by ${sql.join(sortExpressions(ordering), sql`, `)})`.mapWith(
    Number,
  );
