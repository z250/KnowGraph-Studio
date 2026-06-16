# Myuxi —— 智能知识库与知识图谱智能体开发平台

基于大模型的**企业级智能知识库与多智能体协作平台**，融合 RAG 检索增强生成与知识图谱推理能力。

技术栈：**TypeScript / NestJS (BFF) / LangGraph.js / LangChain.js / BullMQ / Prisma / Zod / Vue 3 / Vite / Pinia / Ant Design Vue / ECharts**。

基础设施：PostgreSQL / Redis / Milvus / Neo4j / MinIO / Docker 沙盒，通过 Docker Compose 统一编排。

---

## 参考实现

Yuxi（`../Yuxi/`）是本项目的 Python 参考实现。Myuxi 是它的 Node.js/TypeScript 复刻版本。遇到不确定的设计决策时，先去 Yuxi 代码库中查看对应实现作为参考。

关键参考文档：
- [Yuxi 系统架构](../Yuxi/SYSTEM_ARCHITECTURE.md) — 路由层/服务层/领域层/数据层/基础设施层完整拓扑
- [架构设计指南](../Yuxi/ARCHITECTURE_DESIGN_GUIDE.md) — 从零设计这类平台的完整思考框架

---

## 技术栈选型理由

| 组件 | 选择 | 对标 Yuxi | 理由 |
|------|------|-----------|------|
| 后端框架 | NestJS | FastAPI | 装饰器路由 + 依赖注入 + Guard/Interceptor/Pipe 三层中间件，与 FastAPI 范式高度一致 |
| 智能体编排 | LangGraph.js | LangGraph (Python) | 有状态图编排，checkpoint 持久化，人机协同中断-恢复 |
| LLM 框架 | LangChain.js | LangChain (Python) | 统一的 ChatModel/Embedding/Tool 抽象 |
| 任务队列 | BullMQ (Redis) | ARQ | Node.js 生态最成熟的 Redis 队列，支持延迟/重试/优先级 |
| ORM | Prisma | SQLAlchemy | TypeScript 优先，类型安全，迁移管理 |
| 校验 | Zod | Pydantic | TypeScript 运行时校验的事实标准 |
| Docker SDK | dockerode | docker (Python) | 程序化管理沙盒容器 |
| 图数据库 | neo4j-driver | Neo4j (Python) | 知识图谱存储与多跳推理 |
| 向量数据库 | @zilliz/milvus2-sdk-node | Milvus (Python) | 稠密向量 ANN + 稀疏 BM25 + 混合检索 |
| Token 计数 | js-tiktoken | tiktoken | OpenAI tokenizer 的 JS 移植 |
| 前端 | Vue 3 + Vite + Pinia | 同 | 用户最熟悉，直接复用设计模式 |

---

## MVP 范围

**第一阶段目标**：跑通"文档上传 → 分块 → 向量化 → 检索 → LLM 生成答案"的核心链路。

**做**：
- 1 个 Agent（chatbot，单轮问答 + 知识库检索工具）
- 1 种知识库后端（Milvus 纯向量检索）
- 文件上传 → 分块 → Embedding → 入库 → 检索 → 生成
- 前端：对话页面 + 知识库管理页
- Docker Compose 管理所有服务

**砍（后期迭代再加）**：
- 知识图谱 Neo4j — 向量检索覆盖 80% 场景
- 多知识库后端 — 先只做 Milvus
- Skills / MCP 协议 / SubAgents — Agent 基础跑通后再扩展
- 文档解析多后端 — MVP 只支持 PDF + Markdown
- 仪表盘 / 评估 / 思维导图 — 管理端功能
- LITE_MODE — MVP 就是要全套，后期再加轻量模式

---

## 架构分层

```
┌──────────────────────────────────────┐
│  NestJS Controllers (HTTP 边界)       │  ← 薄层：参数解析、认证、响应装配
│  src/modules/chat/chat.controller.ts  │
├──────────────────────────────────────┤
│  服务层 (用例编排)                     │  ← 所有业务逻辑
│  src/modules/chat/chat.service.ts     │
├──────────────────────────────────────┤
│  领域层                                │
│  ├── agents/   (智能体 + 中间件)       │  ← 核心：LangGraph 状态图
│  └── knowledge/(知识库 + 向量检索)     │
├──────────────────────────────────────┤
│  数据访问层                             │
│  src/repositories/ (Prisma)           │  ← 唯一数据出口，路由不直接碰 DB
├──────────────────────────────────────┤
│  基础设施层                             │
│  ├── storage/ (pg/minio 连接管理)      │
│  └── models/  (LLM 适配)              │
└──────────────────────────────────────┘
```

