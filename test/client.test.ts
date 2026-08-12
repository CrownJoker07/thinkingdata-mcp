import { describe, expect, it, vi } from "vitest";
import { ThinkingDataClient } from "../src/client.js";

const config = { baseUrl: "https://ta.example.test", projectId: "1", queryToken: "secret-token" };

describe("ThinkingDataClient", () => {
  it("keeps the token in the HTTP layer and parses a success response", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      return_code: 0, return_message: "success", data: { rows: [] },
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const client = new ThinkingDataClient(config, request);

    await expect(client.get("/open/list-event-meta", { projectId: "1" })).resolves.toMatchObject({ return_code: 0 });
    const requestedUrl = request.mock.calls[0]?.[0] as URL;
    expect(requestedUrl.searchParams.get("token")).toBe("secret-token");
  });

  it("does not include the token in HTTP errors", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response("no", { status: 500, statusText: "Failure" }));
    const client = new ThinkingDataClient(config, request);
    await expect(client.get("/open/list-event-meta", {})).rejects.not.toThrow("secret-token");
  });

  it("reports a non-JSON response", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response("not json", { status: 200 }));
    const client = new ThinkingDataClient(config, request);
    await expect(client.get("/open/list-event-meta", {})).rejects.toThrow("non-JSON");
  });

  it("reports a network failure without exposing credentials", async () => {
    const request = vi.fn<typeof fetch>().mockRejectedValue(new Error("offline"));
    const client = new ThinkingDataClient(config, request);
    await expect(client.get("/open/list-event-meta", {})).rejects.toThrow("offline");
    await expect(client.get("/open/list-event-meta", {})).rejects.not.toThrow("secret-token");
  });
});
