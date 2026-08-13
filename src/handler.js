import { matchRule } from './rules.js';
import { extractMentionQuery } from './mention.js';
import { matchGacha } from './gacha.js';
import { parseWeatherArg } from './weather.js';
import { parseTodoCommand, parseRemindTime } from './todo.js';

export const MESSAGE_TYPE_TEXT = 7;

export function parseCommand(text) {
  if (!text) return null;
  const t = String(text).trim().replace(/^@[\u4e00-\u9fa5a-zA-Z0-9_\-]+\s*/, '').trim();

  const weatherMatch = t.match(/^(天气|weather)\s+(.+)$/i);
  if (weatherMatch) {
    const parsed = parseWeatherArg(weatherMatch[2]);
    if (parsed) return parsed;
  }

  const searchMatch = t.match(/^(搜索|搜一下|search)\s+(.+)$/i);
  if (searchMatch && searchMatch[2].trim()) {
    return { type: 'search', arg: searchMatch[2].trim() };
  }

  const zodiacMatch = t.match(/^(星座|运势|今日星座)\s*(.*)$/i);
  if (zodiacMatch && (zodiacMatch[2] || '').trim()) {
    return { type: 'zodiac', arg: zodiacMatch[2].trim() };
  }

  return null;
}

export class MessageHandler {
  constructor({ config, rag, bot, weather, search, chat, zodiac, todo }) {
    this.config = config;
    this.rag = rag || null;
    this.bot = bot;
    this.weather = weather || null;
    this.search = search || null;
    this.chat = chat || null;
    this.zodiac = zodiac || null;
    this.todo = todo || null;
    this.debug = !!process.env.BOT_DEBUG;
  }

  log(msg) {
    if (this.debug) console.log(`[DEBUG handler] ${msg}`);
  }

  async handleCommand(text) {
    const cmd = parseCommand(text);
    if (!cmd) return null;

    if (cmd.type === 'weather') {
      this.log(`指令: 天气 ${cmd.arg}`);
      if (!this.weather || !this.weather.enabled) {
        return '天气功能未配置：请在 .env 中设置 USER_QWEATHER_API_KEY 与 USER_QWEATHER_API_HOST（和风天气控制台可查）。';
      }
      try {
        if (cmd.days && cmd.days > 0) {
          const f = await this.weather.queryCityForecast(cmd.arg, cmd.days, cmd.offset || 0);
          return this.weather.formatForecast(f);
        }
        const w = await this.weather.queryCityWeather(cmd.arg);
        return this.weather.format(w);
      } catch (err) {
        console.error(`[天气查询异常] ${err.message}`);
        return '天气查询失败，请稍后再试。';
      }
    }

    if (cmd.type === 'search') {
      this.log(`指令: 搜索 ${cmd.arg}`);
      if (!this.search || !this.search.enabled) {
        return '搜索功能未配置：请在 .env 中设置 USER_BING_API_KEY（Bing Web Search）。';
      }
      try {
        const results = await this.search.search(cmd.arg);
        return this.search.format(results);
      } catch (err) {
        console.error(`[搜索异常] ${err.message}`);
        return '搜索失败，请稍后再试。';
      }
    }

    if (cmd.type === 'zodiac') {
      this.log(`指令: 星座 ${cmd.arg}`);
      if (!this.zodiac || !this.zodiac.enabled) {
        return '星座运势未配置：请在 .env 中设置 USER_JUHE_API_KEY（聚合数据，https://www.juhe.cn）。';
      }
      try {
        const d = await this.zodiac.getDaily(cmd.arg);
        return this.zodiac.format(d);
      } catch (err) {
        console.error(`[星座异常] ${err.message}`);
        return '星座运势查询失败，请稍后再试。';
      }
    }

    return null;
  }

  async _roomId(room) {
    try {
      return typeof room.id === 'function' ? await room.id() : room.id;
    } catch {
      return '';
    }
  }

  async _botSelfId() {
    try {
      return this.bot?.userSelf?.()?.id;
    } catch {
      return null;
    }
  }

  async _mentionContacts(message) {
    let contacts = [];
    try {
      contacts = await message.mentionList();
    } catch {
      contacts = [];
    }
    const selfId = await this._botSelfId();
    return contacts.filter((c) => c && c.id && c.id !== selfId);
  }

