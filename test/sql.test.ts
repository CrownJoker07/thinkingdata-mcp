import { describe, expect, it } from "vitest";
import { assertReadOnlySql } from "../src/sql.js";

describe("read-only SQL validation", () => {
  it.each([
    "SELECT * FROM events",
    "  select count(*) FROM events  ",
    "WITH data AS (SELECT * FROM events) SELECT * FROM data",
  ])("accepts %s", (sql) => {
    expect(assertReadOnlySql(sql)).toBe(sql.trim());
  });

  it.each([
    "",
    "DELETE FROM events",
    "INSERT INTO target SELECT * FROM source",
    "UPDATE events SET value = 1",
    "DROP TABLE events",
    "CALL procedure()",
    "SELECT 1; DROP TABLE events",
    "SELECT 1;",
    "-- comment\nSELECT 1",
    "SELECT /* comment */ 1",
    "WITH data AS (VALUES 1)",
    "WITH data AS (DELETE FROM events) SELECT * FROM data",
  ])("rejects %s", (sql) => {
    expect(() => assertReadOnlySql(sql)).toThrow();
  });
});
