import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it, vi } from "vitest";
import type { ThinkingDataClient } from "../src/client.js";
import { createServer } from "../src/server.js";

const expectedTools = [
  "query_event_analysis",
  "query_retention_analysis",
  "query_funnel_analysis",
  "query_distribution_analysis",
  "query_path_analysis",
  "query_interval_analysis",
  "query_user_property_analysis",
  "execute_sql_query",
  "list_event_metadata",
  "list_property_metadata",
].sort();

describe("MCP server", () => {
  it("exposes exactly the ten read-only tools with complete contracts", async () => {
    const server = createServer({
      baseUrl: "https://ta.example.test",
      projectId: "377",
      queryToken: "secret-token",
    });
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const response = await client.listTools();

    expect(response.tools.map((tool) => tool.name).sort()).toEqual(expectedTools);
    for (const tool of response.tools) {
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeTruthy();
      expect(tool.outputSchema).toBeTruthy();
      expect(tool.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
    }

    await client.close();
    await server.close();
  });

  it("rejects write SQL before making an HTTP request", async () => {
    const executeSql = vi.fn();
    const server = createServer({
      baseUrl: "https://ta.example.test",
      projectId: "377",
      queryToken: "secret-token",
    }, { executeSql } as unknown as ThinkingDataClient);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const response = await client.callTool({
      name: "execute_sql_query",
      arguments: { sql: "DELETE FROM events" },
    });

    expect(response.isError).toBe(true);
    expect(executeSql).not.toHaveBeenCalled();

    await client.close();
    await server.close();
  });
});
