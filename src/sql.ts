const forbiddenSqlKeyword =
  /\b(INSERT|UPDATE|DELETE|MERGE|CREATE|ALTER|DROP|TRUNCATE|REPLACE|GRANT|REVOKE|CALL|EXECUTE|SET|RESET|USE|REFRESH|OPTIMIZE|ANALYZE|COMMENT)\b/i;

export function assertReadOnlySql(sql: string): string {
  let normalized = sql.trim();
  const fencedSql = /^```(?:sql)?\s*\n([\s\S]*?)\n```$/i.exec(normalized);
  if (fencedSql) normalized = fencedSql[1].trim();

  if (normalized.includes(";")) {
    throw new Error("SQL must contain exactly one statement without a semicolon");
  }
  if (normalized.includes("--") || normalized.includes("/*") || normalized.includes("*/")) {
    throw new Error("SQL comments are not allowed");
  }
  if (!/^(SELECT|WITH)\b/i.test(normalized)) {
    throw new Error("Only SELECT or WITH queries are allowed");
  }
  if (/^WITH\b/i.test(normalized) && !/\bSELECT\b/i.test(normalized)) {
    throw new Error("A WITH query must contain SELECT");
  }
  if (forbiddenSqlKeyword.test(normalized)) {
    throw new Error("SQL contains a non-read-only operation");
  }

  return normalized;
}
