import type { Config } from "./config.js";

export type ThinkingDataResponse = {
  return_code: number;
  return_message: string;
  data?: unknown;
};

export class ThinkingDataClient {
  constructor(
    private readonly config: Config,
    private readonly request: typeof fetch = fetch,
  ) {}

  async postJson(path: string, body: unknown): Promise<ThinkingDataResponse> {
    return this.send(path, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
    });
  }

  async executeSql(sql: string): Promise<ThinkingDataResponse> {
    const body = new URLSearchParams({ sql, format: "json" });
    return this.send("/open/execute-sql", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json",
      },
      body,
    });
  }

  async get(path: string, query: Record<string, string>): Promise<ThinkingDataResponse> {
    return this.send(path, { method: "GET" }, query);
  }

  private async send(
    path: string,
    init: RequestInit,
    query: Record<string, string> = {},
  ): Promise<ThinkingDataResponse> {
    const url = new URL(path, this.config.baseUrl);
    url.searchParams.set("token", this.config.queryToken);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);

    let response: Response;
    try {
      response = await this.request(url, init);
    } catch (error) {
      throw new Error(`ThinkingData network request failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!response.ok) throw new Error(`ThinkingData HTTP error: ${response.status} ${response.statusText}`);

    let result: unknown;
    try {
      result = await response.json();
    } catch {
      throw new Error("ThinkingData returned a non-JSON response");
    }
    if (!result || typeof result !== "object") throw new Error("ThinkingData returned an invalid JSON response");
    return result as ThinkingDataResponse;
  }
}
