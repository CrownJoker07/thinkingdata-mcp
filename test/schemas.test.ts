import { describe, expect, it } from "vitest";
import {
  eventAnalysisSchema,
  funnelAnalysisSchema,
  propertyMetadataSchema,
} from "../src/schemas/tools.js";

describe("tool input schemas", () => {
  it("accepts a valid event analysis request", () => {
    expect(eventAnalysisSchema.safeParse({
      event: { name: "login" },
      metric: "TOTAL_TIMES",
      time_range: { recent_day: "1-7" },
      time_granularity: "day",
    }).success).toBe(true);
  });

  it("rejects a missing required field", () => {
    expect(eventAnalysisSchema.safeParse({ event: { name: "login" } }).success).toBe(false);
  });

  it("rejects an unsupported enum", () => {
    expect(eventAnalysisSchema.safeParse({
      event: { name: "login" }, metric: "COUNT", time_range: { recent_day: "1-7" }, time_granularity: "day",
    }).success).toBe(false);
  });

  it("rejects mixed absolute and relative time ranges", () => {
    expect(eventAnalysisSchema.safeParse({
      event: { name: "login" }, metric: "TOTAL_TIMES",
      time_range: { recent_day: "1-7", start_time: "2026-01-01", end_time: "2026-01-02" },
      time_granularity: "day",
    }).success).toBe(false);
  });

  it("requires at least two funnel steps", () => {
    expect(funnelAnalysisSchema.safeParse({
      steps: [{ name: "login" }], conversion_window: { value: 1, unit: "day" }, time_range: { recent_day: "1-7" },
    }).success).toBe(false);
  });

  it("rejects event_name for user properties", () => {
    expect(propertyMetadataSchema.safeParse({ table_type: "user", event_name: "login" }).success).toBe(false);
  });
});
