export class Chat {
  constructor({ llm, config }) {
    this.llm = llm || null;
    this.config = config || {};
    this.historySize = this.config.chat?.historySize ?? 8;
    this.enabled = Boolean(this.config.chat?.enabled) && Boolean(this.llm?.enabled);
    this.systemPrompt =
      this.config.chat?.systemPrompt ||
      '你是微信群聊中的智能助手。请用简洁、友好、口语化的中文回答群成员的问题。回答不宜过长。';
    this.rooms = new Map();
  }

  getHistory(topic) {
    if (!this.rooms.has(topic)) this.rooms.set(topic, []);
    return this.rooms.get(topic);
  }

  push(topic, role, content) {
    const history = this.getHistory(topic);
    history.push({ role, content });
    if (history.length > this.historySize) history.splice(0, history.length - this.historySize);
  }

  async reply(topic, text) {
    if (!this.enabled) return null;
    const history = this.getHistory(topic);
    const messages = [
      { role: 'system', content: this.systemPrompt },
      ...history,
      { role: 'user', content: text },
    ];
    try {
      const answer = await this.llm.chat(messages, { temperature: 0.8, maxTokens: 800 });
      const clean = (answer || '').trim();
      if (!clean) return null;
      this.push(topic, 'user', text);
      this.push(topic, 'assistant', clean);
      return clean;
    } catch (err) {
      console.error(`[闲聊异常] ${err.message}`);
      return null;
    }
  }
}
