import http, { IncomingMessage, ServerResponse } from 'http';
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { checkRateLimit } from './utils/rate-limit.js';
import { codexService } from './services/codex.js';
import { startCodexCliUpdater, type CodexCliUpdater } from './services/codex-updater.js';
import { appendFavorite, getFavoriteStorePaths } from './services/favorites.js';
import { getConfigSafe, writeConfig } from './utils/config.js';
import { readMemoryFacts, deleteMemoryFact } from './services/memory.js';
import {
  checkoutGitBranch,
  commitGit,
  discardGitPaths,
  getGitDiff,
  getGitFileDiff,
  getGitStatus,
  getGitWorkspaceDiffs,
  pullGit,
  pushGit,
  stageGitPaths,
  unstageGitPaths
} from './services/git.js';
import { deleteMcpServer, listMcpServers, saveMcpServer, toggleMcpServer, writeSharedPoolSettings } from './services/mcp.js';
import { getQuickPreview } from './services/preview.js';
import { deleteSkill, listSkills, setSkillEnabled } from './services/skills.js';
import { killTerminalSession, listTerminalSessions, resizeTerminalSession, spawnTerminalSession, writeTerminalStdin } from './services/terminal.js';
import { scanSessions, parseSessionMessages, parseSessionMessagesPage, isWithinSessions, readHistory, writeHistory } from './utils/fs-helpers.js';
import type { History, HistoryEntry, ProjectRoot, SessionEntry } from './types.js';
import {
  cleanupExpiredTransfers,
  createRemoteTransferFile,
  createTransferFile,
  createTransferTextMessage,
  deleteTransferFile,
  getTransferDownload,
  getTransferStorePath,
  isTransferDownloadTokenValid,
  listTransferEvents,
  listTransferFiles,
  listTransferMessages,
  writeTransferFileContent
} from './services/transfer-store.js';
import {
  completeStorageToMultipart,
  confirmStorageToUpload,
  getStorageToPartUrls,
  initStorageToUpload,
  listStorageToProvider
} from './services/storage-to.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT ? Number(process.env.PORT) : 5055;
const HOST = process.env.HOST || '0.0.0.0';
const TOKEN = process.env.WEBUI_TOKEN || '';
const PUBLIC_AUTH_USER = process.env.CODEX_WEBUI_PUBLIC_USER || 'lop';
const PUBLIC_AUTH_PASSWORD = process.env.CODEX_WEBUI_PUBLIC_PASSWORD || '';
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || `http://localhost:${PORT}`;
const AUTO_RECOVER_INTERRUPTED_TURNS = (() => {
  const raw = String(process.env.CODEX_WEBUI_AUTO_RECOVER || '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(raw)) return true;
  if (['0', 'false', 'no', 'off'].includes(raw)) return false;
  return PORT === 5055;
})();
const UI_BUILD = '20260707-question-jump-composer-v2';
const STATIC_ASSETS = ['index.html', 'css/app.css', 'js/app.js', 'js/transfer.js'];
const UPLOAD_DIR = process.env.CODEX_WEBUI_UPLOADS ? path.resolve(process.env.CODEX_WEBUI_UPLOADS) : path.resolve(process.cwd(), 'uploads');
const SESSIONS_ROOT = path.join(os.homedir(), '.codex', 'sessions');
const SESSION_RECYCLE_ROOT = process.env.CODEX_WEBUI_SESSION_RECYCLE_ROOT
  ? path.resolve(process.env.CODEX_WEBUI_SESSION_RECYCLE_ROOT)
  : path.join(os.homedir(), 'Documents', 'Codex', 'Codex_RECYCLE');
const HISTORY_PROJECT_NAME = '历史对话';
const HISTORY_PROJECT_ROOT = process.env.CODEX_WEBUI_HISTORY_PROJECT_DIR
  ? path.resolve(process.env.CODEX_WEBUI_HISTORY_PROJECT_DIR)
  : path.join(os.homedir(), 'Documents', 'Codex', HISTORY_PROJECT_NAME);

const sseClients = new Set<ServerResponse>();
let codexCliUpdater: CodexCliUpdater | null = null;

interface SavedImageAttachment {
  kind: 'image';
  name: string;
  path: string;
  url: string;
}

function isPrivateIpv4(address: string): boolean {
  const parts = address.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    || (parts[0] === 169 && parts[1] === 254);
}

function lanHostRank(address: string): number {
  if (address.startsWith('192.168.')) return 0;
  if (address.startsWith('10.')) return 1;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(address)) return 2;
  if (address.startsWith('169.254.')) return 3;
  return 4;
}

function getLanHosts(): string[] {
  const hosts: string[] = [];
  const seen = new Set<string>();
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (!entry || entry.internal || entry.family !== 'IPv4') continue;
      const address = String(entry.address || '').trim();
      if (!address || seen.has(address)) continue;
      seen.add(address);
      hosts.push(address);
    }
  }
  return hosts.sort((a, b) => {
    const privateDelta = Number(!isPrivateIpv4(a)) - Number(!isPrivateIpv4(b));
    if (privateDelta) return privateDelta;
    return lanHostRank(a) - lanHostRank(b) || a.localeCompare(b);
  });
}

function formatHttpUrl(host: string, port: number): string {
  const normalized = String(host || '').trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  if (!normalized) return '';
  if (normalized.startsWith('[')) return `http://${normalized.includes(']:') ? normalized : `${normalized}:${port}`}`;
  if (/:\d+$/.test(normalized)) return `http://${normalized}`;
  return `http://${normalized}:${port}`;
}

function runtimeNetworkInfo() {
  const lanUrls = getLanHosts().map((host) => formatHttpUrl(host, PORT)).filter(Boolean);
  return {
    ok: true,
    host: HOST,
    port: PORT,
    localUrl: `http://127.0.0.1:${PORT}`,
    lanUrl: lanUrls[0] || null,
    lanUrls
  };
}

function setCORS(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-File-Name');
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  setCORS(res);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

function launchWebUiRecovery(mode: 'restart' | 'recover'): { ok: boolean; pid?: number; mode: string; logDir: string; error?: string } {
  const scriptPath = path.join(process.cwd(), 'scripts', 'webui-recover.mjs');
  if (!fs.existsSync(scriptPath)) return { ok: false, mode, logDir: path.join(process.cwd(), 'logs'), error: `Missing recovery script: ${scriptPath}` };
  const logDir = path.join(process.cwd(), 'logs');
  fs.mkdirSync(logDir, { recursive: true });
  const out = fs.openSync(path.join(logDir, `webui-${mode}.out.log`), 'a');
  const err = fs.openSync(path.join(logDir, `webui-${mode}.err.log`), 'a');
  const child = spawn(process.execPath, [scriptPath, '--mode', mode, '--delay', mode === 'restart' ? '900' : '100', '--launch-app'], {
    cwd: process.cwd(),
    detached: true,
    windowsHide: true,
    stdio: ['ignore', out, err],
    env: { ...process.env }
  });
  child.unref();
  try { fs.closeSync(out); } catch {}
  try { fs.closeSync(err); } catch {}
  return { ok: true, pid: child.pid, mode, logDir };
}

function readJsonBody(req: IncomingMessage, maxBytes = 64 * 1024): Promise<any> {
  return new Promise((resolveRead, reject) => {
    let body = '';
    let size = 0;
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('Request body is too large'));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on('error', reject);
    req.on('end', () => {
      try { resolveRead(body ? JSON.parse(body) : {}); } catch { reject(new Error('Bad JSON')); }
    });
  });
}

function requireAuth(req: IncomingMessage): boolean {
  if (!TOKEN) return true;
  return req.headers.authorization === `Bearer ${TOKEN}`;
}

function requestHost(req: IncomingMessage): string {
  const raw = String(req.headers.host || '').trim().toLowerCase();
  if (!raw) return '';
  if (raw.startsWith('[')) {
    const end = raw.indexOf(']');
    return end >= 0 ? raw.slice(1, end) : raw;
  }
  return raw.split(':')[0];
}

function isLocalHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function requirePublicAuth(req: IncomingMessage, res: ServerResponse): boolean {
  if (!PUBLIC_AUTH_PASSWORD || isLocalHost(requestHost(req))) return true;
  const expected = `Basic ${Buffer.from(`${PUBLIC_AUTH_USER}:${PUBLIC_AUTH_PASSWORD}`, 'utf8').toString('base64')}`;
  if (req.headers.authorization === expected) return true;
  setCORS(res);
  res.writeHead(401, {
    'Content-Type': 'text/plain; charset=utf-8',
    'WWW-Authenticate': 'Basic realm="Codex WebUI"'
  });
  res.end('Authentication required');
  return false;
}

