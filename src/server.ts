import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Config } from "./config.js";
import type { ThinkingDataResponse } from "./client.js";
import { ThinkingDataClient } from "./client.js";
import { analysisToolSpecs, callAnalysisTool, DOCUMENT_BASE } from "./tools.js";
import { emptySchema, propertyMetadataSchema, sqlQuerySchema } from "./schemas/tools.js";
import { assertReadOnlySql } from "./sql.js";

const outputShape = {
  source: z.object({ document_version: z.literal("5.0"), documentation_url: z.string().url(), endpoint: z.string() }),
  return_code: z.number(),
  return_message: z.string(),
  data: z.unknown().optional(),
  stackMessage: z.string().optional(),
  showStackMessage: z.boolean().optional(),
};

const annotations = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;
const packageScopeGuidance = "When querying app data, narrow the scope with an equality filter on the package name or app identifier whenever one is available. Confirm the exact property name with metadata first, and do not run a broad cross-package query unless the user explicitly asks for it.";

const descriptions: Record<keyof typeof analysisToolSpecs, string> = {
  query_event_analysis: `Query event metrics over time with optional filters and grouping. ${packageScopeGuidance}`,
  query_retention_analysis: `Query retention from an initial event to a returning event. ${packageScopeGuidance}`,
  query_funnel_analysis: `Query conversion across an ordered sequence of event steps. ${packageScopeGuidance}`,
  query_distribution_analysis: `Query the per-user distribution of an event by TIMES, NUMBER_OF_DAYS, or NUMBER_OF_HOURS, with optional event filters. These metrics do not take a property; use query_event_analysis group_by to break results down by a property. ${packageScopeGuidance}`,
  query_path_analysis: `Query paths around a selected starting event. ${packageScopeGuidance}`,
  query_interval_analysis: `Query elapsed intervals between a start and end event. ${packageScopeGuidance}`,
  query_user_property_analysis: `Query an aggregation over a user or event property. Use property metadata to choose an aggregation compatible with the property's data type; for example, use DISTINCT rather than numeric SUM or AVG for a string property. ${packageScopeGuidance}`,
};

function result(response: ThinkingDataResponse, code: string, endpoint: string) {
  const structuredContent = {
    source: {
      document_version: "5.0" as const,
      documentation_url: `${DOCUMENT_BASE}&code=${code}&anchorId=`,
      endpoint,
    },
    return_code: response.return_code,
    return_message: response.return_message,
    ...(response.data === undefined ? {} : { data: response.data }),
    ...(response.stackMessage === undefined ? {} : { stackMessage: response.stackMessage }),
    ...(response.showStackMessage === undefined ? {} : { showStackMessage: response.showStackMessage }),
  };
  return {
    content: [{ type: "text" as const, text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
    isError: response.return_code !== 0,
  };
}

export function createServer(config: Config, client = new ThinkingDataClient(config)) {
  const server = new McpServer(
    { name: "thinkingdata-readonly", version: "0.1.0" },
    {
      instructions: `This server exposes tools only and does not provide MCP resources. Do not call resources/list or resources/read for this server. Use list_event_metadata and list_property_metadata for ThinkingData metadata, and use the query tools for analysis. ${packageScopeGuidance}`,
    },
  );
  const eventTable = `v_event_${config.projectId}`;
  const userTable = `v_user_${config.projectId}`;

  for (const [name, spec] of Object.entries(analysisToolSpecs) as [keyof typeof analysisToolSpecs, (typeof analysisToolSpecs)[keyof typeof analysisToolSpecs]][]) {
    server.registerTool(name, {
      description: descriptions[name],
      inputSchema: spec.schema,
      outputSchema: outputShape,
      annotations,
    }, async (input: unknown) => result(await callAnalysisTool(client, config.projectId, spec, input), spec.code, spec.path));
  }

  server.registerTool("execute_sql_query", {
    description: `Execute one TA SQL SELECT or WITH query through ThinkingData's /querySql endpoint and return JSON rows. Pass raw SQL without Markdown code fences. Quote identifiers with double quotes, never backticks. The configured project's event table is ${eventTable} and its user table is ${userTable}; use these exact table names and do not invent, shorten, or otherwise derive table names. Use the metadata tools to confirm event names, properties, and data types before querying. Time semantics: on event tables, "$part_date" is a date-only partition derived from "#event_time"; it is not inherently UTC/UTC+0. This tool returns /querySql rows without rewriting event fields, and its request cannot activate SQL IDE report parameters or pass a timezone. Do not assume raw SQL results use the report's timezone-aware date filtering or invent a timezone-adjusted partition column. Use ThinkingData's report/analysis timezone configuration for timezone-aware reporting. For raw SQL conversion, use a valid "#zone_offset" only: UTC time = "#event_time" - "#zone_offset". Missing/unknown offsets cannot be converted reliably and must not be treated as zero. Client SDKs may collect timezone offset automatically; RESTful API events need the source payload to provide the offset. ${packageScopeGuidance}`,
    inputSchema: sqlQuerySchema,
    outputSchema: outputShape,
    annotations,
  }, async ({ sql }) => result(await client.executeSql(assertReadOnlySql(sql)), "data_api", "/querySql"));

  server.registerTool("list_event_metadata", {
    description: "List event metadata for the configured ThinkingData project.",
    inputSchema: emptySchema,
    outputSchema: outputShape,
    annotations,
  }, async () => result(await client.get("/open/list-event-meta", { projectId: config.projectId }), "meta_data_manage_api", "/open/list-event-meta"));

  server.registerTool("list_property_metadata", {
    description: "List event or user property metadata for the configured project.",
    inputSchema: propertyMetadataSchema,
    outputSchema: outputShape,
    annotations,
  }, async ({ table_type, event_name }) => result(await client.get("/open/list-props", {
    projectId: config.projectId,
    tableType: table_type,
    ...(event_name === undefined ? {} : { eventName: event_name }),
  }), "meta_data_manage_api", "/open/list-props"));

  return server;
}
