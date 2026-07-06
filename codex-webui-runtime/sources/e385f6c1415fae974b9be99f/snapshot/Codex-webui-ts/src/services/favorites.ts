import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface FavoriteInput {
  sessionPath?: string | null;
  turnId?: string | null;
  question: string;
  answer: string;
  durationMs?: number | null;
  completedAt?: string | null;
}

export interface FavoriteResult {
  ok: true;
  duplicate: boolean;
  id: string;
  dir: string;
  rawPath: string;
  summaryPath: string;
}

const FAVORITES_DIR = process.env.CODEX_WEBUI_FAVORITES_DIR
  ? path.resolve(process.env.CODEX_WEBUI_FAVORITES_DIR)
  : path.resolve(process.cwd(), 'favorites');

function rawPath(): string {
  return path.join(FAVORITES_DIR, 'raw.md');
}

function summaryPath(): string {
  return path.join(FAVORITES_DIR, 'summary.md');
}

function normalizeText(value: unknown, max = 64_000): string {
  return String(value || '')
    .replace(/<memory\b[^>]*>[\s\S]*?(?:<\/memory>|$)/gi, '')
    .replace(/<oai-mem-citation\b[^>]*>[\s\S]*?(?:<\/oai-mem-citation>|$)/gi, '')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, max);
}

function fileSafeLine(value: unknown): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function favoriteId(input: FavoriteInput, question: string, answer: string): string {
  return crypto.createHash('sha256')
    .update([input.sessionPath || '', input.turnId || '', question, answer].join('\n---favorite---\n'))
    .digest('hex')
    .slice(0, 16);
}

function formatDuration(ms: unknown): string {
  const value = Number(ms || 0);
  if (!Number.isFinite(value) || value <= 0) return '未记录';
  const totalSeconds = Math.max(1, Math.round(value / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function formatCompletedAt(value: unknown): string {
  const ms = Date.parse(String(value || ''));
  if (!Number.isFinite(ms)) return '未记录';
  return new Date(ms).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function appendUnique(filePath: string, section: string, id: string): boolean {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  let existing = '';
  try { existing = fs.readFileSync(filePath, 'utf8'); } catch {}
  if (existing.includes(`<!-- favorite:${id} -->`)) return true;
  const prefix = existing.trim() ? '\n\n' : '';
  fs.appendFileSync(filePath, `${prefix}${section}`, 'utf8');
  return false;
}

function conciseAnswer(answer: string): string {
  const stripped = answer
    .replace(/```[\s\S]*?```/g, ' [代码块] ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/[*_>#~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (stripped.length <= 360) return stripped;
  const boundary = stripped.slice(0, 360).search(/[。！？.!?]\s*[^。！？.!?]*$/);
  const end = boundary > 80 ? boundary + 1 : 360;
  return `${stripped.slice(0, end).trim()}...`;
}

export function appendFavorite(input: FavoriteInput): FavoriteResult {
  const question = normalizeText(input.question);
  const answer = normalizeText(input.answer);
  if (!question || !answer) throw new Error('Favorite requires question and answer text');

  const id = favoriteId(input, question, answer);
  const completed = formatCompletedAt(input.completedAt);
  const duration = formatDuration(input.durationMs);
  const sessionLine = fileSafeLine(input.sessionPath);
  const turnLine = fileSafeLine(input.turnId);
  const title = `## ${completed} · ${duration}`;
  const meta = [
    `<!-- favorite:${id} -->`,
    sessionLine ? `- Session: ${sessionLine}` : '',
    turnLine ? `- Turn: ${turnLine}` : '',
    `- Completed: ${completed}`,
    `- Duration: ${duration}`
  ].filter(Boolean).join('\n');

  const rawSection = `${title}\n${meta}\n\n### 提问\n${question}\n\n### 回答\n${answer}\n`;
  const summarySection = `${title}\n${meta}\n\n- 提问：${fileSafeLine(question).slice(0, 240)}\n- 精简回答：${conciseAnswer(answer)}\n`;

  const raw = rawPath();
  const summary = summaryPath();
  const duplicateRaw = appendUnique(raw, rawSection, id);
  const duplicateSummary = appendUnique(summary, summarySection, id);
  return { ok: true, duplicate: duplicateRaw && duplicateSummary, id, dir: FAVORITES_DIR, rawPath: raw, summaryPath: summary };
}

export function getFavoriteStorePaths(): { dir: string; rawPath: string; summaryPath: string } {
  fs.mkdirSync(FAVORITES_DIR, { recursive: true });
  return { dir: FAVORITES_DIR, rawPath: rawPath(), summaryPath: summaryPath() };
}
