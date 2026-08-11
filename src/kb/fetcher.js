export async function fetchSite(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'BotChat-KnowledgeBot/1.0' },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    const html = await res.text();
    const cheerio = (await import('cheerio')).default;
    const $ = cheerio.load(html);
    $('script, style, noscript, iframe, nav, footer, header, aside').remove();
    const text = $('body').text().replace(/\s+/g, ' ').trim();
    return { source: url, text, title: $('title').text().trim() };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchSites(urls, timeoutMs = 15000) {
  const results = [];
  const errors = [];
  for (const url of urls) {
    try {
      results.push(await fetchSite(url, timeoutMs));
    } catch (err) {
      errors.push({ source: url, error: err });
    }
  }
  return { sites: results, errors };
}
