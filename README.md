# Bot-Chat 微信群聊自动回复机器人

基于 Wechaty 的微信群聊自动回复机器人，支持关键词自定义回复、@ 机器人引导回复、以及基于大模型 RAG 的本地文档/网站知识库检索问答。

## 功能

- **关键词自动回复**：群消息命中配置的关键词时，回复预设的自定义内容（支持精确/包含匹配、优先级）。
- **@ 机器人回复**：群成员 @ 机器人并附问题时从知识库检索回答；仅 @ 无问题时回复使用引导。
- **知识库检索（RAG）**：启动时构建知识库，支持本地文档（PDF/Word/文本）与网站/在线页面，经大模型语义检索后回答。
- **限流保护**：按时间窗口限制回复频率，降低被微信风控风险。
- **无 LLM 也能跑**：未配置 API Key 时自动禁用 RAG，保留关键词与 @ 引导功能。

## 安装

```bash
npm install
```

要求 Node.js >= 18。

## 配置

### 1. 大模型（可选，用于知识库问答）

复制 `.env.example` 为 `.env` 并填入 OpenAI 兼容接口的配置：

```bash
cp .env.example .env
```

| 变量 | 说明 |
|------|------|
| `USER_LLM_API_KEY` | API Key，必填才启用 RAG |
| `USER_LLM_BASE_URL` | 接口地址，默认 DeepSeek |
| `USER_LLM_MODEL` | 对话模型名 |
| `USER_LLM_EMBEDDING_MODEL` | 向量模型名（可选，配置后使用向量检索） |

### 2. 机器人配置

```bash
cp config.example.json config.json
```

关键字段：

- `rooms`：监听的群名白名单（空数组表示监听所有群）。
- `keywordRules`：关键词规则数组，每项含 `id`、`keywords`、`reply`、`mode`（`exact`/`contains`）、`priority`（数字越大越优先）、`enabled`。
- `mentionReply`：仅 @ 机器人无提问时的引导回复。
- `noResultReply`：知识库无结果时的兜底回复。
- `rag.docs`：本地文档目录或文件路径数组（支持 `.txt/.md/.pdf/.docx`）。
- `rag.sites`：网站/在线页面 URL 数组。
- `rateLimit`：回复限流配置。

### 3. 准备知识库

把文档放入 `rag.docs` 指定的目录，例如：

```bash
mkdir -p knowledge
# 将 PDF / Word / txt 文档放入 knowledge/ 目录
```

## 运行

```bash
npm start
```

启动后：

1. 终端会打印二维码与链接，用要作为机器人的微信扫码登录。
2. 登录成功后自动开始监听配置的群聊。
3. 按 `Ctrl+C` 退出（会正常登出并清除微信端会话）。

修改 `config.json` 后需重启机器人生效。

## 重新扫码登录

Wechaty 会把登录会话保存在本地 `bot-chat.memory-card.json`，下次启动时会自动恢复登录（免扫码）。

如果出现"已登录但收不到/发不出消息"（多为旧会话已失效导致的假登录），强制重新扫码：

```bash
npm start -- --relogin
```

该命令会清除本地登录缓存并重新要求扫码。也可直接删除 `bot-chat.memory-card.json` 后运行 `npm start`。

## 开发与测试

```bash
npm test
```

测试覆盖：关键词匹配、配置解析、文本分块、@ 文本剥离、限流、RAG 检索与消息处理链。

## 技术栈

- Node.js + [Wechaty](https://wechaty.js.org/)（web 协议，扫码登录）
- PDF/Word 解析：pdf-parse、mammoth
- 网页正文提取：cheerio
- 知识库存储：内存 + 本地 JSON 缓存（`.kb-cache/`）

## 风险提示

个人微信 web 协议存在被微信风控的可能，请仅将机器人用于合规场景，控制回复频率，并注意账号安全。
