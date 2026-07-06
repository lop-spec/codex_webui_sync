import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { EventEmitter } from 'events';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { getConfigSafe } from '../utils/config.js';
import { readMemoryFacts, saveMemoryFactsFromText } from './memory.js';
import { countSessionTurnsFrom, readHistory, writeHistory } from '../utils/fs-helpers.js';
import { resolveCodexLaunch } from './codex-launch.js';
import { AppServerClient, DEFAULT_APP_SERVER_URL } from './app-server-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const APP_DIR = path.resolve(__dirname, '../..');
const DEFAULT_WORKDIR = process.env.CODEX_WORKDIR ? path.resolve(process.env.CODEX_WORKDIR) : APP_DIR;
const LOG_DIR = path.join(APP_DIR, 'logs');
const CODEX_LAUNCH = resolveCodexLaunch();
const BACKEND_MODE = String(process.env.CODEX_WEBUI_BACKEND || (process.env.CODEX_CMD ? 'exec' : 'app-server')).toLowerCase();
const APP_SERVER_URL = process.env.CODEX_APP_SERVER_URL || DEFAULT_APP_SERVER_URL;
const GUIDANCE_DEBOUNCE_MS = Math.max(0, Number(process.env.CODEX_GUIDANCE_DEBOUNCE_MS || 500));
const GUIDANCE_STEER_TIMEOUT_MS = Math.max(500, Number(process.env.CODEX_GUIDANCE_STEER_TIMEOUT_MS || 1500));

interface InputAttachment {
  kind: 'image';
  name: string;
  path: string;
  url?: string;
}

interface PendingInput {
  id: string;
  text: string;
  imagePaths: string[];
  attachments: InputAttachment[];
  collaborationPreset: 'default' | 'plan';
  serviceTier: string | null;
  createdAt: string;
}

type SendStatus = 'started' | 'queued' | 'steered' | 'guidance_pending';
type SendResult = { ok: true; status: SendStatus; id: string; turnId?: string | null };

interface UserInputOption {
  label: string;
  description: string;
}

interface UserInputQuestion {
  id: string;
  header: string;
  question: string;
  isOther: boolean;
  isSecret: boolean;
  options: UserInputOption[] | null;
}

interface PendingUserInputRequest {
  kind: 'userInput';
  requestId: string;
  rpcId: string | number;
  method: string;
  threadId: string | null;
  turnId: string | null;
  itemId: string | null;
  questions: UserInputQuestion[];
  createdAt: string;
}

interface InterruptedTurnState {
  threadId: string | null;
  turnId: string | null;
  resumePath: string | null;
  workdir: string;
  reason: string;
  savedAt: string;
}

function createChildLogStreams() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const header = `\n\n===== ${new Date().toISOString()} =====\n`;
  const stderr = fs.createWriteStream(path.join(LOG_DIR, 'codex-child.err.log'), { flags: 'a' });
  const stdout = fs.createWriteStream(path.join(LOG_DIR, 'codex-child.out.jsonl'), { flags: 'a' });
  stderr.write(header);
  stdout.write(header);
  return { stderr, stdout };
}

const NON_ACTIONABLE_STDERR_PATTERNS = [
  /codex_memories_write::phase2: Phase 2 no changes/i,
  /codex_models_manager::manager: failed to refresh available models: timeout waiting for child process to exit/i
];

function visibleStderrText(text: string): string {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !NON_ACTIONABLE_STDERR_PATTERNS.some((pattern) => pattern.test(line)))
    .join('\n');
}

function resumeAllowed(): boolean {
  return !['0', 'false', 'no', 'off'].includes(String(process.env.CODEX_RESUME || '1').toLowerCase());
}

function normalizeUserInputAnswers(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  const text = String(value || '').trim();
  return text ? [text] : [];
}

function normalizeUserInputQuestion(raw: any, index: number): UserInputQuestion | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || `question-${index + 1}`).trim();
  const header = String(raw.header || `Question ${index + 1}`).trim();
  const question = String(raw.question || raw.prompt || '').trim();
  if (!id || !question) return null;
  const rawOptions = Array.isArray(raw.options) ? raw.options : null;
  const options = rawOptions
    ? rawOptions.map((option: any) => ({
        label: String(option?.label || '').trim(),
        description: String(option?.description || '').trim()
      })).filter((option) => option.label)
    : null;
  return {
    id,
    header,
    question,
    isOther: raw.isOther === true,
    isSecret: raw.isSecret === true,
    options
  };
}

export class CodexService extends EventEmitter {
  private codexProc: ChildProcess | null = null;
  private appServer: AppServerClient | null = null;
  private appServerStarting: Promise<void> | null = null;
  private currentWorkdir = DEFAULT_WORKDIR;
  private lastResumePath: string | null = null;
  private queuedInputs: PendingInput[] = [];
  private pendingGuidanceInputs: PendingInput[] = [];
  private savedGuidanceInputs: PendingInput[] = [];
  private guidanceFlushTimer: NodeJS.Timeout | null = null;
  private guidanceFlushRunning = false;
  private pendingUserInputs = new Map<string, PendingUserInputRequest>();
  private activeThreadId: string | null = null;
  private activeTurnId: string | null = null;
  private activeThreadRunning = false;
  private activeStartedAtMs = 0;
  private lastAgentMessageByThread = new Map<string, string>();
  private suppressAutoResume = false;
  private suppressExecExitError = false;

  public getLastResumePath() {
    return this.lastResumePath;
  }

  public getWorkdir() {
    return this.currentWorkdir;
  }

  public getDisplayResumePath() {
    const current = this.isExistingResumePath(this.lastResumePath) ? this.lastResumePath : null;
    return current || (!this.suppressAutoResume && resumeAllowed() ? this.findDefaultResumePath() : null);
  }

  public isRunning() {
    return this.useAppServerBackend() ? Boolean(this.activeTurnId || this.activeThreadRunning) : this.codexProc !== null;
  }

  public getQueue() {
    return this.queuedInputs.map((item) => ({
      id: item.id,
      text: item.text,
      attachments: item.attachments.map(({ kind, name, url }) => ({ kind, name, url })),
      serviceTier: item.serviceTier,
      createdAt: item.createdAt
    }));
  }

  public getGuidance() {
    const items = [...this.pendingGuidanceInputs, ...this.savedGuidanceInputs];
    return {
      pending: this.pendingGuidanceInputs.length,
      saved: this.savedGuidanceInputs.length,
      count: items.length,
      items: items.map((item) => ({
        id: item.id,
        text: item.text,
        attachments: item.attachments.map(({ kind, name, url }) => ({ kind, name, url })),
        serviceTier: item.serviceTier,
        createdAt: item.createdAt
      }))
    };
  }

  public getPendingUserInputRequests(): PendingUserInputRequest[] {
    return [...this.pendingUserInputs.values()].map((request) => ({
      ...request,
      questions: request.questions.map((question) => ({
        ...question,
        options: question.options ? question.options.map((option) => ({ ...option })) : null
      }))
    }));
  }

  public getLatestPendingUserInput(): PendingUserInputRequest | null {
    const requests = this.getPendingUserInputRequests();
    return requests[requests.length - 1] || null;
  }

