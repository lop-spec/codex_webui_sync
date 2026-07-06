const STORAGE_TO_BASE_URL = (process.env.CODEX_WEBUI_STORAGE_TO_BASE_URL || 'https://storage.to').replace(/\/+$/, '');
const STORAGE_TO_VISITOR_TOKEN = String(process.env.CODEX_WEBUI_STORAGE_TO_VISITOR_TOKEN || '').trim();

export interface StorageToUploadInit {
  type: 'single' | 'multipart';
  uploadUrl?: string;
  uploadId?: string;
  r2Key: string;
  partSize?: number;
  totalParts?: number;
  initialUrls?: Record<string, string>;
  headers?: Record<string, string[]>;
}

export interface StorageToFileInfo {
  id: string;
  url: string;
  rawUrl: string;
  filename: string;
  size: number;
  humanSize?: string;
  expiresAt?: string;
}

export interface StorageToPart {
  partNumber: number;
  etag: string;
}

function storageToHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': 'codex-webui-ts/transfer'
  };
  if (STORAGE_TO_VISITOR_TOKEN) headers['X-Visitor-Token'] = STORAGE_TO_VISITOR_TOKEN;
  return headers;
}

function normalizeStorageToUrl(value: unknown): string {
  const text = String(value || '').trim();
  if (!/^https?:\/\//i.test(text)) throw new Error('storage.to returned an invalid URL');
  return text;
}

async function storageToPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${STORAGE_TO_BASE_URL}${path}`, {
    method: 'POST',
    headers: storageToHeaders(),
    body: JSON.stringify(body || {})
  });
  const text = await response.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch {
    throw new Error(`storage.to returned non-JSON response: HTTP ${response.status}`);
  }
  if (!response.ok || data.success === false) {
    throw new Error(data.error || data.message || `storage.to HTTP ${response.status}`);
  }
  return data as T;
}

export function listStorageToProvider() {
  return {
    id: 'storage-to',
    label: 'storage.to',
    available: true,
    role: 'primary',
    reason: '官方 API 可用，无需 API Key；匿名上传有每日次数和 25GB 单文件限制。'
  };
}

export async function initStorageToUpload(name: unknown, mime: unknown, sizeValue: unknown): Promise<StorageToUploadInit> {
  const filename = String(name || 'download.bin').trim() || 'download.bin';
  const contentType = String(mime || 'application/octet-stream').trim() || 'application/octet-stream';
  const size = Number(sizeValue);
  if (!Number.isFinite(size) || size < 0) throw new Error('Invalid storage.to upload size');
  const data: any = await storageToPost('/api/upload/init', {
    filename,
    content_type: contentType,
    size: Math.floor(size)
  });
  return {
    type: data.type === 'multipart' ? 'multipart' : 'single',
    uploadUrl: data.upload_url ? normalizeStorageToUrl(data.upload_url) : undefined,
    uploadId: data.upload_id ? String(data.upload_id) : undefined,
    r2Key: String(data.r2_key || ''),
    partSize: data.part_size ? Number(data.part_size) : undefined,
    totalParts: data.total_parts ? Number(data.total_parts) : undefined,
    initialUrls: data.initial_urls || undefined,
    headers: data.headers || undefined
  };
}

export async function getStorageToPartUrls(uploadId: unknown, partNumbers: unknown): Promise<Record<string, string>> {
  const numbers = Array.isArray(partNumbers)
    ? partNumbers.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0)
    : [];
  if (!String(uploadId || '').trim() || !numbers.length) throw new Error('Invalid storage.to multipart request');
  const data: any = await storageToPost('/api/upload/parts', {
    upload_id: String(uploadId),
    part_numbers: numbers
  });
  return data.urls || {};
}

export async function completeStorageToMultipart(uploadId: unknown, partsValue: unknown): Promise<void> {
  const parts = Array.isArray(partsValue) ? partsValue : [];
  if (!String(uploadId || '').trim() || !parts.length) throw new Error('Invalid storage.to multipart completion');
  await storageToPost('/api/upload/complete-multipart', {
    upload_id: String(uploadId),
    parts: parts.map((part: any) => ({
      partNumber: Number(part.partNumber),
      etag: String(part.etag || part.ETag || '')
    }))
  });
}

export async function confirmStorageToUpload(name: unknown, mime: unknown, sizeValue: unknown, r2Key: unknown): Promise<StorageToFileInfo> {
  const filename = String(name || 'download.bin').trim() || 'download.bin';
  const contentType = String(mime || 'application/octet-stream').trim() || 'application/octet-stream';
  const size = Number(sizeValue);
  if (!Number.isFinite(size) || size < 0) throw new Error('Invalid storage.to confirm size');
  const data: any = await storageToPost('/api/upload/confirm', {
    filename,
    size: Math.floor(size),
    content_type: contentType,
    r2_key: String(r2Key || '')
  });
  const file = data.file || {};
  return {
    id: String(file.id || ''),
    url: normalizeStorageToUrl(file.url),
    rawUrl: normalizeStorageToUrl(file.raw_url || file.url),
    filename: String(file.filename || filename),
    size: Number(file.size || size),
    humanSize: file.human_size ? String(file.human_size) : undefined,
    expiresAt: file.expires_at ? String(file.expires_at) : undefined
  };
}
