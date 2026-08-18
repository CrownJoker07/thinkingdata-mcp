import { z } from "zod";

export const tableTypeSchema = z.enum(["event", "user"]);

export const eventReferenceSchema = z.object({ name: z.string().min(1) }).strict();

export const propertyReferenceSchema = z.object({
  name: z.string().min(1),
  table_type: tableTypeSchema,
}).strict();

export const timeRangeSchema = z.union([
  z.object({ start_time: z.string().min(1), end_time: z.string().min(1) }).strict(),
  z.object({ recent_day: z.string().min(1) }).strict(),
]);

export const comparatorSchema = z.enum([
  "equal",
  "notEqual",
  "isTrue",
  "isFalse",
  "isNull",
  "notNull",
  "include",
  "notInclude",
  "less",
  "greater",
  "range",
  "regexMatch",
  "notRegexMatch",
  "relativeCurrentBetween",
  "relativeCurrentBefore",
  "relativeEventBefore",
  "relativeEventAfter",
  "relativeEventAbsolute",
  "arrayIncludeItem",
  "arrayNotIncludeItem",
  "arrayItemPos",
  "arrayIsNull",
  "arrayNotNull",
]);

export const filterSchema = z.object({
  property: z.object({
    name: z.string().min(1),
    table_type: z.enum(["event", "user", "cluster"]),
  }).strict(),
  comparator: comparatorSchema,
  values: z.array(z.union([z.string(), z.number()])),
  time_unit: z.enum(["minute", "hour", "day"]).optional(),
}).strict();

export const groupPropertySchema = propertyReferenceSchema;

export function mapTimeRange(range: z.infer<typeof timeRangeSchema>) {
  return "recent_day" in range
    ? { recentDay: range.recent_day }
    : { startTime: range.start_time, endTime: range.end_time };
}

export function mapProperty(property: z.infer<typeof propertyReferenceSchema>) {
  return { columnName: property.name, tableType: property.table_type };
}

export function mapFilter(filter: z.infer<typeof filterSchema>) {
  return {
    columnName: filter.property.name,
    tableType: filter.property.table_type,
    comparator: filter.comparator,
    ftv: filter.values,
    ...(filter.time_unit === undefined ? {} : { timeUnit: filter.time_unit }),
  };
}