function broadcast(event: string, data: any) {
  const payload = `event: ${event}\n` + `data: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try { res.write(payload); } catch { /* ignore */ }
  }
}

function publicRoot(): string {
  return path.resolve(process.cwd(), 'public');
}

function readJsonArrayEnv(name: string): string[] {
  const raw = process.env[name];
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function resolveProjectPath(value: unknown): string | null {
  const requested = normalizeOpenPath(value);
  if (!requested) return null;
  const resolved = path.resolve(requested);
  let stat: fs.Stats;
  try { stat = fs.statSync(resolved); } catch { return null; }
  if (!stat.isDirectory()) return null;
  return resolved;
}

function latestHistoryEntryForResumePath(history: History, resumePath: string | null): HistoryEntry | null {
  if (!resumePath) return null;
  const resumeKey = pathIdentity(resumePath);
  let best: HistoryEntry | null = null;
  for (const entry of history.entries || []) {
    if (!entry || !entry.resume_path || !entry.workdir) continue;
    if (pathIdentity(entry.resume_path) !== resumeKey) continue;
    if (!resolveProjectPath(entry.workdir)) continue;
    if (!best || Number(entry.last_used || 0) >= Number(best.last_used || 0)) best = entry;
  }
  return best;
}

function historyWorkdirForResumePath(resumePath: string | null): string | null {
  const entry = latestHistoryEntryForResumePath(readHistory(), resumePath);
  return entry ? resolveProjectPath(entry.workdir) : null;
}

function effectiveSessionWorkdir(history: History, session: SessionEntry): string {
  const entry = latestHistoryEntryForResumePath(history, session.path);
  const moved = entry ? resolveProjectPath(entry.workdir) : null;
  return moved || session.cwd || '';
}

function pinnedSessionPathSet(history: History): Set<string> {
  return new Set((history.entries || [])
    .filter((entry) => entry && entry.pinned === true && entry.resume_path)
    .map((entry) => pathIdentity(entry.resume_path)));
}

function upsertSessionWorkdir(history: History, sessionPath: string, workdir: string): ProjectRoot {
  const resolvedSession = path.resolve(sessionPath);
  const resolvedWorkdir = path.resolve(workdir);
  const sessionKey = pathIdentity(resolvedSession);
  history.entries = (history.entries || []).filter((entry) => {
    if (!entry || !entry.resume_path) return true;
    return pathIdentity(entry.resume_path) !== sessionKey;
  });
  history.entries.push({ resume_path: resolvedSession, workdir: resolvedWorkdir, last_used: Date.now() });
  const root = upsertProjectRoot(history, resolvedWorkdir);
  history.selectedRootId = root.id;
  return root;
}

type OpenTarget = { path: string; kind: 'file' | 'directory' };
type DirectoryRoot = { label: string; path: string };
type DirectoryEntry = { name: string; path: string; kind: 'directory'; hidden: boolean };
type ProjectGroupEntry = { resume_path: string; workdir: string; last_used: number };

function normalizeOpenPath(value: unknown): string {
  let requested = String(value || '').trim();
  if ((requested.startsWith('<') && requested.endsWith('>')) || (requested.startsWith('"') && requested.endsWith('"'))) {
    requested = requested.slice(1, -1).trim();
  }
  try { requested = decodeURI(requested); } catch {}
  return requested;
}

function openPathCandidates(value: unknown): string[] {
  const requested = normalizeOpenPath(value);
  if (!requested) return [];
  const candidates = [requested];
  const withoutLineSuffix = requested.replace(/:(\d+)(?::\d+)?$/, '');
  if (withoutLineSuffix !== requested) candidates.push(withoutLineSuffix);
  return [...new Set(candidates)];
}

function resolveOpenTarget(value: unknown): OpenTarget | null {
  for (const candidate of openPathCandidates(value)) {
    if (!path.isAbsolute(candidate)) continue;
    const resolved = path.resolve(candidate);
    let stat: fs.Stats;
    try { stat = fs.statSync(resolved); } catch { continue; }
    if (stat.isFile()) return { path: resolved, kind: 'file' };
    if (stat.isDirectory()) return { path: resolved, kind: 'directory' };
  }
  return null;
}

function normalizeProjectFolderName(value: unknown): string {
  const name = String(value || '').trim();
  if (!name) throw new Error('Project folder name is required');
  if (name === '.' || name === '..' || /[<>:"/\\|?*\x00-\x1f]/.test(name)) throw new Error('Invalid project folder name');
  if (/[. ]$/.test(name)) throw new Error('Invalid project folder name');
  const reserved = new Set([
    'CON', 'PRN', 'AUX', 'NUL',
    ...Array.from({ length: 9 }, (_, i) => `COM${i + 1}`),
    ...Array.from({ length: 9 }, (_, i) => `LPT${i + 1}`)
  ]);
  if (reserved.has(name.split('.')[0].toUpperCase())) throw new Error('Invalid project folder name');
  return name;
}

function childProjectPath(parentPath: string, name: string): string {
  const target = path.resolve(parentPath, name);
  const relative = path.relative(path.resolve(parentPath), target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Invalid project folder name');
  return target;
}

function stripWindowsNamespacePrefix(value: string): string {
  if (process.platform !== 'win32') return value;
  if (value.startsWith('\\\\?\\UNC\\')) return `\\\\${value.slice(8)}`;
  if (value.startsWith('\\\\?\\')) return value.slice(4);
  return value;
}

function pathIdentity(value: string): string {
  const resolved = stripWindowsNamespacePrefix(path.resolve(stripWindowsNamespacePrefix(value)));
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function normalizeArchivedSessionPaths(history: History): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of history.archivedSessionPaths || []) {
    if (typeof item !== 'string' || !item) continue;
    const resolved = path.resolve(item);
    const key = pathIdentity(resolved);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(resolved);
  }
  return out;
}

function archivedSessionPathSet(history: History): Set<string> {
  return new Set(normalizeArchivedSessionPaths(history).map((item) => pathIdentity(item)));
}

function removeArchivedSessionPath(history: History, sessionPath: string): void {
  const key = pathIdentity(sessionPath);
  history.archivedSessionPaths = normalizeArchivedSessionPaths(history).filter((item) => pathIdentity(item) !== key);
}

function sessionDateBucket(sessionPath: string): string {
  const relative = path.relative(SESSIONS_ROOT, sessionPath);
  const parts = relative.split(/[\\/]+/);
  const [year, month, day] = parts;
  if (/^\d{4}$/.test(year || '') && /^\d{2}$/.test(month || '') && /^\d{2}$/.test(day || '')) {
    return `${year}${month}${day}`;
  }
  try {
    const stat = fs.statSync(sessionPath);
    const mtime = stat.mtime;
    const y = String(mtime.getFullYear());
    const m = String(mtime.getMonth() + 1).padStart(2, '0');
    const d = String(mtime.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  } catch {
    const now = new Date();
    const y = String(now.getFullYear());
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  }
}

function assertWithinDirectory(target: string, root: string): void {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  const rootKey = pathIdentity(resolvedRoot);
  const targetKey = pathIdentity(resolvedTarget);
  const sep = path.sep;
  if (targetKey !== rootKey && !targetKey.startsWith(`${rootKey}${sep}`)) {
    throw new Error('Resolved recycle path escapes recycle root');
  }
}

function uniquePath(candidate: string): string {
  if (!fs.existsSync(candidate)) return candidate;
  const ext = path.extname(candidate);
  const base = candidate.slice(0, candidate.length - ext.length);
  for (let index = 1; index < 1000; index += 1) {
    const next = `${base}.${index}${ext}`;
    if (!fs.existsSync(next)) return next;
  }
  throw new Error('Too many recycle path collisions');
}

function moveFileAcrossVolumes(source: string, target: string): void {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  try {
    fs.renameSync(source, target);
  } catch (error: any) {
    if (error && error.code === 'EXDEV') {
      fs.copyFileSync(source, target);
      fs.unlinkSync(source);
    } else {
      throw error;
    }
  }
}

function recycleSessionFile(sessionPath: string): { recycled: boolean; recycledPath: string | null; bucket: string } {
  const abs = path.resolve(sessionPath);
  const bucket = sessionDateBucket(abs);
  if (!fs.existsSync(abs)) return { recycled: false, recycledPath: null, bucket };
  const relative = path.relative(SESSIONS_ROOT, abs);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Session path is outside sessions root');
  }
  const target = uniquePath(path.join(SESSION_RECYCLE_ROOT, bucket, 'sessions', relative));
  assertWithinDirectory(target, SESSION_RECYCLE_ROOT);
  moveFileAcrossVolumes(abs, target);
  return { recycled: true, recycledPath: target, bucket };
}

type RecycledSessionPathInfo = {
  recycledPath: string;
  targetBasePath: string;
  relativeSessionPath: string;
  bucket: string;
};

function recycledSessionPathInfo(value: string): RecycledSessionPathInfo | null {
  const recycledPath = path.resolve(value);
  if (!/^rollout-.*\.jsonl$/.test(path.basename(recycledPath))) return null;
  const relativeToRecycle = path.relative(SESSION_RECYCLE_ROOT, recycledPath);
  if (!relativeToRecycle || relativeToRecycle.startsWith('..') || path.isAbsolute(relativeToRecycle)) return null;
  const parts = relativeToRecycle.split(/[\\/]+/);
  const [bucket, sessionsPart] = parts;
  if (!/^\d{8}$/.test(bucket || '') || sessionsPart !== 'sessions' || parts.length < 5) return null;
  const relativeSessionPath = parts.slice(2).join(path.sep);
  const targetBasePath = path.join(SESSIONS_ROOT, relativeSessionPath);
  assertWithinDirectory(targetBasePath, SESSIONS_ROOT);
  return { recycledPath, targetBasePath, relativeSessionPath, bucket };
}

function rolloutTimestampMs(filePath: string): number | null {
  const match = path.basename(filePath).match(/^rollout-(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-/);
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  const time = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)).getTime();
  return Number.isFinite(time) ? time : null;
}

function trimTextForList(value: string, max = 140): string {
  const normalized = String(value || '')
    .replace(/```[\s\S]*?```/g, ' 代码块 ')
    .replace(/<memory\b[^>]*>[\s\S]*?(?:<\/memory>|$)/gi, '')
    .replace(/<oai-mem-citation\b[^>]*>[\s\S]*?(?:<\/oai-mem-citation>|$)/gi, '')
    .replace(/^[-*#>\s]+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, Math.max(0, max - 3)).trim()}...`;
}

function compactLatestConclusion(text: string): string {
  const cleaned = String(text || '').replace(/```[\s\S]*?```/g, ' 代码块 ');
  const blocks = cleaned
    .split(/\n{2,}|\r?\n/)
    .map((line) => trimTextForList(line, 160))
    .filter(Boolean);
  const conclusion = blocks.find((line) => /^(最终)?(结论|总结|当前结果|解决方案|根因)[:：]/.test(line))
    || blocks.find((line) => /结论|当前结果|解决方案/.test(line))
    || blocks[0]
    || '未提取到最新回复';
  return trimTextForList(conclusion, 140);
}

function recycledSessionCandidate(info: RecycledSessionPathInfo, stat: fs.Stats) {
  const messages = parseSessionMessages(info.recycledPath);
  const latestAssistant = [...messages].reverse().find((message) => message.role === 'assistant' && message.text);
  const latestUser = [...messages].reverse().find((message) => message.role === 'user' && message.text);
  const sessionTime = rolloutTimestampMs(info.recycledPath) || stat.mtimeMs;
  const archiveTime = stat.mtimeMs;
  return {
    recycledPath: info.recycledPath,
    targetPath: uniquePath(info.targetBasePath),
    relativeSessionPath: info.relativeSessionPath,
    bucket: info.bucket,
    name: path.basename(info.recycledPath),
    title: trimTextForList(latestUser?.text || path.basename(info.recycledPath), 80),
    summary: compactLatestConclusion(latestAssistant?.text || ''),
    latestReply: trimTextForList(latestAssistant?.text || '', 500),
    messageCount: messages.length,
    sessionTime,
    archiveTime,
    mtimeMs: stat.mtimeMs,
    size: stat.size
  };
}

function recycleCandidateMatchesQuery(candidate: ReturnType<typeof recycledSessionCandidate>, query: string): boolean {
  const terms = String(query || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const haystack = [
    candidate.title,
    candidate.summary,
    candidate.latestReply,
    candidate.name,
    candidate.relativeSessionPath,
    candidate.recycledPath,
    candidate.bucket
  ].join(' ').toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

function listRecycledSessionCandidates(days = 1, limit = 200, query = '') {
  const boundedDays = Math.max(1, Math.min(30, Number(days) || 1));
  const boundedLimit = Math.max(1, Math.min(500, Number(limit) || 200));
  const cutoff = Date.now() - boundedDays * 24 * 60 * 60 * 1000;
  const out: ReturnType<typeof recycledSessionCandidate>[] = [];
  let buckets: fs.Dirent[] = [];
  try { buckets = fs.readdirSync(SESSION_RECYCLE_ROOT, { withFileTypes: true }); } catch { return out; }
  for (const bucket of buckets) {
    if (!bucket.isDirectory() || !/^\d{8}$/.test(bucket.name)) continue;
    const sessionsDir = path.join(SESSION_RECYCLE_ROOT, bucket.name, 'sessions');
    const stack = [sessionsDir];
    while (stack.length) {
      const dir = stack.pop();
      if (!dir) continue;
      let entries: fs.Dirent[] = [];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          stack.push(full);
          continue;
        }
        const info = recycledSessionPathInfo(full);
        if (!info) continue;
        let stat: fs.Stats;
        try { stat = fs.statSync(full); } catch { continue; }
        if (stat.mtimeMs < cutoff) continue;
        const candidate = recycledSessionCandidate(info, stat);
        if (!recycleCandidateMatchesQuery(candidate, query)) continue;
        out.push(candidate);
      }
    }
  }
  out.sort((a, b) => (b.archiveTime || b.mtimeMs || 0) - (a.archiveTime || a.mtimeMs || 0));
  return out.slice(0, boundedLimit);
}

function ensureHistoryProject(history: History): ProjectRoot {
  fs.mkdirSync(HISTORY_PROJECT_ROOT, { recursive: true });
  const root = upsertProjectRoot(history, HISTORY_PROJECT_ROOT);
  root.name = HISTORY_PROJECT_NAME;
  root.path = path.resolve(HISTORY_PROJECT_ROOT);
  return root;
}

function restoreRecycledSession(recycledPath: string) {
  const info = recycledSessionPathInfo(recycledPath);
  if (!info || !fs.existsSync(info.recycledPath)) throw new Error('Invalid recycled session path');
  const targetPath = uniquePath(info.targetBasePath);
  assertWithinDirectory(targetPath, SESSIONS_ROOT);
  moveFileAcrossVolumes(info.recycledPath, targetPath);
  const h = readHistory();
  const root = ensureHistoryProject(h);
  upsertSessionWorkdir(h, targetPath, root.path);
  removeArchivedSessionPath(h, targetPath);
  writeHistory(h);
  const stat = fs.statSync(targetPath);
  const session = scanSessions().find((item) => pathIdentity(item.path) === pathIdentity(targetPath))
    || { path: targetPath, name: path.basename(targetPath), mtimeMs: stat.mtimeMs, size: stat.size, title: path.basename(targetPath), cwd: root.path, messageCount: 0 };
  return {
    session: { ...session, cwd: root.path, projectRoot: root.path },
    historyProject: root
  };
}

