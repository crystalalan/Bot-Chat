import qrcodeTerminal from 'qrcode-terminal';

export async function createBot({ config, handler, rateLimiter }) {
  const { WechatyBuilder } = await import('wechaty');
  const bot = WechatyBuilder.build({ name: 'bot-chat' });
  let scanned = false;

  bot.on('scan', (qrcode, status) => {
    scanned = true;
    console.log(`\n[扫码登录] 状态: ${status}`);
    qrcodeTerminal.generate(qrcode, { small: true });
    console.log(`https://wechaty.js.org/qrcode/${encodeURIComponent(qrcode)}`);
  });

  bot.on('login', (user) => {
    console.log(`[登录成功] ${user.name()} (${user.id})`);
    if (!scanned) {
      console.warn(
        '[提示] 本次为自动恢复上次登录会话（未扫码）。若出现"已登录但收不到/发不出消息"，说明会话已失效。' +
          '\n[解决] 按 Ctrl+C 正常退出后，重新运行 `npm start -- --relogin` 强制重新扫码登录。'
      );
    }
  });

  bot.on('logout', (user) => {
    console.log(`[已退出] ${user.name()}`);
  });

  bot.on('error', (err) => {
    console.error('[Wechaty 错误]', err);
  });

  bot.on('message', async (message) => {
    try {
      const reply = await handler.handle(message);
      if (reply) {
        if (!rateLimiter.allow()) {
          console.warn('[限流] 已超过回复频率限制，跳过本次回复');
          return;
        }
        const room = message.room();
        if (room) await room.say(reply);
        else await message.say(reply);
      }
    } catch (err) {
      console.error('[消息处理异常]', err.message);
    }
  });

  return bot;
}
