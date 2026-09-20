import type { Config } from "./config.js";

export type ThinkingDataResponse = {
  return_code: number;
  return_message: string;
  data?: unknown;
};

type SqlTaskInfo = {
  taskId?: string;
  status?: string;
  resultStat?: {
    headers?: unknown;
    rowCount?: number;
    pageCount?: number;
  };
};

const SQL_TASK_POLL_INTERVAL_MS = 500;
const SQL_TASK_POLL_LIMIT = 60;

const sqlFailure = (code: number, message: string, taskId?: string): ThinkingDataResponse => ({
  return_code: code,
  return_message: `${message}${taskId ? ` (taskId=${taskId})` : ""}`,
});

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
    let submitted: ThinkingDataResponse;
    try {
      submitted = await this.send("/open/execute-sql", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          accept: "application/json",
        },
        body,
      });
    } catch (error) {
      return sqlFailure(-2001, `查询提交失败：${error instanceof Error ? error.message : String(error)}`);
    }

    if (submitted.return_code !== 0) {
      return sqlFailure(-2001, `查询提交失败：${submitted.return_message}`);
    }

    const submittedData = submitted.data as Record<string, unknown> | undefined;
    const taskId = typeof submittedData?.taskId === "string" ? submittedData.taskId : undefined;
    if (!taskId) {
      const rows = extractRows(submitted.data);
      if (rows) return { ...submitted, data: { ...submittedData, rows } };
      return sqlFailure(-2001, "查询提交失败：响应缺少 taskId，且没有实际数据行");
    }

    let taskInfo: SqlTaskInfo | undefined;
    for (let attempt = 0; attempt < SQL_TASK_POLL_LIMIT; attempt += 1) {
      try {
        const response = await this.get("/open/sql-task-info", { taskId });
        if (response.return_code !== 0) {
          return sqlFailure(-2003, `查询任务执行失败：${response.return_message}`, taskId);
        }
        taskInfo = response.data as SqlTaskInfo | undefined;
      } catch (error) {
        return sqlFailure(-2003, `查询任务执行失败：${error instanceof Error ? error.message : String(error)}`, taskId);
      }

      if (taskInfo?.status === "FINISHED") break;
      if (taskInfo?.status === "FAILED") {
        return sqlFailure(-2003, "查询任务执行失败", taskId);
      }
      if (attempt < SQL_TASK_POLL_LIMIT - 1) await new Promise((resolve) => setTimeout(resolve, SQL_TASK_POLL_INTERVAL_MS));
    }

    if (taskInfo?.status !== "FINISHED") {
      return sqlFailure(-2002, "查询任务超时", taskId);
    }

    const resultStat = taskInfo.resultStat ?? {};
    const pageCount = typeof resultStat.pageCount === "number"
      ? resultStat.pageCount
      : typeof submittedData?.pageCount === "number" ? submittedData.pageCount : 0;
    const expectedRowCount = typeof resultStat.rowCount === "number"
      ? resultStat.rowCount
      : typeof submittedData?.rowCount === "number" ? submittedData.rowCount : undefined;
    if (pageCount === 0 && expectedRowCount !== undefined && expectedRowCount > 0) {
      return sqlFailure(-2004, "结果拉取失败：响应包含 rowCount，但缺少 pageCount", taskId);
    }
    const rows: unknown[] = [];
    try {
      for (let pageId = 0; pageId < pageCount; pageId += 1) {
        const page = await this.getSqlResultPage(taskId, pageId);
        const pageRows = extractRows(page);
        if (!pageRows) throw new Error("结果页没有实际数据行");
        rows.push(...pageRows);
      }
    } catch (error) {
      return sqlFailure(-2004, `结果拉取失败：${error instanceof Error ? error.message : String(error)}`, taskId);
    }

    return {
      return_code: 0,
      return_message: "success",
      data: {
        headers: resultStat.headers ?? submittedData?.headers ?? [],
        rowCount: expectedRowCount ?? rows.length,
        pageCount,
        taskId,
        rows,
      },
    };
  }

  async get(path: string, query: Record<string, string>): Promise<ThinkingDataResponse> {
    return this.send(path, { method: "GET" }, query);
  }

  private async getSqlResultPage(taskId: string, pageId: number): Promise<unknown> {
    return this.sendRaw("/open/sql-result-page", { method: "GET" }, { taskId, pageId: String(pageId) });
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

  private async sendRaw(path: string, init: RequestInit, query: Record<string, string>): Promise<unknown> {
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

    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      const rows = text.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => JSON.parse(line));
      return rows;
    }
  }
}

function extractRows(value: unknown): unknown[] | undefined {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.rows)) return record.rows;
  if (Array.isArray(record.data)) return record.data;
  return undefined;
}