**设计原则**（继承自 Yuxi）：
1. 路由层永远薄 — 不在路由里写业务逻辑
2. 服务层是唯一编排入口 — 跨模块流程放 service
3. Repository 是数据唯一出口 — 不绕过 Prisma 直写 SQL
4. 领域内部自治 — agents 模块内部怎么设计是它自己的事，外部只通过 service 调用

---

## 核心链路：一次 Agent 对话

这是整个系统最复杂的链路（参考 Yuxi 的设计）：

```
1. 前端收集输入 + 附件 + Agent 配置
      ↓
2. POST /api/chat → chat_router → chat_service
      ↓  (路由层结束，下面是服务层)
3. chat_service:
   - 加载 conversation / agent config
   - 创建 Run 记录 (status=queued)
   - 入队 BullMQ
   - 返回 run_id
      ↓
4. BullMQ Worker 执行:
   - 构造 Agent + Context
   - 按序挂载 Middleware（知识库/工具/上下文管理）
   - 执行 LangGraph graph
   - 每一步事件 → Redis Pub/Sub
      ↓
5. 前端 SSE 消费事件流 → 逐 token 渲染 → 工具调用卡片 → 完成
```

**关键决策**：
- **不在 HTTP 里直接跑 Agent** → 超时、断开、无法并发
- **BullMQ + Redis Pub/Sub 而不是 WebSocket** → Worker 和 API 是独立进程，Redis 是唯一共享状态；重启不丢事件

---

## Agent 能力扩展：中间件管道

Agent 的每项能力（知识库检索、工具调用、对话摘要、上下文裁剪）实现为独立中间件，在 `create_agent()` 中以线性管道组装。

```
BaseAgent
  ├── KnowledgeBaseMiddleware   → 挂载知识库检索能力
  ├── ToolMiddleware            → 注册工具列表
  ├── ContextMiddleware         → 上下文管理（消息裁剪、系统提示词）
  └── SummaryMiddleware         → 对话摘要压缩
```

**设计要点**（来自 Yuxi 实践）：
- 每个 Middleware 职责单一，独立开启/关闭
- 新增能力只需新增一个 Middleware，不碰 Agent 核心
- 管道顺序决定能力组合语义

---

## 知识库插件架构

通过接口抽象 + 注册表模式隔离不同知识库实现（长期目标，MVP 只做 Milvus）：

```typescript
interface IKnowledgeBaseBackend {
  search(query: string, options: SearchOptions): Promise<SearchResult[]>;
  insert(documents: Document[]): Promise<void>;
  delete(fileIds: string[]): Promise<void>;
  query(params: QueryParams): Promise<QueryResult>;
}
```

---

## 开发规范

### 通用准则
- 不过度工程化，只做当前任务需要的
- 不添加"可能将来有用"的抽象
- 只在系统边界做校验（用户输入、外部 API），内部信任类型系统
- 关键设计意图加注释，不写无意义的注释

### TypeScript 规范
- 严格模式 (`strict: true`)
- 优先使用 `interface` 而非 `type`（除非需要 union/intersection）
- Zod schema 是运行时校验的唯一入口；类型能从 Zod 推导就不要手写

### 前端规范
- **前端页面直接复用 Yuxi（`../Yuxi/`）中的现有页面**，按功能需求一步一步添加，不过度设计
- pnpm 管理依赖
- 所有 API 调用封装在 `web/src/apis/` 下
- 图标：lucide-vue-next
- 样式：Less + CSS 变量（定义在 base.css）
- Pinia Store 管理全局状态

### 后端规范
- NestJS Controller 文件尽量薄，业务逻辑下沉到 Service 层
- Prisma Repository 是数据访问的唯一出口
- 环境变量统一在 `.env` 管理，通过 Zod 校验后导出为配置对象
- 使用 NestJS Guard 做认证拦截，Interceptor 做日志/转换，Pipe 做入参校验

### 测试
- 三层：Vitest unit + Playwright e2e + 集成测试
- 测试代码放在 `test/` 目录

### 提交
- Conventional Commits 规范
- 中文提交信息

---

## Docker Compose 开发工作流

所有开发在 Docker 容器中进行，前端和后端均配置热重载。

```bash
docker compose up -d          # 启动全部服务
docker ps                     # 检查运行状态
docker logs api-dev --tail 100  # 查看后端日志
```

本地修改代码后服务自动更新，无需手动重启。
