function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

const CJK_RE = /[\u4e00-\u9fff]+/g;
const STOP_CHARS = new Set('的了么吗呢吧啊呀呀哦嗯好啊哟哦在是有和与及或之其这那'.split(''));

function tokenize(text) {
  const s = String(text || '').toLowerCase();
  const tokens = new Set();

  const cjkSegs = s.match(CJK_RE) || [];
  for (const seg of cjkSegs) {
    for (let i = 0; i < seg.length; i++) {
      const single = seg[i];
      if (!STOP_CHARS.has(single)) tokens.add(single);
      if (i + 1 < seg.length) {
        const bigram = seg.slice(i, i + 2);
        if (!STOP_CHARS.has(bigram[0]) && !STOP_CHARS.has(bigram[1])) {
          tokens.add(bigram);
        }
      }
    }
  }

  const others = s.replace(CJK_RE, ' ').match(/[a-z0-9]+/g) || [];
  for (const w of others) tokens.add(w);

  return [...tokens];
}

export function computeEmbeddingSimilarity(queryVec, chunkVecs) {
  return chunkVecs.map((vec) => cosineSimilarity(queryVec, vec));
}

export function textSimilarityScores(query, texts) {
  const qTokens = tokenize(query);
  if (qTokens.length === 0) return texts.map(() => 0);

  return texts.map((t) => {
    const tTokens = tokenize(t);
    if (tTokens.length === 0) return 0;

    const tSet = new Set(tTokens);
    let overlap = 0;
    for (const tok of qTokens) {
      if (tSet.has(tok)) overlap += 1;
    }

    const coverage = overlap / tTokens.length;
    const queryCoverage = overlap / qTokens.length;
    const contains = qTokens.some((tok) => t.includes(tok)) ? 0.15 : 0;
    return coverage + queryCoverage * 0.5 + contains;
  });
}

export class RAG {
  constructor({ store, llm, config }) {
    this.store = store;
    this.llm = llm;
    this.config = config;
    this.topK = config?.rag?.topK ?? 3;
  }

  async retrieve(query) {
    if (!this.store || this.store.size === 0) return [];
    const topK = Math.min(this.topK, this.store.size);

    if (this.llm.enabled && this.llm.embeddingModel) {
      try {
        const [queryVec] = await this.llm.embed([query]);
        const texts = this.store.chunks.map((c) => c.text);
        const scores = computeEmbeddingSimilarity(queryVec, texts);
        return this.store.chunks
          .map((c, i) => ({ chunk: c, score: scores[i] }))
          .sort((a, b) => b.score - a.score)
          .slice(0, topK);
      } catch {
        // embedding 失败时退化到文本检索
      }
    }

    const texts = this.store.chunks.map((c) => c.text);
    const scores = textSimilarityScores(query, texts);
    return this.store.chunks
      .map((c, i) => ({ chunk: c, score: scores[i] }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  async answer(query) {
    const hits = await this.retrieve(query);
    if (hits.length === 0) {
      if (process.env.BOT_DEBUG) {
        console.log(`[DEBUG rag] 检索为空。知识库文本块数=${this.store?.size ?? 0}，查询="${query}"`);
      }
      return { answer: this.config.noResultReply, hits: [] };
    }

    if (!this.llm.enabled) {
      const fallback = hits
        .map((h) => h.chunk.text)
        .slice(0, 3)
        .join('\n---\n');
      return { answer: fallback, hits };
    }

    const context = hits.map((h) => `[来源: ${h.chunk.source}]\n${h.chunk.text}`).join('\n\n');
    const messages = [
      {
        role: 'system',
        content:
          '你是群聊知识库助手。请严格基于提供的知识库片段回答用户问题。若片段不足以回答，请如实说明。回答保持简洁、准确。',
      },
      { role: 'user', content: `知识库片段：\n${context}\n\n用户问题：${query}` },
    ];
    try {
      const answer = await this.llm.chat(messages);
      return { answer, hits };
    } catch (err) {
      console.error(`[RAG 错误] 大模型调用失败: ${err.message}`);
      return { answer: this.config.noResultReply, hits };
    }
  }
}
