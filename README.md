# thinkingdata-mcp

ThinkingData 5.0 的本地只读 MCP Server。服务端稳定名称为
`thinkingdata-readonly`，首版只通过 stdio 运行，仅暴露 10 个面向用户目标的
只读工具。

> 当前状态：首版 10 个只读 tools、stdio 入口、HTTP 客户端、API 映射和基础测试已实现。

## 安装与运行

项目要求 Node.js 18 或更高版本。依赖只安装在当前项目中：

```bash
npm ci
npm run build
```

配置必填环境变量并启动：

```bash
export THINKINGDATA_BASE_URL="https://your-thinkingdata-host"
export THINKINGDATA_PROJECT_ID="your-project-id"
export THINKINGDATA_QUERY_TOKEN="your-query-token"
npm start
```

质量检查：

```bash
npm run typecheck
npm test
npm run build
```

## 设计原则

- Tool 对应用户要完成的目标，不机械复制 ThinkingData 内部 API。
- 读取与写入能力分离；首版没有写入能力，也没有通用 `call_api` 后门。
- 参数使用业务化、窄而明确的 schema；不会接收任意官方请求 JSON。
- 凭据只在 HTTP 客户端层读取，不是 tool 参数，不进入返回值或日志。
- 只实现本地 stdio；不实现缓存、重试、持久化、远程 HTTP、OAuth、Plugin UI
  或自动抓取文档。
- ThinkingData API 的字段、枚举和限制以固定版本 5.0 的官方文档为准，并记录在
  `docs/api-mapping.yaml`。

这些选择遵循 OpenAI 的建议：tool 应帮助完成一个用户目标，相关操作组成一个连贯
动作，而权限、风险或确认要求不同的操作应拆开。完整 contract 应明确名称、描述、
输入与输出 schema、授权、副作用和失败行为。

## MCP 官方推荐格式

MCP tool 通过 `tools/list` 暴露，通过 `tools/call` 调用。一个完整 tool 定义应包含：

```json
{
  "name": "query_event_analysis",
  "title": "查询事件分析",
  "description": "当用户需要按指标、时间粒度、筛选或分组分析事件时使用。",
  "inputSchema": {
    "type": "object",
    "properties": {},
    "required": [],
    "additionalProperties": false
  },
  "outputSchema": {
    "type": "object",
    "properties": {},
    "required": [],
    "additionalProperties": false
  },
  "annotations": {
    "readOnlyHint": true,
    "destructiveHint": false,
    "openWorldHint": false
  }
}
```

本项目使用 Zod 定义输入与输出 schema，由官方 MCP TypeScript SDK 导出 JSON
Schema。`outputSchema` 一旦声明，服务端返回的 `structuredContent` 必须符合它。
同时返回简短 `content`，便于模型直接组织回答并兼容只消费 MCP content 的客户端：

```json
{
  "content": [
    {
      "type": "text",
      "text": "事件分析查询成功。"
    }
  ],
  "structuredContent": {
    "source": {
      "document_version": "5.0",
      "documentation_url": "https://docs-v2.thinkingdata.cn/?version=v5.0&lan=zh-CN&code=event_query_api&anchorId=",
      "endpoint": "/actual/endpoint"
    },
    "return_code": 0,
    "return_message": "success",
    "data": {}
  }
}
```

说明：

- `name` 使用稳定、可读、action-oriented 的标识符。
- `description` 说明用户目标以及何时选择该工具，用于提高模型选取准确率。
- `inputSchema` 明确必填项、类型、枚举、互斥关系和限制。
- `outputSchema` 描述可复用的结构化结果。
- `content` 保持简短；详细机器可读数据放入 `structuredContent`。
- annotations 必须与真实行为一致，不能代替服务端授权和输入校验。
- 本项目所有工具均为只读，因此使用 `readOnlyHint: true`、
  `destructiveHint: false`。查询会访问配置的 ThinkingData 服务，但不改变其状态。

## stdio 约定

stdio 用于由 MCP Host 启动的本地子进程。JSON-RPC 请求从 stdin 进入，响应从
stdout 输出。stdout 是协议专用通道，因此诊断信息只能写入 stderr；任何普通
`console.log` 都可能破坏协议通信。

服务启动所需的三个环境变量均为必填，不提供隐式默认值：

```text
THINKINGDATA_BASE_URL
THINKINGDATA_PROJECT_ID
THINKINGDATA_QUERY_TOKEN
```

计划中的 Host 配置格式如下；构建完成后将 `<absolute-path>` 替换为仓库绝对路径：

```json
{
  "mcpServers": {
    "thinkingdata-readonly": {
      "command": "node",
      "args": ["<absolute-path>/dist/index.js"],
      "env": {
        "THINKINGDATA_BASE_URL": "https://your-thinkingdata-host",
        "THINKINGDATA_PROJECT_ID": "your-project-id",
        "THINKINGDATA_QUERY_TOKEN": "your-query-token"
      }
    }
  }
}
```

