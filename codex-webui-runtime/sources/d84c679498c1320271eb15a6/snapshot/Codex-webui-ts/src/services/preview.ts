import fs from 'fs';
import path from 'path';

const IMAGE_EXTENSIONS = new Set(['avif', 'bmp', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp']);
const DOCUMENT_EXTENSIONS = new Set(['csv', 'md', 'markdown', 'pdf', 'rtf', 'txt']);
const TEXT_EXTENSIONS = new Set(['csv', 'md', 'markdown', 'txt']);
const MAX_PREVIEW_BYTES = 220_000;
const MAX_DIRECTORY_PREVIEW_ENTRIES = 160;

function extensionFor(value: string): string {
  return path.extname(value.split(/[?#]/, 1)[0] || value).replace(/^\./, '').toLowerCase();
}

function basenameFor(value: string): string {
  return path.basename(value.replace(/[\\/]+$/, '')) || value;
}

function mimeFor(extension: string): string {
  if (extension === 'svg') return 'image/svg+xml';
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'gif') return 'image/gif';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'avif') return 'image/avif';
  if (extension === 'bmp') return 'image/bmp';
  if (extension === 'pdf') return 'application/pdf';
  if (extension === 'md' || extension === 'markdown') return 'text/markdown';
  if (extension === 'csv') return 'text/csv';
  if (extension === 'txt') return 'text/plain';
  return 'application/octet-stream';
}

function normalizeTarget(value: unknown): string {
  let target = String(value || '').trim();
  if ((target.startsWith('<') && target.endsWith('>')) || (target.startsWith('"') && target.endsWith('"'))) {
    target = target.slice(1, -1).trim();
  }
  try { target = decodeURI(target); } catch {}
  return target;
}

function resolvePreviewPath(target: string, cwd: string): string {
  let value = target;
  if (value.toLowerCase().startsWith('file://')) {
    value = new URL(value).pathname;
    if (process.platform === 'win32') value = value.replace(/^\/([A-Za-z]:)/, '$1');
  }
  const withoutLine = value.replace(/:(\d+)(?::\d+)?$/, '');
  return path.resolve(path.isAbsolute(withoutLine) ? withoutLine : path.join(cwd, withoutLine));
}

async function previewWebsite(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();
    const title = (text.match(/<title[^>]*>([^<]+)<\/title>/i) || [])[1]?.trim() || url;
    return {
      ok: true,
      kind: 'website',
      url: response.url || url,
      title,
      contentType,
      status: response.status,
      text: text.slice(0, MAX_PREVIEW_BYTES),
      truncated: text.length > MAX_PREVIEW_BYTES
    };
  } finally {
    clearTimeout(timer);
  }
}

function previewFile(filePath: string) {
  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) {
    const entries = [];
    const directory = fs.opendirSync(filePath);
    try {
      while (entries.length < MAX_DIRECTORY_PREVIEW_ENTRIES + 1) {
        const entry = directory.readSync();
        if (!entry) break;
        entries.push({
          name: entry.name,
          path: path.join(filePath, entry.name),
          kind: entry.isDirectory() ? 'directory' : 'file',
          hidden: entry.name.startsWith('.')
        });
      }
    } finally {
      directory.closeSync();
    }
    entries.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
    const visibleEntries = entries.slice(0, MAX_DIRECTORY_PREVIEW_ENTRIES);
    const truncated = entries.length > MAX_DIRECTORY_PREVIEW_ENTRIES;
    return {
      ok: true,
      kind: 'directory',
      path: filePath,
      name: basenameFor(filePath),
      entries: visibleEntries,
      totalEntries: visibleEntries.length + (truncated ? 1 : 0),
      truncated
    };
  }
  if (!stat.isFile()) throw new Error('preview target must be a file');
  const extension = extensionFor(filePath);
  const name = basenameFor(filePath);
  if (!IMAGE_EXTENSIONS.has(extension) && !DOCUMENT_EXTENSIONS.has(extension)) {
    throw new Error('file type is not previewable');
  }
  const size = stat.size;
  const mime = mimeFor(extension);
  if (IMAGE_EXTENSIONS.has(extension)) {
    const data = fs.readFileSync(filePath);
    return {
      ok: true,
      kind: 'file',
      fileKind: 'image',
      path: filePath,
      name,
      extension,
      mime,
      size,
      dataUrl: `data:${mime};base64,${data.toString('base64')}`,
      truncated: false
    };
  }
  if (TEXT_EXTENSIONS.has(extension)) {
    const data = fs.readFileSync(filePath);
    const truncated = data.length > MAX_PREVIEW_BYTES;
    return {
      ok: true,
      kind: 'file',
      fileKind: 'document',
      path: filePath,
      name,
      extension,
      mime,
      size,
      text: data.subarray(0, MAX_PREVIEW_BYTES).toString('utf8'),
      markdown: extension === 'md' || extension === 'markdown',
      truncated
    };
  }
  return {
    ok: true,
    kind: 'file',
    fileKind: 'document',
    path: filePath,
    name,
    extension,
    mime,
    size,
    embeddable: extension === 'pdf',
    truncated: false
  };
}

export async function getQuickPreview(target: unknown, cwd: string) {
  const normalized = normalizeTarget(target);
  if (!normalized) throw new Error('preview target is required');
  if (/^https?:\/\//i.test(normalized)) return previewWebsite(normalized);
  return previewFile(resolvePreviewPath(normalized, cwd));
}