  public async ensureBackendReady(): Promise<any> {
    if (!this.useAppServerBackend()) {
      if (!this.codexProc) await this.startExecSession(this.lastResumePath);
      return { ok: true, backend: 'exec', running: this.codexProc !== null };
    }
    await this.ensureAppServer();
    return {
      ok: true,
      backend: 'app-server',
      endpoint: this.appServer?.endpoint() || APP_SERVER_URL,
      running: this.appServer?.isRunning() || false,
      threadId: this.activeThreadId,
      turnId: this.activeTurnId,
      active: this.activeThreadRunning
    };
  }

  public async recoverInterruptedTurnIfNeeded(): Promise<any> {
    if (!this.useAppServerBackend()) return { ok: true, skipped: true, reason: 'exec backend' };
    const state = this.readInterruptedTurnState();
    if (!state) return { ok: true, skipped: true, reason: 'no interrupted turn state' };
    await this.ensureAppServer();
    if (state.resumePath && this.isExistingResumePath(state.resumePath)) {
      await this.resumeAppThread(state.resumePath);
    } else if (state.threadId) {
      this.activeThreadId = state.threadId;
      this.activeTurnId = state.turnId;
      this.activeThreadRunning = Boolean(state.turnId);
      await this.recoverActiveTurnId();
    }
    const recovered = Boolean(this.activeThreadId && (this.activeTurnId || this.activeThreadRunning));
    if (!recovered) this.clearInterruptedTurnState('no-active-turn');
    return {
      ok: recovered,
      recovered,
      reason: recovered ? state.reason : 'no active turn found',
      threadId: this.activeThreadId,
      turnId: this.activeTurnId
    };
  }

  public resolveUserInputRequest(requestId: string, answers: Record<string, unknown>): boolean {
    const request = this.pendingUserInputs.get(String(requestId));
    if (!request || !this.appServer) return false;
    const result = {
      answers: Object.fromEntries(request.questions.map((question) => [
        question.id,
        { answers: normalizeUserInputAnswers(answers?.[question.id]) }
      ]))
    };
    const ok = this.appServer.resolveServerRequest(request.requestId, result);
    if (!ok) return false;
    this.pendingUserInputs.delete(request.requestId);
    this.emit('broadcast', 'server_request_resolved', { requestId: request.requestId });
    this.emit('status_update');
    return true;
  }

  public async start(resumePath: string | null = null): Promise<void> {
    if (!this.useAppServerBackend()) return this.startExecSession(resumePath);
    let finalResumePath = resumePath;
    if (!finalResumePath && resumeAllowed() && !this.suppressAutoResume) finalResumePath = this.findDefaultResumePath();
    if (finalResumePath && !this.isExistingResumePath(finalResumePath)) {
      this.handleAppStartFailure(new Error(`resume path not found: ${finalResumePath}`));
      this.emit('status_update');
      return;
    }
    this.lastResumePath = finalResumePath;
    if (finalResumePath) {
      try {
        await this.resumeAppThread(finalResumePath);
      } catch (error) {
        this.handleAppStartFailure(error);
      }
    }
    this.emit('status_update');
  }

  private handleAppStartFailure(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.broadcastStderr(`恢复历史会话失败，已切换到空会话：${message}`);
    this.lastResumePath = null;
    this.activeThreadId = null;
    this.activeTurnId = null;
    this.activeThreadRunning = false;
    this.activeStartedAtMs = 0;
    this.clearGuidanceInputs(false);
    this.suppressAutoResume = true;
    this.emit('status_update');
  }

  public stop(cb?: () => void): void {
    if (this.useAppServerBackend()) {
      this.shutdownAppServer();
      if (cb) cb();
      return;
    }
    this.stopExec(cb);
  }

  public cancelActiveTurn(cb?: () => void): void {
    if (!this.useAppServerBackend()) {
      this.stopExec(cb);
      return;
    }
    let interrupted = false;
    (async () => {
      if (!this.activeTurnId && this.activeThreadRunning) await this.recoverActiveTurnId();
      const threadId = this.activeThreadId;
      const turnId = this.activeTurnId;
      if (!threadId || !turnId || !this.appServer) {
        if (this.activeThreadRunning) this.broadcastStderr('停止失败：当前线程仍标记运行中，但未能定位 active turn id。');
        return;
      }
      await this.appServer.request('turn/interrupt', { threadId, turnId }, 15000);
      interrupted = true;
    })()
      .catch((error) => this.broadcastStderr(`停止失败：${error.message || error}`))
      .finally(() => {
        if (interrupted) {
        this.activeTurnId = null;
        this.activeThreadRunning = false;
        this.activeStartedAtMs = 0;
        this.clearGuidanceInputs(false);
      }
      this.emit('status_update');
      if (cb) cb();
      });
  }

  public async compactThread(): Promise<any> {
    const threadId = await this.requireAppThreadId();
    const result = await this.appServer!.request('thread/compact/start', { threadId }, 30000);
    this.emit('status_update');
    return result || {};
  }

  public async forkThread(): Promise<any> {
    const threadId = await this.requireAppThreadId();
    const cfg = getConfigSafe();
    const result = await this.appServer!.request('thread/fork', {
      threadId,
      path: this.lastResumePath || undefined,
      cwd: this.currentWorkdir,
      runtimeWorkspaceRoots: [this.currentWorkdir],
      approvalPolicy: String(cfg['approval_policy'] || 'never'),
      approvalsReviewer: this.approvalsReviewer(cfg),
      sandbox: String(cfg['sandbox_mode'] || 'danger-full-access'),
      model: String(cfg['model'] || 'gpt-5.5'),
      serviceTier: this.serviceTier(cfg),
      developerInstructions: this.developerInstructions(),
      config: this.codexConfigOverrides(cfg),
      threadSource: 'codex-webui-ts',
      excludeTurns: true
    }, 30000);
    this.applyThreadState(result?.thread);
    return result || {};
  }

  public async reviewCurrentThread(argumentsText = ''): Promise<any> {
    const threadId = await this.requireAppThreadId();
    const result = await this.appServer!.request('review/start', {
      threadId,
      target: this.reviewTarget(argumentsText),
      delivery: 'inline'
    }, 30000);
    this.activeTurnId = result?.turn?.id || this.activeTurnId;
    this.activeThreadRunning = true;
    this.activeStartedAtMs = Date.now();
    this.emit('status_update');
    return result || {};
  }

  public async getThreadGoal(): Promise<any> {
    const threadId = await this.requireAppThreadId();
    return this.appServer!.request('thread/goal/get', { threadId }, 30000);
  }

  public async setThreadGoal(argumentsText = ''): Promise<any> {
    const threadId = await this.requireAppThreadId();
    const parsed = this.parseGoalArguments(argumentsText);
    if (parsed.clear) return this.appServer!.request('thread/goal/clear', { threadId }, 30000);
    if (!parsed.objective && !parsed.status && parsed.read) return this.getThreadGoal();
    return this.appServer!.request('thread/goal/set', { threadId, objective: parsed.objective, status: parsed.status, tokenBudget: parsed.tokenBudget }, 30000);
  }

  public async cleanBackgroundTerminals(): Promise<any> {
    const threadId = await this.requireAppThreadId();
    return this.appServer!.request('thread/backgroundTerminals/clean', { threadId }, 30000);
  }

  public async listApps(): Promise<any> {
    await this.ensureAppServer();
    return this.appServer!.request('app/list', { threadId: this.activeThreadId, limit: 50, forceRefetch: false }, 30000);
  }

