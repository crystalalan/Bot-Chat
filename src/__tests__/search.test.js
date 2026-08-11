import { SearchClient } from '../search.js';

describe('SearchClient.format', () => {
  test('格式化搜索结果', () => {
    const client = new SearchClient();
    const results = [
      { title: '标题A', url: 'https://example.com/a', snippet: '摘要A' },
      { title: '标题B', url: 'https://example.com/b', snippet: '摘要B' },
    ];
    const out = client.format(results);
    expect(out).toContain('1. 标题A');
    expect(out).toContain('https://example.com/a');
    expect(out).toContain('2. 标题B');
  });

  test('无结果返回未搜索到提示', () => {
    const client = new SearchClient();
    expect(client.format([])).toContain('未搜索到');
    expect(client.format(null)).toContain('未搜索到');
  });
});

describe('SearchClient API 调用', () => {
  test('未配置 Key 时 enabled 为 false', () => {
    const client = new SearchClient();
    expect(client.enabled).toBe(Boolean(process.env.USER_BING_API_KEY));
  });

  test('未配置 Key 时 search 抛错', async () => {
    const client = new SearchClient();
    if (!client.enabled) {
      await expect(client.search('测试')).rejects.toThrow(/USER_BING_API_KEY/);
    }
  });
});
