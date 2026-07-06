import { spawn, spawnSync, ChildProcessWithoutNullStreams } from 'child_process';
import fs from 'fs';
import http from 'http';
import https from 'https';
import os from 'os';
import path from 'path';

interface CxConfig {
  password?: string;
  cloudflaredCommand?: string;
  tailscaleCommand?: string;
  tunnelProvider?: string;
}

type TunnelProvider = 'tailscale' | 'cloudflared';

const root = process.cwd();
const logDir = path.resolve(root, 'logs');
const port = Number(process.env.PORT || 5155);
const host = process.env.HOST || '0.0.0.0';
const publicUser = process.env.CODEX_WEBUI_PUBLIC_USER || 'lop';
const cxConfig = readCxConfig();
const publicPassword = process.env.CODEX_WEBUI_PUBLIC_PASSWORD || cxConfig.password || '';

let webProcess: ChildProcessWithoutNullStreams | null = null;
let tunnelProcess: ChildProcessWithoutNullStreams | null = null;
let shuttingDown = false;
let webStartPromise: Promise<void> | null = null;
let tunnelStartPromise: Promise<string> | null = null;
let webRestartTimer: ReturnType<typeof setTimeout> | null = null;
let tunnelRestartTimer: ReturnType<typeof setTimeout> | null = null;
let healthMonitor: ReturnType<typeof setInterval> | null = null;
let publicMonitor: ReturnType<typeof setInterval> | null = null;
let healthCheckRunning = false;
let publicCheckRunning = false;
let publicFailureCount = 0;
let activeTunnelProvider: TunnelProvider = 'cloudflared';
let activeTunnelCommand: string | null = null;
let activeCloudflaredCommand: string | null = null;
let activePublicStatus: { provider: TunnelProvider; command: string; publicUrl: string } | null = null;

function readCxConfig(): CxConfig {
  const configPath = path.join(os.homedir(), '.cx-codex', 'config.json');
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return {};
  }
}

function canRun(command: string, args: string[] = ['--version']): boolean {
  try {
    const result = spawnSync(command, args, { stdio: 'ignore', windowsHide: true });
    return result.status === 0;
  } catch {
    return false;
  }
}

function resolveCloudflaredCommand(): string {
  const candidates = [
    process.env.CODEX_WEBUI_CLOUDFLARED_COMMAND,
    process.env.CX_CODEX_CLOUDFLARED_COMMAND,
    cxConfig.cloudflaredCommand,
    'cloudflared',
    path.join(os.homedir(), '.local', 'bin', process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared')
  ].filter((value): value is string => !!value && !!value.trim());
  for (const candidate of [...new Set(candidates.map((value) => value.trim()))]) {
    if (canRun(candidate)) return candidate;
  }
  throw new Error('cloudflared is not available. Set CODEX_WEBUI_CLOUDFLARED_COMMAND.');
}

function resolveTailscaleCommand(): string | null {
  const candidates = [
    process.env.CODEX_WEBUI_TAILSCALE_COMMAND,
    process.env.CX_CODEX_TAILSCALE_COMMAND,
    cxConfig.tailscaleCommand,
    'tailscale',
    process.platform === 'win32' ? 'C:\\Program Files\\Tailscale\\tailscale.exe' : '',
    path.join(os.homedir(), '.local', 'bin', process.platform === 'win32' ? 'tailscale.exe' : 'tailscale')
  ].filter((value): value is string => !!value && !!value.trim());
  for (const candidate of [...new Set(candidates.map((value) => value.trim()))]) {
    if (canRun(candidate, ['version'])) return candidate;
  }
  return null;
}

function resolveTunnel(): { provider: TunnelProvider; command: string } {
  const requested = String(
    process.env.CODEX_WEBUI_TUNNEL_PROVIDER
      || process.env.CX_CODEX_TUNNEL_PROVIDER
      || cxConfig.tunnelProvider
      || 'auto'
  ).toLowerCase();
  if (requested === 'cloudflared') {
    return { provider: 'cloudflared', command: resolveCloudflaredCommand() };
  }
  const tailscale = resolveTailscaleCommand();
  if (tailscale) return { provider: 'tailscale', command: tailscale };
  if (requested === 'tailscale') {
    throw new Error('tailscale is not available. Set CODEX_WEBUI_TAILSCALE_COMMAND or login to Tailscale.');
  }
  console.warn('Tailscale is not available; fallback to cloudflared quick tunnel with a temporary URL.');
  return { provider: 'cloudflared', command: resolveCloudflaredCommand() };
}

function openLog(name: string): number {
  fs.mkdirSync(logDir, { recursive: true });
  return fs.openSync(path.join(logDir, name), 'a');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function healthUrl(): string {
  return `http://127.0.0.1:${port}/health`;
}

function checkHealth(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(healthUrl(), { timeout: 1200 }, (res) => {
      res.resume();
      resolve((res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300);
    });
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
  });
}

async function waitForHealth(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    if (await checkHealth()) return;
    await sleep(250);
  }
  throw new Error(`Codex WebUI did not become healthy at ${healthUrl()}`);
}

