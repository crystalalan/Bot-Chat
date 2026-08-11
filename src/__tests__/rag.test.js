import { RAG, textSimilarityScores, computeEmbeddingSimilarity } from '../rag.js';

const config = {
  rag: { topK: 2 },
  noResultReply: '未找到相关内容',
};

function makeStore(chunks) {
  return {
    size: chunks.length,
    chunks: chunks.map((c, i) => ({ id: String(i), source: `src-${i}`, text: c, embedding: null })),
  };
}

describe('textSimilarityScores', () => {
  test('高词重叠获得更高分数', () => {
    const scores = textSimilarityScores('如何部署机器人', ['如何部署机器人到服务器', '今天天气不错']);
    expect(scores[0]).toBeGreaterThan(scores[1]);
  });

  test('中文检索能匹配语义相关文本', () => {
    const scores = textSimilarityScores('如何安装依赖', ['运行 npm install 安装所有依赖', '复制配置文件并修改']);
    expect(scores[0]).toBeGreaterThan(scores[1]);
    expect(scores[0]).toBeGreaterThan(0);
  });

  test('中文长查询匹配对应知识库片段', () => {
    const scores = textSimilarityScores('怎么配置环境变量', [
      '运行 npm install 安装所有依赖',
      '配置 USER_LLM_API_KEY 环境变量',
    ]);
    expect(scores[1]).toBeGreaterThan(scores[0]);
  });

  test('空查询返回全零', () => {
    expect(textSimilarityScores('', ['abc'])).toEqual([0]);
  });
});

describe('computeEmbeddingSimilarity', () => {
  test('相同向量余弦相似度为1', () => {
    expect(computeEmbeddingSimilarity([1, 0], [[1, 0], [0, 1]])[0]).toBeCloseTo(1);
    expect(computeEmbeddingSimilarity([1, 0], [[1, 0], [0, 1]])[1]).toBeCloseTo(0);
  });
});

describe('RAG.retrieve', () => {
  test('无知识库时返回空数组', async () => {
    const rag = new RAG({ store: makeStore([]), llm: { enabled: false }, config });
    expect(await rag.retrieve('任意')).toEqual([]);
  });

  test('文本检索按相关度返回 topK', async () => {
    const rag = new RAG({
      store: makeStore(['服务器部署步骤是 A', '完全无关的内容 B', '部署需要配置环境 C']),
      llm: { enabled: false },
      config,
    });
    const hits = await rag.retrieve('部署');
    expect(hits.length).toBeLessThanOrEqual(2);
    expect(hits[0].score).toBeGreaterThan(0);
  });
});

describe('RAG.answer', () => {
  test('无结果时返回 noResultReply', async () => {
    const rag = new RAG({
      store: makeStore(['关于苹果的内容']),
      llm: { enabled: false },
      config,
    });
    const { answer } = await rag.answer('量子物理');
    expect(answer).toBe('未找到相关内容');
  });

  test('无 LLM 时返回原文片段兜底', async () => {
    const rag = new RAG({
      store: makeStore(['部署步骤：1. 安装 2. 配置']),
      llm: { enabled: false },
      config,
    });
    const { answer } = await rag.answer('部署');
    expect(answer).toContain('部署步骤');
  });

  test('有 LLM 时调用 chat 生成回答', async () => {
    const llm = {
      enabled: true,
      embeddingModel: '',
      chat: async () => '这是生成的回答',
    };
    const rag = new RAG({ store: makeStore(['部署步骤：1. 安装']), llm, config });
    const { answer } = await rag.answer('部署');
    expect(answer).toBe('这是生成的回答');
  });

  test('LLM 调用失败时回退到 noResultReply', async () => {
    const llm = {
      enabled: true,
      embeddingModel: '',
      chat: async () => {
        throw new Error('boom');
      },
    };
    const rag = new RAG({ store: makeStore(['部署步骤：1. 安装']), llm, config });
    const { answer } = await rag.answer('部署');
    expect(answer).toBe('未找到相关内容');
  });
});
