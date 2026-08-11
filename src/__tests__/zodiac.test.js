import { ZodiacClient, normalizeSign, ZODIAC_SIGNS } from '../zodiac.js';

describe('normalizeSign', () => {
  test('标准星座名原样返回', () => {
    expect(normalizeSign('白羊座')).toBe('白羊座');
    expect(normalizeSign('双鱼座')).toBe('双鱼座');
  });

  test('省略"座"自动补全', () => {
    expect(normalizeSign('金牛')).toBe('金牛座');
    expect(normalizeSign('天秤')).toBe('天秤座');
  });

  test('非法名称返回 null', () => {
    expect(normalizeSign('不存在座')).toBeNull();
    expect(normalizeSign('')).toBeNull();
    expect(normalizeSign(null)).toBeNull();
  });

  test('12 星座全部可识别', () => {
    expect(ZODIAC_SIGNS.length).toBe(12);
    for (const sign of ZODIAC_SIGNS) expect(normalizeSign(sign)).toBe(sign);
  });
});

describe('ZodiacClient', () => {
  test('未配置 Key 时 enabled 为 false', () => {
    const client = new ZodiacClient();
    expect(client.enabled).toBe(Boolean(process.env.USER_JUHE_API_KEY));
  });

  test('未配置 Key 时 getDaily 抛错', async () => {
    const client = new ZodiacClient();
    if (!client.enabled) {
      await expect(client.getDaily('白羊座')).rejects.toThrow(/USER_JUHE_API_KEY/);
    }
  });

  test('非法星座返回 null', async () => {
    process.env.USER_JUHE_API_KEY = 'fake';
    const client = new ZodiacClient();
    expect(await client.getDaily('不存在座')).toBeNull();
    delete process.env.USER_JUHE_API_KEY;
  });

  test('format 输出运势字段', () => {
    const client = new ZodiacClient();
    const d = {
      name: '白羊座',
      date: '08月11日',
      week: '星期二',
      all: '整体不错',
      love: '感情顺利',
      work: '工作努力',
      money: '财运一般',
      health: '健康良好',
      number: '5',
      color: '红色',
      QFriend: '狮子座',
    };
    const out = client.format(d);
    expect(out).toContain('白羊座 今日运势');
    expect(out).toContain('综合运势：整体不错');
    expect(out).toContain('爱情：感情顺利');
    expect(out).toContain('幸运数字：5');
    expect(out).toContain('速配星座：狮子座');
  });

  test('format 空数据返回未找到提示', () => {
    const client = new ZodiacClient();
    expect(client.format(null)).toContain('未找到该星座');
  });
});