function projectRootId(value: string): string {
  return pathIdentity(value);
}

function basenameForDirectory(value: string): string {
  return path.basename(value) || path.parse(value).root || value;
}

function upsertProjectRoot(history: History, projectPath: string): ProjectRoot {
  const resolved = path.resolve(projectPath);
  const id = projectRootId(resolved);
  const roots = Array.isArray(history.roots) ? history.roots : [];
  const now = Date.now();
  const existing = roots.find((root) => root && root.id === id);
  if (existing) {
    existing.name = existing.name || basenameForDirectory(resolved);
    existing.path = resolved;
    existing.last_used = now;
    history.roots = roots;
    return existing;
  }
  const root = { id, name: basenameForDirectory(resolved), path: resolved, last_used: now };
  history.roots = [root, ...roots].slice(0, 80);
  return root;
}

function rememberProjectRoot(projectPath: string): ProjectRoot {
  const history = readHistory();
  const root = upsertProjectRoot(history, projectPath);
  history.selectedRootId = root.id;
  writeHistory(history);
  return root;
}

function removeProjectRoot(history: History, projectPath: unknown): ProjectRoot | null {
  const requested = normalizeOpenPath(projectPath);
  if (!requested) return null;
  const target = path.resolve(requested);
  const targetId = projectRootId(target);
  let removed: ProjectRoot | null = null;
  history.roots = (history.roots || []).filter((root) => {
    if (!root || typeof root.path !== 'string') return false;
    const resolved = path.resolve(root.path);
    if (projectRootId(resolved) !== targetId) return true;
    removed = {
      id: targetId,
      name: root.name || basenameForDirectory(resolved),
      path: resolved,
      last_used: Number(root.last_used || 0)
    };
    return false;
  });
  if (removed && (!history.selectedRootId || history.selectedRootId === removed.id)) {
    history.selectedRootId = validHistoryRoots(history)[0]?.id;
  }
  return removed;
}

function validHistoryRoots(history: History): ProjectRoot[] {
  const roots: ProjectRoot[] = [];
  const seen = new Set<string>();
  for (const root of history.roots || []) {
    if (!root || typeof root.path !== 'string') continue;
    const resolved = resolveProjectPath(root.path);
    if (!resolved) continue;
    const id = projectRootId(resolved);
    if (seen.has(id)) continue;
    seen.add(id);
    roots.push({
      id,
      name: root.name || basenameForDirectory(resolved),
      path: resolved,
      last_used: Number(root.last_used || 0)
    });
  }
  return roots.sort((a, b) => b.last_used - a.last_used);
}

function isWithinProjectRoot(workdir: string, rootPath: string): boolean {
  const relative = path.relative(path.resolve(rootPath), path.resolve(workdir));
  return relative === '' || Boolean(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

function rebasePathInsideRoot(value: string, oldRoot: string, newRoot: string): string {
  const relative = path.relative(path.resolve(oldRoot), path.resolve(value));
  return relative ? path.resolve(newRoot, relative) : path.resolve(newRoot);
}

function rewriteProjectRootPath(history: History, oldPath: string, newPath: string): ProjectRoot {
  const oldRoot = path.resolve(oldPath);
  const nextRoot = path.resolve(newPath);
  const oldId = projectRootId(oldRoot);
  const nextId = projectRootId(nextRoot);
  const now = Date.now();
  let touchedRoot = false;
  history.roots = (history.roots || [])
    .filter((root) => root && typeof root.path === 'string')
    .map((root) => {
      const rootPath = path.resolve(root.path);
      if (projectRootId(rootPath) !== oldId) return root;
      touchedRoot = true;
      return { id: nextId, name: basenameForDirectory(nextRoot), path: nextRoot, last_used: now };
    })
    .filter((root, index, roots) => roots.findIndex((candidate) => projectRootId(candidate.path) === projectRootId(root.path)) === index);
  if (!touchedRoot) {
    history.roots = [{ id: nextId, name: basenameForDirectory(nextRoot), path: nextRoot, last_used: now }, ...(history.roots || [])];
  }
  history.entries = (history.entries || []).map((entry) => {
    if (!entry || typeof entry.workdir !== 'string' || !isWithinProjectRoot(entry.workdir, oldRoot)) return entry;
    return { ...entry, workdir: rebasePathInsideRoot(entry.workdir, oldRoot, nextRoot) };
  });
  if (!history.selectedRootId || history.selectedRootId === oldId) history.selectedRootId = nextId;
  return (history.roots || []).find((root) => projectRootId(root.path) === nextId)
    || { id: nextId, name: basenameForDirectory(nextRoot), path: nextRoot, last_used: now };
}

function projectRootForWorkdir(workdir: string | null | undefined, roots: ProjectRoot[]): string {
  const resolved = workdir ? path.resolve(workdir) : path.resolve(codexService.getWorkdir());
  const matches = roots
    .filter((root) => isWithinProjectRoot(resolved, root.path))
    .sort((a, b) => b.path.length - a.path.length);
  return matches[0]?.path || resolved;
}

function projectListRootForWorkdir(workdir: string | null | undefined, roots: ProjectRoot[], currentRoot: string): string | null {
  if (!workdir) return null;
  const resolved = path.resolve(workdir);
  const registered = roots
    .filter((root) => isWithinProjectRoot(resolved, root.path))
    .sort((a, b) => b.path.length - a.path.length)[0]?.path;
  if (registered) return registered;
  return isWithinProjectRoot(resolved, currentRoot) ? currentRoot : null;
}

function ensureProjectGroup(groups: Record<string, ProjectGroupEntry[]>, projectPath: string): ProjectGroupEntry[] {
  groups[projectPath] = groups[projectPath] || [];
  return groups[projectPath];
}

function pushProjectGroupEntry(groups: Record<string, ProjectGroupEntry[]>, seen: Map<string, Set<string>>, projectPath: string, entry: ProjectGroupEntry): void {
  const group = ensureProjectGroup(groups, projectPath);
  const key = entry.resume_path ? pathIdentity(entry.resume_path) : `${pathIdentity(entry.workdir)}:${entry.last_used}`;
  const groupSeen = seen.get(projectPath) || new Set<string>();
  if (groupSeen.has(key)) return;
  groupSeen.add(key);
  seen.set(projectPath, groupSeen);
  group.push(entry);
}

function pushDirectoryRoot(roots: DirectoryRoot[], seen: Set<string>, label: string, value: unknown) {
  const resolved = resolveProjectPath(value);
  if (!resolved) return;
  const key = pathIdentity(resolved);
  if (seen.has(key)) return;
  seen.add(key);
  roots.push({ label, path: resolved });
}

function collectDriveRoots(): DirectoryRoot[] {
  if (process.platform !== 'win32') {
    return fs.existsSync('/') ? [{ label: '/', path: path.resolve('/') }] : [];
  }
  const roots: DirectoryRoot[] = [];
  for (let code = 65; code <= 90; code += 1) {
    const drive = `${String.fromCharCode(code)}:\\`;
    try {
      if (fs.existsSync(drive)) roots.push({ label: drive, path: path.resolve(drive) });
    } catch {}
  }
  return roots;
}

function collectProjectBrowserRoots(currentPath: string): DirectoryRoot[] {
  const roots: DirectoryRoot[] = [];
  const seen = new Set<string>();
  const home = os.homedir();
  const documents = home ? path.join(home, 'Documents') : '';

  for (const root of readJsonArrayEnv('CODEX_WEBUI_PROJECT_ROOTS_JSON')) {
    pushDirectoryRoot(roots, seen, basenameForDirectory(root), root);
  }
  pushDirectoryRoot(roots, seen, '当前项目', codexService.getWorkdir());
  pushDirectoryRoot(roots, seen, '当前浏览', currentPath);
  pushDirectoryRoot(roots, seen, 'WebUI', process.cwd());
  pushDirectoryRoot(roots, seen, '用户目录', home);
  pushDirectoryRoot(roots, seen, 'Documents', documents);
  pushDirectoryRoot(roots, seen, 'Codex', documents ? path.join(documents, 'Codex') : '');
  const history = readHistory();
  for (const root of validHistoryRoots(history).slice(0, 24)) {
    pushDirectoryRoot(roots, seen, root.name || basenameForDirectory(root.path), root.path);
  }
  for (const entry of (history.entries || []).slice(0, 24)) {
    if (!entry || typeof entry.workdir !== 'string') continue;
    pushDirectoryRoot(roots, seen, basenameForDirectory(entry.workdir), entry.workdir);
  }
  for (const drive of collectDriveRoots()) {
    pushDirectoryRoot(roots, seen, drive.label, drive.path);
  }
  return roots;
}

function parentDirectory(value: string): string | null {
  const parent = path.dirname(value);
  return pathIdentity(parent) === pathIdentity(value) ? null : parent;
}

function readDirectoryEntries(directory: string): DirectoryEntry[] {
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      path: path.join(directory, entry.name),
      kind: 'directory' as const,
      hidden: entry.name.startsWith('.')
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
}

function windowsPowerShellCommand(): string {
  const systemRoot = process.env.SystemRoot || 'C:\\Windows';
  const powershell = path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  return fs.existsSync(powershell) ? powershell : 'powershell.exe';
}

function windowsExplorerCommand(): string {
  const systemRoot = process.env.SystemRoot || 'C:\\Windows';
  const explorer = path.join(systemRoot, 'explorer.exe');
  return fs.existsSync(explorer) ? explorer : 'explorer.exe';
}

function windowsOpenArgs(targetPath: string, kind: OpenTarget['kind']): string[] {
  return kind === 'file' ? ['/select,', targetPath] : [targetPath];
}

const recentLocalPathOpens = new Map<string, number>();
const LOCAL_PATH_OPEN_DEDUPE_MS = 1500;

function pickProjectDirectory(): Promise<string | null> {
  const override = resolveProjectPath(process.env.CODEX_WEBUI_PICK_DIRECTORY);
  if (override) return Promise.resolve(override);
  if (process.platform !== 'win32') return Promise.reject(new Error('Native folder picker is only implemented on Windows'));

  const script = [
    '[Console]::OutputEncoding=[System.Text.Encoding]::UTF8',
    'Add-Type -AssemblyName System.Windows.Forms',
    '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
    "$dialog.Description = '选择工作区文件夹'",
    '$dialog.ShowNewFolderButton = $true',
    '$result = $dialog.ShowDialog()',
    'if ($result -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dialog.SelectedPath }'
  ].join('; ');

  return new Promise((resolvePick, reject) => {
    const child = spawn(windowsPowerShellCommand(), ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (chunk) => { stdout += chunk; });
    child.stderr?.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code !== 0) return reject(new Error(stderr.trim() || `Folder picker exited with code ${code}`));
      const picked = stdout.trim().split(/\r?\n/).filter(Boolean).pop();
      resolvePick(picked ? resolveProjectPath(picked) : null);
    });
  });
}

