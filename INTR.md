# INTR —— Bot-Chat 功能与调用方式速查

Bot-Chat 微信群聊自动回复机器人：关键词自定义回复、@ 机器人引导回复、基于大模型 RAG 的知识库检索问答、对话闲聊，以及天气、网络搜索、星座运势、抽卡、待办提醒等群内指令。本文档按"功能总览 → 群内指令 → 命令运行 → 程序化 API"逐层列出所有可调用方式。

## 功能总览

| 功能 | 触发方式 | 需要 @ 机器人 | 前置配置 |
|------|----------|:----:|----------|
| 天气查询 | 群内发 `天气 城市名` 指令 | 否 | `USER_QWEATHER_API_KEY` + `USER_QWEATHER_API_HOST` |
| 网络搜索 | 群内发 `搜索 关键词` 指令 | 否 | `USER_BING_API_KEY` |
| 星座运势 | 群内发 `星座 星座名` 指令 | 否 | `USER_JUHE_API_KEY` |
| 待办提醒 | `@机器人 添加待办 ...` | 是 | `config.json` 的 `todo.enabled` |
| 抽卡随机回复 | `@机器人 抽卡` | 是 | `config.json` 的 `gacha` |
| 关键词自动回复 | `@机器人 命中关键词` | 是 | `config.json` 的 `keywordRules` |
| 知识库问答（RAG） | `@机器人 问题` | 是 | `config.json` 的 `rag` + LLM |
| 对话闲聊 | `@机器人 话题`（知识库未命中时） | 是 | `chat.enabled` + LLM |

> 天气/搜索/星座指令即使不 @ 机器人也能触发，且优先级最高。待办、抽卡、关键词、知识库、闲聊必须 @ 机器人才会响应。机器人回复时会自动 @ 提出请求的群成员。

## 安装

```bash
npm install
```

要求 Node.js >= 18。

## 配置

### 1. 大模型（可选，用于知识库问答与闲聊）

复制 `.env.example` 为 `.env` 并填入 OpenAI 兼容接口的配置：

```bash
cp .env.example .env
```

| 变量 | 说明 |
|------|------|
| `USER_LLM_API_KEY` | API Key，配置后才启用 RAG 与闲聊 |
| `USER_LLM_BASE_URL` | 接口地址，默认 DeepSeek |
| `USER_LLM_MODEL` | 对话模型名 |
| `USER_LLM_EMBEDDING_MODEL` | 向量模型名（可选，配置后使用向量检索） |

### 2. 天气、搜索与星座（可选）

| 变量 | 说明 |
|------|------|
| `USER_QWEATHER_API_KEY` | 和风天气 Key（https://console.qweather.com 免费申请），启用"天气 城市名"指令 |
| `USER_QWEATHER_API_HOST` | 和风天气 API Host，在控制台「设置」查看（如 `abc1234.def.qweatherapi.com`），必填。2026 年起旧域名已停服 |
| `USER_BING_API_KEY` | Bing Web Search Key（Azure 门户申请），启用"搜索 关键词"指令 |
| `USER_JUHE_API_KEY` | 聚合数据 Key（https://www.juhe.cn 免费申请），启用"星座 星座名"指令 |

### 3. 机器人配置

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
- `chat`：对话聊天配置（`enabled` 开关、`historySize` 每个群保留的上下文条数、`systemPrompt` 人设）。
- `gacha`：抽卡配置（`keywords` 触发词数组、`replies` 候选话术列表，@ 机器人并命中关键词时随机回复一句）。
- `todo`：待办提醒配置（`enabled` 开关、`intervalMs` 扫描间隔毫秒数）。

### 4. 准备知识库

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

## 群内指令详解

以下指令均在机器人监听的微信群中发送。

### 1. 天气查询

两种写法等价：直接发，或先 @ 机器人再发（`@机器人 天气 北京` 也可）。

```
天气 北京
weather 北京
```

**查询实时天气**：`天气 城市名`

**查询未来预报**：城市名后接时间词或天数

