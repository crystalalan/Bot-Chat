import { Chat } from '../chat.js';

const llmOk = {
  enabled: true,
  chat: async (messages) => {
    const last = messages[messages.length - 1].content;
    return `回复:${last}`;
  },
};

describe('Chat', () => {
  test('enabled 要求 chat.enabled 且 llm 可用', () => {
    expect(new Chat({ llm: llmOk, config: { chat: { enabled: true } } }).enabled).toBe(true);
    expect(new Chat({ llm: llmOk, config: { chat: { enabled: false } } }).enabled).toBe(false);
    expect(new Chat({ llm: { enabled: false }, config: { chat: { enabled: true } } }).enabled).toBe(false);
  });

  test('reply 调用 llm 并返回清理后的内容', async () => {
    const chat = new Chat({ llm: llmOk, config: { chat: { enabled: true } } });
    expect(await chat.reply('群A', '你好')).toBe('回复:你好');
  });

  test('多轮对话携带历史上下文', async () => {
    const seen = [];
    const llm = {
      enabled: true,
      chat: async (messages) => {
        seen.push(messages.map((m) => `${m.role}:${m.content}`));
        return 'ok';
      },
    };
    const chat = new Chat({ llm, config: { chat: { enabled: true, historySize: 8 } } });
    await chat.reply('群A', '第一句');
    await chat.reply('群A', '第二句');
    const last = seen[1];
    expect(last).toContain('user:第一句');
    expect(last).toContain('assistant:ok');
    expect(last).toContain('user:第二句');
  });

  test('历史超过 historySize 时截断', async () => {
    const chat = new Chat({ llm: llmOk, config: { chat: { enabled: true, historySize: 2 } } });
    await chat.reply('群A', '1');
    await chat.reply('群A', '2');
    await chat.reply('群A', '3');
    const history = chat.getHistory('群A');
    expect(history.length).toBe(2);
    expect(history.map((m) => m.content)).toEqual(['3', '回复:3']);
  });

  test('不同群的历史相互隔离', async () => {
    const chat = new Chat({ llm: llmOk, config: { chat: { enabled: true } } });
    await chat.reply('群A', 'a');
    await chat.reply('群B', 'b');
    expect(chat.getHistory('群A').map((m) => m.content)).toEqual(['a', '回复:a']);
    expect(chat.getHistory('群B').map((m) => m.content)).toEqual(['b', '回复:b']);
  });

  test('llm 异常时 reply 返回 null 并记录错误', async () => {
    const origErr = console.error;
    const errLogs = [];
    console.error = (...args) => errLogs.push(args.join(' '));
    const llm = {
      enabled: true,
      chat: async () => {
        throw new Error('boom');
      },
    };
    const chat = new Chat({ llm, config: { chat: { enabled: true } } });
    expect(await chat.reply('群A', 'hi')).toBeNull();
    expect(errLogs.join('\n')).toContain('闲聊异常');
    console.error = origErr;
  });

  test('llm 返回空内容时 reply 返回 null', async () => {
    const llm = { enabled: true, chat: async () => '   ' };
    const chat = new Chat({ llm, config: { chat: { enabled: true } } });
    expect(await chat.reply('群A', 'hi')).toBeNull();
  });
});
