import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pipeline } from 'stream/promises';

const TRANSFER_ROOT = process.env.CODEX_WEBUI_TRANSFERS
  ? path.resolve(process.env.CODEX_WEBUI_TRANSFERS)
  : path.resolve(process.cwd(), 'transfers');
const ANDROID_INBOX_ROOT = process.env.CODEX_WEBUI_ANDROID_INBOX
  ? path.resolve(process.env.CODEX_WEBUI_ANDROID_INBOX)
  : path.join(os.homedir(), 'Documents', 'Codex', 'Android', 'webui-companion', 'received-from-phone');
const ANDROID_PHONE_UPLOADERS = new Set(['android-companion', 'android-app']);
const RETENTION_HOURS = Number(process.env.CODEX_WEBUI_TRANSFER_TTL_HOURS || 24);

export type TransferFileStatus = 'uploading' | 'ready' | 'failed';
export type TransferProvider = 'local' | 'storage-to';

export interface TransferProviderAttempt {
  provider: TransferProvider;
  label: string;
  status: 'skipped' | 'failed' | 'ready';
  startedAt: number;
  completedAt?: number;
  error?: string;
  url?: string;
}

export interface TransferFileMeta {
  id: string;
  name: string;
  mime: string;
  expectedSize: number | null;
  size: number;
  status: TransferFileStatus;
  uploaderId: string;
  downloadToken: string;
  provider?: TransferProvider;
  providerLabel?: string;
  downloadUrl?: string;
  rawDownloadUrl?: string;
  localPath?: string;
  androidInbox?: {
    status: 'received' | 'failed';
    path?: string;
    name?: string;
    size?: number;
    receivedAt?: number;
    failedAt?: number;
    error?: string;
    sourceUploaderId?: string;
  };
  remoteId?: string;
  remoteExpiresAt?: string;
  providerAttempts?: TransferProviderAttempt[];
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  completedAt?: number;
  uploadDurationMs?: number;
  uploadRateBytesPerSec?: number;
  error?: string;
}

export interface TransferDownload {
  meta: TransferFileMeta;
  filePath: string;
  size: number;
}

export interface TransferTextMessage {
  id: string;
  kind: 'text';
  text: string;
  senderId: string;
  senderName: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
}

export interface TransferFileEvent {
  id: string;
  kind: 'file';
  createdAt: number;
  updatedAt: number;
  file: TransferFileMeta;
}

export type TransferEvent = TransferTextMessage | TransferFileEvent;

function filesDir(): string {
  return path.join(TRANSFER_ROOT, 'files');
}

function messagesPath(): string {
  return path.join(TRANSFER_ROOT, 'messages.json');
}

function ensureTransferRoot(): void {
  fs.mkdirSync(filesDir(), { recursive: true });
}

export function getTransferStorePath(): string {
  ensureTransferRoot();
  return TRANSFER_ROOT;
}

function safeId(value: unknown): string {
  const id = String(value || '').trim();
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(id)) throw new Error('Invalid transfer file id');
  return id;
}

function metaPath(id: string): string {
  return path.join(filesDir(), `${safeId(id)}.json`);
}

function contentPath(id: string): string {
  return path.join(filesDir(), `${safeId(id)}.bin`);
}

function partPath(id: string): string {
  return path.join(filesDir(), `${safeId(id)}.part`);
}

function readJsonFile<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

function writeJsonAtomic(filePath: string, value: unknown): void {
  ensureTransferRoot();
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, filePath);
}

function unlinkIfExists(filePath: string): void {
  try { fs.unlinkSync(filePath); } catch {}
}

function normalizeRetentionHours(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return RETENTION_HOURS;
  return Math.min(168, Math.max(1, parsed));
}

