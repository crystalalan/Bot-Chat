import 'dotenv/config';

export class LLMClient {
  constructor() {
    this.apiKey = process.env.USER_LLM_API_KEY || '';
    this.baseUrl = (process.env.USER_LLM_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/+$/, '');
    this.chatModel = process.env.USER_LLM_MODEL || 'deepseek-chat';
    this.embeddingModel = process.env.USER_LLM_EMBEDDING_MODEL || '';
    this.enabled = Boolean(this.apiKey);
  }

  async chat(messages, { temperature = 0.7, maxTokens = 1000 } = {}) {
    if (!this.enabled) throw new Error('LLM 未启用：未配置 USER_LLM_API_KEY');
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.chatModel,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`LLM chat 请求失败 HTTP ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  }

  async embed(texts) {
    if (!this.enabled) throw new Error('LLM 未启用：未配置 USER_LLM_API_KEY');
    if (!this.embeddingModel) throw new Error('未配置 USER_LLM_EMBEDDING_MODEL，无法使用向量检索');
    const res = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: this.embeddingModel, input: texts }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`LLM embed 请求失败 HTTP ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    return (data.data || []).map((d) => d.embedding);
  }
}
