import { describe, expect, it } from "vitest";
import { analysisToolSpecs } from "../src/tools.js";

describe("request mapping", () => {
  it("maps event analysis to the official method body", () => {
    const spec = analysisToolSpecs.query_event_analysis;
    expect(spec.map(spec.schema.parse({
      event: { name: "login" }, metric: "TOTAL_TIMES",
      time_range: { start_time: "2026-01-01 00:00:00", end_time: "2026-01-02 23:59:59" },
      time_granularity: "day",
      group_by: [{ name: "#city", table_type: "event" }],
    }), "377")).toMatchObject({
      projectId: "377",
      eventView: { startTime: "2026-01-01 00:00:00", endTime: "2026-01-02 23:59:59", timeParticleSize: "day" },
      events: [{ eventName: "login", analysis: "TOTAL_TIMES", type: "normal" }],
    });
    expect(spec.path).toBe("/open/event-analyze");
  });

  it("maps retention analysis and global filters to the official method body", () => {
    const spec = analysisToolSpecs.query_retention_analysis;
    expect(spec.map(spec.schema.parse({
      initial_event: { name: "register" },
      returning_event: { name: "login" },
      time_range: { recent_day: "1-7" },
      time_granularity: "day",
      unit_num: 7,
      filters: [{
        property: { name: "app_version", table_type: "event" },
        comparator: "equal",
        values: ["1.0"],
      }],
    }), "377")).toEqual({
      projectId: "377",
      eventView: {
        recentDay: "1-7",
        filts: [{ columnName: "app_version", tableType: "event", comparator: "equal", ftv: ["1.0"] }],
        statType: "retention",
        timeParticleSize: "day",
        unitNum: 7,
      },
      events: [
        { eventName: "register", type: "first" },
        { eventName: "login", type: "second" },
      ],
    });
  });

  it("maps path direction and event collection", () => {
    const spec = analysisToolSpecs.query_path_analysis;
    expect(spec.map(spec.schema.parse({
      events: [{ name: "login" }, { name: "purchase" }], start_event: { name: "login" },
      direction: "initial_event", time_range: { recent_day: "1-7" },
    }), "377")).toMatchObject({
      projectId: "377",
      events: { event_names: ["login", "purchase"], source_event: { event_name: "login" }, source_type: "initial_event" },
    });
  });
});
