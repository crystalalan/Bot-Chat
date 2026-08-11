import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadPdf(filePath) {
  const pdfParse = (await import('pdf-parse')).default;
  const buf = fs.readFileSync(filePath);
  const data = await pdfParse(buf);
  return data.text || '';
}

async function loadDocx(filePath) {
  const mammoth = (await import('mammoth')).default;
  const buf = fs.readFileSync(filePath);
  const result = await mammoth.extractRawText({ buffer: buf });
  return result.value || '';
}

async function loadText(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

function walkDir(dir, exts, results) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.')) continue;
      walkDir(full, exts, results);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (exts.has(ext)) results.push(full);
    }
  }
}

export const SUPPORTED_EXTS = new Set(['.txt', '.md', '.pdf', '.docx']);

export async function loadDocs(paths) {
  const results = [];
  const errors = [];
  const allFiles = [];
  for (const p of paths) {
    const abs = path.resolve(p);
    if (!fs.existsSync(abs)) {
      errors.push({ source: p, error: new Error('路径不存在') });
      continue;
    }
    const stat = fs.statSync(abs);
    if (stat.isFile()) {
      if (SUPPORTED_EXTS.has(path.extname(abs).toLowerCase())) allFiles.push(abs);
      else errors.push({ source: p, error: new Error(`不支持的文档格式: ${path.extname(abs)}`) });
    } else if (stat.isDirectory()) {
      walkDir(abs, SUPPORTED_EXTS, allFiles);
    }
  }

  for (const file of allFiles) {
    try {
      const ext = path.extname(file).toLowerCase();
      let text;
      if (ext === '.pdf') text = await loadPdf(file);
      else if (ext === '.docx') text = await loadDocx(file);
      else text = await loadText(file);
      results.push({ source: file, text });
    } catch (err) {
      errors.push({ source: file, error: err });
    }
  }
  return { docs: results, errors };
}