function openLocalPath(targetPath: string, kind: OpenTarget['kind'] = 'directory'): Promise<void> {
  const override = process.env.CODEX_WEBUI_OPEN_COMMAND;
  const windowsOpen = !override && process.platform === 'win32';
  const now = Date.now();
  const dedupeKey = `${kind}:${process.platform === 'win32' ? targetPath.toLowerCase() : targetPath}`;
  if (now - (recentLocalPathOpens.get(dedupeKey) || 0) < LOCAL_PATH_OPEN_DEDUPE_MS) return Promise.resolve();
  recentLocalPathOpens.set(dedupeKey, now);
  const command = override || (windowsOpen ? windowsExplorerCommand() : process.platform === 'darwin' ? 'open' : 'xdg-open');
  const args = override
    ? [...readJsonArrayEnv('CODEX_WEBUI_OPEN_ARGS_PREFIX_JSON'), targetPath]
    : windowsOpen
      ? windowsOpenArgs(targetPath, kind)
      : [...readJsonArrayEnv('CODEX_WEBUI_OPEN_ARGS_PREFIX_JSON'), targetPath];
  return new Promise((resolveOpen, reject) => {
    const child = spawn(command, args, {
      detached: !override,
      stdio: 'ignore',
      windowsHide: true,
      env: { ...process.env, CODEX_WEBUI_OPEN_TARGET: targetPath, CODEX_WEBUI_OPEN_KIND: kind }
    });
    child.once('error', reject);
    if (override) {
      child.once('exit', (code) => {
        if (code === 0) resolveOpen();
        else reject(new Error(`Open command exited with code ${code}`));
      });
      return;
    }
    child.once('spawn', () => {
      child.unref();
      resolveOpen();
    });
  });
}

function getAssetVersion() {
  const root = publicRoot();
  const files = STATIC_ASSETS.map((rel) => {
    const filePath = path.join(root, rel);
    try {
      const stat = fs.statSync(filePath);
      return { path: rel, size: stat.size, mtimeMs: Math.trunc(stat.mtimeMs) };
    } catch {
      return { path: rel, missing: true };
    }
  });
  return {
    build: UI_BUILD,
    version: `${UI_BUILD}:${files.map((f) => `${f.path}:${'size' in f ? f.size : 'missing'}:${'mtimeMs' in f ? f.mtimeMs : 0}`).join('|')}`,
    files
  };
}

function safeUploadName(name: unknown, index: number, ext: string): string {
  const rawBase = String(name || `pasted-image-${index + 1}`).replace(/\.[A-Za-z0-9]+$/, '');
  const base = rawBase
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || `pasted-image-${index + 1}`;
  return `${Date.now()}-${index + 1}-${base}.${ext}`;
}

function saveImageAttachments(attachments: unknown): SavedImageAttachment[] {
  if (!Array.isArray(attachments)) return [];
  const imagePaths: SavedImageAttachment[] = [];
  const extByMime: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif'
  };
  for (const [index, item] of attachments.slice(0, 6).entries()) {
    const attachment = item as any;
    if (attachment?.kind === 'image' && typeof attachment.url === 'string' && attachment.url.startsWith('/uploads/')) {
      const fileName = path.basename(decodeURIComponent(attachment.url.replace(/^\/uploads\//, '')));
      const filePath = path.resolve(UPLOAD_DIR, fileName);
      const uploadRoot = path.resolve(UPLOAD_DIR);
      const comparableFile = process.platform === 'win32' ? filePath.toLowerCase() : filePath;
      const comparableRoot = process.platform === 'win32' ? uploadRoot.toLowerCase() : uploadRoot;
      if (comparableFile.startsWith(comparableRoot + path.sep) && fs.existsSync(filePath)) {
        imagePaths.push({ kind: 'image', name: String(attachment.name || fileName), path: filePath, url: `/uploads/${encodeURIComponent(fileName)}` });
      }
      continue;
    }
    if (!attachment || attachment.type !== 'image' || typeof attachment.dataUrl !== 'string') continue;
    const match = attachment.dataUrl.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=\r\n]+)$/);
    if (!match) continue;
    const mime = match[1];
    const ext = extByMime[mime];
    if (!ext) continue;
    const data = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
    if (!data.length || data.length > 8 * 1024 * 1024) continue;
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const fileName = safeUploadName(attachment.name, index, ext);
    const filePath = path.join(UPLOAD_DIR, fileName);
    fs.writeFileSync(filePath, data);
    imagePaths.push({ kind: 'image', name: String(attachment.name || `image.${ext}`), path: filePath, url: `/uploads/${encodeURIComponent(fileName)}` });
  }
  return imagePaths;
}

// Keep SSE alive
setInterval(() => {
  for (const res of sseClients) {
    try { res.write(': ping\n\n'); } catch {}
  }
}, 15000);

// Wire up Codex Service events
codexService.on('broadcast', (event, data) => broadcast(event, data));
codexService.on('status_update', () => broadcastStatus());

function getResumeMeta() {
  try {
    const lastPath = codexService.getDisplayResumePath();
    if (!lastPath) return null;
    const stat = fs.statSync(lastPath);
    const name = path.basename(lastPath);
    return { name, mtimeMs: stat.mtimeMs, size: stat.size };
  } catch { return null; }
}

function broadcastStatus() {
  const facts = readMemoryFacts();
  const meta = getResumeMeta();
  const lastPath = codexService.getDisplayResumePath();
  broadcast('status', {
    resumed: !!lastPath,
    resume_path: lastPath,
    resume_meta: meta,
    memory: facts,
    config: getConfigSafe(),
    running: codexService.isRunning(),
    workdir: codexService.getWorkdir(),
    queue: codexService.getQueue(),
    guidance: codexService.getGuidance(),
    pendingUserInput: codexService.getLatestPendingUserInput()
  });
}

function actionError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sendActionResult(res: ServerResponse, promise: Promise<any>, statusBroadcast = true): void {
  promise.then((result) => {
    if (statusBroadcast) broadcastStatus();
    sendJson(res, 200, { ok: true, result: result || {} });
  }).catch((error) => {
    sendJson(res, 500, { ok: false, error: actionError(error) });
  });
}

function createAgentsFile(workdir: string): { path: string; created: boolean } {
  const target = path.join(workdir, 'AGENTS.md');
  if (fs.existsSync(target)) return { path: target, created: false };
  const content = [
    '# Agent Instructions',
    '',
    '- Read this file before changing this project.',
    '- Preserve user changes and keep edits scoped to the requested behavior.',
    '- Run the project checks that cover modified behavior before reporting completion.',
    ''
  ].join('\n');
  fs.writeFileSync(target, content, { encoding: 'utf8', flag: 'wx' });
  return { path: target, created: true };
}

function serveStatic(req: IncomingMessage, res: ServerResponse) {
  const url = (req.url || '').split('?')[0];
  // Serve static files from public/ in the current working directory
  const root = publicRoot();
  
  let filePath = path.join(root, url === '/' ? 'index.html' : url);
  if (!filePath.startsWith(root)) { setCORS(res); res.writeHead(403); return res.end('Forbidden'); }
  
  fs.readFile(filePath, (err, data) => {
    if (err) { setCORS(res); res.writeHead(404); return res.end('Not Found'); }
    const ext = path.extname(filePath);
    const types: Record<string, string> = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.webmanifest': 'application/manifest+json; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.svg': 'image/svg+xml; charset=utf-8',
      '.png': 'image/png',
      '.ico': 'image/x-icon'
    };
    setCORS(res);
    res.writeHead(200, {
      'Content-Type': types[ext] || 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Codex-WebUI-Build': UI_BUILD
    });
    res.end(data);
  });
}

function serveUpload(req: IncomingMessage, res: ServerResponse) {
  const rawName = (req.url || '').split('?')[0].replace(/^\/uploads\//, '');
  let fileName = '';
  try { fileName = decodeURIComponent(rawName); } catch {}
  if (!fileName || fileName.includes('/') || fileName.includes('\\')) {
    setCORS(res); res.writeHead(400); return res.end('Bad upload path');
  }
  const uploadRoot = path.resolve(UPLOAD_DIR);
  const filePath = path.join(uploadRoot, fileName);
  const rel = path.relative(uploadRoot, filePath);
  if (rel.startsWith('..') || path.isAbsolute(rel) || !fs.existsSync(filePath)) {
    setCORS(res); res.writeHead(404); return res.end('Not Found');
  }
  const ext = path.extname(filePath).toLowerCase();
  const contentType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : ext === '.gif' ? 'image/gif' : 'image/png';
  setCORS(res);
  res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'private, max-age=86400' });
  fs.createReadStream(filePath).pipe(res);
}