  public async listPlugins(): Promise<any> {
    await this.ensureAppServer();
    const params = { cwds: [this.currentWorkdir], marketplaceKinds: ['local', 'workspace-directory'] };
    const [installed, catalog] = await Promise.all([
      this.appServer!.request('plugin/installed', { cwds: [this.currentWorkdir] }, 30000).catch((error) => ({ error: error.message || String(error), marketplaces: [], marketplaceLoadErrors: [] })),
      this.appServer!.request('plugin/list', params, 30000).catch((error) => ({ error: error.message || String(error), marketplaces: [], marketplaceLoadErrors: [], featuredPluginIds: [] }))
    ]);
    return { installed, catalog };
  }

  public async installPlugin(params: any): Promise<any> {
    await this.ensureAppServer();
    return this.appServer!.request('plugin/install', params, 30000);
  }

  public async uninstallPlugin(pluginId: string): Promise<any> {
    await this.ensureAppServer();
    return this.appServer!.request('plugin/uninstall', { pluginId }, 30000);
  }

  public async readPlugin(params: any): Promise<any> {
    await this.ensureAppServer();
    return this.appServer!.request('plugin/read', params, 30000);
  }

  public async setAppEnabled(appId: string, enabled: boolean): Promise<any> {
    await this.ensureAppServer();
    return this.appServer!.request('config/value/write', {
      keyPath: `apps.${appId}.enabled`,
      value: enabled,
      mergeStrategy: 'upsert'
    }, 30000);
  }

  public async setMarketplacePluginEnabled(pluginId: string, enabled: boolean): Promise<any> {
    await this.ensureAppServer();
    return this.appServer!.request('config/value/write', {
      keyPath: `plugins.${pluginId}.enabled`,
      value: enabled,
      mergeStrategy: 'upsert'
    }, 30000);
  }

  public async startAccountLogin(): Promise<any> {
    await this.ensureAppServer();
    return this.appServer!.request('account/login/start', { type: 'chatgpt' }, 30000);
  }

  public async logoutAccount(): Promise<any> {
    await this.ensureAppServer();
    const result = await this.appServer!.request('account/logout', undefined, 30000);
    this.shutdownAppServer();
    return result || {};
  }

  public async startWindowsSandboxSetup(): Promise<any> {
    await this.ensureAppServer();
    return this.appServer!.request('windowsSandbox/setupStart', { mode: 'unelevated', cwd: this.currentWorkdir }, 30000);
  }

  public async listRealtimeVoices(): Promise<any> {
    await this.ensureAppServer();
    return this.appServer!.request('thread/realtime/listVoices', {}, 30000);
  }

  public async readAccountStatus(): Promise<any> {
    await this.ensureAppServer();
    const read = (method: string, params?: any) => this.appServer!.request(method, params, 30000)
      .catch((error) => ({ ok: false, error: error.message || String(error) }));
    const [authStatus, account, rateLimits, usage, workspaceMessages, config] = await Promise.all([
      read('getAuthStatus', { includeToken: false, refreshToken: false }),
      read('account/read', { refreshToken: true }),
      read('account/rateLimits/read'),
      read('account/usage/read'),
      read('account/workspaceMessages/read'),
      read('config/read', {})
    ]);
    return { authStatus, account, rateLimits, usage, workspaceMessages, config };
  }

  public restart(resumePath: string | null, cb: () => void) {
    if (this.useAppServerBackend()) {
      this.shutdownAppServer();
      this.lastResumePath = resumePath;
      this.activeThreadId = null;
      this.activeTurnId = null;
      this.activeThreadRunning = false;
      this.suppressAutoResume = resumePath === null;
      this.start(resumePath)
        .catch((error) => this.handleAppStartFailure(error))
        .finally(cb);
      return;
    }
    this.stopExec(() => {
      this.lastResumePath = resumePath;
      this.suppressAutoResume = resumePath === null;
      this.start(resumePath).then(cb);
    });
  }

  public setWorkdir(workdir: string): void {
    this.currentWorkdir = path.resolve(workdir);
  }

  public switchProject(workdir: string, cb: () => void): void {
    this.setWorkdir(workdir);
    this.clearQueuedInputs();
    this.clearGuidanceInputs(false);
    this.restart(null, cb);
  }

  public async sendUserInput(text: string, imagePaths: string[] = [], attachments: InputAttachment[] = [], collaborationPreset: 'default' | 'plan' = 'default', serviceTier: string | null = null): Promise<SendResult> {
    const input = this.createPendingInput(text, imagePaths, attachments, collaborationPreset, serviceTier);
    if (this.useAppServerBackend() && this.isRunning()) return this.acceptGuidanceInput(input);
    if (this.useAppServerBackend()) return this.sendAppServerInput(input);
    if (this.codexProc) {
      this.queuedInputs.push(input);
      this.emit('status_update');
      return { ok: true, status: 'queued', id: input.id };
    }
    this.startExecInput(input);
    return { ok: true, status: 'started', id: input.id };
  }

  public async regenerateFromEditedUserMessage(
    resumePath: string | null,
    turnId: string,
    text: string,
    imagePaths: string[] = [],
    attachments: InputAttachment[] = [],
    collaborationPreset: 'default' | 'plan' = 'default',
    serviceTier: string | null = null
  ): Promise<SendResult & { rollbackTurns: number }> {
    if (!this.useAppServerBackend()) throw new Error('当前 exec 后端不支持历史消息重编辑；请切换到 app-server 后端。');
    if (this.isRunning()) throw new Error('当前回复仍在运行，结束或停止后才能编辑历史消息。');
    const sessionPath = resumePath || this.lastResumePath;
    const rollbackTurns = countSessionTurnsFrom(sessionPath, turnId);
    if (resumePath) await this.resumeAppThread(resumePath);
    const threadId = await this.requireAppThreadId();
    if (this.isRunning()) throw new Error('当前回复仍在运行，结束或停止后才能编辑历史消息。');

    this.clearQueuedInputs();
    const rollback = await this.appServer!.request('thread/rollback', { threadId, numTurns: rollbackTurns }, 30000);
    this.applyThreadState(rollback?.thread);
    const sent = await this.sendAppServerInput(this.createPendingInput(text, imagePaths, attachments, collaborationPreset, serviceTier));
    return { ...sent, rollbackTurns };
  }

  public promoteQueuedInput(id: string): boolean {
    const index = this.queuedInputs.findIndex((item) => item.id === id);
    if (index < 0) return false;
    const [item] = this.queuedInputs.splice(index, 1);
    if (!item) return false;
    this.queuedInputs.unshift(item);
    this.emit('status_update');
    if (this.useAppServerBackend() && this.isRunning()) {
      const next = this.queuedInputs.shift();
      if (next) {
        this.emit('status_update');
        this.acceptGuidanceInput(next);
      }
      return true;
    }
    this.drainQueue();
    return true;
  }

  public removeQueuedInput(id: string): boolean {
    const before = this.queuedInputs.length;
    this.queuedInputs = this.queuedInputs.filter((item) => item.id !== id);
    const changed = this.queuedInputs.length !== before;
    if (changed) this.emit('status_update');
    return changed;
  }

  public clearQueuedInputs(): void {
    if (!this.queuedInputs.length) return;
    this.queuedInputs = [];
    this.emit('status_update');
  }

  private clearGuidanceInputs(emit = true): void {
    if (this.guidanceFlushTimer) {
      clearTimeout(this.guidanceFlushTimer);
      this.guidanceFlushTimer = null;
    }
    const changed = Boolean(this.pendingGuidanceInputs.length || this.savedGuidanceInputs.length);
    this.pendingGuidanceInputs = [];
    this.savedGuidanceInputs = [];
    if (changed && emit) this.emit('status_update');
  }

