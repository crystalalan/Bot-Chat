import { MessageHandler, MESSAGE_TYPE_TEXT } from '../handler.js';

const baseConfig = {
  rooms: ['测试群'],
  keywordRules: [
    { id: 'greet', keywords: ['你好'], reply: '你好！', mode: 'contains', priority: 1, enabled: true },
  ],
  mentionReply: '我在！请附上问题。',
  noResultReply: '未找到相关内容。',
};

function makeMessage({ self = false, type = MESSAGE_TYPE_TEXT, text = '', roomTopic = '测试群', mentioned = false, mentionNames = [] }) {
  return {
    self: () => self,
    type: () => type,
    text: () => text,
    room: () => ({ topic: async () => roomTopic }),
    mentionSelf: async () => mentioned,
    mentionList: async () => mentionNames.map((n) => ({ name: () => n })),
  };
}

describe('MessageHandler 完整处理链', () => {
  test('@ 机器人并附问题走知识库检索', async () => {
    const rag = { answer: async (q) => ({ answer: `答案:${q}` }) };
    const handler = new MessageHandler({ config: baseConfig, rag });
    const msg = makeMessage({ mentioned: true, mentionNames: ['机器人'], text: '@机器人 部署步骤' });
    expect(await handler.handle(msg)).toBe('答案:部署步骤');
  });

  test('@ 机器人无问题回复引导', async () => {
    const handler = new MessageHandler({ config: baseConfig, rag: { answer: async () => ({ answer: 'x' }) } });
    const msg = makeMessage({ mentioned: true, text: '@机器人' });
    expect(await handler.handle(msg)).toBe('我在！请附上问题。');
  });

  test('命中关键词返回自定义回复', async () => {
    const handler = new MessageHandler({ config: baseConfig, rag: null });
    const msg = makeMessage({ text: '你好呀' });
    expect(await handler.handle(msg)).toBe('你好！');
  });

  test('未命中关键词返回 null', async () => {
    const handler = new MessageHandler({ config: baseConfig, rag: null });
    const msg = makeMessage({ text: '今天天气不错' });
    expect(await handler.handle(msg)).toBeNull();
  });

  test('机器人自身消息被忽略', async () => {
    const handler = new MessageHandler({ config: baseConfig, rag: null });
    const msg = makeMessage({ self: true, text: '你好' });
    expect(await handler.handle(msg)).toBeNull();
  });

  test('非文本消息被忽略', async () => {
    const handler = new MessageHandler({ config: baseConfig, rag: null });
    const msg = makeMessage({ type: 1, text: '' });
    expect(await handler.handle(msg)).toBeNull();
  });

  test('非白名单群被忽略', async () => {
    const handler = new MessageHandler({ config: baseConfig, rag: null });
    const msg = makeMessage({ text: '你好', roomTopic: '其他群' });
    expect(await handler.handle(msg)).toBeNull();
  });

  test('私聊消息被忽略', async () => {
    const handler = new MessageHandler({ config: baseConfig, rag: null });
    const msg = makeMessage({ text: '你好', roomTopic: null });
    msg.room = () => null;
    expect(await handler.handle(msg)).toBeNull();
  });
});
