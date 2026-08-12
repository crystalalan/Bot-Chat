export function pickReply(replies) {
  if (!Array.isArray(replies) || replies.length === 0) return null;
  const idx = Math.floor(Math.random() * replies.length);
  return replies[idx];
}

export function matchGacha(text, config) {
  if (!config || !Array.isArray(config.replies) || config.replies.length === 0) return null;
  const keywords = Array.isArray(config.keywords) && config.keywords.length > 0 ? config.keywords : ['抽卡'];
  const t = String(text || '').trim();
  if (!t) return null;
  if (!keywords.some((k) => t.includes(k))) return null;
  return pickReply(config.replies);
}
