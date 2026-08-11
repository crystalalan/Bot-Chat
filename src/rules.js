export function matchRule(text, rules) {
  if (!text || typeof text !== 'string' || !Array.isArray(rules) || rules.length === 0) {
    return null;
  }
  const enabled = rules
    .filter((r) => r.enabled !== false)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  for (const rule of enabled) {
    const mode = rule.mode === 'exact' ? 'exact' : 'contains';
    const hit = rule.keywords.some((kw) => {
      if (!kw) return false;
      const k = kw;
      const t = text;
      return mode === 'exact' ? t === k : t.includes(k);
    });
    if (hit) return rule;
  }
  return null;
}

export function matchAllRules(text, rules) {
  if (!text || !Array.isArray(rules)) return [];
  const hits = [];
  for (const rule of rules) {
    if (rule.enabled === false) continue;
    const mode = rule.mode === 'exact' ? 'exact' : 'contains';
    const hit = rule.keywords.some((kw) => {
      if (!kw) return false;
      return mode === 'exact' ? text === kw : text.includes(kw);
    });
    if (hit) hits.push(rule);
  }
  return hits;
}