  private interruptedTurnStatePath(): string {
    return path.join(LOG_DIR, 'interrupted-turn-state.json');
  }

  private readInterruptedTurnState(): InterruptedTurnState | null {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.interruptedTurnStatePath(), 'utf8'));
      if (!parsed || typeof parsed !== 'object') return null;
      return {
        threadId: parsed.threadId ? String(parsed.threadId) : null,
        turnId: parsed.turnId ? String(parsed.turnId) : null,
        resumePath: parsed.resumePath ? String(parsed.resumePath) : null,
        workdir: parsed.workdir ? String(parsed.workdir) : this.currentWorkdir,
        reason: parsed.reason ? String(parsed.reason) : 'unknown',
        savedAt: parsed.savedAt ? String(parsed.savedAt) : ''
      };
    } catch {
      return null;
    }
  }

  private persistInterruptedTurnState(reason: string): void {
    if (!this.activeThreadId && !this.lastResumePath) return;
    try {
      fs.mkdirSync(LOG_DIR, { recursive: true });
      const state: InterruptedTurnState = {
        threadId: this.activeThreadId,
        turnId: this.activeTurnId,
        resumePath: this.lastResumePath,
        workdir: this.currentWorkdir,
        reason,
        savedAt: new Date().toISOString()
      };
      fs.writeFileSync(this.interruptedTurnStatePath(), JSON.stringify(state, null, 2), 'utf8');
    } catch (error) {
      this.broadcastStderr(`保存中断状态失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private clearInterruptedTurnState(_reason: string): void {
    try {
      fs.rmSync(this.interruptedTurnStatePath(), { force: true });
    } catch {}
  }

  private useAppServerBackend(): boolean {
    return BACKEND_MODE !== 'exec';
  }

  private createPendingInput(text: string, imagePaths: string[], attachments: InputAttachment[], collaborationPreset: 'default' | 'plan', serviceTier: string | null): PendingInput {
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      text,
      imagePaths,
      attachments,
      collaborationPreset,
      serviceTier: serviceTier === 'fast' ? 'fast' : null,
      createdAt: new Date().toISOString()
    };
  }

  private acceptGuidanceInput(input: PendingInput): SendResult {
    this.pendingGuidanceInputs.push(input);
    this.scheduleGuidanceFlush();
    this.emit('status_update');
    return { ok: true, status: 'guidance_pending', id: input.id, turnId: this.activeTurnId };
  }

  private scheduleGuidanceFlush(): void {
    if (this.guidanceFlushTimer) clearTimeout(this.guidanceFlushTimer);
    this.guidanceFlushTimer = setTimeout(() => {
      this.guidanceFlushTimer = null;
      this.flushGuidanceInputs().catch((error) => this.savePendingGuidance(`引导合并失败，已保留且不会自动重跑：${error.message || error}`));
    }, GUIDANCE_DEBOUNCE_MS);
    this.guidanceFlushTimer.unref?.();
  }

  private mergeGuidanceInputs(inputs: PendingInput[]): PendingInput {
    if (inputs.length === 1 && inputs[0]) return inputs[0];
    const last = inputs[inputs.length - 1] || this.createPendingInput('', [], [], 'default', null);
    return {
      id: last.id,
      text: inputs.map((item, index) => `引导 ${index + 1}:\n${item.text}`).join('\n\n'),
      imagePaths: inputs.flatMap((item) => item.imagePaths),
      attachments: inputs.flatMap((item) => item.attachments),
      collaborationPreset: inputs.some((item) => item.collaborationPreset === 'plan') ? 'plan' : 'default',
      serviceTier: inputs.some((item) => item.serviceTier === 'fast') ? 'fast' : null,
      createdAt: inputs[0]?.createdAt || new Date().toISOString()
    };
  }

  private savePendingGuidance(reason: string, inputs: PendingInput[] | null = null): void {
    const pending = inputs || this.pendingGuidanceInputs.splice(0);
    if (!pending.length) return;
    this.savedGuidanceInputs.push(...pending);
    this.emit('broadcast', 'notification', {
      title: '引导已保留',
      body: reason,
      kind: 'info',
      minVisible: false
    });
    this.emit('status_update');
  }

  private movePendingGuidanceToSaved(reason: string): void {
    this.savePendingGuidance(reason);
  }

  private async flushGuidanceInputs(): Promise<void> {
    if (this.guidanceFlushRunning) {
      this.scheduleGuidanceFlush();
      return;
    }
    this.guidanceFlushRunning = true;
    let sending: PendingInput[] = [];
    try {
      if (!this.pendingGuidanceInputs.length) return;
      if (!this.useAppServerBackend() || !this.isRunning()) {
        this.movePendingGuidanceToSaved('当前回复已结束，引导已保留，失败不会自动重跑。');
        return;
      }
      await this.ensureAppServer();
      if (!this.activeTurnId && this.activeThreadRunning) await this.recoverActiveTurnId();
      if (!this.appServer || !this.activeThreadId || !this.activeTurnId) {
        this.movePendingGuidanceToSaved('当前 turn 暂不可合并，引导已保留，失败不会自动重跑。');
        return;
      }
      sending = this.pendingGuidanceInputs.splice(0);
      const input = this.mergeGuidanceInputs(sending);
      await this.appServer.request('turn/steer', {
        threadId: this.activeThreadId,
        expectedTurnId: this.activeTurnId,
        clientUserMessageId: input.id,
        input: this.buildAppUserInput(input, false),
        responsesapiClientMetadata: { source: 'codex-webui-ts', action: 'guidance' }
      }, GUIDANCE_STEER_TIMEOUT_MS);
      this.broadcastUserInput(input);
      this.emit('status_update');
    } catch (error) {
      this.savePendingGuidance(`引导合并失败，已保留且不会自动重跑：${error instanceof Error ? error.message : String(error)}`, sending.length ? sending : null);
    } finally {
      this.guidanceFlushRunning = false;
      if (this.pendingGuidanceInputs.length) this.scheduleGuidanceFlush();
    }
  }

  private async sendAppServerInput(input: PendingInput): Promise<SendResult> {
    await this.ensureAppThread();
    if (!this.appServer || !this.activeThreadId) throw new Error('app-server thread is not ready');

    const payload = this.buildAppUserInput(input);
    if (!this.activeTurnId && this.activeThreadRunning) await this.recoverActiveTurnId();
    if (this.activeTurnId || this.activeThreadRunning) return this.acceptGuidanceInput(input);

    const cfg = getConfigSafe();
    const collaborationMode = await this.resolveCollaborationMode(input.collaborationPreset, cfg);
    const serviceTier = this.serviceTierForInput(input, cfg);
    const result = await this.appServer.request('turn/start', {
      threadId: this.activeThreadId,
      clientUserMessageId: input.id,
      input: payload,
      cwd: this.currentWorkdir,
      runtimeWorkspaceRoots: [this.currentWorkdir],
      approvalPolicy: String(cfg['approval_policy'] || 'never'),
      approvalsReviewer: this.approvalsReviewer(cfg),
      sandboxPolicy: this.sandboxPolicy(String(cfg['sandbox_mode'] || 'danger-full-access')),
      model: String(cfg['model'] || 'gpt-5.5'),
      effort: String(cfg['model_reasoning_effort'] || 'xhigh'),
      serviceTier,
      collaborationMode,
      responsesapiClientMetadata: { source: 'codex-webui-ts', action: 'start' }
    }, 30000);
    this.activeTurnId = result?.turn?.id || this.activeTurnId;
    this.activeThreadRunning = true;
    this.activeStartedAtMs = Date.now();
    this.clearGuidanceInputs(false);
    this.broadcastUserInput(input);
    this.emit('status_update');
    return { ok: true, status: 'started', id: input.id, turnId: this.activeTurnId };
  }

  private async ensureAppThread(): Promise<void> {
    await this.ensureAppServer();
    if (this.activeThreadId) return;

    let resumePath = this.isExistingResumePath(this.lastResumePath) ? this.lastResumePath : null;
    if (!resumePath && resumeAllowed() && !this.suppressAutoResume) resumePath = this.findDefaultResumePath();
    if (resumePath) {
      try {
        await this.resumeAppThread(resumePath);
        return;
      } catch (error) {
        this.broadcastStderr(`恢复历史会话失败，已新建会话：${error instanceof Error ? error.message : String(error)}`);
        this.lastResumePath = null;
      }
    }

    const cfg = getConfigSafe();
    const result = await this.appServer!.request('thread/start', {
      model: String(cfg['model'] || 'gpt-5.5'),
      cwd: this.currentWorkdir,
      runtimeWorkspaceRoots: [this.currentWorkdir],
      approvalPolicy: String(cfg['approval_policy'] || 'never'),
      approvalsReviewer: this.approvalsReviewer(cfg),
      sandbox: String(cfg['sandbox_mode'] || 'danger-full-access'),
      sessionStartSource: 'startup',
      threadSource: 'codex-webui-ts',
      developerInstructions: this.developerInstructions(),
      serviceTier: this.serviceTier(cfg),
      config: this.codexConfigOverrides(cfg)
    }, 30000);
    this.suppressAutoResume = false;
    this.applyThreadState(result?.thread);
  }

  private async ensureAppServer(): Promise<void> {
    if (this.appServer?.isRunning()) return;
    if (this.appServerStarting) return this.appServerStarting;

    const client = new AppServerClient(LOG_DIR, this.currentWorkdir, APP_SERVER_URL);
    this.appServer = client;
    client.on('notification', (message) => this.handleAppNotification(message));
    client.on('server_request', (request) => this.handleAppServerRequest(request));
    client.on('stderr', (text) => this.broadcastStderr(String(text)));
    client.on('error', (error) => this.broadcastStderr(`app-server 启动失败：${error instanceof Error ? error.message : String(error)}`));
    client.on('exit', (code) => {
      if (code !== null && code !== 1000) this.broadcastStderr(`app-server websocket closed with code ${code}`);
      this.appServer = null;
      this.appServerStarting = null;
      this.activeTurnId = null;
      this.activeThreadRunning = false;
      this.activeStartedAtMs = 0;
      this.emit('status_update');
    });

    this.appServerStarting = client.start().catch((error) => {
      this.appServer = null;
      throw error;
    }).finally(() => {
      this.appServerStarting = null;
    });
    return this.appServerStarting;
  }

  private async resumeAppThread(resumePath: string): Promise<void> {
    await this.ensureAppServer();
    const threadId = this.sessionIdFromPath(resumePath);
    if (!threadId) throw new Error(`无法从历史路径解析 thread id: ${resumePath}`);
    const cfg = getConfigSafe();
    const result = await this.appServer!.request('thread/resume', {
      threadId,
      path: resumePath,
      cwd: this.currentWorkdir,
      runtimeWorkspaceRoots: [this.currentWorkdir],
      model: String(cfg['model'] || 'gpt-5.5'),
      approvalPolicy: String(cfg['approval_policy'] || 'never'),
      approvalsReviewer: this.approvalsReviewer(cfg),
      sandbox: String(cfg['sandbox_mode'] || 'danger-full-access'),
      developerInstructions: this.developerInstructions(),
      serviceTier: this.serviceTier(cfg),
      config: this.codexConfigOverrides(cfg),
      excludeTurns: true
    }, 30000);
    this.applyThreadState(result?.thread);
    await this.recoverActiveTurnId();
  }

  private applyThreadState(thread: any): void {
    if (!thread || !thread.id) return;
    this.activeThreadId = String(thread.id);
    const resumePath = thread.path ? String(thread.path) : null;
    if (this.isExistingResumePath(resumePath)) {
      this.lastResumePath = resumePath;
      this.recordResume(this.lastResumePath);
    }
    this.applyThreadRuntimeState(thread);
    this.emit('status_update');
  }

  private applyThreadRuntimeState(thread: any): void {
    this.applyThreadStatusChange({ threadId: thread?.id, status: thread?.status });
    if (Array.isArray(thread?.turns)) this.applyInProgressTurn(thread.turns);
  }

  private applyThreadStatusChange(params: any): void {
    const thread = params?.thread;
    const status = params?.status || thread?.status;
    if (!status) return;
    const threadId = typeof params?.threadId === 'string'
      ? params.threadId
      : typeof params?.thread?.id === 'string'
        ? params.thread.id
        : null;
    if (threadId) {
      if (this.activeThreadId && this.activeThreadId !== threadId) return;
      this.activeThreadId = threadId;
    }
    const active = thread?.status?.type === 'active' || status.type === 'active';
    this.activeThreadRunning = active;
    if (active && !this.activeStartedAtMs) this.activeStartedAtMs = Date.now();
    if (!active) {
      this.activeTurnId = null;
      this.activeStartedAtMs = 0;
    }
  }

  private applyInProgressTurn(turns: any[]): boolean {
    const turn = turns.find((turn) => turn && turn.status === 'inProgress' && turn.id);
    if (!turn) return false;
    this.activeTurnId = String(turn.id);
    this.activeThreadRunning = true;
    if (!this.activeStartedAtMs) this.activeStartedAtMs = Date.now();
    return true;
  }

  private async recoverActiveTurnId(): Promise<void> {
    if (!this.appServer || !this.activeThreadId || this.activeTurnId || !this.activeThreadRunning) return;
    const page = await this.appServer.request('thread/turns/list', {
      threadId: this.activeThreadId,
      limit: 5,
      sortDirection: 'desc',
      itemsView: 'notLoaded'
    }, 30000);
    const turns = Array.isArray(page?.data) ? page.data : [];
    this.applyInProgressTurn(turns);
  }

  private handleAppServerRequest(request: any): void {
    if (request?.method !== 'item/tool/requestUserInput') {
      this.broadcastStderr(`Unsupported interactive app-server request: ${request?.method || 'unknown'}`);
      return;
    }
    const params = request.params || {};
    const questions = Array.isArray(params.questions)
      ? params.questions.map((question: any, index: number) => normalizeUserInputQuestion(question, index)).filter(Boolean) as UserInputQuestion[]
      : [];
    const requestId = String(request.requestId || request.rpcId || '');
    if (!requestId) return;
    if (!questions.length) {
      this.appServer?.resolveServerRequest(requestId, { answers: {} });
      return;
    }
    const pending: PendingUserInputRequest = {
      kind: 'userInput',
      requestId,
      rpcId: request.rpcId || requestId,
      method: request.method,
      threadId: typeof params.threadId === 'string' ? params.threadId : null,
      turnId: typeof params.turnId === 'string' ? params.turnId : null,
      itemId: typeof params.itemId === 'string' ? params.itemId : null,
      questions,
      createdAt: new Date().toISOString()
    };
    this.pendingUserInputs.set(pending.requestId, pending);
    this.emit('broadcast', 'server_request', pending);
    this.emit('status_update');
  }

  private handleAppNotification(message: any): void {
    const method = message.method;
    const params = message.params || {};
    if (method === 'serverRequest/resolved') {
      const requestId = String(params.requestId || params.id || '');
      if (requestId) {
        this.pendingUserInputs.delete(requestId);
        this.emit('broadcast', 'server_request_resolved', { requestId });
        this.emit('status_update');
      }
      return;
    }
    if (method === 'thread/started') {
      this.applyThreadState(params.thread);
      return;
    }
    if (method === 'thread/status/changed') {
      this.applyThreadStatusChange(params);
      if (this.activeThreadRunning && !this.activeTurnId) {
        this.recoverActiveTurnId().catch((error) => this.broadcastStderr(`恢复 active turn 失败：${error.message || error}`));
      }
      this.emit('status_update');
      return;
    }
    if (method === 'turn/started') {
      this.activeThreadId = params.threadId || this.activeThreadId;
      this.activeTurnId = params.turn?.id || this.activeTurnId;
      this.activeThreadRunning = true;
      this.activeStartedAtMs = Date.now();
      if (this.activeThreadId) this.lastAgentMessageByThread.delete(this.activeThreadId);
      this.emit('status_update');
      return;
    }
    if (method === 'turn/completed') {
      this.handleAppTurnCompleted(params);
      return;
    }
    if (method === 'item/agentMessage/delta') {
      this.emit('broadcast', 'delta', { text: String(params.delta || '') });
      return;
    }
    if (method === 'item/completed') {
      this.handleAppCompletedItem(params.item || {});
      return;
    }
    if (method === 'error' || method === 'warning' || method === 'configWarning' || method === 'guardianWarning') {
      const text = this.notificationText(method, params);
      this.broadcastStderr(text);
      this.emit('broadcast', 'notification', {
        title: method === 'error' ? 'Agent Error' : 'Codex Warning',
        body: text,
        kind: method === 'error' ? 'error' : 'warning',
        threadId: params?.threadId || this.activeThreadId || null,
        minVisible: false
      });
    }
  }

  private handleAppCompletedItem(item: any): void {
    if (item.type === 'agentMessage' && item.text) {
      const text = String(item.text);
      saveMemoryFactsFromText(text);
      if (this.activeThreadId) this.lastAgentMessageByThread.set(this.activeThreadId, text);
      this.emit('broadcast', 'message', { text });
      this.emit('status_update');
      return;
    }
    if (item.type === 'commandExecution') {
      const suffix = item.exitCode == null ? '' : `\nexit=${item.exitCode}`;
      this.emit('broadcast', 'timeline_item', { role: 'tool', kind: 'commandExecution', title: item.command || 'Command', text: item.command || 'command', detail: `${item.command || ''}${suffix}`, status: item.status, metadata: { cwd: item.cwd, exitCode: item.exitCode } });
      return;
    }
    if (item.type === 'mcpToolCall' || item.type === 'dynamicToolCall' || item.type === 'fileChange' || item.type === 'webSearch') {
      this.emit('broadcast', 'timeline_item', {
        role: 'tool',
        kind: item.type,
        title: item.tool || item.query || item.type,
        text: item.tool || item.query || item.status || item.type,
        detail: this.timelineDetail(item),
        status: item.status
      });
    }
  }

  private timelineDetail(item: any): string {
    try {
      if (item.type === 'fileChange') return JSON.stringify(item.changes || item, null, 2);
      if (item.type === 'webSearch') return JSON.stringify(item.action || item.query || item, null, 2);
      if (item.arguments || item.result || item.error) return JSON.stringify(item.arguments || item.result || item.error, null, 2);
      return JSON.stringify(item, null, 2);
    } catch {
      return String(item?.tool || item?.query || item?.status || item?.type || '');
    }
  }

  private handleAppTurnCompleted(params: any): void {
    const turn = params.turn || {};
    const threadId = params.threadId || this.activeThreadId;
    const durationMs = this.activeStartedAtMs ? Date.now() - this.activeStartedAtMs : 0;
    const latest = this.findRolloutByThreadId(threadId) || (this.isExistingResumePath(this.lastResumePath) ? this.lastResumePath : null);
    if (latest) {
      this.lastResumePath = latest;
      this.recordResume(latest);
    }
    if (turn.status === 'failed' && turn.error) {
      this.persistInterruptedTurnState('turn-failed');
      const body = `turn failed: ${JSON.stringify(turn.error)}`;
      this.broadcastStderr(body);
      this.emit('broadcast', 'notification', { title: 'Agent Error', body, kind: 'error', threadId, durationMs, minVisible: false });
    } else {
      this.clearInterruptedTurnState('turn-completed');
    }
    if (turn.status !== 'failed' && durationMs >= 60_000) {
      const body = threadId ? this.lastAgentMessageByThread.get(threadId) : '';
      this.emit('broadcast', 'notification', {
        title: 'Agent Complete',
        body: body || 'Your agent has finished its task.',
        kind: 'success',
        threadId,
        durationMs,
        minVisible: true
      });
    }
    this.activeTurnId = null;
    this.activeThreadRunning = false;
    this.activeStartedAtMs = 0;
    this.emit('status_update');
    this.drainQueue();
  }

  private notificationText(method: string, params: any): string {
    if (typeof params?.message === 'string') return params.message;
    if (typeof params?.warning === 'string') return params.warning;
    if (typeof params?.error === 'string') return params.error;
    return `${method}: ${JSON.stringify(params)}`;
  }

  private buildAppUserInput(input: PendingInput, includeMemory = true): any[] {
    const text = includeMemory ? this.withMemory(input.text) : input.text;
    const items: any[] = [{ type: 'text', text, text_elements: [] }];
    for (const filePath of input.imagePaths) items.push({ type: 'localImage', path: filePath });
    return items;
  }

  private withMemory(text: string): string {
    const facts = readMemoryFacts();
    if (!facts.length) return text;
    return text + '\n\n<memory>\n' + facts.map(f => `- ${f}`).join('\n') + '\n</memory>\n';
  }

  private async requireAppThreadId(): Promise<string> {
    await this.ensureAppThread();
    if (!this.appServer || !this.activeThreadId) throw new Error('app-server thread is not ready');
    return this.activeThreadId;
  }

  private reviewTarget(argumentsText: string): any {
    const value = String(argumentsText || '').trim();
    if (!value) return { type: 'uncommittedChanges' };
    const base = value.match(/^base(?:Branch)?\s+(.+)$/i);
    if (base) return { type: 'baseBranch', branch: base[1].trim() };
    const commit = value.match(/^(?:commit\s+)?([0-9a-f]{7,40})(?:\s+(.+))?$/i);
    if (commit) return { type: 'commit', sha: commit[1], title: commit[2] || null };
    return { type: 'custom', instructions: value };
  }

  private parseGoalArguments(argumentsText: string): { read?: boolean; clear?: boolean; objective?: string | null; status?: string | null; tokenBudget?: number | null } {
    const value = String(argumentsText || '').trim();
    if (!value || /^(?:get|show|status)$/i.test(value)) return { read: true };
    if (/^(?:clear|remove|delete)$/i.test(value)) return { clear: true };
    const budgetMatch = value.match(/\b(?:budget|tokens?)=(\d+)\b/i);
    const tokenBudget = budgetMatch ? Number(budgetMatch[1]) : null;
    const cleaned = value.replace(/\b(?:budget|tokens?)=\d+\b/ig, '').trim();
    const statusMatch = cleaned.match(/^(active|paused|blocked|usageLimited|budgetLimited|complete)\b\s*(.*)$/i);
    if (statusMatch) {
      const statusKey = statusMatch[1].toLowerCase();
      const status = statusKey === 'usagelimited'
        ? 'usageLimited'
        : statusKey === 'budgetlimited'
          ? 'budgetLimited'
          : statusKey;
      const objective = statusMatch[2]?.trim() || null;
      return { status, objective, tokenBudget };
    }
    return { status: 'active', objective: cleaned, tokenBudget };
  }

  private broadcastUserInput(input: PendingInput): void {
    this.emit('broadcast', 'user_message', {
      text: input.text,
      turnId: this.activeTurnId,
      attachments: input.attachments.map(({ kind, name, url }) => ({ kind, name, url }))
    });
  }

  private sandboxPolicy(mode: string): any {
    if (mode === 'read-only') return { type: 'readOnly', networkAccess: true };
    if (mode === 'workspace-write') {
      return { type: 'workspaceWrite', writableRoots: [this.currentWorkdir], networkAccess: true, excludeTmpdirEnvVar: false, excludeSlashTmp: false };
    }
    return { type: 'dangerFullAccess' };
  }

  private codexConfigOverrides(cfg: Record<string, any>): Record<string, any> {
    const overrides: Record<string, any> = {
      model_reasoning_effort: String(cfg['model_reasoning_effort'] || 'xhigh'),
      'tools.web_search_request': cfg['tools.web_search_request'] === true,
      use_experimental_streamable_shell_tool: cfg['use_streamable_shell'] !== false,
      approvals_reviewer: this.approvalsReviewer(cfg),
      suppress_unstable_features_warning: true
    };
    const tier = this.serviceTier(cfg);
    if (tier) overrides.service_tier = tier;
    return overrides;
  }

  private serviceTier(cfg: Record<string, any>): string | null {
    return String(cfg['service_tier'] || '').trim().toLowerCase() === 'fast' ? 'fast' : null;
  }

  private serviceTierForInput(input: PendingInput, cfg: Record<string, any>): string | null {
    return input.serviceTier === 'fast' ? 'fast' : this.serviceTier(cfg);
  }

  private approvalsReviewer(cfg: Record<string, any>): string {
    const reviewer = String(cfg['approvals_reviewer'] || 'user').trim();
    return ['user', 'auto_review', 'guardian_subagent'].includes(reviewer) ? reviewer : 'user';
  }

  private async resolveCollaborationMode(preset: 'default' | 'plan', cfg: Record<string, any>): Promise<any | null> {
    if (preset !== 'plan') return null;
    const response = await this.appServer!.request('collaborationMode/list', {}, 30000);
    const modes = Array.isArray(response?.modes) ? response.modes : Array.isArray(response) ? response : [];
    const plan = modes.find((mode: any) => String(mode?.mode || mode?.name || '').toLowerCase() === 'plan');
    if (!plan) throw new Error('Current app-server did not expose the plan collaboration preset.');
    return {
      mode: 'plan',
      settings: {
        model: plan.model || String(cfg['model'] || 'gpt-5.5'),
        reasoning_effort: plan.reasoningEffort || plan.reasoning_effort || String(cfg['model_reasoning_effort'] || 'xhigh'),
        developer_instructions: null
      }
    };
  }

  private developerInstructions(): string {
    const cfg = getConfigSafe();
    return [
      'Act autonomously without asking for confirmations.',
      'Use apply_patch to create/modify files in the current working directory.',
      'Use exec_command to run, build, and test as needed.',
      'Prefer concise status updates over questions.',
      'When you identify a reusable, non-sensitive fact that will help in future sessions, emit a single line starting with "SAVE_MEMORY: " followed by the fact (<=140 chars). Never store secrets or tokens.',
      String(cfg['instructions_extra'] || '')
    ].filter(Boolean).join(' ');
  }

  private shutdownAppServer(): void {
    // The app-server is a separate 5056 process. WebUI stop/restart only
    // disconnects this client so active Codex work is not killed with 5055.
    if (this.activeTurnId || this.activeThreadRunning) this.persistInterruptedTurnState('app-server-shutdown');
    this.appServer?.shutdown();
    this.appServer = null;
    this.appServerStarting = null;
    this.activeThreadId = null;
    this.activeTurnId = null;
    this.activeThreadRunning = false;
    this.activeStartedAtMs = 0;
    this.clearGuidanceInputs(false);
    this.suppressAutoResume = false;
    this.emit('status_update');
  }

  private async startExecSession(resumePath: string | null = null): Promise<void> {
    if (this.codexProc) return;
    let finalResumePath = resumePath;
    if (!finalResumePath && resumeAllowed() && !this.suppressAutoResume) finalResumePath = this.findDefaultResumePath();
    if (finalResumePath && !this.isExistingResumePath(finalResumePath)) finalResumePath = null;
    this.lastResumePath = finalResumePath;
    if (finalResumePath) this.recordResume(finalResumePath);
    this.emit('status_update');
  }

  private stopExec(cb?: () => void): void {
    if (!this.codexProc) {
      if (cb) cb();
      return;
    }
    try {
      this.codexProc.stdin?.write(JSON.stringify({ id: 'shutdown', op: { type: 'shutdown' } }) + '\n');
    } catch {}

    const proc = this.codexProc;
    this.codexProc = null;
    this.suppressExecExitError = true;
    setTimeout(() => {
      try { proc.kill(); } catch {}
      if (cb) cb();
    }, 500);
  }

  private startExecInput(input: PendingInput): boolean {
    if (this.codexProc) return false;
    const attachmentBlock = input.imagePaths.length
      ? '\n\n<attachments>\n' + input.imagePaths.map((filePath) => `<image path="${filePath}" />`).join('\n') + '\n</attachments>\n'
      : '';
    const finalText = this.withMemory(input.text + attachmentBlock);
    const args = this.buildExecArgs(input.imagePaths);
    const childLogs = createChildLogStreams();
    this.activeThreadId = null;
    this.activeStartedAtMs = Date.now();

    try {
      this.codexProc = spawn(CODEX_LAUNCH.command, [...CODEX_LAUNCH.argsPrefix, ...args], {
        cwd: this.currentWorkdir,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      });
    } catch (error) {
      childLogs.stderr.write(`Codex 启动失败：${error instanceof Error ? error.message : String(error)}\n`);
      childLogs.stdout.end();
      childLogs.stderr.end();
      this.handleExecLaunchError(error);
      return true;
    }

    this.broadcastUserInput(input);
    this.emit('status_update');

    this.codexProc.stdout?.setEncoding('utf8');
    this.codexProc.stdout?.on('data', (chunk) => {
      childLogs.stdout.write(chunk);
      this.handleExecStdout(chunk);
    });
    this.codexProc.stderr?.setEncoding('utf8');
    this.codexProc.stderr?.on('data', (d) => {
      const text = d.toString();
      childLogs.stderr.write(text);
      this.broadcastStderr(text);
    });

    this.codexProc.on('error', (error) => {
      childLogs.stderr.write(`Codex 启动失败：${error.message || error}\n`);
      childLogs.stdout.end();
      childLogs.stderr.end();
      this.handleExecLaunchError(error);
    });

    this.codexProc.on('exit', (code) => {
      const suppressExitError = this.suppressExecExitError;
      this.suppressExecExitError = false;
      if (!suppressExitError) {
        const latest = this.findRolloutByThreadId(this.activeThreadId)
          || (process.env.CODEX_CMD ? null : this.findLatestRollout(this.activeStartedAtMs - 1000));
        if (latest) {
          this.lastResumePath = latest;
          this.recordResume(latest);
        }
      }
      if (code !== 0 && !suppressExitError) this.emit('broadcast', 'stderr', { text: `Codex exited with code ${code}` });
      this.codexProc = null;
      this.activeThreadId = null;
      this.activeStartedAtMs = 0;
      childLogs.stdout.end();
      childLogs.stderr.end();
      this.emit('status_update');
      this.drainQueue();
    });

    this.codexProc.stdin?.write(finalText);
    this.codexProc.stdin?.end();
    return true;
  }

  private handleExecLaunchError(error: any): void {
    this.emit('broadcast', 'stderr', { text: `Codex 启动失败：${error.message || error}` });
    this.codexProc = null;
    this.activeThreadId = null;
    this.activeThreadRunning = false;
    this.activeStartedAtMs = 0;
    this.emit('status_update');
    this.drainQueue();
  }

  private broadcastStderr(text: string): void {
    const visible = visibleStderrText(text);
    if (visible) this.emit('broadcast', 'stderr', { text: visible });
  }

  private drainQueue(): void {
    if (this.useAppServerBackend()) {
      if (this.isRunning() || !this.queuedInputs.length) return;
      const next = this.queuedInputs.shift();
      if (!next) return;
      this.emit('status_update');
      this.sendAppServerInput(next).catch((error) => this.broadcastStderr(`队列发送失败：${error.message || error}`));
      return;
    }
    if (this.codexProc || !this.queuedInputs.length) return;
    const next = this.queuedInputs.shift();
    if (!next) return;
    this.emit('status_update');
    this.startExecInput(next);
  }

  private handleExecStdout(chunk: string) {
    const lines = chunk.split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      let event;
      try { event = JSON.parse(line); } catch { continue; }
      this.handleExecEvent(event);
    }
  }

  private buildExecArgs(imagePaths: string[] = []): string[] {
    const cfg = getConfigSafe();
    const common = [
      '--json',
      '--skip-git-repo-check',
      '-m', String(cfg['model'] || 'gpt-5.5'),
      '-c', `model_reasoning_effort="${String(cfg['model_reasoning_effort'] || 'xhigh')}"`,
      '-c', `approval_policy="${String(cfg['approval_policy'] || 'never')}"`,
      '-c', `approvals_reviewer="${this.approvalsReviewer(cfg)}"`,
      '-c', `sandbox_mode="${String(cfg['sandbox_mode'] || 'danger-full-access')}"`,
      '-c', `tools.web_search_request=${cfg['tools.web_search_request'] === true}`,
      '-c', `use_experimental_streamable_shell_tool=${cfg['use_streamable_shell'] !== false}`,
      '-c', 'suppress_unstable_features_warning=true',
      '-c', `instructions=${JSON.stringify(this.developerInstructions())}`
    ];
    const imageArgs = imagePaths.flatMap((filePath) => ['--image', filePath]);

    const sessionId = this.sessionIdFromPath(this.isExistingResumePath(this.lastResumePath) ? this.lastResumePath : null);
    if (sessionId) return ['exec', 'resume', ...common, ...imageArgs, '--all', sessionId, '-'];
    return ['exec', ...common, ...imageArgs, '-C', this.currentWorkdir, '-'];
  }

  private handleExecEvent(event: any): void {
    if (event.type === 'thread.started') {
      const threadId = String(event.thread_id || event.threadId || '').trim();
      if (threadId) this.activeThreadId = threadId;
      this.emit('status_update');
      return;
    }
    if (event.type === 'turn.completed') {
      this.emit('status_update');
      return;
    }
    const item = event.item || {};
    if (event.type !== 'item.completed' || !item.type) return;

    if (item.type === 'agent_message' && item.text) {
      const text = String(item.text);
      saveMemoryFactsFromText(text);
      this.emit('broadcast', 'message', { text });
      this.emit('status_update');
      return;
    }

    if (item.type === 'error') {
      this.emit('broadcast', 'stderr', { text: String(item.message || 'Error') });
      return;
    }

    if (item.type.includes('command') || item.type.includes('tool') || item.type.includes('function')) {
      this.emit('broadcast', 'tool', { name: item.type, detail: item.command || item.name || item.text || '' });
    }
  }

  private sessionIdFromPath(resumePath: string | null): string | null {
    if (!resumePath) return null;
    const match = path.basename(resumePath).match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i);
    return match ? match[1] : null;
  }

  private findLatestRollout(minMtimeMs = 0): string | null {
    try {
      const root = path.join(os.homedir(), '.codex', 'sessions');
      if (!fs.existsSync(root)) return null;
      let latest = null;
      let latestMtime = 0;
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
            if (stat && stat.mtimeMs >= minMtimeMs && stat.mtimeMs > latestMtime) { latestMtime = stat.mtimeMs; latest = full; }
          }
        }
      }
      return latest;
    } catch { return null; }
  }

  private findRecordedResume(): string | null {
    try {
      const entries = (readHistory().entries || [])
        .filter((entry: any) => this.sameWorkdir(entry?.workdir) && entry?.resume_path && fs.existsSync(entry.resume_path))
        .sort((a: any, b: any) => (b.last_used || 0) - (a.last_used || 0));
      return entries[0]?.resume_path || null;
    } catch {
      return null;
    }
  }

  private findDefaultResumePath(): string | null {
    return this.findRecordedResume() || this.findLatestRollout();
  }

  private findRolloutByThreadId(threadId: string | null): string | null {
    if (!threadId || !/^[0-9a-f-]{36}$/i.test(threadId)) return null;
    try {
      const root = path.join(os.homedir(), '.codex', 'sessions');
      if (!fs.existsSync(root)) return null;
      const stack = [root];
      while (stack.length) {
        const dir = stack.pop();
        if (!dir) continue;
        let entries: fs.Dirent[] = [];
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
        for (const ent of entries) {
          const full = path.join(dir, ent.name);
          if (ent.isDirectory()) { stack.push(full); continue; }
          if (ent.name.endsWith(`${threadId}.jsonl`) && /^rollout-.*\.jsonl$/i.test(ent.name)) return full;
        }
      }
      return null;
    } catch { return null; }
  }

  private isExistingResumePath(resumePath: string | null): resumePath is string {
    if (!resumePath) return false;
    try {
      return fs.existsSync(path.resolve(resumePath));
    } catch {
      return false;
    }
  }

  private recordResume(resumePath: string) {
    if (!this.isExistingResumePath(resumePath)) return;
    const h = readHistory();
    const ts = Date.now();
    h.entries = h.entries || [];
    h.entries = h.entries.filter(e => !(e.resume_path === resumePath && this.sameWorkdir(e.workdir)));
    h.entries.push({ resume_path: resumePath, workdir: this.currentWorkdir, last_used: ts });
    writeHistory(h);
  }

  private comparablePath(filePath: string): string {
    const resolved = path.resolve(filePath);
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
  }

  private sameWorkdir(workdir: unknown): boolean {
    return typeof workdir === 'string' && this.comparablePath(workdir) === this.comparablePath(this.currentWorkdir);
  }
}

export const codexService = new CodexService();
