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
  "include",
  "notInclude",
  "less",
  "greater",
  "lessEqual",
  "greaterEqual",
  "isNull",
  "notNull",
]);

export const filterSchema = z.object({
  property: propertyReferenceSchema,
  comparator: comparatorSchema,
  values: z.array(z.string()),
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
    ...mapProperty(filter.property),
    comparator: filter.comparator,
    ftv: filter.values,
  };
}
