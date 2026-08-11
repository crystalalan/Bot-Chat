import 'dotenv/config';

const BING_API = 'https://api.bing.microsoft.com/v7.0/search';

export class SearchClient {
  constructor() {
    this.apiKey = process.env.USER_BING_API_KEY || '';
    this.enabled = Boolean(this.apiKey);
  }

  async search(query, { count = 3, mkt = 'zh-CN' } = {}) {
    if (!this.enabled) throw new Error('未配置 USER_BING_API_KEY');
    const url = `${BING_API}?q=${encodeURIComponent(query)}&count=${count}&mkt=${mkt}`;
    const res = await fetch(url, {
      headers: { 'Ocp-Apim-Subscription-Key': this.apiKey },
    });
    if (!res.ok) throw new Error(`搜索请求失败 HTTP ${res.status}`);
    const data = await res.json();
    return (data.webPages?.value || []).map((item) => ({
      title: item.name || '',
      url: item.url || '',
      snippet: item.snippet || '',
    }));
  }

  format(results) {
    if (!results || results.length === 0) return '抱歉，未搜索到相关内容。';
    return results
      .map((r, i) => `${i + 1}. ${r.title}\n${r.url}\n${r.snippet}`)
      .join('\n\n');
  }
}
