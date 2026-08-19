import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { readConfig } from "./config.js";
import { createServer } from "./server.js";

const port = Number(process.env.PORT ?? 3000);
const config = readConfig(process.env);

async function handleMcp(req: IncomingMessage, res: ServerResponse) {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => transport.close());
  await createServer(config).connect(transport);
  await transport.handleRequest(req, res);
}

const httpServer = createHttpServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "text/plain" }).end("ok");
    return;
  }
  if (req.url === "/mcp") {
    handleMcp(req, res).catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "application/json" });
      }
      res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null }));
    });
    return;
  }
  res.writeHead(404).end();
});

httpServer.listen(port, "0.0.0.0", () => {
  console.info(`thinkingdata-mcp Streamable HTTP endpoint: http://0.0.0.0:${port}/mcp`);
});
