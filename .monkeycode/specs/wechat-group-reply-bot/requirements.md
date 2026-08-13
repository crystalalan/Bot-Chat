# Requirements Document

## Introduction

本项目为 Bot-Chat 微信群聊自动回复机器人。机器人通过开源 Wechaty 框架接入个人微信，运行在本地命令行环境。机器人在群聊中监听消息，当命中用户自定义的关键词时回复自定义内容；当群成员在群聊中 @ 机器人时，机器人执行特定回复；当群成员提问且命中知识库时，机器人从知识库（本地文档 PDF/Word/文本、网站/在线页面）中检索相关内容并回复。

## 技术选型

- **开发框架**: Node.js + Wechaty
- **微信接入协议**: web 协议（puppet-wechat），扫码登录
- **知识库检索**: 大模型 RAG，用户自备大模型 API Key（通过 `USER_LLM_API_KEY` 等环境变量配置）

## Glossary

- **机器人（Bot）**: 通过 Wechaty 接入个人微信的自动回复程序，对群聊消息进行监听与回复。
- **关键词规则（Keyword Rule）**: 用户定义的一组映射，包含触发关键词与对应的自定义回复内容。
- **知识库（Knowledge Base）**: 机器人用于检索回复内容的数据源，包含本地文档与网站/在线页面两种形态。
- **@ 机器人（Mention）**: 群成员在群聊消息中通过 @ 方式提及机器人的行为。
- **检索（Retrieval）**: 从知识库中查找与用户提问相关的内容并生成回复的过程。

## Requirements

### Requirement 1: 群聊消息监听

**User Story:** AS 群管理员, I want 机器人持续监听指定群聊的消息, so that 群聊中的每条消息都能被机器人感知并处理。

#### Acceptance Criteria

1. WHEN 机器人启动成功, the 机器人 SHALL 开始监听配置中指定的微信群聊会话。
2. WHEN 群聊中出现任意新消息, the 机器人 SHALL 判定该消息是否触发回复条件。
3. IF 微信登录失败或会话过期, the 机器人 SHALL 输出可读的错误日志并停止运行。

### Requirement 2: 关键词自动回复

**User Story:** AS 群管理员, I want 针对特定关键词配置自定义回复内容, so that 群成员在群聊中发送含关键词的消息时能自动收到自定义回复。

#### Acceptance Criteria

1. WHEN 群成员发送的消息命中任一已配置关键词, the 机器人 SHALL 在群聊中回复该关键词对应的自定义内容。
2. WHEN 用户配置关键词规则, the 机器人 SHALL 支持精确匹配与包含匹配两种模式。
3. WHEN 一条消息命中多条关键词规则, the 机器人 SHALL 按规则配置的优先级回复优先级最高的规则。
4. WHEN 用户修改或新增关键词规则, the 机器人 SHALL 在下次消息触发时使用更新后的规则。

### Requirement 3: @ 机器人特定回复

**User Story:** AS 群管理员, I want 群成员在群聊中 @ 机器人时得到特定回复, so that 群成员知道如何与机器人交互并触发特定能力。

#### Acceptance Criteria

1. WHEN 群成员在群聊消息中 @ 机器人, the 机器人 SHALL 回复预设的引导性内容。
2. WHEN 群成员 @ 机器人并附带提问内容, the 机器人 SHALL 将附带内容作为查询条件进行知识库检索。
3. WHEN 群成员 @ 机器人但未附带提问内容, the 机器人 SHALL 回复机器人的功能说明与使用引导。

### Requirement 4: 知识库检索回复

**User Story:** AS 群管理员, I want 机器人能从知识库检索并回复, so that 群成员的问题能从本地文档与网站中获得准确答案。

#### Acceptance Criteria

1. WHEN 机器人的配置指定了本地文档知识库, the 机器人 SHALL 解析文档（PDF/Word/纯文本）中的内容用于检索。
2. WHEN 机器人的配置指定了网站/在线页面知识库, the 机器人 SHALL 抓取页面文本内容并纳入检索范围。
3. WHEN 群成员提问并触发知识库检索, the 机器人 SHALL 从知识库中检索出相关内容并生成回复。
4. IF 知识库中未检索到与问题相关的内容, the 机器人 SHALL 回复未找到相关内容的提示信息。

### Requirement 5: 回复内容与知识库的自定义管理

**User Story:** AS 群管理员, I want 通过配置文件自定义回复内容与知识库来源, so that 无需修改代码即可调整机器人行为。

#### Acceptance Criteria

1. WHEN 用户需要调整回复内容, the 机器人 SHALL 支持通过配置文件修改关键词规则、自定义回复与 @ 回复内容。
2. WHEN 用户需要调整知识库, the 机器人 SHALL 支持通过配置文件指定本地文档路径与网站 URL 列表。
3. WHEN 配置文件格式错误, the 机器人 SHALL 输出明确的错误信息并拒绝启动。

### Requirement 6: 运行与异常处理

**User Story:** AS 群管理员, I want 机器人稳定运行并具备基本容错, so that 单项异常不会导致机器人整体崩溃。

#### Acceptance Criteria

1. WHEN 知识库检索过程中单个知识源读取失败, the 机器人 SHALL 跳过该知识源并继续处理其他知识源。
2. WHEN 机器人连续收到大量消息, the 机器人 SHALL 对回复执行限流以避免被微信风控。
3. WHEN 机器人启动, the 机器人 SHALL 输出当前加载的规则数量与知识库信息，便于管理员确认配置生效。

### Requirement 7: 天气查询指令