function sanitizeFileName(value: unknown): string {
  const name = String(value || 'download.bin')
    .replace(/[<>:"/\\|?*\x00-\x1F]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
  return name || 'download.bin';
}

function androidInboxDir(): string {
  fs.mkdirSync(ANDROID_INBOX_ROOT, { recursive: true });
  return ANDROID_INBOX_ROOT;
}

function androidInboxFileName(meta: TransferFileMeta): string {
  return `${safeId(meta.id)}-${sanitizeFileName(meta.name)}`;
}

function isAndroidPhoneUpload(meta: TransferFileMeta | null | undefined): meta is TransferFileMeta {
  return Boolean(meta && meta.status === 'ready' && ANDROID_PHONE_UPLOADERS.has(normalizeUploaderId(meta.uploaderId)));
}

function normalizeMime(value: unknown): string {
  const mime = String(value || 'application/octet-stream').trim().slice(0, 160);
  return mime || 'application/octet-stream';
}

function normalizeExpectedSize(value: unknown): number | null {
  const size = Number(value);
  return Number.isFinite(size) && size >= 0 ? Math.floor(size) : null;
}

function normalizeUploaderId(value: unknown): string {
  return String(value || 'unknown').replace(/[^A-Za-z0-9_-]+/g, '').slice(0, 80) || 'unknown';
}

function normalizeProvider(value: unknown): TransferProvider {
  const provider = String(value || 'local').trim();
  return provider === 'storage-to' ? provider : 'local';
}

function providerLabel(provider: TransferProvider): string {
  if (provider === 'storage-to') return 'storage.to';
  return '本地公网';
}

function normalizeTransferUrl(value: unknown): string | undefined {
  const text = String(value || '').trim();
  return /^https?:\/\//i.test(text) ? text.slice(0, 2048) : undefined;
}

function normalizeProviderAttempts(value: unknown): TransferProviderAttempt[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-12).map((item) => {
    const attempt = item as any;
    const provider = normalizeProvider(attempt?.provider);
    const status = attempt?.status === 'ready' || attempt?.status === 'failed' || attempt?.status === 'skipped'
      ? attempt.status
      : 'failed';
    return {
      provider,
      label: String(attempt?.label || providerLabel(provider)).slice(0, 40),
      status,
      startedAt: Number(attempt?.startedAt || Date.now()),
      completedAt: attempt?.completedAt ? Number(attempt.completedAt) : undefined,
      error: attempt?.error ? String(attempt.error).slice(0, 500) : undefined,
      url: normalizeTransferUrl(attempt?.url)
    };
  });
}

function normalizeSenderName(value: unknown): string {
  const name = String(value || '设备')
    .replace(/[<>:"/\\|?*\x00-\x1F]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
  return name || '设备';
}

function normalizeTransferText(value: unknown): string {
  const text = String(value || '').trim();
  if (!text) throw new Error('Missing transfer message text');
  if (text.length > 16 * 1024) throw new Error('Transfer message text is too large');
  return text;
}

function randomDownloadToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

function ensureDownloadToken(meta: TransferFileMeta): TransferFileMeta {
  let changed = false;
  if (!meta.downloadToken) {
    meta.downloadToken = randomDownloadToken();
    changed = true;
  }
  if (normalizeProvider(meta.provider) === 'local') {
    if (meta.provider !== 'local' || meta.providerLabel !== providerLabel('local') || meta.downloadUrl || meta.rawDownloadUrl) {
      meta.provider = 'local';
      meta.providerLabel = providerLabel('local');
      delete meta.downloadUrl;
      delete meta.rawDownloadUrl;
      changed = true;
    }
    const filePath = contentPath(meta.id);
    if (meta.status === 'ready' && fs.existsSync(filePath) && meta.localPath !== filePath) {
      meta.localPath = filePath;
      changed = true;
    }
  }
  if (changed) {
    meta.updatedAt = Date.now();
    writeJsonAtomic(metaPath(meta.id), meta);
  }
  return meta;
}

export function readTransferFileMeta(idValue: unknown): TransferFileMeta | null {
  ensureTransferRoot();
  const meta = readJsonFile<TransferFileMeta>(metaPath(safeId(idValue)));
  return meta ? ensureDownloadToken(meta) : null;
}

function listMetasUnsafe(): TransferFileMeta[] {
  ensureTransferRoot();
  const out: TransferFileMeta[] = [];
  for (const name of fs.readdirSync(filesDir())) {
    if (!name.endsWith('.json')) continue;
    const meta = readJsonFile<TransferFileMeta>(path.join(filesDir(), name));
    if (meta && meta.id) out.push(ensureDownloadToken(meta));
  }
  return out;
}

function listMessagesUnsafe(): TransferTextMessage[] {
  ensureTransferRoot();
  const messages = readJsonFile<TransferTextMessage[]>(messagesPath());
  if (!Array.isArray(messages)) return [];
  return messages.filter((message) => message && message.kind === 'text' && message.id && typeof message.text === 'string');
}

function saveMessages(messages: TransferTextMessage[]): void {
  writeJsonAtomic(messagesPath(), messages.slice(-1000));
}

function removeTransferFiles(id: string): void {
  unlinkIfExists(metaPath(id));
  unlinkIfExists(contentPath(id));
  unlinkIfExists(partPath(id));
}

export function cleanupExpiredTransfers(now = Date.now()): void {
  ensureTransferRoot();
  for (const meta of listMetasUnsafe()) {
    if (Number(meta.expiresAt || 0) <= now) removeTransferFiles(meta.id);
  }
  const messages = listMessagesUnsafe();
  const keptMessages = messages.filter((message) => Number(message.expiresAt || 0) > now);
  if (keptMessages.length !== messages.length) saveMessages(keptMessages);
}

export function listTransferFiles(): TransferFileMeta[] {
  cleanupExpiredTransfers();
  syncAndroidInboxForPendingTransfers();
  return listMetasUnsafe().sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
}

export function listTransferMessages(): TransferTextMessage[] {
  cleanupExpiredTransfers();
  return listMessagesUnsafe().sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
}

export function listTransferEvents(): TransferEvent[] {
  cleanupExpiredTransfers();
  syncAndroidInboxForPendingTransfers();
  const messageEvents = listMessagesUnsafe();
  const fileEvents: TransferFileEvent[] = listMetasUnsafe().map((file) => ({
    id: file.id,
    kind: 'file',
    createdAt: Number(file.completedAt || file.createdAt || 0),
    updatedAt: Number(file.updatedAt || 0),
    file
  }));
  return [...messageEvents, ...fileEvents].sort((a, b) => {
    const byTime = Number(a.createdAt || 0) - Number(b.createdAt || 0);
    return byTime || String(a.id).localeCompare(String(b.id));
  });
}

export function createTransferFile(name: unknown, mime: unknown, expectedSize: unknown, uploaderId: unknown, ttlHours?: number): TransferFileMeta {
  cleanupExpiredTransfers();
  const now = Date.now();
  const id = crypto.randomUUID().replace(/-/g, '');
  const meta: TransferFileMeta = {
    id,
    name: sanitizeFileName(name),
    mime: normalizeMime(mime),
    expectedSize: normalizeExpectedSize(expectedSize),
    size: 0,
    status: 'uploading',
    uploaderId: normalizeUploaderId(uploaderId),
    downloadToken: randomDownloadToken(),
    provider: 'local',
    providerLabel: providerLabel('local'),
    createdAt: now,
    updatedAt: now,
    expiresAt: now + normalizeRetentionHours(ttlHours) * 60 * 60 * 1000
  };
  writeJsonAtomic(metaPath(id), meta);
  return meta;
}

export function createRemoteTransferFile(input: {
  name: unknown;
  mime: unknown;
  size: unknown;
  uploaderId: unknown;
  provider: unknown;
  downloadUrl: unknown;
  rawDownloadUrl?: unknown;
  remoteId?: unknown;
  remoteExpiresAt?: unknown;
  providerAttempts?: unknown;
  ttlHours?: number;
}): TransferFileMeta {
  cleanupExpiredTransfers();
  const now = Date.now();
  const id = crypto.randomUUID().replace(/-/g, '');
  const provider = normalizeProvider(input.provider);
  const downloadUrl = normalizeTransferUrl(input.downloadUrl);
  const rawDownloadUrl = normalizeTransferUrl(input.rawDownloadUrl) || downloadUrl;
  if (!downloadUrl || !rawDownloadUrl) throw new Error('Remote transfer download URL is required');
  const size = normalizeExpectedSize(input.size);
  const meta: TransferFileMeta = {
    id,
    name: sanitizeFileName(input.name),
    mime: normalizeMime(input.mime),
    expectedSize: size,
    size: size || 0,
    status: 'ready',
    uploaderId: normalizeUploaderId(input.uploaderId),
    downloadToken: randomDownloadToken(),
    provider,
    providerLabel: providerLabel(provider),
    downloadUrl,
    rawDownloadUrl,
    remoteId: String(input.remoteId || '').slice(0, 160) || undefined,
    remoteExpiresAt: String(input.remoteExpiresAt || '').slice(0, 80) || undefined,
    providerAttempts: normalizeProviderAttempts(input.providerAttempts),
    createdAt: now,
    updatedAt: now,
    expiresAt: now + normalizeRetentionHours(input.ttlHours) * 60 * 60 * 1000,
    completedAt: now,
    uploadDurationMs: 1,
    uploadRateBytesPerSec: 0
  };
  writeJsonAtomic(metaPath(id), meta);
  return meta;
}

export function createTransferTextMessage(text: unknown, senderId: unknown, senderName: unknown, ttlHours?: number): TransferTextMessage {
  cleanupExpiredTransfers();
  const now = Date.now();
  const message: TransferTextMessage = {
    id: crypto.randomUUID().replace(/-/g, ''),
    kind: 'text',
    text: normalizeTransferText(text),
    senderId: normalizeUploaderId(senderId),
    senderName: normalizeSenderName(senderName),
    createdAt: now,
    updatedAt: now,
    expiresAt: now + normalizeRetentionHours(ttlHours) * 60 * 60 * 1000
  };
  saveMessages([...listMessagesUnsafe(), message]);
  return message;
}

function saveMeta(meta: TransferFileMeta): void {
  meta.updatedAt = Date.now();
  writeJsonAtomic(metaPath(meta.id), meta);
}

function markAndroidInboxFailure(meta: TransferFileMeta, error: unknown): void {
  meta.androidInbox = {
    status: 'failed',
    path: meta.androidInbox?.path,
    error: error instanceof Error ? error.message : String(error),
    failedAt: Date.now(),
    sourceUploaderId: meta.uploaderId
  };
  saveMeta(meta);
}

function mirrorAndroidUploadToInbox(meta: TransferFileMeta): boolean {
  if (!isAndroidPhoneUpload(meta)) return false;
  if (meta.androidInbox?.status === 'received' && meta.androidInbox.path && fs.existsSync(meta.androidInbox.path)) return false;
  const sourcePath = contentPath(meta.id);
  const targetName = androidInboxFileName(meta);
  const targetPath = path.join(androidInboxDir(), targetName);
  const pendingPath = `${targetPath}.${process.pid}.${Date.now()}.part`;
  try {
    if (!fs.existsSync(sourcePath)) throw new Error('Transfer content is missing');
    if (!fs.existsSync(targetPath)) {
      fs.copyFileSync(sourcePath, pendingPath);
      fs.renameSync(pendingPath, targetPath);
    }
    const stat = fs.statSync(targetPath);
    meta.androidInbox = {
      status: 'received',
      path: targetPath,
      name: targetName,
      size: stat.size,
      receivedAt: Date.now(),
      sourceUploaderId: meta.uploaderId
    };
    saveMeta(meta);
    return true;
  } catch (error) {
    unlinkIfExists(pendingPath);
    markAndroidInboxFailure(meta, error);
    return true;
  }
}

function syncAndroidInboxForPendingTransfers(): void {
  for (const meta of listMetasUnsafe()) {
    if (!isAndroidPhoneUpload(meta)) continue;
    if (meta.androidInbox?.status === 'received' && meta.androidInbox.path && fs.existsSync(meta.androidInbox.path)) continue;
    mirrorAndroidUploadToInbox(meta);
  }
}

export async function writeTransferFileContent(idValue: unknown, input: NodeJS.ReadableStream): Promise<TransferFileMeta> {
  const id = safeId(idValue);
  const meta = readTransferFileMeta(id);
  if (!meta) throw new Error('Transfer file not found');
  const start = Date.now();
  meta.status = 'uploading';
  meta.error = undefined;
  saveMeta(meta);
  unlinkIfExists(partPath(id));
  try {
    await pipeline(input, fs.createWriteStream(partPath(id)));
    const stat = fs.statSync(partPath(id));
    fs.renameSync(partPath(id), contentPath(id));
    const end = Date.now();
    meta.status = 'ready';
    meta.size = stat.size;
    meta.localPath = contentPath(id);
    meta.completedAt = end;
    meta.uploadDurationMs = Math.max(1, end - start);
    meta.uploadRateBytesPerSec = Math.round((stat.size * 1000) / meta.uploadDurationMs);
    saveMeta(meta);
    mirrorAndroidUploadToInbox(meta);
    return readTransferFileMeta(meta.id) || meta;
  } catch (error) {
    unlinkIfExists(partPath(id));
    meta.status = 'failed';
    meta.error = error instanceof Error ? error.message : String(error);
    saveMeta(meta);
    throw error;
  }
}

export function getTransferDownload(idValue: unknown): TransferDownload | null {
  const id = safeId(idValue);
  cleanupExpiredTransfers();
  const meta = readTransferFileMeta(id);
  if (!meta || meta.status !== 'ready') return null;
  const filePath = contentPath(id);
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return null;
    return { meta, filePath, size: stat.size };
  } catch {
    return null;
  }
}

export function isTransferDownloadTokenValid(idValue: unknown, tokenValue: unknown): boolean {
  const token = String(tokenValue || '').trim();
  if (!/^[a-f0-9]{48}$/i.test(token)) return false;
  cleanupExpiredTransfers();
  const meta = readTransferFileMeta(idValue);
  if (!meta || !meta.downloadToken) return false;
  const expected = Buffer.from(meta.downloadToken, 'utf8');
  const received = Buffer.from(token, 'utf8');
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

export function deleteTransferFile(idValue: unknown): boolean {
  const id = safeId(idValue);
  const meta = readTransferFileMeta(id);
  if (!meta) return false;
  removeTransferFiles(id);
  return true;
}
