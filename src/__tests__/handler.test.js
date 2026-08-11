import { MessageHandler, MESSAGE_TYPE_TEXT, parseCommand } from '../handler.js';

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

describe('parseCommand', () => {
  test('识别天气指令', () => {
    expect(parseCommand('天气 北京')).toEqual({ type: 'weather', arg: '北京' });
    expect(parseCommand('weather beijing')).toEqual({ type: 'weather', arg: 'beijing' });
  });

  test('识别搜索指令', () => {
    expect(parseCommand('搜索 Node.js')).toEqual({ type: 'search', arg: 'Node.js' });
    expect(parseCommand('搜一下 天气API')).toEqual({ type: 'search', arg: '天气API' });
    expect(parseCommand('search wechaty')).toEqual({ type: 'search', arg: 'wechaty' });
  });

  test('支持 @ 后带指令', () => {
    expect(parseCommand('@机器人 天气 上海')).toEqual({ type: 'weather', arg: '上海' });
  });

  test('仅指令词无参数返回 null', () => {
    expect(parseCommand('天气')).toBeNull();
    expect(parseCommand('搜索')).toBeNull();
  });

  test('普通消息返回 null', () => {
    expect(parseCommand('今天天气不错')).toBeNull();
    expect(parseCommand('你好')).toBeNull();
  });
});

describe('MessageHandler 天气/搜索指令', () => {
  test('天气指令调用天气客户端', async () => {
    const weather = {
      enabled: true,
      queryCityWeather: async (city) => ({ cityName: city, text: '晴', temp: '30', feelsLike: '31', humidity: '50', windDir: '南', windScale: '2' }),
      format: (w) => `天气:${w.cityName}:${w.text}:${w.temp}℃`,
    };
    const handler = new MessageHandler({ config: baseConfig, rag: null, weather });
    const msg = makeMessage({ text: '天气 北京' });
    expect(await handler.handle(msg)).toBe('天气:北京:晴:30℃');
  });

  test('天气未配置 Key 返回提示', async () => {
    const handler = new MessageHandler({ config: baseConfig, rag: null, weather: { enabled: false } });
    const msg = makeMessage({ text: '天气 北京' });
    expect(await handler.handle(msg)).toContain('USER_QWEATHER_API_KEY');
  });

  test('天气查询异常返回失败提示', async () => {
    const weather = {
      enabled: true,
      queryCityWeather: async () => {
        throw new Error('api down');
      },
    };
    const handler = new MessageHandler({ config: baseConfig, rag: null, weather });
    const msg = makeMessage({ text: '天气 北京' });
    expect(await handler.handle(msg)).toContain('天气查询失败');
  });

  test('搜索指令调用搜索客户端', async () => {
    const search = {
      enabled: true,
      search: async (q) => [{ title: `关于${q}`, url: 'https://x.com', snippet: '摘要' }],
      format: (r) => `结果:${r[0].title}`,
    };
    const handler = new MessageHandler({ config: baseConfig, rag: null, search });
    const msg = makeMessage({ text: '搜索 wechaty' });
    expect(await handler.handle(msg)).toBe('结果:关于wechaty');
  });

  test('搜索未配置 Key 返回提示', async () => {
    const handler = new MessageHandler({ config: baseConfig, rag: null, search: { enabled: false } });
    const msg = makeMessage({ text: '搜索 wechaty' });
    expect(await handler.handle(msg)).toContain('USER_BING_API_KEY');
  });
});