async function startWebUi(): Promise<void> {
  if (await checkHealth()) {
    refreshStatus();
    return;
  }
  const out = openLog('public-webui.out.log');
  const err = openLog('public-webui.err.log');
  const child = spawn(process.execPath, ['dist/server.js'], {
    cwd: root,
    windowsHide: true,
    stdio: ['ignore', out, err],
    env: {
      ...process.env,
      PORT: String(port),
      HOST: host,
      CODEX_WEBUI_PUBLIC_USER: publicUser,
      CODEX_WEBUI_PUBLIC_PASSWORD: publicPassword
    }
  });
  webProcess = child;
  fs.closeSync(out);
  fs.closeSync(err);
  child.once('exit', (code) => {
    if (webProcess === child) webProcess = null;
    if (!shuttingDown) {
      console.error(`Codex WebUI exited with code ${String(code)}`);
      scheduleWebRestart('web process exited');
    }
  });
  try {
    await waitForHealth(15000);
    refreshStatus();
  } catch (error) {
    try { child.kill(); } catch {}
    throw error;
  }
}

function scheduleWebRestart(reason: string): void {
  if (shuttingDown || webRestartTimer) return;
  console.error(`Codex WebUI restart scheduled: ${reason}`);
  webRestartTimer = setTimeout(() => {
    webRestartTimer = null;
    ensureWebUiRunning().catch((error) => {
      console.error(`Codex WebUI restart failed: ${error instanceof Error ? error.message : String(error)}`);
      scheduleWebRestart('restart failed');
    });
  }, 1500);
}

function ensureWebUiRunning(): Promise<void> {
  if (webStartPromise) return webStartPromise;
  webStartPromise = startWebUi().finally(() => {
    webStartPromise = null;
  });
  return webStartPromise;
}

function startHealthMonitor(): void {
  if (healthMonitor) return;
  healthMonitor = setInterval(async () => {
    if (shuttingDown || healthCheckRunning) return;
    healthCheckRunning = true;
    try {
      if (!(await checkHealth())) scheduleWebRestart('health check failed');
    } finally {
      healthCheckRunning = false;
    }
  }, 5000);
}

function refreshStatus(): void {
  if (activePublicStatus) writeStatus(activePublicStatus.command, activePublicStatus.publicUrl, activePublicStatus.provider);
}

function checkPublicTunnel(): Promise<boolean> {
  const publicUrl = activePublicStatus?.publicUrl;
  if (!publicUrl) return Promise.resolve(false);
  return new Promise((resolve) => {
    let parsed: URL;
    try {
      parsed = new URL(publicUrl);
    } catch {
      resolve(false);
      return;
    }
    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.get(parsed, { timeout: 5000 }, (res) => {
      res.resume();
      const status = res.statusCode || 0;
      resolve(status > 0 && status < 500);
    });
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
  });
}

function parseCloudflaredUrl(text: string): string {
  const matches = text.match(/https:\/\/[A-Za-z0-9-]+\.trycloudflare\.com/g);
  return matches?.at(-1) || '';
}

