import { loadDocs } from './loader.js';
import { fetchSites } from './fetcher.js';
import { KnowledgeStore } from './store.js';

export async function buildKnowledge(config, { useCache = true } = {}) {
  const rag = config.rag || {};
  const store = new KnowledgeStore({
    chunkSize: rag.chunkSize,
    chunkOverlap: rag.chunkOverlap,
  });

  if (useCache) {
    const cached = await store.loadCache();
    if (cached && store.size > 0) {
      return { store, cached: true, errors: [] };
    }
  }

  const errors = [];
  const docs = (rag.docs || []).length ? await loadDocs(rag.docs) : { docs: [], errors: [] };
  const sites = (rag.sites || []).length ? await fetchSites(rag.sites) : { sites: [], errors: [] };

  store.fromDocs(docs.docs);
  store.fromSites(sites.sites);
  errors.push(...docs.errors, ...sites.errors);

  await store.saveCache();
  return { store, cached: false, errors };
}
