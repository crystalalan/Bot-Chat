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

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter(Boolean);
}

export function computeEmbeddingSimilarity(queryVec, chunkVecs) {
  return chunkVecs.map((vec) => cosineSimilarity(queryVec, vec));
}

export function textSimilarityScores(query, texts) {
  const q = new Set(tokenize(query));
  if (q.size === 0) return texts.map(() => 0);
  return texts.map((t) => {
    const tTokens = tokenize(t);
    if (tTokens.length === 0) return 0;
    const overlap = tTokens.filter((tok) => q.has(tok)).length;
    const coverage = overlap / tTokens.length;
    const contains = q.size > 0 && Array.from(q).some((tok) => t.includes(tok)) ? 0.1 : 0;
    return coverage + contains;
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
    } catch {
      return { answer: this.config.noResultReply, hits };
    }
  }
}