function getTailscalePublicUrl(command: string): string {
  const result = spawnSync(command, ['status', '--json'], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) {
    const error = String(result.stderr || result.stdout || '').trim();
    throw new Error(`tailscale status failed: ${error || `exit ${String(result.status)}`}`);
  }
  const status = JSON.parse(result.stdout || '{}') as {
    BackendState?: string;
    Self?: { DNSName?: string };
    CertDomains?: string[];
  };
  if (status.BackendState && status.BackendState !== 'Running') {
    throw new Error(`tailscale is not running or authenticated: ${status.BackendState}`);
  }
  const domain = (status.Self?.DNSName || status.CertDomains?.[0] || '').replace(/\.$/, '');
  if (!domain) throw new Error('tailscale did not report a stable DNS name.');
  return `https://${domain}`;
}

function startTailscaleFunnel(command: string): Promise<string> {
  const result = spawnSync(command, ['funnel', '--bg', '--yes', String(port)], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true
  });
  if (result.status !== 0) {
    const error = String(result.stderr || result.stdout || '').trim();
    throw new Error(`tailscale funnel failed: ${error || `exit ${String(result.status)}`}`);
  }
  const publicUrl = getTailscalePublicUrl(command);
  writeStatus(command, publicUrl, 'tailscale');
  return Promise.resolve(publicUrl);
}

function startCloudflared(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let connected = false;
    const outPath = path.join(logDir, 'public-cloudflared.out.log');
    const errPath = path.join(logDir, 'public-cloudflared.err.log');
    fs.mkdirSync(logDir, { recursive: true });
    const outStream = fs.createWriteStream(outPath, { flags: 'a' });
    const errStream = fs.createWriteStream(errPath, { flags: 'a' });
    const tunnelOriginUrl = `http://127.0.0.1:${port}`;
    const child = spawn(command, ['tunnel', '--url', tunnelOriginUrl], {
      cwd: root,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    tunnelProcess = child;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { tunnelProcess?.kill(); } catch {}
      reject(new Error('Timed out waiting for cloudflared public URL'));
    }, 30000);
    const handleText = (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      const url = parseCloudflaredUrl(text);
      if (!url) return;
      if (settled) return;
      settled = true;
      connected = true;
      clearTimeout(timeout);
      writeStatus(command, url);
      resolve(url);
    };
    child.stdout.on('data', (chunk) => {
      outStream.write(chunk);
      handleText(chunk);
    });
    child.stderr.on('data', (chunk) => {
      errStream.write(chunk);
      handleText(chunk);
    });
    child.once('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });
    tunnelProcess.once('exit', (code) => {
      const wasCurrent = tunnelProcess === child;
      if (wasCurrent) tunnelProcess = null;
      outStream.end();
      errStream.end();
      if (!shuttingDown && code !== 0 && !settled) {
        settled = true;
        clearTimeout(timeout);
        reject(new Error(`cloudflared exited before providing a URL, code=${String(code)}`));
        return;
      }
      if (!shuttingDown && connected && wasCurrent) {
        scheduleTunnelRestart(`cloudflared exited with code ${String(code)}`);
      }
    });
  });
}

async function startCloudflaredWithRetry(command: string, attempts = 5): Promise<string> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      if (attempt > 1) console.log(`Retrying cloudflared tunnel (${attempt}/${attempts})...`);
      return await startCloudflared(command);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      tunnelProcess = null;
      if (attempt < attempts) await sleep(1500 * attempt);
    }
  }
  throw lastError || new Error('cloudflared tunnel failed');
}

function scheduleTunnelRestart(reason: string): void {
  if (shuttingDown || tunnelRestartTimer || !activeTunnelCommand) return;
  console.error(`Codex WebUI public tunnel restart scheduled: ${reason}`);
  tunnelRestartTimer = setTimeout(() => {
    const command = activeTunnelCommand;
    const provider = activeTunnelProvider;
    if (provider === 'cloudflared') {
      const oldProcess = tunnelProcess;
      tunnelProcess = null;
      try { oldProcess?.kill(); } catch {}
    }
    tunnelRestartTimer = null;
    ensureTunnelRunning(command, provider).then((publicUrl) => {
      console.log(`Codex WebUI public tunnel reconnected: ${publicUrl}`);
    }).catch((error) => {
      console.error(`Codex WebUI public tunnel restart failed: ${error instanceof Error ? error.message : String(error)}`);
      scheduleTunnelRestart('restart failed');
    });
  }, 1500);
}