  async handleTodo(cmd, message, room, topic) {
    if (!this.todo) return '待办功能未配置（todo.enabled 为 false）。';

    const roomId = await this._roomId(room);

    if (cmd.action === 'add') {
      const { remindAt, rest } = parseRemindTime(cmd.raw);
      if (!rest) return '待办内容不能为空，格式：添加待办 [时间] 内容。';
      const creator = (() => { try { return message.talker(); } catch { return null; } })();
      let participants = [];
      if (cmd.scope === 'group') {
        const all = await this._mentionContacts(message);
        const selfId = creator?.id;
        participants = all.filter((c) => c.id !== selfId);
      }
      const todo = this.todo.add({
        scope: cmd.scope,
        content: rest,
        remindAt,
        roomId,
        roomTopic: topic,
        creator,
        participants,
      });
      return this.todo.formatAdd(todo);
    }

    if (cmd.action === 'list') {
      return this.todo.formatList(roomId);
    }

    if (cmd.action === 'done') {
      const todo = this.todo.markDone(roomId, cmd.scope, cmd.seq);
      if (!todo) return '未找到对应序号的待办。';
      return `已完成待办：${todo.content}`;
    }

    if (cmd.action === 'remove') {
      const todo = this.todo.remove(roomId, cmd.scope, cmd.seq);
      if (!todo) return '未找到对应序号的待办。';
      return `已删除待办：${todo.content}`;
    }

    return null;
  }

  async handle(message) {
    if (message.self()) {
      this.log('拦截: 机器人自身消息');
      return null;
    }

    const room = message.room();
    if (!room) {
      this.log('拦截: 私聊消息（仅处理群聊）');
      return null;
    }

    let type;
    try {
      type = message.type();
    } catch {
      type = null;
    }
    if (type !== MESSAGE_TYPE_TEXT) {
      this.log(`拦截: 非文本消息 type=${type}`);
      return null;
    }

    let topic = '';
    try {
      topic = await room.topic();
    } catch {
      topic = '';
    }
    if (this.config.rooms.length > 0 && !this.config.rooms.includes(topic)) {
      this.log(`拦截: 群 "${topic}" 不在白名单 [${this.config.rooms.join(', ')}] 中`);
      return null;
    }

    const text = message.text() || '';
    if (!text.trim()) {
      this.log('拦截: 空文本消息');
      return null;
    }

    const cmdReply = await this.handleCommand(text);
    if (cmdReply) return cmdReply;

    let mentioned = false;
    try {
      mentioned = await message.mentionSelf();
    } catch {
      mentioned = false;
    }

    if (!mentioned) {
      this.log(`未 @ 机器人，跳过关键词与知识库处理: ${JSON.stringify(text)}`);
      return null;
    }

    this.log(`命中 @: 文本=${JSON.stringify(text)}`);
    const query = await extractMentionQuery(message);

    const todoCmd = parseTodoCommand(query || text);
    if (todoCmd) {
      this.log(`待办指令: ${JSON.stringify(todoCmd)}`);
      return this.handleTodo(todoCmd, message, room, topic);
    }

    const gachaReply = matchGacha(query || text, this.config.gacha);
    if (gachaReply) {
      this.log(`命中抽卡: ${JSON.stringify(query || text)}`);
      return gachaReply;
    }

    const rule = matchRule(query || text, this.config.keywordRules || []);
    if (rule) {
      this.log(`命中关键词规则 "${rule.id}": ${JSON.stringify(query || text)}`);
      return rule.reply;
    }

    if (query) {
      if (this.rag) {
        const { answer, hits } = await this.rag.answer(query);
        if (hits && hits.length > 0) return answer;
        if (this.chat && this.chat.enabled) {
          this.log(`知识库未命中，进入闲聊: ${JSON.stringify(query)}`);
          const chatReply = await this.chat.reply(topic, query);
          if (chatReply) return chatReply;
        }
        return answer;
      }
      if (this.chat && this.chat.enabled) {
        this.log(`无知识库，进入闲聊: ${JSON.stringify(query)}`);
        const chatReply = await this.chat.reply(topic, query);
        if (chatReply) return chatReply;
      }
      return this.config.mentionReply;
    }
    return this.config.mentionReply;
  }
}
