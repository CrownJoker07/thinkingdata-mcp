import type { Config } from "./config.js";

export type ThinkingDataResponse = {
  return_code: number;
  return_message: string;
  data?: unknown;
};

const sqlFailure = (code: number, message: string, taskId?: string): ThinkingDataResponse => ({
  return_code: code,
  return_message: `${message}${taskId ? ` (taskId=${taskId})` : ""}`,
});

const networkErrorMessage = (error: unknown): string => {
  if (!(error instanceof Error)) return String(error);

  const cause = error.cause;
  if (!cause || typeof cause !== "object") return error.message;

  const details = cause as {
    message?: unknown;
    code?: unknown;
    errno?: unknown;
    syscall?: unknown;
    address?: unknown;
    port?: unknown;
  };
  const fields = [
    ["code", details.code],
    ["errno", details.errno],
    ["syscall", details.syscall],
    ["address", details.address],
    ["port", details.port],
  ].filter(([, value]) => value !== undefined).map(([name, value]) => `${name}=${String(value)}`);
  const causeMessage = details.message ? String(details.message) : String(cause);
  return `${error.message}; cause: ${causeMessage}${fields.length > 0 ? ` (${fields.join(", ")})` : ""}`;
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
    const body = new URLSearchParams({ sql, format: "json", timeoutSecond: "60" });
    try {
      return await this.querySql(body);
    } catch (error) {
      return sqlFailure(-2001, `查询提交失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async querySql(body: URLSearchParams): Promise<ThinkingDataResponse> {
    const url = new URL("/querySql", this.config.baseUrl);
    url.searchParams.set("token", this.config.queryToken);
    let response: Response;
    try {
      response = await this.request(url, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          accept: "application/json",
        },
        body,
      });
    } catch (error) {
      throw new Error(`ThinkingData network request failed: ${networkErrorMessage(error)}`);
    }
    if (!response.ok) throw new Error(`ThinkingData HTTP error: ${response.status} ${response.statusText}`);
    const lines = (await response.text()).split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines.length === 0) throw new Error("ThinkingData returned an empty SQL response");
    const first = JSON.parse(lines[0]) as ThinkingDataResponse;
    if (first.return_code !== 0) return first;
    const firstData = first.data as Record<string, unknown> | undefined;
    const rows = lines.slice(1).map((line) => JSON.parse(line));
    return {
      ...first,
      data: {
        ...firstData,
        rowCount: rows.length,
        pageCount: 1,
        rows,
      },
    };
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
      throw new Error(`ThinkingData network request failed: ${networkErrorMessage(error)}`);
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
