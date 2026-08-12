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
};

const annotations = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;

const descriptions: Record<keyof typeof analysisToolSpecs, string> = {
  query_event_analysis: "Query event metrics over time with optional filters and grouping.",
  query_retention_analysis: "Query retention from an initial event to a returning event.",
  query_funnel_analysis: "Query conversion across an ordered sequence of event steps.",
  query_distribution_analysis: "Query how an event metric is distributed over a property.",
  query_path_analysis: "Query paths around a selected starting event.",
  query_interval_analysis: "Query elapsed intervals between a start and end event.",
  query_user_property_analysis: "Query an aggregation over a user or event property.",
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
  };
  return {
    content: [{ type: "text" as const, text: response.return_code === 0 ? "ThinkingData query succeeded." : `ThinkingData query failed: ${response.return_message}` }],
    structuredContent,
    isError: response.return_code !== 0,
  };
}

export function createServer(config: Config, client = new ThinkingDataClient(config)) {
  const server = new McpServer({ name: "thinkingdata-readonly", version: "0.1.0" });

  for (const [name, spec] of Object.entries(analysisToolSpecs) as [keyof typeof analysisToolSpecs, (typeof analysisToolSpecs)[keyof typeof analysisToolSpecs]][]) {
    server.registerTool(name, {
      description: descriptions[name],
      inputSchema: spec.schema,
      outputSchema: outputShape,
      annotations,
    }, async (input: unknown) => result(await callAnalysisTool(client, config.projectId, spec, input), spec.code, spec.path));
  }

  server.registerTool("execute_sql_query", {
    description: "Execute one synchronous SQL query and return JSON results.",
    inputSchema: sqlQuerySchema,
    outputSchema: outputShape,
    annotations,
  }, async ({ sql }) => result(await client.executeSql(assertReadOnlySql(sql)), "data_api", "/open/execute-sql"));

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
