export function chunkText(text, chunkSize = 800, chunkOverlap = 100) {
  if (!text || typeof text !== 'string') return [];
  const clean = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!clean.trim()) return [];

  const size = Math.max(1, chunkSize);
  const overlap = Math.min(Math.max(0, chunkOverlap), size - 1);

  const chunks = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + size, clean.length);

    if (end < clean.length) {
      const newline = clean.lastIndexOf('\n', end);
      const space = clean.lastIndexOf(' ', end);
      const breakPos = Math.max(newline, space);
      if (breakPos > start + size * 0.5) {
        end = breakPos;
      }
    }

    const piece = clean.slice(start, end).trim();
    if (piece) chunks.push(piece);

    if (end >= clean.length) break;
    start = end - overlap;
  }
  return chunks;
}
