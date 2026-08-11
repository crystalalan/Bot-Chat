import { matchRule } from './rules.js';
import { extractMentionQuery } from './mention.js';

export const MESSAGE_TYPE_TEXT = 7;

export class MessageHandler {
  constructor({ config, rag, bot }) {
    this.config = config;
    this.rag = rag || null;
    this.bot = bot;
  }

  async handle(message) {
    if (message.self()) return null;

    const room = message.room();
    if (!room) return null;

    let type;
    try {
      type = message.type();
    } catch {
      type = null;
    }
    if (type !== MESSAGE_TYPE_TEXT) return null;

    const topic = await room.topic().catch(() => '');
    if (this.config.rooms.length > 0 && !this.config.rooms.includes(topic)) {
      return null;
    }

    const text = message.text() || '';
    if (!text.trim()) return null;

    let mentioned = false;
    try {
      mentioned = await message.mentionSelf();
    } catch {
      mentioned = false;
    }

    if (mentioned) {
      const query = await extractMentionQuery(message);
      if (query) {
        if (!this.rag) return this.config.mentionReply;
        const { answer } = await this.rag.answer(query);
        return answer;
      }
      return this.config.mentionReply;
    }

    const rule = matchRule(text, this.config.keywordRules || []);
    if (rule) return rule.reply;

    return null;
  }
}