function ensureTunnelRunning(command: string, provider: TunnelProvider): Promise<string> {
  activeTunnelProvider = provider;
  activeTunnelCommand = command;
  if (provider === 'tailscale') {
    activeCloudflaredCommand = null;
    return startTailscaleFunnel(command).then((publicUrl) => {
      publicFailureCount = 0;
      return publicUrl;
    });
  }
  activeCloudflaredCommand = command;
  if (tunnelProcess && activePublicStatus?.publicUrl) return Promise.resolve(activePublicStatus.publicUrl);
  if (tunnelStartPromise) return tunnelStartPromise;
  tunnelStartPromise = startCloudflaredWithRetry(command).then((publicUrl) => {
    publicFailureCount = 0;
    return publicUrl;
  }).finally(() => {
    tunnelStartPromise = null;
  });
  return tunnelStartPromise;
}

function startPublicMonitor(): void {
  if (publicMonitor) return;
  publicMonitor = setInterval(async () => {
    if (shuttingDown || publicCheckRunning || !activeTunnelCommand) return;
    publicCheckRunning = true;
    try {
      if (await checkPublicTunnel()) {
        publicFailureCount = 0;
        return;
      }
      publicFailureCount += 1;
      if (publicFailureCount >= 2) {
        publicFailureCount = 0;
        scheduleTunnelRestart('public health check failed');
      }
    } finally {
      publicCheckRunning = false;
    }
  }, 15000);
}

function writeStatus(command: string, publicUrl: string, provider: TunnelProvider = 'cloudflared'): void {
  fs.mkdirSync(logDir, { recursive: true });
  activePublicStatus = { provider, command, publicUrl };
  const status = {
    startedAt: new Date().toISOString(),
    localUrl: `http://127.0.0.1:${port}`,
    healthUrl: healthUrl(),
    publicUrl,
    tunnelProvider: provider,
    stableDomain: provider === 'tailscale',
    publicAuth: publicPassword ? { enabled: true, user: publicUser, passwordSource: 'CODEX_WEBUI_PUBLIC_PASSWORD or ~/.cx-codex/config.json' } : { enabled: false },
    cloudflaredCommand: provider === 'cloudflared' ? command : null,
    tailscaleCommand: provider === 'tailscale' ? command : null,
    webPid: webProcess?.pid || null,
    tunnelPid: provider === 'cloudflared' ? tunnelProcess?.pid || null : null
  };
  fs.writeFileSync(path.join(logDir, 'public-tunnel.json'), `${JSON.stringify(status, null, 2)}\n`, 'utf8');
}

function cleanup(): void {
  if (shuttingDown) return;
  shuttingDown = true;
  if (webRestartTimer) clearTimeout(webRestartTimer);
  if (tunnelRestartTimer) clearTimeout(tunnelRestartTimer);
  if (healthMonitor) clearInterval(healthMonitor);
  if (publicMonitor) clearInterval(publicMonitor);
  try { tunnelProcess?.kill(); } catch {}
  try { webProcess?.kill(); } catch {}
}

process.once('SIGINT', () => {
  cleanup();
  process.exit(130);
});
process.once('SIGTERM', () => {
  cleanup();
  process.exit(143);
});
process.once('exit', cleanup);

async function main(): Promise<void> {
  if (!publicPassword) {
    console.warn('WARNING: CODEX_WEBUI_PUBLIC_PASSWORD is empty; public tunnel will not require browser auth.');
  }
  const tunnel = resolveTunnel();
  const cloudflared = tunnel.command;
  await ensureWebUiRunning();
  const publicUrl = await ensureTunnelRunning(tunnel.command, tunnel.provider);
  startHealthMonitor();
  startPublicMonitor();
  console.log('');
  console.log('Codex WebUI Public is running!');
  console.log(`  Local:       http://127.0.0.1:${port}`);
  console.log(`  Health:      ${healthUrl()}`);
  console.log(`  Tunnel:      ${publicUrl}`);
  console.log(`  Provider:    ${tunnel.provider}`);
  console.log(`  Auth:        ${publicPassword ? `Basic user=${publicUser}` : 'disabled'}`);
  console.log(`  Command:     ${cloudflared}`);
  console.log(`  Logs:        ${logDir}`);
}

main().catch((error) => {
  cleanup();
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
