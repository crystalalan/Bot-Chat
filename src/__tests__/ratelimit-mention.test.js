import { RateLimiter } from '../ratelimit.js';
import { stripMentions, extractMentionQuery } from '../mention.js';

describe('RateLimiter', () => {
  test('窗口内允许 max 次', () => {
    const rl = new RateLimiter({ intervalMs: 60000, maxRepliesPerWindow: 3 });
    expect(rl.allow()).toBe(true);
    expect(rl.allow()).toBe(true);
    expect(rl.allow()).toBe(true);
    expect(rl.allow()).toBe(false);
  });

  test('窗口重置后恢复', async () => {
    const rl = new RateLimiter({ intervalMs: 10, maxRepliesPerWindow: 1 });
    expect(rl.allow()).toBe(true);
    expect(rl.allow()).toBe(false);
    await new Promise((r) => setTimeout(r, 20));
    expect(rl.allow()).toBe(true);
  });
});

describe('stripMentions', () => {
  test('剥离 @昵称 并清理空白', () => {
    expect(stripMentions('@机器人 部署步骤', ['机器人'])).toBe('部署步骤');
  });

  test('@ 在文本中间被剥离', () => {
    expect(stripMentions('请@机器人帮忙', ['机器人'])).toBe('请 帮忙');
  });

  test('多个 @ 全部剥离', () => {
    expect(stripMentions('@机器人 @小助手 一起吗', ['机器人', '小助手'])).toBe('一起吗');
  });
});

describe('extractMentionQuery', () => {
  test('从 mentionList 提取名字并剥离', async () => {
    const message = {
      text: () => '@机器人 怎么配置',
      mentionList: async () => [{ name: () => '机器人' }],
      self: () => null,
    };
    expect(await extractMentionQuery(message)).toBe('怎么配置');
  });

  test('mentionList 失败时用正则兜底剥离 @提及', async () => {
    const message = {
      text: () => '@机器人 怎么配置',
      mentionList: async () => {
        throw new Error('no');
      },
      self: () => null,
    };
    expect(await extractMentionQuery(message)).toBe('怎么配置');
  });

  test('仅 @ 无内容时剥离后为空字符串', async () => {
    const message = {
      text: () => '@机器人',
      mentionList: async () => [],
      self: () => null,
    };
    expect(await extractMentionQuery(message)).toBe('');
  });
});
