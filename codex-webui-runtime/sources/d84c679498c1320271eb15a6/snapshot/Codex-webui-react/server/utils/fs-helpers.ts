import fs from 'fs';
import * as path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { SessionEntry, History, Message } from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const HISTORY_FILE = process.env.CODEX_WEBUI_HISTORY_FILE
  ? path.resolve(process.env.CODEX_WEBUI_HISTORY_FILE)
  : path.resolve(__dirname, '../../history.json');
const SESS_ROOT = path.join(os.homedir(), '.codex', 'sessions');
const DEFAULT_SESSION_MESSAGE_LIMIT = 120;
const SESSION_TITLE_MAX_CHARS = 30;
const sessionSummaryCache = new Map<string, { mtimeMs: number; size: number; summary: Pick<SessionEntry, 'title' | 'cwd' | 'messageCount'> }>();
const sessionMessagesCache = new Map<string, { mtimeMs: number; size: number; messages: Message[] }>();

export interface SessionMessagesPage {
  messages: Message[];
  total: number;
  start: number;
  end: number;
  limit: number;
  hasMoreOlder: boolean;
  hasMoreNewer: boolean;
  nextBefore: number | null;
}

export interface SessionMessagePageOptions {
  limit?: number;
  before?: number | null;
}

function comparablePath(p: string): string {
  const normalized = process.platform === 'win32' ? p.replace(/^\\\\\?\\/, '') : p;
  const resolved = path.resolve(normalized);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

export const isWithinSessions = (p: string): boolean => p ? comparablePath(p).startsWith(comparablePath(SESS_ROOT)) : false;

function normalizeText(value: unknown): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function titleCharLength(value: string): number {
  return [...value].length;
}

function trimTitleChars(value: string, max = SESSION_TITLE_MAX_CHARS): string {
  const chars = [...String(value || '').trim()];
  if (chars.length <= max) return chars.join('');
  return `${chars.slice(0, Math.max(0, max - 1)).join('').trim()}…`;
}

function joinTitleClauses(parts: string[]): string {
  return parts.reduce((out, part) => {
    if (!out) return part;
    return /[A-Za-z0-9]$/.test(out) && /^[A-Za-z0-9]/.test(part) ? `${out} ${part}` : `${out}${part}`;
  }, '');
}

function stripInternalMessageBlocks(value: unknown): string {
  return String(value || '')
    .replace(/<memory\b[^>]*>[\s\S]*?(?:<\/memory>|$)/gi, '')
    .replace(/<oai-mem-citation\b[^>]*>[\s\S]*?(?:<\/oai-mem-citation>|$)/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function contentText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.map((item: any) => {
    if (!item) return '';
    if (typeof item === 'string') return item;
    if (typeof item.text === 'string') return item.text;
    if (typeof item.message === 'string') return item.message;
    if (Array.isArray(item.content)) return contentText(item.content);
    return '';
  }).filter(Boolean).join('\n');
}

function payloadText(payload: any): string {
  if (!payload) return '';
  if (typeof payload.message === 'string') return payload.message;
  if (typeof payload.text === 'string') return payload.text;
  return contentText(payload.content);
}

function timestampMs(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 10_000_000_000 ? Math.trunc(value) : Math.trunc(value * 1000);
  }
  if (typeof value !== 'string' || !value.trim()) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function objectTimeMs(obj: any, payload: any = {}): number {
  return timestampMs(obj?.timestamp)
    || timestampMs(obj?.time)
    || timestampMs(obj?.ts)
    || timestampMs(obj?.created_at)
    || timestampMs(obj?.createdAt)
    || timestampMs(payload?.timestamp)
    || timestampMs(payload?.time)
    || timestampMs(payload?.created_at)
    || timestampMs(payload?.createdAt);
}

function turnTiming(startMs: number, completedMs: number): Partial<Message> {
  const completedAt = completedMs ? new Date(completedMs).toISOString() : undefined;
  const startedAt = startMs ? new Date(startMs).toISOString() : undefined;
  const durationMs = startMs && completedMs ? Math.max(0, completedMs - startMs) : undefined;
  return { startedAt, completedAt, durationMs };
}

type AssistantTimingCandidate = {
  index: number;
  turnId: string;
  startMs: number;
  completedMs: number;
};

function recordAssistantTimingCandidate(candidates: AssistantTimingCandidate[], list: Message[], previousLength: number, turnId: string, startMs: number, completedMs: number): void {
  if (list.length <= previousLength || !turnId || !completedMs) return;
  candidates.push({ index: list.length - 1, turnId, startMs, completedMs });
}

function attachFinalAssistantTiming(list: Message[], candidates: AssistantTimingCandidate[]): void {
  const latestByTurn = new Map<string, AssistantTimingCandidate>();
  for (const candidate of candidates) latestByTurn.set(candidate.turnId, candidate);
  for (const candidate of latestByTurn.values()) {
    const message = list[candidate.index];
    if (!message || message.role !== 'assistant') continue;
    Object.assign(message, turnTiming(candidate.startMs, candidate.completedMs));
  }
}

function summaryMessageText(value: unknown): string {
  const text = normalizeText(stripInternalMessageBlocks(value));
  if (!text) return '';
  if (text.startsWith('<permissions instructions>')) return '';
  if (text.startsWith('# AGENTS.md instructions')) return '';
  if (text.startsWith('<skills_instructions>')) return '';
  return text;
}

export function summarizeSessionTitle(value: unknown, max = SESSION_TITLE_MAX_CHARS): string {
  let text = summaryMessageText(value)
    .replace(/```[\s\S]*?```/g, '代码')
    .replace(/`([^`]{1,120})`/g, '$1')
    .replace(/\[[^\]]{1,80}\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/gi, '链接')
    .replace(/^[-*#>\s]+/g, '')
    .replace(/^(我希望|希望|我想|想要|请你?|麻烦|帮我|帮忙|需要|能不能|可以|把|将|让)\s*/i, '')
    .replace(/^(每个|所有|现有的?)\s*/, '')
    .replace(/生成的标题是/g, '标题')
    .replace(/自动提取核心内容并精简控制在最大显示范围内/g, '自动提取并精简')
    .replace(/鼠标放在([^，,。.!?；;]{1,18})处会自动隐藏/g, '$1隐藏')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';
  const primary = text.split(/\n{2,}/)[0] || text;
  const sentence = (primary.split(/[。！？!?]/).find(Boolean) || primary).trim();
  const clauses = sentence
    .split(/[，,；;]/)
    .map((part) => part.trim().replace(/^(并且|然后|同时|以及|还有)\s*/, ''))
    .filter(Boolean);
  if (!clauses.length) return trimTitleChars(sentence, max);
  let title = '';
  for (const part of clauses) {
    const next = joinTitleClauses([title, part]);
    if (title && titleCharLength(next) > max) break;
    title = next;
    if (titleCharLength(title) >= Math.floor(max * 0.72)) break;
  }
  if (!title) title = clauses[0] || sentence;
  return trimTitleChars(title, max);
}

function pushMessage(out: Message[], role: string, text: unknown, extra: Partial<Message> = {}): void {
  const normalized = stripInternalMessageBlocks(text);
  if (!normalized) return;
  const prev = out[out.length - 1];
  if (prev && prev.role === role && prev.text === normalized && prev.kind === extra.kind && (!prev.turnId || !extra.turnId || prev.turnId === extra.turnId)) return;
  out.push({ role, text: normalized, ...extra });
}

function stringifyDetail(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

function responseItemTimelineMessage(payload: any): Message | null {
  if (!payload || typeof payload.type !== 'string') return null;
  if (payload.type === 'reasoning') {
    const summary = contentText(payload.summary);
    if (!summary) return null;
    return { role: 'assistant', kind: 'reasoning', title: 'Reasoning', text: summary, detail: summary };
  }
  if (payload.type === 'function_call') {
    return { role: 'tool', kind: 'functionCall', title: `Function call · ${payload.name || payload.call_id || 'tool'}`, text: payload.arguments || payload.name || 'function_call', detail: stringifyDetail(payload.arguments), metadata: { call_id: payload.call_id } };
  }
  if (payload.type === 'custom_tool_call') {
    return { role: 'tool', kind: 'dynamicToolCall', title: `Custom tool · ${payload.name || payload.call_id || 'tool'}`, text: payload.input || payload.name || 'custom_tool_call', detail: stringifyDetail(payload.input), metadata: { call_id: payload.call_id } };
  }
  if (payload.type === 'web_search_call') {
    return { role: 'tool', kind: 'webSearch', title: 'Web search', text: stringifyDetail(payload.action || payload.query || payload), detail: stringifyDetail(payload.action || payload.query || payload) };
  }
  return null;
}

function protoTimelineMessage(item: any): Message | null {
  if (!item || typeof item.type !== 'string') return null;
  if (item.type === 'commandExecution') {
    return { role: 'tool', kind: 'commandExecution', title: item.command || 'Command', text: item.command || 'command', detail: stringifyDetail(item.output || item.result || item), status: item.status, metadata: { cwd: item.cwd, exitCode: item.exitCode } };
  }
  if (item.type === 'fileChange') {
    return { role: 'tool', kind: 'fileChange', title: 'File change', text: stringifyDetail(item.changes || item.path || item), detail: stringifyDetail(item.changes || item), status: item.status };
  }
  if (item.type === 'mcpToolCall') {
    return { role: 'tool', kind: 'mcpToolCall', title: `${item.server || 'MCP'} · ${item.tool || 'tool'}`, text: item.tool || 'mcpToolCall', detail: stringifyDetail(item.arguments || item.result || item.error), status: item.status };
  }
  if (item.type === 'dynamicToolCall') {
    return { role: 'tool', kind: 'dynamicToolCall', title: item.tool || 'Dynamic tool', text: item.tool || 'dynamicToolCall', detail: stringifyDetail(item.arguments || item.contentItems || item.error), status: item.status };
  }
  if (item.type === 'webSearch') {
    return { role: 'tool', kind: 'webSearch', title: 'Web search', text: item.query || stringifyDetail(item.action), detail: stringifyDetail(item.action || item.query) };
  }
  if (item.type === 'plan') {
    return { role: 'assistant', kind: 'plan', title: 'Plan', text: item.text || stringifyDetail(item.plan), detail: item.text || stringifyDetail(item.plan), status: item.status };
  }
  if (item.type === 'reasoning') {
    const summary = Array.isArray(item.summary) ? item.summary.join('\n') : stringifyDetail(item.summary || item.content);
    return summary ? { role: 'assistant', kind: 'reasoning', title: 'Reasoning', text: summary, detail: summary } : null;
  }
  return null;
}

function objectTurnId(obj: any, payload: any, currentTurnId = ''): string {
  const passthrough = payload?.internal_chat_message_metadata_passthrough || obj?.internal_chat_message_metadata_passthrough || {};
  return String(payload?.turn_id || payload?.turnId || obj?.turn_id || obj?.turnId || passthrough?.turn_id || passthrough?.turnId || currentTurnId || '').trim();
}

function objectMessageId(obj: any, payload: any): string {
  return String(payload?.id || obj?.id || '').trim();
}

function readSessionSummary(filePath: string): Pick<SessionEntry, 'title' | 'cwd' | 'messageCount'> {
  let title = '';
  let cwd = '';
  let messageCount = 0;
  const seenMessages = new Set<string>();
  const addSummaryMessage = (role: string, textValue: unknown): void => {
    const text = summaryMessageText(textValue);
    if (!text) return;
    const key = `${role}\u0000${text}`;
    if (seenMessages.has(key)) return;
    seenMessages.add(key);
    messageCount++;
    if (!title && role === 'user') title = summarizeSessionTitle(text);
  };
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw.split(/\r?\n/);
    for (const line of lines) {
      const s = line.trim();
      if (!s) continue;
      let obj: any;
      try { obj = JSON.parse(s); } catch { continue; }
      if (obj.type === 'session_meta' && obj.payload && typeof obj.payload.cwd === 'string') {
        cwd = obj.payload.cwd;
      }
      const payload = obj.payload || {};
      if (obj.type === 'event_msg' && (payload.type === 'user_message' || payload.type === 'agent_message')) {
        addSummaryMessage(payload.type === 'user_message' ? 'user' : 'assistant', payloadText(payload));
      }
      if (obj.type === 'response_item' && payload.type === 'message' && (payload.role === 'user' || payload.role === 'assistant')) {
        addSummaryMessage(payload.role, payloadText(payload));
      }
      const msg = obj.msg || {};
      if (msg.type === 'user_input' || msg.type === 'agent_message') {
        addSummaryMessage(msg.type === 'user_input' ? 'user' : 'assistant', msg.text || msg.message || contentText(msg.items));
      }
    }
  } catch {}
  return { title, cwd, messageCount };
}

export function clearSessionSummaryCache(): void {
  sessionSummaryCache.clear();
}

function getSessionSummary(filePath: string, stat: fs.Stats): Pick<SessionEntry, 'title' | 'cwd' | 'messageCount'> {
  const cached = sessionSummaryCache.get(filePath);
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) return cached.summary;
  const summary = readSessionSummary(filePath);
  sessionSummaryCache.set(filePath, { mtimeMs: stat.mtimeMs, size: stat.size, summary });
  return summary;
}

export function scanSessions(): SessionEntry[] {
  const root = SESS_ROOT;
  const out: SessionEntry[] = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    if (!dir) continue;
    let entries: fs.Dirent[] = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) { stack.push(full); continue; }
      if (/^rollout-.*\.jsonl$/.test(ent.name)) {
        let stat: fs.Stats | undefined;
        try { stat = fs.statSync(full); } catch { continue; }
        if (stat) out.push({ path: full, name: ent.name, mtimeMs: stat.mtimeMs, size: stat.size, ...getSessionSummary(full, stat) });
      }
    }
  }
  out.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return out;
}

export function readHistory(): History {
  try {
    return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
  } catch { return { entries: [] }; }
}

export function writeHistory(h: History): void {
  try { fs.writeFileSync(HISTORY_FILE, JSON.stringify(h, null, 2)); } catch {}
}

function readSessionMessagesUncached(filePath: string): Message[] {
  const out: Message[] = [];
  const fallback: Message[] = [];
  let currentTurnId = '';
  const turnStartedAt = new Map<string, number>();
  const outAssistantTiming: AssistantTimingCandidate[] = [];
  const fallbackAssistantTiming: AssistantTimingCandidate[] = [];
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw.split(/\r?\n/);
    for (const line of lines) {
      const s = line.trim(); if (!s) continue;
      let obj: any; try { obj = JSON.parse(s); } catch { continue; }
      const payload = obj.payload || {};
      const eventMs = objectTimeMs(obj, payload);
      if (obj.type === 'event_msg' && payload.type === 'task_started' && payload.turn_id) {
        currentTurnId = String(payload.turn_id);
        if (eventMs) turnStartedAt.set(currentTurnId, eventMs);
      }
      const turnId = objectTurnId(obj, payload, currentTurnId);
      const id = objectMessageId(obj, payload);
      if (obj.type === 'event_msg') {
        if (payload.type === 'user_message') {
          if (turnId && eventMs && !turnStartedAt.has(turnId)) turnStartedAt.set(turnId, eventMs);
          pushMessage(out, 'user', payloadText(payload), { id, turnId, startedAt: eventMs ? new Date(eventMs).toISOString() : undefined });
        }
        if (payload.type === 'agent_message') {
          const previousLength = out.length;
          pushMessage(out, 'assistant', payloadText(payload), { id, turnId });
          recordAssistantTimingCandidate(outAssistantTiming, out, previousLength, turnId, turnStartedAt.get(turnId) || 0, eventMs);
        }
      }
      if (obj.type === 'message' && obj.role && obj.content && Array.isArray(obj.content)) {
        if (obj.role === 'user' && turnId && eventMs && !turnStartedAt.has(turnId)) turnStartedAt.set(turnId, eventMs);
        const previousLength = fallback.length;
        pushMessage(fallback, obj.role, contentText(obj.content), {
          id,
          turnId,
          ...(obj.role === 'assistant' ? {} : { startedAt: eventMs ? new Date(eventMs).toISOString() : undefined })
        });
        if (obj.role === 'assistant') recordAssistantTimingCandidate(fallbackAssistantTiming, fallback, previousLength, turnId, turnStartedAt.get(turnId) || 0, eventMs);
      }
      if (obj.type === 'response_item' && payload.type === 'message' && (payload.role === 'user' || payload.role === 'assistant')) {
        const text = payloadText(payload);
        const normalized = normalizeText(text);
        if (normalized && !normalized.startsWith('<permissions instructions>') && !normalized.startsWith('# AGENTS.md instructions')) {
          if (payload.role === 'user' && turnId && eventMs && !turnStartedAt.has(turnId)) turnStartedAt.set(turnId, eventMs);
          const previousLength = fallback.length;
          pushMessage(fallback, payload.role, text, {
            id,
            turnId,
            ...(payload.role === 'assistant' ? {} : { startedAt: eventMs ? new Date(eventMs).toISOString() : undefined })
          });
          if (payload.role === 'assistant') recordAssistantTimingCandidate(fallbackAssistantTiming, fallback, previousLength, turnId, turnStartedAt.get(turnId) || 0, eventMs);
        }
      }
      if (obj.type === 'response_item') {
        const timeline = responseItemTimelineMessage(payload);
        if (timeline) fallback.push(timeline);
      }
      // Fallback: proto event styles
      const msg = obj && obj.msg;
      if (msg && (msg.type === 'user_input' || msg.type === 'agent_message')) {
        const msgTurnId = objectTurnId(obj, msg, currentTurnId);
        const msgMs = objectTimeMs(obj, msg) || eventMs;
        if (msg.type === 'user_input') {
          if (msgTurnId && msgMs && !turnStartedAt.has(msgTurnId)) turnStartedAt.set(msgTurnId, msgMs);
          pushMessage(out, 'user', msg.text || contentText(msg.items), { turnId: msgTurnId, startedAt: msgMs ? new Date(msgMs).toISOString() : undefined });
        }
        if (msg.type === 'agent_message') {
          const previousLength = out.length;
          pushMessage(out, 'assistant', msg.message, { turnId: msgTurnId });
          recordAssistantTimingCandidate(outAssistantTiming, out, previousLength, msgTurnId, turnStartedAt.get(msgTurnId) || 0, msgMs);
        }
      }
      if (obj.type === 'event_msg' && payload.type && !['user_message', 'agent_message', 'token_count'].includes(payload.type)) {
        const timeline = protoTimelineMessage(payload.item || payload);
        if (timeline) out.push(timeline);
      }
      if (msg) {
        const timeline = protoTimelineMessage(msg.item || msg);
        if (timeline) out.push(timeline);
      }
    }
  } catch {}
  attachFinalAssistantTiming(out, outAssistantTiming);
  attachFinalAssistantTiming(fallback, fallbackAssistantTiming);
  return out.length ? out : fallback;
}

function cacheSessionMessages(filePath: string, stat: fs.Stats, messages: Message[]): Message[] {
  if (sessionMessagesCache.size > 128) {
    const oldest = sessionMessagesCache.keys().next().value;
    if (oldest) sessionMessagesCache.delete(oldest);
  }
  sessionMessagesCache.set(filePath, { mtimeMs: stat.mtimeMs, size: stat.size, messages });
  return messages;
}

function sessionMessagesFor(filePath: string | null): Message[] {
  try {
    if (!filePath) return [];
    const abs = path.resolve(filePath);
    const stat = fs.statSync(abs);
    const cached = sessionMessagesCache.get(abs);
    if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) return cached.messages;
    return cacheSessionMessages(abs, stat, readSessionMessagesUncached(abs));
  } catch {
    return [];
  }
}

function clampSessionMessageLimit(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_SESSION_MESSAGE_LIMIT;
  return Math.max(20, Math.min(500, Math.floor(parsed)));
}

export function parseSessionMessages(filePath: string | null): Message[] {
  return sessionMessagesFor(filePath).slice();
}

export function parseSessionMessagesPage(filePath: string | null, options: SessionMessagePageOptions = {}): SessionMessagesPage {
  const all = sessionMessagesFor(filePath);
  const total = all.length;
  const limit = clampSessionMessageLimit(options.limit);
  const rawBefore = Number(options.before);
  const hasBefore = options.before !== null && options.before !== undefined && Number.isFinite(rawBefore) && rawBefore >= 0;
  const end = hasBefore
    ? Math.max(0, Math.min(total, Math.floor(rawBefore)))
    : total;
  const start = Math.max(0, end - limit);
  return {
    messages: all.slice(start, end),
    total,
    start,
    end,
    limit,
    hasMoreOlder: start > 0,
    hasMoreNewer: end < total,
    nextBefore: start > 0 ? start : null
  };
}

export function countSessionTurnsFrom(filePath: string | null, targetTurnId: string): number {
  const target = String(targetTurnId || '').trim();
  if (!target) throw new Error('Missing turn id');
  const turnIds: string[] = [];
  const seen = new Set<string>();
  const pushTurnId = (turnId: string): void => {
    const value = String(turnId || '').trim();
    if (!value || seen.has(value)) return;
    seen.add(value);
    turnIds.push(value);
  };
  try {
    if (!filePath || !fs.existsSync(filePath)) throw new Error('Missing session file');
    const raw = fs.readFileSync(filePath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const s = line.trim();
      if (!s) continue;
      let obj: any;
      try { obj = JSON.parse(s); } catch { continue; }
      const payload = obj.payload || {};
      if (obj.type === 'event_msg' && payload.type === 'task_started') pushTurnId(String(payload.turn_id || ''));
      const turnId = objectTurnId(obj, payload);
      if (turnId === target) pushTurnId(turnId);
    }
  } catch (error) {
    throw new Error(`Cannot read session turns: ${error instanceof Error ? error.message : String(error)}`);
  }
  const index = turnIds.indexOf(target);
  if (index < 0) throw new Error(`Cannot find turn id in session: ${target}`);
  return Math.max(1, turnIds.length - index);
}
