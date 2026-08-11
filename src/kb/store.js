import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { chunkText } from './chunker.js';

export class KnowledgeStore {
  constructor({ chunkSize = 800, chunkOverlap = 100, cacheFile = '.kb-cache/knowledge.json' } = {}) {
    this.chunkSize = chunkSize;
    this.chunkOverlap = chunkOverlap;
    this.cacheFile = cacheFile;
    this.chunks = [];
  }

  add(source, text) {
    const pieces = chunkText(text, this.chunkSize, this.chunkOverlap);
    for (const piece of pieces) {
      this.chunks.push({
        id: crypto.createHash('sha1').update(`${source}:${piece}`).digest('hex').slice(0, 16),
        source,
        text: piece,
        embedding: null,
      });
    }
  }

  fromDocs(docs) {
    for (const doc of docs) this.add(doc.source, doc.text);
    return this;
  }

  fromSites(sites) {
    for (const site of sites) this.add(site.source, site.text);
    return this;
  }

  get size() {
    return this.chunks.length;
  }

  async saveCache() {
    if (!this.chunks.length) return;
    const dir = path.dirname(this.cacheFile);
    fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify({ chunkSize: this.chunkSize, chunkOverlap: this.chunkOverlap, chunks: this.chunks });
    fs.writeFileSync(this.cacheFile, payload, 'utf-8');
  }

  async loadCache() {
    if (!fs.existsSync(this.cacheFile)) return false;
    try {
      const data = JSON.parse(fs.readFileSync(this.cacheFile, 'utf-8'));
      if (data.chunkSize === this.chunkSize && data.chunkOverlap === this.chunkOverlap && Array.isArray(data.chunks)) {
        this.chunks = data.chunks;
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }
}