不要把真实 token 提交到仓库；`.env` 已被忽略。

## 首版工具

| Tool | 用户目标 | 主要参数形态 |
| --- | --- | --- |
| `query_event_analysis` | 查询事件指标趋势 | 指标、时间粒度、筛选、分组 |
| `query_retention_analysis` | 查询初始事件后的回访留存 | 初始事件、回访事件、时间范围 |
| `query_funnel_analysis` | 查询有序步骤转化 | 有序步骤、转化窗口、筛选 |
| `query_distribution_analysis` | 查询指标在属性上的分布 | 事件、指标、分布属性 |
| `query_path_analysis` | 查询事件间访问路径 | 事件集合、起点、路径方向 |
| `query_interval_analysis` | 查询两个事件之间的间隔 | 起始事件、结束事件 |
| `query_user_property_analysis` | 查询用户属性聚合 | 目标属性、聚合方式 |
| `execute_sql_query` | 执行只读 SQL 查询并返回 JSON | `sql` |
| `list_event_metadata` | 列出当前项目事件元数据 | 无参数 |
| `list_property_metadata` | 列出事件或用户属性元数据 | `table_type`，事件表可带 `event_name` |

共享结构只提取确实重复的概念：绝对或相对时间范围、事件引用、属性引用、筛选条件
和分组属性。每类分析仍保留独立 schema，不用一个泛化结构抹平业务差异。

明确排除：用户列表、全量下载、用户列表下载、SQL 分页、异步 SQL、任务取消、
分群或标签写入、元数据修改、看板管理、用户管理和项目管理。

## Tool search 与能力布局

OpenAI 建议在工具较多时将能力放入描述清楚的 namespace 或 MCP Server，以便模型
只加载相关工具，减少初始上下文占用。本项目把 10 个同一权限边界、同一数据源的
ThinkingData 只读能力放在一个 MCP Server 中；工具描述保持明确，使直接选择和按需
发现都能工作。后续写入能力不会混入当前只读 server contract。

## 项目布局

```text
thinkingdata-mcp/
├── docs/
│   └── api-mapping.yaml       # ThinkingData 5.0 权威依据矩阵
├── src/
│   ├── index.ts               # stdio 入口
│   ├── server.ts              # MCP Server 创建和 10 个 tool 注册
│   ├── config.ts              # 三个必填环境变量的边界校验
│   ├── client.ts              # ThinkingData HTTP 客户端与凭据隔离
│   ├── schemas/               # 共享结构和各分析独立 schema
│   └── tools/                 # tool 到 HTTP 请求的业务映射
├── test/
│   ├── fixtures/              # ThinkingData 5.0 官方示例映射 fixture
│   ├── schemas/               # 合法、缺失、非法枚举、互斥范围测试
│   ├── tools/                 # 请求映射、响应和 tool 选择测试
│   └── server.test.ts         # tools/list、annotations 与泄密检查
├── package.json
├── tsconfig.json
└── README.md
```

目录会随实现落地，但职责边界保持不变；不会为未请求的能力预留抽象层。

## 权威资料

### MCP 官方

- [Model Context Protocol 规范](https://modelcontextprotocol.io/specification/)
- [MCP Tools 规范](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)
- [MCP Transports 规范](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports)
- [官方 TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [TypeScript SDK Server Guide](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md)
- [stdio Guide](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/serving/stdio.md)
- [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector)

### OpenAI 官方

- [Define tools](https://developers.openai.com/plugins/plan/tools)
- [Build an MCP server](https://developers.openai.com/plugins/build/mcp-server)
- [Tool search](https://developers.openai.com/api/docs/guides/tools-tool-search)
- [MCP and Connectors](https://developers.openai.com/api/docs/guides/tools-connectors-mcp)

### ThinkingData 官方

- [ThinkingData 5.0 文档（固定版本）](https://docs-v2.thinkingdata.cn/?version=v5.0&lan=zh-CN&code=event_query_api&anchorId=)

`docs/api-mapping.yaml` 将对每个 tool 记录官方页面与章节、endpoint、HTTP 方法、
请求与响应字段映射、官方枚举、只读属性、错误码和最后核对日期，只摘录实现必需的
内容，不复制整篇官方文档。

## 测试要求

- 10 个 tools 分别覆盖合法 schema、缺失必填项、非法枚举和互斥时间范围。
- 使用官方示例 fixture 验证 method、path、query 和 body 映射。
- 使用本地 fake HTTP server 验证成功、非零返回码、非 JSON、HTTP 错误和网络失败。
- token 不得出现在 MCP 结果、错误、快照或日志中。
- `tools/list` 只能暴露上述 10 个工具，并完整验证描述、schema、output schema 和
  annotations。
- 每个 tool 覆盖直接请求、相似工具区分和越界请求三类自然语言选择测试。
- 最终使用 MCP Inspector 逐个核对代表性、非法和未授权输入。

## License

尚未指定。