| 输入 | 效果 |
|------|------|
| `天气 北京 今天` / `天气 北京 明天` / `天气 北京 后天` | 查询对应日期的单日预报 |
| `天气 北京 3天` / `天气 北京 3` | 未来 3 天预报（自动选择 3d/7d/15d 接口） |
| `天气 北京 未来5天` | 未来 5 天预报（天数支持 1~15） |

示例：

```
天气 北京
天气 上海 明天
天气 深圳 3天
天气 广州 未来7天
```

### 2. 网络搜索

支持三个触发词：`搜索`、`搜一下`、`search`（不区分大小写）。

```
搜索 wechaty 教程
搜一下 2026 世界杯赛程
search vite 使用指南
```

### 3. 星座运势

支持三个触发词：`星座`、`运势`、`今日星座`。星座名支持带"座"或不带"座"（如 `白羊` 与 `白羊座` 均可）。

```
星座 白羊座
运势 天秤
今日星座 摩羯座
```

支持全部 12 星座：白羊、金牛、双子、巨蟹、狮子、处女、天秤、天蝎、射手、摩羯、水瓶、双鱼。

### 4. 待办提醒

待办指令必须 @ 机器人。所有待办按群隔离，每个群独立管理自己的待办列表。

**添加待办**：

```
@机器人 添加待办 内容                      # 默认创建个人待办，提醒时 @ 创建者
@机器人 添加个人待办 时间 内容              # 同上，显式指定个人待办
@机器人 添加团体待办 时间 内容 @张三 @李四   # 团体待办，参与成员为消息中 @ 的其他成员（发起人与机器人自动排除）
```

**时间格式**（支持多种描述，解析优先级从高到低）：

| 输入示例 | 含义 |
|------|------|
| `30分钟后`、`2小时后` | 相对时间 |
| `8月25日 14:30` | 指定日期时刻（可带年份如 `2027年8月25日 14:30`；无年份且日期已过时自动顺延至明年） |
| `8月25日下午2点30分` | 指定日期时刻（支持上午/下午/晚上，如 `8月25日 14点`） |
| `今天9点`、`明天18:30`、`后天下午2点` | 今天/明天/后天 + 具体时刻（支持上午/下午/晚上） |
| `今天`、`明天`、`后天` | 当天默认 9 点提醒 |
| （不带时间） | 只记录不提醒，如 `@机器人 添加待办 记得买牛奶` |

**查看待办**：

```
@机器人 查看待办
@机器人 列出待办
@机器人 查询待办
```

按"个人待办"与"团体待办"分组展示，各自从 1 开始编号。

**完成待办**（默认操作个人待办，可指定类型）：

```
@机器人 完成待办 1
@机器人 完成个人待办 1
@机器人 完成团体待办 1
```

**删除待办**：

```
@机器人 删除待办 2
@机器人 移除待办 2
@机器人 删除个人待办 2
@机器人 删除团体待办 2
```

到点后机器人会在群内发送提醒并 @ 相关人员：个人待办 @ 创建者，团体待办 @ 参与成员与发起人。待办保存在 `data/todos.json`，重启后自动恢复。

### 5. 抽卡随机回复

@ 机器人并命中 `gacha.keywords` 中任意触发词（默认 `抽卡`、`抽一张`），从 `gacha.replies` 中随机回复一句：

```
@机器人 抽卡
@机器人 抽一张
```

话术可在 `config.json` 的 `gacha.replies` 中自定义。

### 6. 关键词自动回复

@ 机器人并发送命中 `keywordRules` 关键词的消息时，回复该规则预设的 `reply`。支持 `contains`（包含匹配，默认）与 `exact`（完全匹配）两种模式，`priority` 数字越大越优先。

```
@机器人 你好
@机器人 帮助
@机器人 功能
```

### 7. 知识库问答（RAG）

@ 机器人并附上问题，机器人在配置的知识库（本地文档 + 网站）中检索并回答：

```
@机器人 项目的部署步骤是什么？
@机器人 这个项目的技术栈有哪些？
```

未配置 LLM 时退化为直接返回命中的知识库片段；无命中时回复 `noResultReply`。

### 8. 对话闲聊

@ 机器人且知识库未命中（或未配置知识库）时，进入多轮闲聊对话，每个群独立维护最近 8 条上下文：

