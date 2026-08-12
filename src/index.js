import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './config.js';
import { buildKnowledge } from './kb/index.js';
import { LLMClient } from './llm.js';
import { RAG } from './rag.js';
import { WeatherClient } from './weather.js';
import { SearchClient } from './search.js';
import { ZodiacClient } from './zodiac.js';
import { Chat } from './chat.js';
import { MessageHandler } from './handler.js';
import { RateLimiter } from './ratelimit.js';
import { createBot } from './bot.js';

const MEMORY_CARD_FILE = 'bot-chat.memory-card.json';

function handleRelogin() {
  const args = process.argv.slice(2);
  if (!args.includes('--relogin') && !args.includes('-r')) return;
  const abs = path.resolve(MEMORY_CARD_FILE);
  if (fs.existsSync(abs)) {
    fs.unlinkSync(abs);
    console.log(`[relogin] 已清除登录缓存 ${MEMORY_CARD_FILE}，将强制重新扫码登录。`);
  } else {
    console.log('[relogin] 未找到登录缓存文件，无需清除。');
  }
}

async function main() {
  handleRelogin();

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

  const weather = new WeatherClient();
  const search = new SearchClient();
  const zodiac = new ZodiacClient();
  const chat = new Chat({ llm, config });
  const handler = new MessageHandler({ config, rag, weather, search, chat, zodiac });
  const rateLimiter = new RateLimiter(config.rateLimit);
  const bot = await createBot({ config, handler, rateLimiter });

  console.log('----------------------------------------');
  console.log('微信群聊自动回复机器人启动中...');
  console.log(`监听群: ${config.rooms.length ? config.rooms.join(', ') : '所有群'}`);
  console.log(`关键词规则: ${config.keywordRules.length} 条（仅 @ 机器人时触发）`);
  console.log(`RAG 知识库: ${rag ? '已启用' : '已禁用'}`);
  console.log(`对话聊天: ${chat.enabled ? '已启用（@ 且知识库未命中时闲聊）' : '已禁用'}`);
  console.log(`天气查询: ${weather.enabled ? '已启用' : '未配置 KEY（天气功能不可用）'}`);
  console.log(`网络搜索: ${search.enabled ? '已启用' : '未配置 KEY（搜索功能不可用）'}`);
  console.log(`星座运势: ${zodiac.enabled ? '已启用' : '未配置 KEY（星座功能不可用）'}`);
  const gachaReplies = (config.gacha?.replies || []).length;
  console.log(`抽卡回复: ${gachaReplies > 0 ? `已启用（${gachaReplies} 条话术）` : '未配置话术（抽卡功能不可用）'}`);
  console.log('请用微信扫码登录。按 Ctrl+C 退出。');
  console.log('----------------------------------------');

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n[退出] 收到 ${signal}，正在正常登出以清除微信会话...`);

    const forceExitTimer = setTimeout(() => {
      console.warn('[退出] 清理超时，强制退出。');
      process.exit(0);
    }, 8000);

    try {
      if (bot.isLoggedIn) {
        await bot.logout();
        console.log('[退出] 已登出，微信端会话已清除。');
      }
    } catch (err) {
      console.warn(`[退出] 登出异常（不影响退出）: ${err.message}`);
    }
    try {
      await Promise.race([
        bot.stop(),
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);
    } catch (err) {
      console.warn(`[退出] 停止异常: ${err.message}`);
    }
    clearTimeout(forceExitTimer);
    console.log('[退出] 已安全退出。下次运行将要求重新扫码。');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT (Ctrl+C)'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  await bot.start();
}

main().catch((err) => {
  console.error(`[启动失败] ${err.message}`);
  process.exit(1);
});
