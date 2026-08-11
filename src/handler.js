import { matchRule } from './rules.js';
import { extractMentionQuery } from './mention.js';

export const MESSAGE_TYPE_TEXT = 7;

export function parseCommand(text) {
  if (!text) return null;
  const t = String(text).trim().replace(/^@[\u4e00-\u9fa5a-zA-Z0-9_\-]+\s*/, '').trim();

  const weatherMatch = t.match(/^(天气|weather)\s+(.+)$/i);
  if (weatherMatch && weatherMatch[2].trim()) {
    return { type: 'weather', arg: weatherMatch[2].trim() };
  }

  const searchMatch = t.match(/^(搜索|搜一下|search)\s+(.+)$/i);
  if (searchMatch && searchMatch[2].trim()) {
    return { type: 'search', arg: searchMatch[2].trim() };
  }

  return null;
}

export class MessageHandler {
  constructor({ config, rag, bot, weather, search }) {
    this.config = config;
    this.rag = rag || null;
    this.bot = bot;
    this.weather = weather || null;
    this.search = search || null;
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

    if (mentioned) {
      this.log(`命中 @: 文本=${JSON.stringify(text)}`);
      const query = await extractMentionQuery(message);
      if (query) {
        if (!this.rag) return this.config.mentionReply;
        const { answer } = await this.rag.answer(query);
        return answer;
      }
      return this.config.mentionReply;
    }

    const rule = matchRule(text, this.config.keywordRules || []);
    if (rule) {
      this.log(`命中关键词规则 "${rule.id}": ${JSON.stringify(text)}`);
      return rule.reply;
    }

    this.log(`未命中任何规则: ${JSON.stringify(text)}`);
    return null;
  }
}