```
@机器人 今天心情不错，聊聊天吧
```

### 9. 仅 @ 无提问

只 @ 机器人不附内容时，回复 `mentionReply` 引导语。

## 程序化调用（模块 API）

本项目各模块可直接 import 使用。以下是主要导出：

| 模块 | 导出 | 说明 |
|------|------|------|
| `src/handler.js` | `MessageHandler`、`parseCommand` | 消息处理链；指令文本解析 |
| `src/todo.js` | `TodoManager`、`parseRemindTime`、`parseTodoCommand` | 待办管理；时间解析；待办指令解析 |
| `src/weather.js` | `WeatherClient`、`parseWeatherArg` | 天气查询；天气参数解析 |
| `src/search.js` | `SearchClient` | Bing 搜索 |
| `src/zodiac.js` | `ZodiacClient`、`normalizeSign`、`ZODIAC_SIGNS` | 星座查询；星座名归一化；12 星座列表 |
| `src/chat.js` | `Chat` | 多轮闲聊（每群独立上下文） |
| `src/gacha.js` | `matchGacha`、`pickReply` | 抽卡匹配；随机选话术 |
| `src/rules.js` | `matchRule`、`matchAllRules` | 关键词规则匹配 |
| `src/mention.js` | `extractMentionQuery`、`stripMentions` | 剥离 @ 提取提问内容 |
| `src/rag.js` | `RAG`、`textSimilarityScores`、`computeEmbeddingSimilarity` | 知识库检索问答；文本/向量相似度 |
| `src/llm.js` | `LLMClient` | OpenAI 兼容大模型客户端（chat/embed） |
| `src/ratelimit.js` | `RateLimiter` | 时间窗口限流 |
| `src/config.js` | `loadConfig`、`DEFAULT_CONFIG` | 配置加载与默认值 |
| `src/kb/index.js` | `buildKnowledge` | 构建知识库文本块 |
| `src/bot.js` | `createBot` | 创建 Wechaty 机器人实例 |

使用示例：

```js
import { parseCommand } from './src/handler.js';
import { parseRemindTime } from './src/todo.js';
import { matchGacha } from './src/gacha.js';

console.log(parseCommand('天气 北京 明天'));
// => { type: 'weather', arg: '北京', days: 1, offset: 1 }

console.log(parseCommand('搜索 云原生'));
// => { type: 'search', arg: '云原生' }

console.log(parseRemindTime('明天9点 交周报'));
// => { remindAt: <时间戳>, rest: '交周报' }

console.log(parseRemindTime('30分钟后 开会'));
// => { remindAt: <时间戳>, rest: '开会' }

console.log(matchGacha('抽一张', { keywords: ['抽卡', '抽一张'], replies: ['你很棒'] }));
// => '你很棒'
```

## 环境变量

| 变量 | 说明 |
|------|------|
| `CONFIG_PATH` | 指定配置文件路径，默认 `config.json` |
| `BOT_DEBUG` | 设为 `1` 打印详细调试日志（消息原文、处理链路） |

```bash
CONFIG_PATH=/path/to/config.json npm start
BOT_DEBUG=1 npm start
```

## 开发与测试

```bash
npm test
```

测试覆盖：关键词匹配、配置解析、文本分块、@ 文本剥离、限流、抽卡随机回复、RAG 检索、天气/星座/待办与消息处理链。

## 数据与持久化

| 文件 | 说明 |
|------|------|
| `data/todos.json` | 待办数据（重启后自动恢复） |
| `.kb-cache/` | 知识库构建缓存 |
| `bot-chat.memory-card.json` | Wechaty 登录会话缓存（删除后需重新扫码） |

## 技术栈

- Node.js + [Wechaty](https://wechaty.js.org/)（web 协议，扫码登录）
- PDF/Word 解析：pdf-parse、mammoth
- 网页正文提取：cheerio
- 知识库存储：内存 + 本地 JSON 缓存（`.kb-cache/`）

## 风险提示

个人微信 web 协议存在被微信风控的可能，请仅将机器人用于合规场景，控制回复频率，并注意账号安全。
