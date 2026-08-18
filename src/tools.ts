import { z } from "zod";
import type { ThinkingDataClient } from "./client.js";
import { mapFilter, mapProperty, mapTimeRange } from "./schemas/common.js";
import {
  distributionAnalysisSchema,
  eventAnalysisSchema,
  funnelAnalysisSchema,
  intervalAnalysisSchema,
  pathAnalysisSchema,
  retentionAnalysisSchema,
  userPropertyAnalysisSchema,
} from "./schemas/tools.js";

export const DOCUMENT_BASE = "https://docs-v2.thinkingdata.cn/?version=v5.0&lan=zh-CN";

export type ToolSpec = {
  path: string;
  code: string;
  map: (input: never, projectId: string) => unknown;
};

const eventView = (timeRange: Parameters<typeof mapTimeRange>[0], filters?: Parameters<typeof mapFilter>[0][]) => ({
  ...mapTimeRange(timeRange),
  ...(filters ? { filts: filters.map(mapFilter) } : {}),
});

export const analysisToolSpecs = {
  query_event_analysis: {
    path: "/open/event-analyze",
    code: "event_query_api",
    schema: eventAnalysisSchema,
    map: (input: z.infer<typeof eventAnalysisSchema>, projectId: string) => ({
      projectId,
      eventView: {
        ...eventView(input.time_range, input.filters),
        timeParticleSize: input.time_granularity,
        ...(input.group_by ? { groupBy: input.group_by.map(mapProperty) } : {}),
      },
      events: [{ eventName: input.event.name, analysis: input.metric, type: "normal" }],
    }),
  },
  query_retention_analysis: {
    path: "/open/retention-analyze",
    code: "retention_query_api",
    schema: retentionAnalysisSchema,
    map: (input: z.infer<typeof retentionAnalysisSchema>, projectId: string) => ({
      projectId,
      eventView: {
        ...eventView(input.time_range, input.filters),
        statType: "retention",
        timeParticleSize: input.time_granularity,
        unitNum: input.unit_num,
      },
      events: [
        { eventName: input.initial_event.name, type: "first" },
        { eventName: input.returning_event.name, type: "second" },
      ],
    }),
  },
  query_funnel_analysis: {
    path: "/open/funnel-analyze",
    code: "funnel_query_api",
    schema: funnelAnalysisSchema,
    map: (input: z.infer<typeof funnelAnalysisSchema>, projectId: string) => ({
      projectId,
      funnelView: {
        ...eventView(input.time_range, input.filters),
        conversionWindow: input.conversion_window.value,
        windowUnit: input.conversion_window.unit,
      },
      events: input.steps.map((step) => ({ eventName: step.name })),
    }),
  },
  query_distribution_analysis: {
    path: "/open/distribution-analyze",
    code: "distribution_query_api",
    schema: distributionAnalysisSchema,
    map: (input: z.infer<typeof distributionAnalysisSchema>, projectId: string) => ({
      projectId,
      distributionView: mapTimeRange(input.time_range),
      events: [{ eventName: input.event.name, analysis: input.metric, byField: mapProperty(input.distribution_property) }],
    }),
  },
  query_path_analysis: {
    path: "/open/path-analyze",
    code: "path_query_api",
    schema: pathAnalysisSchema,
    map: (input: z.infer<typeof pathAnalysisSchema>, projectId: string) => ({
      projectId,
      eventView: mapTimeRange(input.time_range),
      events: {
        event_names: input.events.map((event) => event.name),
        source_event: { event_name: input.start_event.name },
        source_type: input.direction,
      },
    }),
  },
  query_interval_analysis: {
    path: "/open/interval-analyze",
    code: "interval_query_api",
    schema: intervalAnalysisSchema,
    map: (input: z.infer<typeof intervalAnalysisSchema>, projectId: string) => ({
      projectId,
      intervalView: mapTimeRange(input.time_range),
      events: [{ eventName: input.start_event.name }, { eventName: input.end_event.name }],
    }),
  },
  query_user_property_analysis: {
    path: "/open/user-prop-analyze",
    code: "user_prop_query_api",
    schema: userPropertyAnalysisSchema,
    map: (input: z.infer<typeof userPropertyAnalysisSchema>, projectId: string) => ({
      projectId,
      userPropView: mapTimeRange(input.time_range),
      userProps: [{ ...mapProperty(input.property), analysis: input.aggregation }],
    }),
  },
} as const;

export async function callAnalysisTool(
  client: ThinkingDataClient,
  projectId: string,
  spec: (typeof analysisToolSpecs)[keyof typeof analysisToolSpecs],
  input: unknown,
) {
  const parsed = spec.schema.parse(input) as never;
  return client.postJson(spec.path, spec.map(parsed, projectId));
}
