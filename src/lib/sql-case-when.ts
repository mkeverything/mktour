import { type SQL, sql } from 'drizzle-orm';

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

  when(whenExpr: SQL, thenExpr: SQL) {
    this.cases.append(sql` WHEN ${whenExpr} THEN ${thenExpr}`);
    return this;
  }

  else(elseExpr: SQL) {
    return sql`${this.cases} ELSE ${elseExpr} END` as SQL;
  }

  elseNull() {
    return sql`${this.cases} END` as SQL;
  }
}

export function caseWhen(whenExpr: SQL, thenExpr: number | string) {
  return new SQLCaseWhen().when(whenExpr, sql<typeof thenExpr>`${thenExpr}`);
}
