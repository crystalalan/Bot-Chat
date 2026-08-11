import 'dotenv/config';
import { loadConfig } from './config.js';
import { buildKnowledge } from './kb/index.js';
import { LLMClient } from './llm.js';
import { RAG } from './rag.js';
import { MessageHandler } from './handler.js';
import { RateLimiter } from './ratelimit.js';
import { createBot } from './bot.js';

async function main() {
  const configPath = process.env.CONFIG_PATH || 'config.json';
  const config = loadConfig(configPath);

  const llm = new LLMClient();
  if (!llm.enabled) {
    console.warn('[警告] 未配置 USER_LLM_API_KEY，知识库 RAG 功能已禁用，仅保留关键词与 @ 引导回复。');
  }

  const hasKnowledge = (config.rag?.docs?.length || 0) > 0 || (config.rag?.sites?.length || 0) > 0;
  let rag = null;
  if (hasKnowledge) {
    console.log('[知识库] 正在构建...');
    const { store, cached, errors } = await buildKnowledge(config);
    for (const e of errors) {
      console.warn(`[知识库警告] ${e.source}: ${e.error.message}`);
    }
    console.log(`[知识库] 构建完成${cached ? '（命中缓存）' : ''}，共 ${store.size} 个文本块`);
    rag = new RAG({ store, llm, config });
  } else {
    console.log('[知识库] 未配置知识库来源，跳过构建');
  }

  const handler = new MessageHandler({ config, rag });
  const rateLimiter = new RateLimiter(config.rateLimit);
  const bot = await createBot({ config, handler, rateLimiter });

  console.log('----------------------------------------');
  console.log('微信群聊自动回复机器人启动中...');
  console.log(`监听群: ${config.rooms.length ? config.rooms.join(', ') : '所有群'}`);
  console.log(`关键词规则: ${config.keywordRules.length} 条`);
  console.log(`RAG 知识库: ${rag ? '已启用' : '已禁用'}`);
  console.log('请用微信扫码登录。按 Ctrl+C 退出。');
  console.log('----------------------------------------');

  await bot.start();
}

main().catch((err) => {
  console.error(`[启动失败] ${err.message}`);
  process.exit(1);
});