function contentDisposition(fileName: string): string {
  const fallback = String(fileName || 'download.bin').replace(/["\\\r\n]/g, '_') || 'download.bin';
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName || fallback)}`;
}

function parseByteRange(header: string | undefined, size: number): { start: number; end: number } | null {
  if (!header) return { start: 0, end: size - 1 };
  const match = header.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return null;
  let start = match[1] ? Number(match[1]) : NaN;
  let end = match[2] ? Number(match[2]) : NaN;
  if (!Number.isFinite(start) && Number.isFinite(end)) {
    start = Math.max(0, size - end);
    end = size - 1;
  } else {
    if (!Number.isFinite(start)) start = 0;
    if (!Number.isFinite(end)) end = size - 1;
  }
  if (start < 0 || end < start || start >= size) return null;
  return { start, end: Math.min(end, size - 1) };
}

function hasValidTransferDownloadToken(req: IncomingMessage, url: string, parsedUrl: URL): boolean {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  const match = url.match(/^\/transfer\/files\/([A-Za-z0-9_-]{8,80})\/download$/);
  if (!match) return false;
  return isTransferDownloadTokenValid(match[1], parsedUrl.searchParams.get('token'));
}

function requireTransferDownloadAuth(req: IncomingMessage, res: ServerResponse, url: string, parsedUrl: URL): boolean {
  if (!PUBLIC_AUTH_PASSWORD) return true;
  if (hasValidTransferDownloadToken(req, url, parsedUrl)) return true;
  const expected = `Basic ${Buffer.from(`${PUBLIC_AUTH_USER}:${PUBLIC_AUTH_PASSWORD}`, 'utf8').toString('base64')}`;
  if (req.headers.authorization === expected) return true;
  setCORS(res);
  res.writeHead(401, {
    'Content-Type': 'text/plain; charset=utf-8',
    'WWW-Authenticate': 'Basic realm="Codex WebUI"'
  });
  res.end('Authentication required');
  return false;
}

function sendTransferDownload(req: IncomingMessage, res: ServerResponse, id: string): void {
  const download = getTransferDownload(id);
  if (!download) return sendJson(res, 404, { ok: false, error: 'Transfer file not found' });
  if (download.size === 0) {
    setCORS(res);
    res.writeHead(200, {
      'Content-Type': download.meta.mime || 'application/octet-stream',
      'Content-Disposition': contentDisposition(download.meta.name),
      'Content-Length': '0',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=300'
    });
    res.end();
    return;
  }
  const range = parseByteRange(req.headers.range, download.size);
  if (!range) {
    setCORS(res);
    res.writeHead(416, { 'Content-Range': `bytes */${download.size}` });
    res.end();
    return;
  }
  const partial = Boolean(req.headers.range);
  const length = range.end - range.start + 1;
  setCORS(res);
  res.writeHead(partial ? 206 : 200, {
    'Content-Type': download.meta.mime || 'application/octet-stream',
    'Content-Disposition': contentDisposition(download.meta.name),
    'Content-Length': String(length),
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=300',
    ...(partial ? { 'Content-Range': `bytes ${range.start}-${range.end}/${download.size}` } : {})
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(download.filePath, { start: range.start, end: range.end }).pipe(res);
}

function listTransferProviders() {
  return [
    listStorageToProvider(),
    {
      id: 'local',
      label: '本地公网',
      available: true,
      role: 'fallback',
      reason: '通过当前访问 WebUI 的公网入口兜底，下载链接由前端按当前 origin 生成。'
    }
  ];
}

async function handleTransferRequest(req: IncomingMessage, res: ServerResponse, parsedUrl: URL, url: string): Promise<void> {
  cleanupExpiredTransfers();
  const fileContentMatch = url.match(/^\/transfer\/files\/([A-Za-z0-9_-]{8,80})\/content$/);
  const fileDownloadMatch = url.match(/^\/transfer\/files\/([A-Za-z0-9_-]{8,80})\/download$/);
  const fileOpenFolderMatch = url.match(/^\/transfer\/files\/([A-Za-z0-9_-]{8,80})\/open-folder$/);
  const fileMatch = url.match(/^\/transfer\/files\/([A-Za-z0-9_-]{8,80})$/);

  if (req.method === 'GET' && url === '/transfer/providers') {
    return sendJson(res, 200, { ok: true, providers: listTransferProviders() });
  }

  if (req.method === 'POST' && url === '/transfer/providers/storage-to/init') {
    if (!requireAuth(req)) return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
    try {
      const body = await readJsonBody(req);
      const upload = await initStorageToUpload(body.name, body.mime, body.size);
      return sendJson(res, 200, { ok: true, provider: 'storage-to', upload });
    } catch (error) {
      return sendJson(res, 502, { ok: false, fallback: true, provider: 'storage-to', error: actionError(error) });
    }
  }

  if (req.method === 'POST' && url === '/transfer/providers/storage-to/parts') {
    if (!requireAuth(req)) return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
    try {
      const body = await readJsonBody(req);
      const urls = await getStorageToPartUrls(body.uploadId, body.partNumbers);
      return sendJson(res, 200, { ok: true, provider: 'storage-to', urls });
    } catch (error) {
      return sendJson(res, 502, { ok: false, fallback: true, provider: 'storage-to', error: actionError(error) });
    }
  }

  if (req.method === 'POST' && url === '/transfer/providers/storage-to/complete-multipart') {
    if (!requireAuth(req)) return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
    try {
      const body = await readJsonBody(req);
      await completeStorageToMultipart(body.uploadId, body.parts);
      return sendJson(res, 200, { ok: true, provider: 'storage-to' });
    } catch (error) {
      return sendJson(res, 502, { ok: false, fallback: true, provider: 'storage-to', error: actionError(error) });
    }
  }

  if (req.method === 'POST' && url === '/transfer/providers/storage-to/confirm') {
    if (!requireAuth(req)) return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
    try {
      const body = await readJsonBody(req);
      const remote = await confirmStorageToUpload(body.name, body.mime, body.size, body.r2Key);
      const file = createRemoteTransferFile({
        name: remote.filename || body.name,
        mime: body.mime,
        size: remote.size,
        uploaderId: body.uploaderId,
        provider: 'storage-to',
        downloadUrl: remote.url,
        rawDownloadUrl: remote.rawUrl,
        remoteId: remote.id,
        remoteExpiresAt: remote.expiresAt,
        providerAttempts: body.attempts,
        ttlHours: body.ttlHours
      });
      return sendJson(res, 200, { ok: true, provider: 'storage-to', file });
    } catch (error) {
      return sendJson(res, 502, { ok: false, fallback: true, provider: 'storage-to', error: actionError(error) });
    }
  }

  if (req.method === 'GET' && url === '/transfer/files') {
    return sendJson(res, 200, { ok: true, files: listTransferFiles(), storePath: getTransferStorePath() });
  }

  if (req.method === 'GET' && url === '/transfer/messages') {
    return sendJson(res, 200, { ok: true, messages: listTransferMessages(), storePath: getTransferStorePath() });
  }

  if (req.method === 'GET' && url === '/transfer/events') {
    return sendJson(res, 200, { ok: true, events: listTransferEvents(), files: listTransferFiles(), storePath: getTransferStorePath() });
  }

  if (req.method === 'POST' && url === '/transfer/messages') {
    if (!requireAuth(req)) return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
    try {
      const body = await readJsonBody(req, 20 * 1024);
      const message = createTransferTextMessage(body.text, body.senderId, body.senderName, body.ttlHours);
      return sendJson(res, 200, { ok: true, message });
    } catch (error) {
      return sendJson(res, 400, { ok: false, error: actionError(error) });
    }
  }

  if (req.method === 'POST' && url === '/transfer/files') {
    if (!requireAuth(req)) return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
    const body = await readJsonBody(req);
    const meta = createTransferFile(body.name, body.mime, body.size, body.uploaderId, body.ttlHours);
    return sendJson(res, 200, { ok: true, file: meta });
  }

  if (req.method === 'PUT' && fileContentMatch) {
    if (!requireAuth(req)) return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
    const meta = await writeTransferFileContent(fileContentMatch[1], req);
    return sendJson(res, 200, { ok: true, file: meta });
  }

  if ((req.method === 'GET' || req.method === 'HEAD') && fileDownloadMatch) {
    if (!requireTransferDownloadAuth(req, res, url, parsedUrl)) return;
    return sendTransferDownload(req, res, fileDownloadMatch[1]);
  }

  if (req.method === 'POST' && fileOpenFolderMatch) {
    if (!requireAuth(req)) return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
    if (!isLocalHost(requestHost(req))) {
      return sendJson(res, 403, { ok: false, error: 'Transfer file folders can only be opened on the WebUI host' });
    }
    const download = getTransferDownload(fileOpenFolderMatch[1]);
    if (!download) return sendJson(res, 404, { ok: false, error: 'Transfer file not found' });
    const folderPath = path.dirname(download.filePath);
    await openLocalPath(folderPath, 'directory');
    return sendJson(res, 200, { ok: true, path: folderPath });
  }

  if (req.method === 'DELETE' && fileMatch) {
    if (!requireAuth(req)) return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
    return sendJson(res, deleteTransferFile(fileMatch[1]) ? 200 : 404, { ok: true });
  }

  if (req.method === 'POST' && url === '/transfer/store/open') {
    if (!requireAuth(req)) return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
    if (!isLocalHost(requestHost(req))) {
      return sendJson(res, 403, { ok: false, error: 'Transfer store can only be opened on the WebUI host' });
    }
    const storePath = getTransferStorePath();
    await openLocalPath(storePath, 'directory');
    return sendJson(res, 200, { ok: true, path: storePath });
  }

  return sendJson(res, 404, { ok: false, error: 'Transfer endpoint not found' });
}

const server = http.createServer((req, res) => {
  if (!checkRateLimit(req)) {
    setCORS(res);
    res.writeHead(429, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Too Many Requests' }));
  }

  if (req.method === 'OPTIONS') {
    setCORS(res);
    res.writeHead(204);
    return res.end();
  }

  const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const url = parsedUrl.pathname;

  if (!hasValidTransferDownloadToken(req, url, parsedUrl) && !requirePublicAuth(req, res)) return;

  if (req.method === 'GET' && url.startsWith('/uploads/')) {
    return serveUpload(req, res);
  }

  if (req.method === 'GET' && url.startsWith('/events')) {
    setCORS(res);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('\n');
    sseClients.add(res);
    
    // Initial status
    const lastPath = codexService.getDisplayResumePath();
    try {
      const init = `event: status\n` + `data: ${JSON.stringify({ resumed: !!lastPath, resume_path: lastPath, resume_meta: getResumeMeta(), memory: readMemoryFacts(), config: getConfigSafe(), running: codexService.isRunning(), workdir: codexService.getWorkdir(), queue: codexService.getQueue(), guidance: codexService.getGuidance(), pendingUserInput: codexService.getLatestPendingUserInput() })}\n\n`;
      res.write(init);
    } catch {}
    
    req.on('close', () => sseClients.delete(res));
    return;
  }

  if (req.method === 'GET' && url === '/health') {
    setCORS(res);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(runtimeNetworkInfo()));
  }

  if (req.method === 'GET' && url === '/asset-version') {
    setCORS(res);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify(getAssetVersion()));
  }

  if (url.startsWith('/transfer')) {
    handleTransferRequest(req, res, parsedUrl, url).catch((e) => {
      if (res.headersSent) return;
      sendJson(res, 500, { ok: false, error: e instanceof Error ? e.message : String(e) });
    });
    return;
  }

  if (req.method === 'GET' && url === '/memory') {
    const facts = readMemoryFacts();
    setCORS(res);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ facts }));
  }

  if (req.method === 'GET' && url === '/git/status') {
    getGitStatus(codexService.getWorkdir())
      .then((data) => sendJson(res, 200, data))
      .catch((error) => sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) }));
    return;
  }

  if (req.method === 'GET' && url === '/git/diff') {
    getGitDiff(codexService.getWorkdir())
      .then((data) => sendJson(res, 200, data))
      .catch((error) => sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) }));
    return;
  }

  if (req.method === 'GET' && url === '/git/file-diff') {
    const filePath = parsedUrl.searchParams.get('path') || '';
    const staged = parsedUrl.searchParams.get('staged') === 'true';
    const ignoreWhitespace = parsedUrl.searchParams.get('ignoreWhitespaceChanges') === 'true';
    getGitFileDiff(codexService.getWorkdir(), filePath, staged, ignoreWhitespace)
      .then((data) => sendJson(res, 200, data))
      .catch((error) => sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) }));
    return;
  }

  if (req.method === 'GET' && url === '/git/workspace-diffs') {
    const scope = parsedUrl.searchParams.get('scope') === 'staged' ? 'staged' : 'unstaged';
    const ignoreWhitespace = parsedUrl.searchParams.get('ignoreWhitespaceChanges') === 'true';
    getGitWorkspaceDiffs(codexService.getWorkdir(), scope, ignoreWhitespace)
      .then((data) => sendJson(res, 200, data))
      .catch((error) => sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) }));
    return;
  }

  if (req.method === 'POST' && url === '/git/stage') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    readJsonBody(req)
      .then((body) => stageGitPaths(codexService.getWorkdir(), body.paths))
      .then((data) => { broadcastStatus(); sendJson(res, 200, data); })
      .catch((error) => sendJson(res, actionError(error) === 'Bad JSON' ? 400 : 500, { ok: false, error: actionError(error) }));
    return;
  }

  if (req.method === 'POST' && url === '/git/unstage') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    readJsonBody(req)
      .then((body) => unstageGitPaths(codexService.getWorkdir(), body.paths))
      .then((data) => { broadcastStatus(); sendJson(res, 200, data); })
      .catch((error) => sendJson(res, actionError(error) === 'Bad JSON' ? 400 : 500, { ok: false, error: actionError(error) }));
    return;
  }

  if (req.method === 'POST' && url === '/git/discard') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    readJsonBody(req)
      .then((body) => discardGitPaths(codexService.getWorkdir(), body.paths, body.deleteUntracked === true))
      .then((data) => { broadcastStatus(); sendJson(res, 200, data); })
      .catch((error) => sendJson(res, actionError(error) === 'Bad JSON' ? 400 : 500, { ok: false, error: actionError(error) }));
    return;
  }

  if (req.method === 'POST' && url === '/git/commit') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    readJsonBody(req)
      .then((body) => commitGit(codexService.getWorkdir(), body.message))
      .then((data) => { broadcastStatus(); sendJson(res, 200, data); })
      .catch((error) => sendJson(res, actionError(error) === 'Bad JSON' ? 400 : 500, { ok: false, error: actionError(error) }));
    return;
  }

  if (req.method === 'POST' && url === '/git/push') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    readJsonBody(req)
      .then((body) => pushGit(codexService.getWorkdir(), body.forceWithLease === true))
      .then((data) => { broadcastStatus(); sendJson(res, 200, data); })
      .catch((error) => sendJson(res, actionError(error) === 'Bad JSON' ? 400 : 500, { ok: false, error: actionError(error) }));
    return;
  }

  if (req.method === 'POST' && url === '/git/pull') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    readJsonBody(req)
      .then(() => pullGit(codexService.getWorkdir()))
      .then((data) => { broadcastStatus(); sendJson(res, 200, data); })
      .catch((error) => sendJson(res, actionError(error) === 'Bad JSON' ? 400 : 500, { ok: false, error: actionError(error) }));
    return;
  }

  if (req.method === 'POST' && url === '/git/checkout') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    readJsonBody(req)
      .then((body) => checkoutGitBranch(codexService.getWorkdir(), body.branchName, body.create === true))
      .then((data) => { broadcastStatus(); sendJson(res, 200, data); })
      .catch((error) => sendJson(res, actionError(error) === 'Bad JSON' ? 400 : 500, { ok: false, error: actionError(error) }));
    return;
  }

  if (req.method === 'GET' && url === '/skills') {
    return sendJson(res, 200, listSkills(codexService.getWorkdir()));
  }

  if (req.method === 'POST' && url === '/skills/toggle') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    readJsonBody(req)
      .then((body) => setSkillEnabled(body.path, body.enabled === true, codexService.getWorkdir()))
      .then((data) => sendJson(res, 200, data))
      .catch((error) => sendJson(res, actionError(error) === 'Bad JSON' ? 400 : 500, { ok: false, error: actionError(error) }));
    return;
  }

  if (req.method === 'POST' && url === '/skills/delete') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    readJsonBody(req)
      .then((body) => deleteSkill(body.path, codexService.getWorkdir()))
      .then((data) => sendJson(res, 200, data))
      .catch((error) => sendJson(res, actionError(error) === 'Bad JSON' ? 400 : 500, { ok: false, error: actionError(error) }));
    return;
  }

  if (req.method === 'GET' && url === '/mcp') {
    return sendJson(res, 200, listMcpServers());
  }

  if (req.method === 'POST' && url === '/mcp/server') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    readJsonBody(req)
      .then((body) => saveMcpServer(body))
      .then((data) => sendJson(res, data.ok === false ? 400 : 200, data))
      .catch((error) => sendJson(res, actionError(error) === 'Bad JSON' ? 400 : 500, { ok: false, error: actionError(error) }));
    return;
  }

  if (req.method === 'POST' && url === '/mcp/toggle') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    readJsonBody(req)
      .then((body) => toggleMcpServer(body.id, body.enabled === true))
      .then((data) => sendJson(res, data.ok === false ? 404 : 200, data))
      .catch((error) => sendJson(res, actionError(error) === 'Bad JSON' ? 400 : 500, { ok: false, error: actionError(error) }));
    return;
  }

  if (req.method === 'DELETE' && url === '/mcp/server') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    readJsonBody(req)
      .then((body) => deleteMcpServer(body.id))
      .then((data) => sendJson(res, data.ok === false ? 404 : 200, data))
      .catch((error) => sendJson(res, actionError(error) === 'Bad JSON' ? 400 : 500, { ok: false, error: actionError(error) }));
    return;
  }

  if (req.method === 'POST' && url === '/mcp/shared-pool') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    readJsonBody(req)
      .then((body) => writeSharedPoolSettings(String(body.agentEnvironment || 'windowsNative'), body.enabled === true))
      .then((data) => sendJson(res, 200, data))
      .catch((error) => sendJson(res, actionError(error) === 'Bad JSON' ? 400 : 500, { ok: false, error: actionError(error) }));
    return;
  }

  if (req.method === 'GET' && url === '/preview') {
    getQuickPreview(parsedUrl.searchParams.get('target') || '', codexService.getWorkdir())
      .then((data) => sendJson(res, 200, data))
      .catch((error) => sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) }));
    return;
  }

  if (req.method === 'GET' && url === '/terminal/sessions') {
    return sendJson(res, 200, listTerminalSessions());
  }

  if (req.method === 'POST' && url === '/terminal/spawn') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    readJsonBody(req)
      .then((body) => spawnTerminalSession(body, codexService.getWorkdir()))
      .then((data) => sendJson(res, 200, data))
      .catch((error) => sendJson(res, actionError(error) === 'Bad JSON' ? 400 : 500, { ok: false, error: actionError(error) }));
    return;
  }

  if (req.method === 'POST' && url === '/terminal/stdin') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    readJsonBody(req)
      .then((body) => writeTerminalStdin(body.id, body.data))
      .then((data) => sendJson(res, 200, data))
      .catch((error) => sendJson(res, actionError(error) === 'Bad JSON' ? 400 : 500, { ok: false, error: actionError(error) }));
    return;
  }

  if (req.method === 'POST' && url === '/terminal/kill') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    readJsonBody(req)
      .then((body) => killTerminalSession(body.id))
      .then((data) => sendJson(res, 200, data))
      .catch((error) => sendJson(res, actionError(error) === 'Bad JSON' ? 400 : 500, { ok: false, error: actionError(error) }));
    return;
  }

  if (req.method === 'POST' && url === '/terminal/resize') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    readJsonBody(req)
      .then((body) => resizeTerminalSession(body.id, body.cols, body.rows))
      .then((data) => sendJson(res, 200, data))
      .catch((error) => sendJson(res, actionError(error) === 'Bad JSON' ? 400 : 500, { ok: false, error: actionError(error) }));
    return;
  }

  if (req.method === 'DELETE' && url === '/memory') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { fact } = JSON.parse(body || '{}');
        if (!fact || typeof fact !== 'string') { setCORS(res); res.writeHead(400); return res.end('Bad JSON'); }
        deleteMemoryFact(fact);
        broadcastStatus();
        setCORS(res);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) { setCORS(res); res.writeHead(400); res.end('Bad JSON'); }
    });
    return;
  }

  if (req.method === 'GET' && url === '/session/recycle-candidates') {
    if (!requireAuth(req)) return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
    const days = Number(parsedUrl.searchParams.get('days') || 1);
    const limit = Number(parsedUrl.searchParams.get('limit') || 200);
    const query = parsedUrl.searchParams.get('q') || parsedUrl.searchParams.get('query') || '';
    const h = readHistory();
    const root = ensureHistoryProject(h);
    writeHistory(h);
    const items = listRecycledSessionCandidates(days, limit, query);
    return sendJson(res, 200, {
      ok: true,
      days: Math.max(1, Math.min(30, Number(days) || 1)),
      query: String(query || '').trim(),
      total: items.length,
      recycleRoot: SESSION_RECYCLE_ROOT,
      historyProject: root,
      items
    });
  }

  if (req.method === 'POST' && url === '/session/restore') {
    if (!requireAuth(req)) return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
    readJsonBody(req)
      .then((body) => {
        const requested = body && (body.recycledPath || body.path);
        if (!requested || typeof requested !== 'string') return sendJson(res, 400, { ok: false, error: 'Missing recycledPath' });
        const result = restoreRecycledSession(requested);
        broadcastStatus();
        return sendJson(res, 200, { ok: true, ...result });
      })
      .catch((error) => sendJson(res, actionError(error).includes('Invalid recycled session path') ? 400 : 500, { ok: false, error: actionError(error) }));
    return;
  }

  if (req.method === 'DELETE' && url === '/session') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { path: p } = JSON.parse(body || '{}');
        if (!p) { setCORS(res); res.writeHead(400); return res.end('Bad JSON'); }
        const abs = path.resolve(p);
        if (!isWithinSessions(abs) || !/rollout-.*\.jsonl$/.test(abs)) { setCORS(res); res.writeHead(403); return res.end('Forbidden'); }
        const recycleResult = recycleSessionFile(abs);
        
        const h = readHistory();
        const deletedKey = pathIdentity(abs);
        h.entries = (h.entries || []).filter(e => !e.resume_path || pathIdentity(e.resume_path) !== deletedKey);
        removeArchivedSessionPath(h, abs);
        writeHistory(h);
        
        const current = codexService.getDisplayResumePath();
        const finish = () => {
          broadcastStatus();
          setCORS(res);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, ...recycleResult }));
        };
        if (current && pathIdentity(current) === pathIdentity(abs)) {
          codexService.restart(null, finish);
          return;
        }
        finish();
      } catch (e) { setCORS(res); res.writeHead(400); res.end('Bad JSON'); }
    });
    return;
  }

  if (req.method === 'DELETE' && url === '/project-history') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { resume_path } = JSON.parse(body || '{}');
        const h = readHistory();
        const deletedKey = resume_path ? pathIdentity(resume_path) : null;
        h.entries = (h.entries || []).filter(e => !deletedKey || !e.resume_path || pathIdentity(e.resume_path) !== deletedKey);
        writeHistory(h);
        setCORS(res);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) { setCORS(res); res.writeHead(400); res.end('Bad JSON'); }
    });
    return;
  }

  if (req.method === 'GET' && url === '/favorites') {
    if (!requireAuth(req)) return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
    return sendJson(res, 200, { ok: true, ...getFavoriteStorePaths() });
  }

  if (req.method === 'POST' && url === '/favorites') {
    if (!requireAuth(req)) return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
    void (async () => {
      try {
        const body = await readJsonBody(req, 256 * 1024);
        const sessionPath = typeof body.sessionPath === 'string' && body.sessionPath.trim() ? path.resolve(body.sessionPath) : null;
        if (sessionPath && (!isWithinSessions(sessionPath) || !/rollout-.*\.jsonl$/.test(sessionPath))) {
          return sendJson(res, 400, { ok: false, error: 'Invalid session path' });
        }
        const result = appendFavorite({
          sessionPath,
          turnId: typeof body.turnId === 'string' ? body.turnId : '',
          question: String(body.question || ''),
          answer: String(body.answer || ''),
          durationMs: Number(body.durationMs || 0) || null,
          completedAt: typeof body.completedAt === 'string' ? body.completedAt : ''
        });
        return sendJson(res, 200, result);
      } catch (error) {
        return sendJson(res, 400, { ok: false, error: actionError(error) });
      }
    })();
    return;
  }

  if (req.method === 'POST' && url === '/message') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { text, attachments, collaborationPreset, serviceTier } = JSON.parse(body || '{}');
        if (typeof text !== 'string' || !text.trim() || text.length > 16*1024) {
          setCORS(res); res.writeHead(400); return res.end('Missing text');
        }
        const imageAttachments = saveImageAttachments(attachments);
        const preset = collaborationPreset === 'plan' ? 'plan' : 'default';
        const selectedServiceTier = String(serviceTier || '').trim().toLowerCase() === 'fast' ? 'fast' : null;
        const sent = await codexService.sendUserInput(text.trim(), imageAttachments.map((item) => item.path), imageAttachments, preset, selectedServiceTier);
        setCORS(res);
        res.writeHead(sent.status === 'queued' || sent.status === 'guidance_pending' ? 202 : 200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ...sent, running: codexService.isRunning(), resume_path: codexService.getDisplayResumePath(), workdir: codexService.getWorkdir(), queue: codexService.getQueue(), guidance: codexService.getGuidance() }));
      } catch (e) {
        setCORS(res); res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }));
      }
    });
    return;
  }

  if (req.method === 'POST' && url === '/message/edit') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const parsed = JSON.parse(body || '{}');
        const text = typeof parsed.text === 'string' ? parsed.text.trim() : '';
        const turnId = typeof parsed.turnId === 'string' ? parsed.turnId.trim() : '';
        if (!text || text.length > 16*1024) {
          setCORS(res); res.writeHead(400); return res.end('Missing text');
        }
        if (!turnId) {
          setCORS(res); res.writeHead(400); return res.end('Missing turnId');
        }
        let resumePath = typeof parsed.path === 'string' && parsed.path ? path.resolve(parsed.path) : codexService.getDisplayResumePath();
        if (!resumePath) {
          setCORS(res); res.writeHead(400); return res.end('Missing session path');
        }
        resumePath = path.resolve(resumePath);
        if (!isWithinSessions(resumePath) || !/rollout-.*\.jsonl$/.test(resumePath)) {
          setCORS(res); res.writeHead(403); return res.end('Forbidden');
        }
        const resumeWorkdir = historyWorkdirForResumePath(resumePath);
        if (resumeWorkdir) codexService.setWorkdir(resumeWorkdir);
        const imageAttachments = saveImageAttachments(parsed.attachments);
        const preset = parsed.collaborationPreset === 'plan' ? 'plan' : 'default';
        const selectedServiceTier = String(parsed.serviceTier || '').trim().toLowerCase() === 'fast' ? 'fast' : null;
        const sent = await codexService.regenerateFromEditedUserMessage(resumePath, turnId, text, imageAttachments.map((item) => item.path), imageAttachments, preset, selectedServiceTier);
        setCORS(res);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ...sent, running: codexService.isRunning(), resume_path: codexService.getDisplayResumePath(), workdir: codexService.getWorkdir(), queue: codexService.getQueue(), guidance: codexService.getGuidance() }));
      } catch (e) {
        setCORS(res); res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }));
      }
    });
    return;
  }

  if (req.method === 'POST' && url === '/session/move') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    readJsonBody(req)
      .then((body) => {
        const requested = body && (body.path || body.resume_path);
        const requestedWorkdir = body && (body.workdir || body.project || body.target);
        if (!requested || typeof requested !== 'string' || !requestedWorkdir || typeof requestedWorkdir !== 'string') {
          sendJson(res, 400, { ok: false, error: 'Bad JSON' });
          return;
        }
        const abs = path.resolve(requested);
        if (!isWithinSessions(abs) || !/rollout-.*\.jsonl$/.test(abs) || !fs.existsSync(abs)) {
          sendJson(res, 403, { ok: false, error: 'Forbidden' });
          return;
        }
        const targetWorkdir = resolveProjectPath(requestedWorkdir);
        if (!targetWorkdir) {
          sendJson(res, 400, { ok: false, error: 'Invalid project path' });
          return;
        }
        const h = readHistory();
        const root = upsertSessionWorkdir(h, abs, targetWorkdir);
        writeHistory(h);
        const current = codexService.getDisplayResumePath();
        if (current && pathIdentity(current) === pathIdentity(abs)) codexService.setWorkdir(targetWorkdir);
        broadcastStatus();
        sendJson(res, 200, { ok: true, path: abs, workdir: targetWorkdir, root });
      })
      .catch((error) => sendJson(res, actionError(error) === 'Bad JSON' ? 400 : 500, { ok: false, error: actionError(error) }));
    return;
  }

  if (req.method === 'GET' && url === '/queue') {
    setCORS(res);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ running: codexService.isRunning(), workdir: codexService.getWorkdir(), queue: codexService.getQueue(), guidance: codexService.getGuidance() }));
  }

  if (req.method === 'GET' && url === '/server-requests') {
    return sendJson(res, 200, {
      ok: true,
      requests: codexService.getPendingUserInputRequests(),
      pendingUserInput: codexService.getLatestPendingUserInput()
    });
  }

  if (req.method === 'POST' && url === '/server-request/resolve') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    readJsonBody(req)
      .then((body) => {
        const requestId = String(body.requestId || '').trim();
        const answers = body.answers && typeof body.answers === 'object' ? body.answers : {};
        if (!requestId) return sendJson(res, 400, { ok: false, error: 'Missing requestId' });
        const ok = codexService.resolveUserInputRequest(requestId, answers);
        return sendJson(res, ok ? 200 : 404, {
          ok,
          running: codexService.isRunning(),
          workdir: codexService.getWorkdir(),
          queue: codexService.getQueue(),
          guidance: codexService.getGuidance(),
          pendingUserInput: codexService.getLatestPendingUserInput()
        });
      })
      .catch((error) => sendJson(res, actionError(error) === 'Bad JSON' ? 400 : 500, { ok: false, error: actionError(error) }));
    return;
  }

  if (req.method === 'POST' && (url === '/queue/promote' || url === '/queue/remove' || url === '/queue/clear')) {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        let ok = true;
        if (url === '/queue/promote') ok = codexService.promoteQueuedInput(String(parsed.id || ''));
        if (url === '/queue/remove') ok = codexService.removeQueuedInput(String(parsed.id || ''));
        if (url === '/queue/clear') codexService.clearQueuedInputs();
        setCORS(res);
        res.writeHead(ok ? 200 : 404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok, running: codexService.isRunning(), workdir: codexService.getWorkdir(), queue: codexService.getQueue(), guidance: codexService.getGuidance() }));
      } catch {
        setCORS(res); res.writeHead(400); res.end('Bad JSON');
      }
    });
    return;
  }

  if (req.method === 'GET' && url === '/config') {
    setCORS(res);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(getConfigSafe()));
  }

  if (req.method === 'PUT' && url === '/config') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const obj = JSON.parse(body || '{}');
        const allowed = ['model','model_reasoning_effort','approval_policy','approvals_reviewer','tools.web_search_request','use_streamable_shell','sandbox_mode','service_tier','instructions_extra'];
        Object.keys(obj||{}).forEach(k => { if (!allowed.includes(k)) delete obj[k]; });
        writeConfig(obj);
        broadcastStatus();
        setCORS(res);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) { setCORS(res); res.writeHead(400); res.end('Bad JSON'); }
    });
    return;
  }

  if (req.method === 'POST' && url === '/restart') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    const lastPath = codexService.getDisplayResumePath();
    codexService.restart(lastPath, () => {
      setCORS(res);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, resume_path: lastPath }));
    });
    return;
  }

  if (req.method === 'POST' && url === '/webui/restart') {
    if (!requireAuth(req)) return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
    const result = launchWebUiRecovery('restart');
    return sendJson(res, result.ok ? 202 : 500, result);
  }

  if (req.method === 'POST' && url === '/webui/recover') {
    if (!requireAuth(req)) return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
    const result = launchWebUiRecovery('recover');
    return sendJson(res, result.ok ? 202 : 500, result);
  }

  if (req.method === 'POST' && url === '/webui/app-server/ensure') {
    if (!requireAuth(req)) return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
    readJsonBody(req)
      .then(async (body) => {
        const backend = await codexService.ensureBackendReady();
        const interrupted = body?.recoverInterrupted === false
          ? { ok: true, skipped: true, reason: 'disabled by request' }
          : await codexService.recoverInterruptedTurnIfNeeded();
        broadcastStatus();
        sendJson(res, 200, { ok: true, backend, interrupted });
      })
      .catch((error) => sendJson(res, 500, { ok: false, error: actionError(error) }));
    return;
  }

  if (req.method === 'POST' && url === '/webui/interrupted/recover') {
    if (!requireAuth(req)) return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
    codexService.recoverInterruptedTurnIfNeeded()
      .then((result) => {
        broadcastStatus();
        sendJson(res, result.ok === false ? 409 : 200, result);
      })
      .catch((error) => sendJson(res, 500, { ok: false, error: actionError(error) }));
    return;
  }

  if (req.method === 'POST' && url === '/new-chat') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    codexService.clearQueuedInputs();
    codexService.restart(null, () => {
      broadcastStatus();
      setCORS(res);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, resume_path: null, workdir: codexService.getWorkdir() }));
    });
    return;
  }

  if (req.method === 'POST' && url === '/cancel') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    codexService.clearQueuedInputs();
    codexService.cancelActiveTurn(() => {
      broadcastStatus();
      setCORS(res);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }

  if (req.method === 'POST' && url === '/thread/compact') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    sendActionResult(res, codexService.compactThread());
    return;
  }

  if (req.method === 'POST' && url === '/thread/fork') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    sendActionResult(res, codexService.forkThread());
    return;
  }

  if (req.method === 'POST' && url === '/thread/review') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    readJsonBody(req)
      .then((body) => codexService.reviewCurrentThread(String(body.argumentsText || '')))
      .then((result) => { broadcastStatus(); sendJson(res, 200, { ok: true, result: result || {} }); })
      .catch((error) => sendJson(res, actionError(error) === 'Bad JSON' ? 400 : 500, { ok: false, error: actionError(error) }));
    return;
  }

  if (req.method === 'GET' && url === '/thread/goal') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    sendActionResult(res, codexService.getThreadGoal(), false);
    return;
  }

  if (req.method === 'POST' && url === '/thread/goal') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    readJsonBody(req)
      .then((body) => codexService.setThreadGoal(String(body.argumentsText || '')))
      .then((result) => { broadcastStatus(); sendJson(res, 200, { ok: true, result: result || {} }); })
      .catch((error) => sendJson(res, actionError(error) === 'Bad JSON' ? 400 : 500, { ok: false, error: actionError(error) }));
    return;
  }

  if (req.method === 'DELETE' && url === '/thread/goal') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    sendActionResult(res, codexService.setThreadGoal('clear'));
    return;
  }

  if (req.method === 'POST' && url === '/thread/background-terminals/clean') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    sendActionResult(res, codexService.cleanBackgroundTerminals());
    return;
  }

  if (req.method === 'GET' && url === '/apps') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    sendActionResult(res, codexService.listApps(), false);
    return;
  }

  if (req.method === 'GET' && url === '/plugins') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    sendActionResult(res, codexService.listPlugins(), false);
    return;
  }

  if (req.method === 'POST' && url === '/plugins/install') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    readJsonBody(req)
      .then((body) => codexService.installPlugin(body))
      .then((data) => sendJson(res, 200, { ok: true, result: data || {} }))
      .catch((error) => sendJson(res, actionError(error) === 'Bad JSON' ? 400 : 500, { ok: false, error: actionError(error) }));
    return;
  }

  if (req.method === 'POST' && url === '/plugins/uninstall') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    readJsonBody(req)
      .then((body) => codexService.uninstallPlugin(String(body.pluginId || '')))
      .then((data) => sendJson(res, 200, { ok: true, result: data || {} }))
      .catch((error) => sendJson(res, actionError(error) === 'Bad JSON' ? 400 : 500, { ok: false, error: actionError(error) }));
    return;
  }

  if (req.method === 'POST' && url === '/plugins/toggle') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    readJsonBody(req)
      .then((body) => codexService.setMarketplacePluginEnabled(String(body.pluginId || ''), body.enabled === true))
      .then((data) => sendJson(res, 200, { ok: true, result: data || {} }))
      .catch((error) => sendJson(res, actionError(error) === 'Bad JSON' ? 400 : 500, { ok: false, error: actionError(error) }));
    return;
  }

  if (req.method === 'POST' && url === '/apps/toggle') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    readJsonBody(req)
      .then((body) => codexService.setAppEnabled(String(body.appId || ''), body.enabled === true))
      .then((data) => sendJson(res, 200, { ok: true, result: data || {} }))
      .catch((error) => sendJson(res, actionError(error) === 'Bad JSON' ? 400 : 500, { ok: false, error: actionError(error) }));
    return;
  }

  if (req.method === 'GET' && url === '/realtime/voices') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    sendActionResult(res, codexService.listRealtimeVoices(), false);
    return;
  }

  if (req.method === 'POST' && url === '/account/login/start') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    sendActionResult(res, codexService.startAccountLogin());
    return;
  }

  if (req.method === 'POST' && url === '/account/logout') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    sendActionResult(res, codexService.logoutAccount());
    return;
  }

  if (req.method === 'GET' && url === '/account/status') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    sendActionResult(res, codexService.readAccountStatus(), false);
    return;
  }

  if (req.method === 'POST' && url === '/windows-sandbox/setup-default') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    sendActionResult(res, codexService.startWindowsSandboxSetup());
    return;
  }

  if (req.method === 'POST' && url === '/project/init-agents') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    try {
      const result = createAgentsFile(codexService.getWorkdir());
      sendJson(res, 200, { ok: true, result });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: actionError(error) });
    }
    return;
  }

  if (req.method === 'GET' && url === '/sessions') {
    const h = readHistory();
    const archived = archivedSessionPathSet(h);
    const pinned = pinnedSessionPathSet(h);
    const roots = validHistoryRoots(h);
    const currentRoot = projectRootForWorkdir(codexService.getWorkdir(), roots);
    const list = scanSessions()
      .filter((session) => !archived.has(pathIdentity(session.path)))
      .map((session) => {
        const effectiveCwd = effectiveSessionWorkdir(h, session);
        const moved = effectiveCwd && session.cwd && pathIdentity(effectiveCwd) !== pathIdentity(session.cwd);
        return {
          ...session,
          cwd: effectiveCwd || session.cwd,
          originalCwd: moved ? session.cwd : undefined,
          projectRoot: projectRootForWorkdir(effectiveCwd || session.cwd, roots),
          pinned: pinned.has(pathIdentity(session.path))
        };
      });
    const lastPathRaw = codexService.getDisplayResumePath();
    const lastPath = lastPathRaw && !archived.has(pathIdentity(lastPathRaw)) ? lastPathRaw : null;
    setCORS(res);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ sessions: list, current: lastPath, workdir: codexService.getWorkdir(), currentRoot }));
  }

  if (req.method === 'GET' && url === '/session-messages') {
    const requestedPath = parsedUrl.searchParams.get('path');
    let sessionPath = requestedPath || codexService.getDisplayResumePath();
    if (requestedPath) {
      const abs = path.resolve(requestedPath);
      if (!isWithinSessions(abs) || !/rollout-.*\.jsonl$/.test(abs)) {
        setCORS(res);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, error: 'Invalid session path' }));
      }
      sessionPath = abs;
    }
    const page = parseSessionMessagesPage(sessionPath, {
      limit: Number(parsedUrl.searchParams.get('limit') || 0),
      before: parsedUrl.searchParams.has('before') ? Number(parsedUrl.searchParams.get('before')) : null
    });
    setCORS(res);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ...page, current: sessionPath }));
  }

  if (req.method === 'POST' && url === '/resume') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      let resumePath: string | null = null;
      let requestedWorkdir: string | null = null;
      try {
        const parsed = JSON.parse(body || '{}');
        resumePath = parsed && (parsed.path || parsed.resume_path) || null;
        requestedWorkdir = resolveProjectPath(parsed.workdir);
      } catch {
        const s = String(body || '').trim();
        if (s && s !== '{}' && s !== 'null') resumePath = s;
      }
      if (resumePath) {
        const abs = path.resolve(resumePath);
        if (!isWithinSessions(abs) || !/rollout-.*\.jsonl$/.test(abs)) {
          setCORS(res); res.writeHead(400, { 'Content-Type':'application/json' });
          return res.end(JSON.stringify({ ok:false, error:'Invalid resume path' }));
        }
        if (!fs.existsSync(abs)) {
          const h = readHistory();
          const missingKey = pathIdentity(abs);
          h.entries = (h.entries || []).filter(e => !e.resume_path || pathIdentity(e.resume_path) !== missingKey);
          writeHistory(h);
          return sendJson(res, 404, { ok: false, error: 'Resume path not found', resume_path: null, removed: true });
        }
        resumePath = abs;
      }
      const resumeWorkdir = requestedWorkdir || historyWorkdirForResumePath(resumePath);
      if (resumeWorkdir) codexService.setWorkdir(resumeWorkdir);
      codexService.restart(resumePath, () => {
        broadcastStatus();
        setCORS(res);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, resume_path: codexService.getDisplayResumePath(), workdir: codexService.getWorkdir() }));
      });
    });
    return;
  }

  if (req.method === 'GET' && url === '/projects') {
    const h = readHistory();
    const archived = archivedSessionPathSet(h);
    const roots = validHistoryRoots(h);
    const groups: Record<string, ProjectGroupEntry[]> = {};
    const seen = new Map<string, Set<string>>();
    const currentRoot = projectRootForWorkdir(codexService.getWorkdir(), roots);
    ensureProjectGroup(groups, currentRoot);
    for (const root of roots) {
      ensureProjectGroup(groups, root.path);
    }
    for (const e of h.entries || []) {
      if (!e || typeof e.workdir !== 'string' || !e.workdir) continue;
      if (e.resume_path && archived.has(pathIdentity(e.resume_path))) continue;
      if (e.resume_path && !fs.existsSync(e.resume_path)) continue;
      const projectRoot = projectListRootForWorkdir(e.workdir, roots, currentRoot);
      if (!projectRoot) continue;
      pushProjectGroupEntry(groups, seen, projectRoot, {
        resume_path: e.resume_path,
        workdir: e.workdir,
        last_used: Number(e.last_used || 0)
      });
    }
    for (const session of scanSessions()) {
      const effectiveCwd = effectiveSessionWorkdir(h, session);
      if (!effectiveCwd || archived.has(pathIdentity(session.path))) continue;
      const projectRoot = projectListRootForWorkdir(effectiveCwd, roots, currentRoot);
      if (!projectRoot) continue;
      pushProjectGroupEntry(groups, seen, projectRoot, {
        resume_path: session.path,
        workdir: effectiveCwd,
        last_used: Number(session.mtimeMs || 0)
      });
    }
    Object.values(groups).forEach(arr => arr.sort((a, b) => (b.last_used || 0) - (a.last_used || 0)));
    setCORS(res);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ groups, current: codexService.getWorkdir(), currentRoot, roots, selectedRootId: h.selectedRootId || projectRootId(currentRoot) }));
  }

  if (req.method === 'DELETE' && url === '/project/root') {
    if (!requireAuth(req)) return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
    readJsonBody(req)
      .then((body) => {
        const requested = body && (body.path || body.workdir);
        if (!requested || typeof requested !== 'string') return sendJson(res, 400, { ok: false, error: 'Missing project path' });
        const h = readHistory();
        const removed = removeProjectRoot(h, requested);
        writeHistory(h);
        const roots = validHistoryRoots(h);
        return sendJson(res, 200, { ok: true, removed: Boolean(removed), root: removed, roots, selectedRootId: h.selectedRootId || roots[0]?.id || '' });
      })
      .catch((error) => sendJson(res, actionError(error) === 'Bad JSON' ? 400 : 500, { ok: false, error: actionError(error) }));
    return;
  }

  if (req.method === 'POST' && url === '/project/create') {
    if (!requireAuth(req)) return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
    readJsonBody(req)
      .then((body) => {
        const parent = resolveProjectPath(body?.parentPath || body?.parent || codexService.getWorkdir());
        if (!parent) return sendJson(res, 400, { ok: false, error: 'Parent path must be an existing local folder' });
        const name = normalizeProjectFolderName(body?.name);
        const projectPath = childProjectPath(parent, name);
        if (fs.existsSync(projectPath)) return sendJson(res, 409, { ok: false, error: 'Project folder already exists' });
        fs.mkdirSync(projectPath);
        const root = rememberProjectRoot(projectPath);
        codexService.switchProject(projectPath, () => {
          broadcastStatus();
          sendJson(res, 200, { ok: true, path: projectPath, workdir: codexService.getWorkdir(), root, resume_path: null });
        });
      })
      .catch((error) => {
        const message = actionError(error);
        sendJson(res, message.includes('Invalid') || message.includes('required') ? 400 : 500, { ok: false, error: message });
      });
    return;
  }

  if (req.method === 'POST' && url === '/project/rename') {
    if (!requireAuth(req)) return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
    readJsonBody(req)
      .then((body) => {
        const oldPath = resolveProjectPath(body?.path || body?.workdir);
        if (!oldPath) return sendJson(res, 400, { ok: false, error: 'Path must be an existing local folder' });
        const name = normalizeProjectFolderName(body?.name || body?.newName);
        const nextPath = childProjectPath(path.dirname(oldPath), name);
        if (pathIdentity(oldPath) !== pathIdentity(nextPath) && fs.existsSync(nextPath)) {
          return sendJson(res, 409, { ok: false, error: 'Project folder already exists' });
        }
        if (pathIdentity(oldPath) !== pathIdentity(nextPath)) fs.renameSync(oldPath, nextPath);
        const history = readHistory();
        const root = rewriteProjectRootPath(history, oldPath, nextPath);
        writeHistory(history);
        const current = codexService.getWorkdir();
        if (isWithinProjectRoot(current, oldPath)) {
          const nextWorkdir = rebasePathInsideRoot(current, oldPath, nextPath);
          codexService.switchProject(nextWorkdir, () => {
            broadcastStatus();
            sendJson(res, 200, { ok: true, path: nextPath, workdir: codexService.getWorkdir(), root, resume_path: null });
          });
          return;
        }
        sendJson(res, 200, { ok: true, path: nextPath, workdir: nextPath, root, resume_path: null });
      })
      .catch((error) => {
        const message = actionError(error);
        sendJson(res, message.includes('already exists') ? 409 : message.includes('Invalid') || message.includes('required') ? 400 : 500, { ok: false, error: message });
      });
    return;
  }

  if (req.method === 'GET' && url === '/filesystem/list') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    const requestedPath = parsedUrl.searchParams.get('path') || codexService.getWorkdir() || process.cwd();
    const directory = resolveProjectPath(requestedPath);
    if (!directory) {
      setCORS(res);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, error: 'Path must be an existing local folder' }));
    }
    try {
      const entries = readDirectoryEntries(directory);
      setCORS(res);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        ok: true,
        path: directory,
        parent: parentDirectory(directory),
        roots: collectProjectBrowserRoots(directory),
        entries
      }));
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      setCORS(res);
      res.writeHead(code === 'EACCES' || code === 'EPERM' ? 403 : 500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e), path: directory }));
    }
  }

  if (req.method === 'POST' && url === '/project/open') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const parsed = JSON.parse(body || '{}');
        const projectPath = resolveProjectPath(parsed.path);
        if (!projectPath) {
          setCORS(res);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ ok: false, error: 'Path must be an existing local folder' }));
        }
        const root = rememberProjectRoot(projectPath);
        codexService.switchProject(projectPath, () => {
          broadcastStatus();
          setCORS(res);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, path: projectPath, workdir: codexService.getWorkdir(), root, resume_path: null }));
        });
      } catch (e) {
        setCORS(res);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }));
      }
    });
    return;
  }

  if (req.method === 'POST' && url === '/project/pick') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    if (!isLocalHost(requestHost(req))) {
      setCORS(res);
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, error: 'Native folder picker is only available from localhost' }));
    }
    pickProjectDirectory().then((pickedPath) => {
      setCORS(res);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, path: pickedPath }));
    }).catch((e) => {
      setCORS(res);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }));
    });
    return;
  }

  if (req.method === 'POST' && url === '/path/open') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const parsed = JSON.parse(body || '{}');
        const target = resolveOpenTarget(parsed.path);
        if (!target) {
          setCORS(res);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ ok: false, error: 'Path must be an existing absolute file or folder' }));
        }
        await openLocalPath(target.path, target.kind);
        setCORS(res);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, path: target.path, kind: target.kind }));
      } catch (e) {
        setCORS(res);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }));
      }
    });
    return;
  }

  if (req.method === 'POST' && url === '/shutdown') {
    if (!requireAuth(req)) { setCORS(res); res.writeHead(401); return res.end(); }
    codexCliUpdater?.stop();
    codexService.stop();
    setCORS(res);
    res.writeHead(200); res.end('OK');
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, HOST, () => {
  codexCliUpdater = startCodexCliUpdater((payload) => broadcast('notification', payload));
  if (AUTO_RECOVER_INTERRUPTED_TURNS) {
    setTimeout(() => {
      codexService.recoverInterruptedTurnIfNeeded()
        .then((result) => {
          if (!result?.skipped) {
            broadcast('system', { text: result?.ok === false ? `自动恢复检查未完成：${result.reason || 'unknown'}` : '自动恢复检查完成。' });
            broadcastStatus();
          }
        })
        .catch((error) => broadcast('stderr', { text: `自动恢复检查失败：${actionError(error)}` }));
    }, 1500);
  }
  const network = runtimeNetworkInfo();
  console.log(`Codex WebUI listening on ${HOST}:${PORT}`);
  console.log(`Codex WebUI local: ${network.localUrl}`);
  if (network.lanUrl) {
    console.log(`Codex WebUI phone LAN: ${network.lanUrl}`);
    if (network.lanUrls.length > 1) console.log(`Codex WebUI LAN candidates: ${network.lanUrls.join(', ')}`);
  } else {
    console.log('Codex WebUI phone LAN: no non-internal IPv4 address detected');
  }
});
