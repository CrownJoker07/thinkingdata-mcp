import { z } from "zod";
import {
  eventReferenceSchema,
  filterSchema,
  groupPropertySchema,
  propertyReferenceSchema,
  tableTypeSchema,
  timeRangeSchema,
} from "./common.js";

export const metricSchema = z.enum(["TOTAL_TIMES", "TRIG_USER_NUM", "PER_CAPITA_TIMES"]);
export const timeGranularitySchema = z.enum(["minute", "minute5", "minute10", "hour", "day", "week", "month", "total"]);

export const eventAnalysisSchema = z.object({
  event: eventReferenceSchema,
  metric: metricSchema,
  time_range: timeRangeSchema,
  time_granularity: timeGranularitySchema,
  filters: z.array(filterSchema).optional(),
  group_by: z.array(groupPropertySchema).optional(),
}).strict();

export const retentionAnalysisSchema = z.object({
  initial_event: eventReferenceSchema,
  returning_event: eventReferenceSchema,
  time_range: timeRangeSchema,
  time_granularity: z.enum(["day", "week", "month"]),
  unit_num: z.number().int().positive(),
  filters: z.array(filterSchema).optional(),
}).strict();

export const funnelAnalysisSchema = z.object({
  steps: z.array(eventReferenceSchema).min(2),
  conversion_window: z.object({
    value: z.number().int().positive(),
    unit: z.enum(["second", "minute", "hour", "day", "week", "month"]),
  }).strict(),
  time_range: timeRangeSchema,
  filters: z.array(filterSchema).optional(),
}).strict();

export const distributionAnalysisSchema = z.object({
  event: eventReferenceSchema,
  metric: metricSchema,
  time_range: timeRangeSchema,
  time_granularity: z.enum(["day", "week", "month", "total"]),
}).strict();

export const pathAnalysisSchema = z.object({
  events: z.array(eventReferenceSchema).min(1),
  start_event: eventReferenceSchema,
  direction: z.enum(["initial_event", "termination_event"]),
  time_range: timeRangeSchema,
  column_limit: z.number().int().min(0).max(20),
  session_window: z.object({ value: z.number().int().positive(), unit: z.enum(["second", "minute", "hour"]) }).strict(),
}).strict();

export const intervalAnalysisSchema = z.object({
  start_event: eventReferenceSchema,
  end_event: eventReferenceSchema,
  time_range: timeRangeSchema,
  time_granularity: z.enum(["minute", "hour", "day", "week", "month", "total"]),
}).strict();

export const userPropertyAnalysisSchema = z.object({
  property: propertyReferenceSchema,
  aggregation: z.enum([
    "TRIG_USER_NUM",
    "SUM",
    "AVG",
    "MAX",
    "MIN",
    "DISTINCT",
    "TRUE",
    "FALSE",
    "IS_NOT_EMPTY",
    "IS_EMPTY",
    "ARRAY_DISTINCT",
    "ARRAY_SET_DISTINCT",
    "ARRAY_ITEM_DISTINCT",
    "MEDIAN",
    "PERCENTILE",
  ]),
}).strict();

export const sqlQuerySchema = z.object({ sql: z.string().min(1) }).strict();
export const emptySchema = z.object({}).strict();
export const propertyMetadataSchema = z.object({
  table_type: tableTypeSchema,
  event_name: z.string().min(1).optional(),
}).strict().superRefine((value, context) => {
  if (value.table_type === "user" && value.event_name !== undefined) {
    context.addIssue({ code: "custom", path: ["event_name"], message: "event_name is only valid for event properties" });
  }
});
