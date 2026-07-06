import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { resolveCodexLaunch } from './codex-launch.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const APP_DIR = path.resolve(__dirname, '../..');
const LOG_DIR = path.join(APP_DIR, 'logs');
const DEFAULT_LOG_FILE = path.join(LOG_DIR, 'codex-update.log');
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_ON_START_DELAY_MS = 1000;

type UpdateNotification = {
  title: string;
  body: string;
  kind: 'success' | 'info' | 'warning' | 'error';
  minVisible: boolean;
};

type NotifyUpdate = (payload: UpdateNotification) => void;

type CommandResult = {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};

export function millisecondsUntilNextDailyRun(now = new Date(), hour = 7, minute = 0): number {
  const safeHour = Math.max(0, Math.min(23, Number.isFinite(hour) ? Math.trunc(hour) : 7));
  const safeMinute = Math.max(0, Math.min(59, Number.isFinite(minute) ? Math.trunc(minute) : 0));
  const next = new Date(now);
  next.setHours(safeHour, safeMinute, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

function enabledByEnv(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw == null || raw === '') return defaultValue;
  return !['0', 'false', 'no', 'off'].includes(String(raw).trim().toLowerCase());
}

function numberEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function appendLog(line: string): void {
  const logFile = process.env.CODEX_WEBUI_CLI_UPDATE_LOG
    ? path.resolve(process.env.CODEX_WEBUI_CLI_UPDATE_LOG)
    : DEFAULT_LOG_FILE;
  try {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    fs.appendFileSync(logFile, `${new Date().toISOString()} ${line}\n`);
  } catch {
    // Logging must not break the WebUI.
  }
}

function parseCodexVersion(output: string): string {
  const text = String(output || '').trim();
  const match = text.match(/codex-cli\s+([^\s]+)/i);
  if (match) return match[1];
  return text.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || '';
}

function runCodexCommand(args: string[], timeoutMs: number): Promise<CommandResult> {
  const launch = resolveCodexLaunch();
  return new Promise((resolveRun) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    const child = spawn(launch.command, [...launch.argsPrefix, ...args], {
      cwd: APP_DIR,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const timer = setTimeout(() => {
      if (settled) return;
      try { child.kill(); } catch {}
      settled = true;
      resolveRun({ code: null, stdout, stderr, timedOut: true });
    }, Math.max(1000, timeoutMs));
    timer.unref?.();
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (chunk) => { stdout += String(chunk); });
    child.stderr?.on('data', (chunk) => { stderr += String(chunk); });
    child.once('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolveRun({ code: null, stdout, stderr: stderr + String(error.message || error), timedOut: false });
    });
    child.once('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolveRun({ code, stdout, stderr, timedOut: false });
    });
  });
}

export class CodexCliUpdater {
  private notify: NotifyUpdate;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private startupTimer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private readonly hour = numberEnv('CODEX_WEBUI_CLI_UPDATE_HOUR', 7);
  private readonly minute = numberEnv('CODEX_WEBUI_CLI_UPDATE_MINUTE', 0);
  private readonly timeoutMs = numberEnv('CODEX_WEBUI_CLI_UPDATE_TIMEOUT_MS', DEFAULT_TIMEOUT_MS);

  constructor(notify: NotifyUpdate) {
    this.notify = notify;
  }

  public start(): void {
    if (!enabledByEnv('CODEX_WEBUI_CLI_AUTO_UPDATE', true)) {
      appendLog('disabled by CODEX_WEBUI_CLI_AUTO_UPDATE');
      return;
    }
    this.scheduleNext();
    if (enabledByEnv('CODEX_WEBUI_CLI_UPDATE_ON_START', false)) {
      const delayMs = Math.max(0, numberEnv('CODEX_WEBUI_CLI_UPDATE_ON_START_DELAY_MS', DEFAULT_ON_START_DELAY_MS));
      this.startupTimer = setTimeout(() => {
        this.runUpdate('startup').catch((error) => appendLog(`startup failed ${error instanceof Error ? error.message : String(error)}`));
      }, delayMs);
      this.startupTimer.unref?.();
    }
  }

  public stop(): void {
    if (this.timer) clearTimeout(this.timer);
    if (this.startupTimer) clearTimeout(this.startupTimer);
    this.timer = null;
    this.startupTimer = null;
  }

  private scheduleNext(): void {
    const delayMs = millisecondsUntilNextDailyRun(new Date(), this.hour, this.minute);
    this.timer = setTimeout(() => {
      this.runUpdate('scheduled')
        .catch((error) => appendLog(`scheduled failed ${error instanceof Error ? error.message : String(error)}`))
        .finally(() => this.scheduleNext());
    }, delayMs);
    this.timer.unref?.();
    appendLog(`next scheduled ${new Date(Date.now() + delayMs).toISOString()}`);
  }

  public async runUpdate(reason: 'scheduled' | 'startup' = 'scheduled'): Promise<boolean> {
    if (this.running) {
      appendLog(`skip ${reason}: already running`);
      return false;
    }
    this.running = true;
    try {
      appendLog(`start ${reason}`);
      const before = await runCodexCommand(['--version'], this.timeoutMs);
      if (before.code !== 0 || before.timedOut) {
        appendLog(`version-before failed code=${before.code} timeout=${before.timedOut} stderr=${before.stderr.trim()}`);
        return false;
      }
      const beforeVersion = parseCodexVersion(before.stdout);
      const update = await runCodexCommand(['update'], this.timeoutMs);
      if (update.code !== 0 || update.timedOut) {
        appendLog(`update failed code=${update.code} timeout=${update.timedOut} stderr=${update.stderr.trim()}`);
        return false;
      }
      const after = await runCodexCommand(['--version'], this.timeoutMs);
      if (after.code !== 0 || after.timedOut) {
        appendLog(`version-after failed code=${after.code} timeout=${after.timedOut} stderr=${after.stderr.trim()}`);
        return false;
      }
      const afterVersion = parseCodexVersion(after.stdout);
      if (!beforeVersion || !afterVersion || beforeVersion === afterVersion) {
        appendLog(`no change ${beforeVersion || 'unknown'} output=${update.stdout.trim()}`);
        return false;
      }
      appendLog(`updated ${beforeVersion} -> ${afterVersion}`);
      this.notify({
        title: 'Codex CLI 已更新',
        body: `已从 ${beforeVersion} 更新到 ${afterVersion}。`,
        kind: 'success',
        minVisible: false
      });
      return true;
    } finally {
      this.running = false;
    }
  }
}

export function startCodexCliUpdater(notify: NotifyUpdate): CodexCliUpdater {
  const updater = new CodexCliUpdater(notify);
  updater.start();
  return updater;
}
