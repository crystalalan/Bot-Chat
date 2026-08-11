export function stripMentions(text, mentionNames) {
  if (!text) return '';
  let out = String(text);
  for (const name of mentionNames) {
    if (!name) continue;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`@\\s*${escaped}\\s*`, 'g'), ' ');
  }
  return out.replace(/\s+/g, ' ').trim();
}

export async function extractMentionQuery(message) {
  const text = message.text() || '';
  let names = [];
  try {
    const mentioned = await message.mentionList();
    names = mentioned.map((c) => c.name()).filter(Boolean);
  } catch {
    names = [];
  }
  if (names.length === 0) {
    const self = message.self();
    if (self) names = [self.name()];
  }
  let query = stripMentions(text, names);
  if (names.length === 0) {
    query = query.replace(/@[\u4e00-\u9fa5a-zA-Z0-9_\-]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  return query;
}
