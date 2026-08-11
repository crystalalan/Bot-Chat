# WeChat 群聊自动回复机器人 - 实施任务清单

## Phase 1: 项目初始化

- [x] 初始化 Node.js 项目（`npm init`），创建 `package.json`
- [x] 安装依赖：`wechaty`、`wechaty-puppet-wechat`（web 协议）、`pdf-parse`、`mammoth`、`cheerio`、`dotenv`、`jest`
- [x] 创建 `src/` 目录结构与 `.gitignore`

## Phase 2: 配置模块

- [x] 实现 `src/config.js`：读取/校验 `config.json`，导出 BotConfig 结构
- [x] 创建 `config.example.json` 模板（rooms、keywordRules、mentionReply、noResultReply、rag、rateLimit）
- [x] 配置校验：非法 JSON 输出明确错误并退出

## Phase 3: 关键词规则匹配

- [x] 实现 `src/rules.js`：exact/contains 两种匹配模式
- [x] 按 priority 降序判定，命中优先级最高规则
- [x] 单元测试（精确/包含/优先级/空文本）

## Phase 4: 知识库构建（启动时）

- [x] 实现 `src/kb/loader.js`：本地文档解析（PDF 用 pdf-parse、Word 用 mammoth、文本直接读）
- [x] 实现 `src/kb/fetcher.js`：抓取网站/在线页面正文（cheerio 提取）
- [x] 实现 `src/kb/chunker.js`：按 chunkSize/chunkOverlap 分块
- [x] 实现 `src/kb/store.js`：向量与文本块内存存储 + 本地 JSON 缓存文件
- [x] 单个知识源失败跳过，记录警告

## Phase 5: 大模型客户端

- [x] 实现 `src/llm.js`：读取 `USER_LLM_API_KEY`/`USER_LLM_BASE_URL`/`USER_LLM_MODEL`
- [x] Chat Completions 调用封装
- [x] Embedding 调用封装（可选）
- [x] 未配置 Key 时禁用 RAG，输出警告

## Phase 6: RAG 检索模块

- [x] 实现 `src/rag.js`：查询向量化 → Top-K 相似度检索 → prompt 拼接 → 生成回答
- [x] 未配置 embedding 时退化为分词文本相关度检索
- [x] 无结果时返回 `noResultReply`

## Phase 7: 消息处理链与 Wechaty 接入

- [x] 实现 `src/bot.js`：Wechaty 扫码登录（scan 事件输出二维码）
- [x] 实现 `src/handler.js`：@ 检测（mentionSelf）→ 关键词匹配 → 知识库检索 的链式判定
- [x] 实现 @ 文本剥离（移除消息中的 @名字 提取 query）
- [x] 群白名单过滤、忽略机器人自身消息
- [x] 实现 `src/ratelimit.js` 限流器

## Phase 9: 天气与网络搜索指令

- [x] 实现 `src/weather.js`：和风天气 API（geoapi 城市解析 + 实时天气）+ 单元测试
- [x] 实现 `src/search.js`：Bing Web Search API + 单元测试
- [x] handler 增加"天气 城市名"与"搜索 关键词"指令检测 + 测试
- [x] 更新 `.env.example`（USER_QWEATHER_API_KEY / USER_BING_API_KEY）、README、启动配置
- [x] 集成测试与手工验证

## Phase 8: 集成与验证

- [x] 集成测试：mock Wechaty message 验证完整处理链
- [x] 创建 `src/index.js` 入口，启动时输出规则数量与知识库信息
- [x] 更新 README：安装、配置、扫码登录、运行说明
- [x] 手工验证：扫码登录 + 测试群三类回复