**User Story:** AS 群管理员, I want 群成员发送"天气 城市名"指令时机器人回复该城市实时天气, so that 群内无需跳出聊天即可获取天气信息。

#### Acceptance Criteria

1. WHEN 群成员发送以"天气"开头的文本消息, the 机器人 SHALL 解析出城市名并调用天气 API 查询实时天气。
2. WHEN 天气 API 返回成功, the 机器人 SHALL 回复包含温度、体感温度、天气现象与湿度的天气信息。
3. IF 城市名无法解析或天气 API 返回无结果, the 机器人 SHALL 回复未找到该城市天气的提示。
4. IF 未配置天气 API Key, the 机器人 SHALL 回复功能未配置的提示。
5. WHEN 群成员发送"天气 城市名 明天/后天/N天"指令, the 机器人 SHALL 调用天气预报接口并回复未来 N 天的天气现象与温度区间。

### Requirement 8: 网络搜索指令

**User Story:** AS 群管理员, I want 群成员发送"搜索 关键词"指令时机器人回复网络搜索结果, so that 群内可直接获取最新网络信息。

#### Acceptance Criteria

1. WHEN 群成员发送以"搜索"开头的文本消息, the 机器人 SHALL 解析出搜索关键词并调用搜索 API。
2. WHEN 搜索 API 返回结果, the 机器人 SHALL 回复按相关度排列的网页标题、链接与摘要。
3. IF 搜索 API 无结果, the 机器人 SHALL 回复未搜索到相关内容的提示。
4. IF 未配置搜索 API Key, the 机器人 SHALL 回复功能未配置的提示。

### Requirement 9: 对话聊天功能

**User Story:** AS 群管理员, I want 群成员 @ 机器人提问时若知识库未命中则进行多轮闲聊对话, so that 机器人能自然聊天而非机械回复。

#### Acceptance Criteria

1. WHEN 群成员 @ 机器人并附上问题, the 机器人 SHALL 先尝试从知识库检索回答。
2. IF 知识库未命中且聊天功能启用, the 机器人 SHALL 调用大模型进行多轮闲聊回复。
3. WHEN 同一群内连续对话, the 机器人 SHALL 携带该群最近 N 条消息作为上下文（每群独立维护）。
4. IF 未配置大模型 Key 或聊天配置关闭, the 机器人 SHALL 回退到原 @ 引导回复。
5. WHEN 大模型调用异常, the 机器人 SHALL 回退到原 @ 引导回复并记录错误日志。

### Requirement 10: 关键词仅 @ 触发与星座运势指令

**User Story:** AS 群管理员, I want 关键词规则仅在机器人被 @ 时触发，并支持群成员通过"星座 星座名"指令查询当日运势, so that 减少无关自动回复且功能更丰富。

#### Acceptance Criteria

1. WHEN 群成员未 @ 机器人且消息命中关键词, the 机器人 SHALL 忽略该消息（关键词仅在被 @ 时触发）。
2. WHEN 群成员 @ 机器人且消息命中关键词, the 机器人 SHALL 返回该关键词对应的自定义回复。
3. WHEN 群成员发送以"星座"或"运势"开头的文本消息, the 机器人 SHALL 解析星座名并调用聚合数据星座接口查询当日运势。
4. WHEN 星座名不合法或无法识别, the 机器人 SHALL 回复未找到该星座的提示。
5. IF 未配置星座 API Key, the 机器人 SHALL 回复功能未配置的提示。

### Requirement 11: 抽卡随机回复

**User Story:** AS 群管理员, I want 群成员 @ 机器人并提到"抽卡"时，机器人从配置的话术列表中随机回复一句, so that 增加群内互动趣味。

#### Acceptance Criteria

1. WHEN 群成员 @ 机器人且消息命中抽卡关键词（默认"抽卡"）, the 机器人 SHALL 从配置的回复话术列表中随机选取一项回复。
2. WHEN 群成员未 @ 机器人且消息命中抽卡关键词, the 机器人 SHALL 忽略该消息。
3. WHEN 配置的回复话术列表为空或未配置, the 机器人 SHALL 不触发抽卡功能。

### Requirement 12: 待办提醒

**User Story:** AS 群管理员, I want 群成员 @ 机器人添加个人/团体待办，机器人记录并到点提醒, so that 群里的事务不会被遗忘。

#### Acceptance Criteria

1. WHEN 群成员 @ 机器人并发送"添加待办 [时间] 内容", the 机器人 SHALL 解析时间与内容并保存待办，启动期间持续生效。
2. WHEN 待办内容含时间描述（如"明天9点""30分钟后"）, the 机器人 SHALL 解析出提醒时间并在到点时提醒；无时间描述则只记录不提醒。
3. WHEN 个人待办到点, the 机器人 SHALL 在所在群 @ 创建者提醒。
4. WHEN 团体待办到点, the 机器人 SHALL 在所在群 @ 消息中指定的参与成员及发起人提醒。
5. WHEN 群成员 @ 机器人发送"查看待办", the 机器人 SHALL 列出本群未完成的个人与团体待办。
6. WHEN 群成员 @ 机器人发送"完成待办 N"或"删除待办 N", the 机器人 SHALL 标记完成或删除对应待办。
7. 待办数据 SHALL 持久化到本地文件，机器人重启后自动恢复。
8. WHEN 待办内容含指定日期时间（如"8月25日 14:30"或带年份"2027年8月25日 14:30"）, the 机器人 SHALL 按指定日期与时刻提醒，无年份且日期已过时自动顺延至明年。
