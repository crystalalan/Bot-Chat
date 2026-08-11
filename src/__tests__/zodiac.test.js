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

describe('ZodiacClient 返回结构兼容', () => {
  const flatPayload = {
    name: '狮子座',
    date: '08月11日',
    all: '89',
    love: '80',
    work: '85',
    money: '84',
    health: '90',
    number: 8,
    color: '古铜色',
    QFriend: '处女座',
  };

  function mockFetch(jsonResult) {
    global.fetch = async () => ({ ok: true, json: async () => jsonResult });
  }

  afterEach(() => {
    delete process.env.USER_JUHE_API_KEY;
    delete global.fetch;
  });

  test('兼容扁平结构（error_code 与数据同层，无 result）', async () => {
    process.env.USER_JUHE_API_KEY = 'fake';
    mockFetch({ ...flatPayload, error_code: 0 });
    const client = new ZodiacClient();
    const d = await client.getDaily('狮子座');
    expect(d.name).toBe('狮子座');
    expect(d.all).toBe('89');
  });

  test('兼容 result 包裹结构', async () => {
    process.env.USER_JUHE_API_KEY = 'fake';
    mockFetch({ error_code: 0, result: { ...flatPayload } });
    const client = new ZodiacClient();
    const d = await client.getDaily('狮子座');
    expect(d.name).toBe('狮子座');
    expect(d.love).toBe('80');
  });

  test('error_code 非 0 时抛出明确错误', async () => {
    process.env.USER_JUHE_API_KEY = 'fake';
    mockFetch({ error_code: 10001, reason: 'KEY ERROR!', result: [] });
    const client = new ZodiacClient();
    await expect(client.getDaily('狮子座')).rejects.toThrow(/10001/);
  });

  test('成功但无 name 字段时返回 null', async () => {
    process.env.USER_JUHE_API_KEY = 'fake';
    mockFetch({ error_code: 0, reason: 'success', result: [] });
    const client = new ZodiacClient();
    expect(await client.getDaily('狮子座')).toBeNull();
  });
});
