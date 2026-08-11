import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_CONFIG = {
  rooms: [],
  keywordRules: [],
  mentionReply: '我在！你可以 @ 我并附上问题，我会尽力从知识库中为你找到答案。',
  noResultReply: '抱歉，我在知识库中没有找到相关内容。',
  rag: {
    docs: [],
    sites: [],
    topK: 3,
    chunkSize: 800,
    chunkOverlap: 100,
  },
  rateLimit: {
    intervalMs: 60000,
    maxRepliesPerWindow: 20,
  },
  chat: {
    enabled: true,
    historySize: 8,
  },
};

function mergeDeep(base, override) {
  const out = { ...base };
  for (const [key, value] of Object.entries(override || {})) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      base[key] &&
      typeof base[key] === 'object' &&
      !Array.isArray(base[key])
    ) {
      out[key] = mergeDeep(base[key], value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function validate(config) {
  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    throw new Error('配置文件根节点必须是 JSON 对象');
  }
  if (config.rooms !== undefined && !Array.isArray(config.rooms)) {
    throw new Error('rooms 必须是字符串数组');
  }
  if (config.keywordRules !== undefined) {
    if (!Array.isArray(config.keywordRules)) throw new Error('keywordRules 必须是数组');
    for (const rule of config.keywordRules) {
      if (!rule.id || typeof rule.id !== 'string') throw new Error('每条 keywordRule 必须包含字符串 id');
      if (!Array.isArray(rule.keywords) || rule.keywords.length === 0) {
        throw new Error(`keywordRule[${rule.id}] 的 keywords 必须是非空字符串数组`);
      }
      if (rule.mode !== undefined && !['exact', 'contains'].includes(rule.mode)) {
        throw new Error(`keywordRule[${rule.id}] 的 mode 必须是 "exact" 或 "contains"`);
      }
    }
  }
  if (config.rag !== undefined) {
    if (config.rag.docs !== undefined && !Array.isArray(config.rag.docs)) throw new Error('rag.docs 必须是数组');
    if (config.rag.sites !== undefined && !Array.isArray(config.rag.sites)) throw new Error('rag.sites 必须是数组');
  }
  return true;
}

export function loadConfig(filePath = 'config.json') {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`配置文件不存在: ${filePath}。请从 config.example.json 复制并修改。`);
  }
  let raw;
  try {
    raw = fs.readFileSync(abs, 'utf-8');
  } catch (err) {
    throw new Error(`读取配置文件失败: ${err.message}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`config.json 不是合法 JSON: ${err.message}`);
  }
  validate(parsed);
  return mergeDeep(DEFAULT_CONFIG, parsed);
}
