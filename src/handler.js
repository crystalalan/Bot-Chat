import { matchRule } from './rules.js';
import { extractMentionQuery } from './mention.js';

export const MESSAGE_TYPE_TEXT = 7;

export class MessageHandler {
  constructor({ config, rag, bot }) {
    this.config = config;
    this.rag = rag || null;
    this.bot = bot;
    this.debug = !!process.env.BOT_DEBUG;
  }

  log(msg) {
    if (this.debug) console.log(`[DEBUG handler] ${msg}`);
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
