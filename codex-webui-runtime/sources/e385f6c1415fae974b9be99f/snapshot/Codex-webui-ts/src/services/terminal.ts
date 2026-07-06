import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const MAX_OUTPUT_CHARS = 220_000;

type TerminalOutputKind = 'stdout' | 'stderr' | 'system';

interface TerminalOutputChunk {
  id: number;
  at: number;
  kind: TerminalOutputKind;
  text: string;
}

interface TerminalSession {
  id: string;
  title: string;
  command: string;
  args: string[];
  cwd: string;
  shell: boolean;
  createdAt: number;
  updatedAt: number;
  running: boolean;
  exitCode: number | null;
  signal: string | null;
  output: TerminalOutputChunk[];
  outputChars: number;
  child: ChildProcessWithoutNullStreams | null;
}

const sessions = new Map<string, TerminalSession>();
let outputCounter = 0;

function defaultShellCommand(): { command: string; args: string[]; title: string } {
  if (process.platform === 'win32') return { command: 'powershell.exe', args: ['-NoLogo'], title: 'PowerShell' };
  return { command: process.env.SHELL || '/bin/sh', args: [], title: path.basename(process.env.SHELL || '/bin/sh') };
}

function resolveCwd(value: unknown, fallback: string): string {
  const requested = String(value || '').trim();
  const cwd = path.resolve(requested || fallback || process.cwd());
  const stat = fs.statSync(cwd);
  if (!stat.isDirectory()) throw new Error('terminal cwd must be an existing directory');
  return cwd;
}

function trimOutput(session: TerminalSession): void {
  while (session.outputChars > MAX_OUTPUT_CHARS && session.output.length > 1) {
    const removed = session.output.shift();
    session.outputChars -= removed?.text.length || 0;
  }
}

function appendOutput(session: TerminalSession, kind: TerminalOutputKind, text: string): void {
  if (!text) return;
  session.output.push({ id: ++outputCounter, at: Date.now(), kind, text });
  session.outputChars += text.length;
  session.updatedAt = Date.now();
  trimOutput(session);
}

function publicSession(session: TerminalSession) {
  return {
    id: session.id,
    title: session.title,
    command: session.command,
    args: session.args,
    cwd: session.cwd,
    shell: session.shell,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    running: session.running,
    exitCode: session.exitCode,
    signal: session.signal,
    output: session.output
  };
}

function createSessionId(): string {
  return `terminal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function listTerminalSessions() {
  return { ok: true, sessions: [...sessions.values()].sort((a, b) => b.updatedAt - a.updatedAt).map(publicSession) };
}

export function spawnTerminalSession(input: any, fallbackCwd: string) {
  const defaults = defaultShellCommand();
  const args = Array.isArray(input?.args) ? input.args.map((item: unknown) => String(item)) : [];
  const rawCommand = String(input?.command || '').trim();
  const command = rawCommand || defaults.command;
  const cwd = resolveCwd(input?.cwd, fallbackCwd);
  const shell = rawCommand ? args.length === 0 && input?.shell !== false : false;
  const title = String(input?.title || '').trim() || (rawCommand ? command : defaults.title);
  if (!command || command.length > 2048) throw new Error('terminal command is invalid');
  const session: TerminalSession = {
    id: createSessionId(),
    title,
    command,
    args: rawCommand ? args : defaults.args,
    cwd,
    shell,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    running: true,
    exitCode: null,
    signal: null,
    output: [],
    outputChars: 0,
    child: null
  };
  appendOutput(session, 'system', `> ${command}${session.args.length ? ` ${session.args.join(' ')}` : ''}${os.EOL}`);
  const child = spawn(command, session.args, {
    cwd,
    shell,
    windowsHide: true,
    env: process.env
  });
  session.child = child;
  sessions.set(session.id, session);
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => appendOutput(session, 'stdout', String(chunk)));
  child.stderr.on('data', (chunk) => appendOutput(session, 'stderr', String(chunk)));
  child.on('error', (error) => {
    appendOutput(session, 'stderr', `${error.message || error}${os.EOL}`);
    session.running = false;
    session.updatedAt = Date.now();
  });
  child.on('exit', (code, signal) => {
    session.running = false;
    session.exitCode = code;
    session.signal = signal;
    appendOutput(session, 'system', `${os.EOL}[process exited code=${code ?? ''} signal=${signal ?? ''}]${os.EOL}`);
  });
  return { ok: true, session: publicSession(session) };
}

export function writeTerminalStdin(id: unknown, data: unknown) {
  const session = sessions.get(String(id || ''));
  if (!session) throw new Error('terminal session not found');
  if (!session.running || !session.child) throw new Error('terminal session is not running');
  const text = String(data ?? '');
  if (!text) return { ok: true, session: publicSession(session) };
  session.child.stdin.write(text);
  session.updatedAt = Date.now();
  return { ok: true, session: publicSession(session) };
}

export function killTerminalSession(id: unknown) {
  const session = sessions.get(String(id || ''));
  if (!session) throw new Error('terminal session not found');
  if (session.running && session.child) {
    session.child.kill();
    session.running = false;
  }
  session.updatedAt = Date.now();
  return { ok: true, session: publicSession(session) };
}

export function resizeTerminalSession(id: unknown, cols: unknown, rows: unknown) {
  const session = sessions.get(String(id || ''));
  if (!session) throw new Error('terminal session not found');
  appendOutput(session, 'system', `[resize ${Number(cols) || 0}x${Number(rows) || 0}]${os.EOL}`);
  return { ok: true, session: publicSession(session) };
}
