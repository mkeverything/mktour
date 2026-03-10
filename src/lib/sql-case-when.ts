import { type SQL, sql } from 'drizzle-orm';

type SQLish = SQL | undefined | number | string;

function toSQL(expr: SQLish, fallback: SQL): SQL {
  if (expr === undefined) return fallback;
  if (typeof expr === 'number' || typeof expr === 'string')
    return sql`${expr}` ?? fallback;
  return expr;
}

/**
 * Type-safe CASE WHEN helper for drizzle. Use in orderBy, select, etc.
 * @see https://github.com/drizzle-team/drizzle-orm/issues/1065#issuecomment-3002014516
 */
export class SQLCaseWhen {
  cases: SQL;

  constructor(init?: SQL | SQLCaseWhen) {
    this.cases = init
      ? sql`${init instanceof SQLCaseWhen ? init.cases : init}`
      : sql`CASE`;
  }

  when(whenExpr: SQLish, thenExpr: SQLish) {
    this.cases.append(
      sql` WHEN ${toSQL(whenExpr, sql.raw('FALSE'))} THEN ${toSQL(thenExpr, sql.raw('NULL'))}`,
    );
    return this;
  }

  else(elseExpr: SQLish) {
    return sql`${this.cases} ELSE ${toSQL(elseExpr, sql.raw('NULL'))} END` as SQL;
  }

  elseNull() {
    return sql`${this.cases} END` as SQL;
  }
}

export function caseWhen(whenExpr: SQLish, thenExpr: SQLish) {
  return new SQLCaseWhen().when(whenExpr, thenExpr);
}
