import { pickReply, matchGacha } from '../gacha.js';

describe('pickReply', () => {
  test('空列表返回 null', () => {
    expect(pickReply([])).toBeNull();
    expect(pickReply(null)).toBeNull();
    expect(pickReply(undefined)).toBeNull();
  });

  test('从列表中随机选取一项', () => {
    const replies = ['a', 'b', 'c'];
    const originalRandom = Math.random;
    Math.random = () => 0;
    expect(pickReply(replies)).toBe('a');
    Math.random = () => 0.99;
    expect(pickReply(replies)).toBe('c');
    Math.random = originalRandom;
  });
});

describe('matchGacha', () => {
  test('命中关键词返回回复列表中的一项', () => {
    const config = { keywords: ['抽卡'], replies: ['你很棒', '你今天非常漂亮'] };
    const originalRandom = Math.random;
    Math.random = () => 0;
    expect(matchGacha('抽卡', config)).toBe('你很棒');
    expect(matchGacha('@机器人 我要抽卡', config)).toBe('你很棒');
    Math.random = originalRandom;
  });

  test('未命中关键词返回 null', () => {
    const config = { keywords: ['抽卡'], replies: ['你很棒'] };
    expect(matchGacha('今天天气不错', config)).toBeNull();
  });

  test('replies 为空返回 null', () => {
    expect(matchGacha('抽卡', { keywords: ['抽卡'], replies: [] })).toBeNull();
    expect(matchGacha('抽卡', {})).toBeNull();
    expect(matchGacha('抽卡', null)).toBeNull();
  });

  test('默认关键词为抽卡', () => {
    const config = { replies: ['x'] };
    expect(matchGacha('抽卡', config)).toBe('x');
    expect(matchGacha('抽一张', config)).toBeNull();
  });

  test('空文本返回 null', () => {
    expect(matchGacha('  ', { keywords: ['抽卡'], replies: ['x'] })).toBeNull();
  });
});
