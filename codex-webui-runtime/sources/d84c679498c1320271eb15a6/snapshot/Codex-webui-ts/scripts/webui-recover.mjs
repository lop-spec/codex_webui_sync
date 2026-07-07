import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const logDir = path.join(root, 'logs');
const webPort = Number(process.env.PORT || 5055);
const webHost = process.env.HOST || '0.0.0.0';
const defaultAppServerUrl = process.env.CODEX_APP_SERVER_URL || 'ws://127.0.0.1:5056';
const watchdogPidFile = path.join(logDir, 'webui-recover-watchdog.pid');
const watchdogStateFile = path.join(logDir, 'webui-recover-watchdog.json');
const recoveryStateFile = path.join(logDir, 'webui-recover-last.json');
const interruptedTurnStateFile = path.join(logDir, 'interrupted-turn.json');

function parseArgs(argv) {
  const options = {
    mode: 'ensure',
    delayMs: 0,
    intervalMs: 15000,
    launchApp: false,
    skipAppServer: false,
    skipAutoRecover: false,
    json: true
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--mode' && argv[index + 1]) options.mode = argv[++index];
    else if (arg.startsWith('--mode=')) options.mode = arg.slice('--mode='.length);
    else if (arg === '--delay' && argv[index + 1]) options.delayMs = Number(argv[++index] || 0);
    else if (arg.startsWith('--delay=')) options.delayMs = Number(arg.slice('--delay='.length) || 0);
    else if (arg === '--interval' && argv[index + 1]) options.intervalMs = Number(argv[++index] || 15000);
    else if (arg.startsWith('--interval=')) options.intervalMs = Number(arg.slice('--interval='.length) || 15000);
    else if (arg === '--launch-app') options.launchApp = true;
    else if (arg === '--skip-app-server') options.skipAppServer = true;
    else if (arg === '--skip-auto-recover') options.skipAutoRecover = true;
    else if (arg === '--plain') options.json = false;
  }
  options.delayMs = Math.max(0, Number.isFinite(options.delayMs) ? options.delayMs : 0);
  options.intervalMs = Math.max(5000, Number.isFinite(options.intervalMs) ? options.intervalMs : 15000);
  return options;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function now() {
  return new Date().toISOString();
}

function ensureLogDir() {
  fs.mkdirSync(logDir, { recursive: true });
}

function writeJson(filePath, value) {
  ensureLogDir();
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function appendLog(line) {
  ensureLogDir();
  fs.appendFileSync(path.join(logDir, 'webui-recover.log'), `[${now()}] ${line}\n`, 'utf8');
}

function healthUrl() {
  return `http://127.0.0.1:${webPort}/health`;
}

function endpointHealthUrl(endpoint) {
  return endpoint.replace(/^ws:/i, 'http:').replace(/^wss:/i, 'https:') + '/healthz';
}

function readAppServerEndpoint() {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(logDir, 'app-server-endpoint.json'), 'utf8'));
    if (typeof parsed.url === 'string' && /^wss?:\/\//i.test(parsed.url)) return parsed.url;
  } catch {}
  return defaultAppServerUrl;
}

function hasActiveInterruptedState() {
  try {
    const state = JSON.parse(fs.readFileSync(interruptedTurnStateFile, 'utf8'));
    return state?.active === true && state?.userStopped !== true;
  } catch {
    return false;
  }
}

function endpointPort(endpoint) {
  try {
    return Number(new URL(endpoint).port || 0);
  } catch {
    return 0;
  }
}

function request(url, options = {}) {
  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (error) {
      resolve({ ok: false, status: 0, error: error.message || String(error), body: '' });
      return;
    }
    const body = options.body ? Buffer.from(options.body) : null;
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: `${parsed.pathname}${parsed.search}`,
      method: options.method || 'GET',
      timeout: options.timeoutMs || 1500,
      headers: {
        ...(body ? { 'Content-Type': 'application/json', 'Content-Length': String(body.length) } : {}),
        ...(options.headers || {})
      }
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({ ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300, status: res.statusCode || 0, body: text });
      });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, status: 0, error: 'timeout', body: '' });
    });
    req.on('error', (error) => resolve({ ok: false, status: 0, error: error.message || String(error), body: '' }));
    if (body) req.write(body);
    req.end();
  });
}

async function requestJson(url, options = {}) {
  const response = await request(url, options);
  let data = null;
  try { data = response.body ? JSON.parse(response.body) : null; } catch {}
  return { ...response, data };
}

async function webHealth() {
  const health = await requestJson(healthUrl(), { timeoutMs: 1500 });
  if (!health.ok) return { ok: false, health };
  const sessions = await requestJson(`http://127.0.0.1:${webPort}/sessions`, { timeoutMs: 3000 });
  return { ok: sessions.ok, health, sessions };
}

async function webHealthLight() {
  const health = await requestJson(healthUrl(), { timeoutMs: 1200 });
  return { ok: health.ok, health };
}

async function appServerHealth(endpoint = readAppServerEndpoint()) {
  const health = await requestJson(endpointHealthUrl(endpoint), { timeoutMs: 1500 });
  return { ok: health.ok, endpoint, health };
}

function pidsForPort(port) {
  if (!port) return [];
  const result = spawnSync('netstat.exe', ['-ano', '-p', 'TCP'], { encoding: 'utf8', windowsHide: true });
  const text = `${result.stdout || ''}\n${result.stderr || ''}`;
  const pids = new Set();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || !/\bLISTENING\b/i.test(line)) continue;
    const parts = line.split(/\s+/);
    const local = parts[1] || '';
    const pid = Number(parts[parts.length - 1] || 0);
    if (pid > 0 && new RegExp(`:${port}$`).test(local)) pids.add(pid);
  }
  return [...pids];
}

function isPidRunning(pid) {
  if (!pid || pid === process.pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function killPidTree(pid, reason, events) {
  if (!pid || pid === process.pid) return;
  const result = spawnSync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
    encoding: 'utf8',
    windowsHide: true
  });
  events.push({
    action: 'kill',
    pid,
    reason,
    ok: result.status === 0,
    output: String(result.stdout || result.stderr || '').trim().slice(-1000)
  });
}

function killPorts(ports, reason, events) {
  const seen = new Set();
  for (const port of ports) {
    for (const pid of pidsForPort(port)) {
      if (seen.has(pid)) continue;
      seen.add(pid);
      killPidTree(pid, reason, events);
    }
  }
}

function npmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function ensureBuild(events) {
  const server = path.join(root, 'dist', 'server.js');
  if (fs.existsSync(server)) return;
  const result = spawnSync(npmCommand(), ['run', 'build'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true
  });
  events.push({ action: 'build', ok: result.status === 0, output: `${result.stdout || ''}${result.stderr || ''}`.slice(-2000) });
  if (result.status !== 0) throw new Error('npm run build failed before WebUI recovery');
}

function openLog(name) {
  ensureLogDir();
  return fs.openSync(path.join(logDir, name), 'a');
}

function startWebUi(events, envOverrides = {}) {
  ensureBuild(events);
  const out = openLog('webui-recover-5055.out.log');
  const err = openLog('webui-recover-5055.err.log');
  const child = spawn(process.execPath, ['dist/server.js'], {
    cwd: root,
    detached: true,
    windowsHide: true,
    stdio: ['ignore', out, err],
    env: {
      ...process.env,
      PORT: String(webPort),
      HOST: webHost,
      CODEX_WEBUI_RECOVERED_START: '1',
      ...envOverrides
    }
  });
  child.unref();
  try { fs.closeSync(out); } catch {}
  try { fs.closeSync(err); } catch {}
  events.push({ action: 'start-webui', pid: child.pid, port: webPort });
  fs.writeFileSync(path.join(logDir, 'webui-recover-5055.pid'), String(child.pid || ''), 'utf8');
}

async function waitForWebUi(events, timeoutMs = 18000, healthCheck = webHealth) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    const health = await healthCheck();
    if (health.ok) {
      events.push({ action: 'web-health', ok: true, port: webPort });
      return health;
    }
    await sleep(350);
  }
  const last = await healthCheck();
  events.push({ action: 'web-health', ok: false, port: webPort, error: last.health?.error || last.sessions?.error || '' });
  throw new Error(`WebUI did not become healthy on ${healthUrl()}`);
}

async function ensureWebUi(events) {
  const before = await webHealth();
  if (before.ok) {
    events.push({ action: 'web-health', ok: true, existing: true, port: webPort });
    return before;
  }
  events.push({ action: 'web-health', ok: false, existing: true, port: webPort, error: before.health?.error || before.sessions?.error || '' });
  killPorts([webPort], 'web health failed', events);
  startWebUi(events);
  return waitForWebUi(events);
}

async function ensureAppServer(events, recoverInterrupted = true) {
  const endpoint = readAppServerEndpoint();
  const before = await appServerHealth(endpoint);
  if (before.ok && !recoverInterrupted) {
    events.push({ action: 'app-server-health', ok: true, endpoint });
    return before;
  }
  if (before.ok) events.push({ action: 'app-server-health', ok: true, endpoint });
  else events.push({ action: 'app-server-health', ok: false, endpoint, error: before.health?.error || '' });
  let response = await requestJson(`http://127.0.0.1:${webPort}/webui/app-server/ensure`, {
    method: 'POST',
    timeoutMs: 45000,
    body: JSON.stringify({ recoverInterrupted })
  });
  events.push({ action: 'app-server-ensure', ok: response.ok, status: response.status, data: response.data });
  if (!response.ok && response.status === 404) {
    events.push({ action: 'webui-recovery-route-missing', ok: true, port: webPort });
    killPorts([webPort], 'recovery route missing', events);
    await sleep(600);
    startWebUi(events);
    await waitForWebUi(events);
    response = await requestJson(`http://127.0.0.1:${webPort}/webui/app-server/ensure`, {
      method: 'POST',
      timeoutMs: 45000,
      body: JSON.stringify({ recoverInterrupted })
    });
    events.push({ action: 'app-server-ensure-retry', ok: response.ok, status: response.status, data: response.data });
  }
  if (!response.ok) throw new Error(response.data?.error || response.error || `app-server ensure failed: HTTP ${response.status}`);
  return response;
}

function launchApp(events) {
  const out = openLog('webui-recover-app.out.log');
  const err = openLog('webui-recover-app.err.log');
  const child = spawn(process.execPath, ['scripts/webui-app.mjs', '--launch', '--skip-service-check'], {
    cwd: root,
    detached: true,
    windowsHide: true,
    stdio: ['ignore', out, err],
    env: { ...process.env }
  });
  child.unref();
  try { fs.closeSync(out); } catch {}
  try { fs.closeSync(err); } catch {}
  events.push({ action: 'launch-app', pid: child.pid });
}

async function restartWebUi(events, options) {
  const env = {
    CODEX_WEBUI_FAST_RESTART: '1',
    CODEX_WEBUI_AUTO_RECOVER: options.skipAutoRecover ? '0' : process.env.CODEX_WEBUI_AUTO_RECOVER
  };
  if (env.CODEX_WEBUI_AUTO_RECOVER == null) delete env.CODEX_WEBUI_AUTO_RECOVER;
  killPorts([webPort], 'explicit lightweight restart', events);
  await sleep(150);
  startWebUi(events, env);
  await waitForWebUi(events, 6000, webHealthLight);
}

async function recover(options) {
  const events = [];
  const startedAt = now();
  if (options.delayMs) await sleep(options.delayMs);
  try {
    if (options.mode === 'restart') {
      await restartWebUi(events, options);
    } else {
      await ensureWebUi(events);
    }
    const fullRecovery = options.mode !== 'restart';
    if (fullRecovery && !options.skipAppServer) await ensureAppServer(events, true);
    if (fullRecovery && options.launchApp) launchApp(events);
    const result = { ok: true, mode: options.mode, startedAt, finishedAt: now(), events };
    writeJson(recoveryStateFile, result);
    appendLog(`${options.mode} ok`);
    return result;
  } catch (error) {
    const result = { ok: false, mode: options.mode, startedAt, finishedAt: now(), error: error.message || String(error), events };
    writeJson(recoveryStateFile, result);
    appendLog(`${options.mode} failed: ${result.error}`);
    return result;
  }
}

function startWatchdog(options) {
  ensureLogDir();
  try {
    const pid = Number(fs.readFileSync(watchdogPidFile, 'utf8').trim());
    if (isPidRunning(pid)) return { ok: true, action: 'watchdog-existing', pid };
  } catch {}
  const out = openLog('webui-recover-watchdog.out.log');
  const err = openLog('webui-recover-watchdog.err.log');
  const child = spawn(process.execPath, ['scripts/webui-recover.mjs', '--mode', 'watch', '--interval', String(options.intervalMs)], {
    cwd: root,
    detached: true,
    windowsHide: true,
    stdio: ['ignore', out, err],
    env: { ...process.env }
  });
  child.unref();
  try { fs.closeSync(out); } catch {}
  try { fs.closeSync(err); } catch {}
  fs.writeFileSync(watchdogPidFile, String(child.pid || ''), 'utf8');
  const result = { ok: true, action: 'watchdog-started', pid: child.pid, intervalMs: options.intervalMs, updatedAt: now() };
  writeJson(watchdogStateFile, result);
  return result;
}

async function watch(options) {
  ensureLogDir();
  fs.writeFileSync(watchdogPidFile, String(process.pid), 'utf8');
  appendLog(`watchdog started pid=${process.pid}`);
  let lastAppServerCheck = 0;
  while (true) {
    const events = [];
    const web = await webHealthLight();
    let result = { ok: true, mode: 'watch', events: [{ action: 'web-health-light', ok: web.ok }] };
    if (!web.ok) {
      result = await recover({ ...options, mode: 'ensure', launchApp: false, delayMs: 0 });
    } else if (Date.now() - lastAppServerCheck >= 60_000) {
      lastAppServerCheck = Date.now();
      const needsAppServer = hasActiveInterruptedState();
      events.push({ action: 'interrupted-state-check', ok: true, active: needsAppServer });
      if (needsAppServer) {
        const interrupted = await requestJson(`http://127.0.0.1:${webPort}/webui/interrupted/recover`, {
          method: 'POST',
          timeoutMs: 45000,
          body: JSON.stringify({})
        });
        events.push({ action: 'interrupted-recover', ok: interrupted.ok || interrupted.status === 409, status: interrupted.status, data: interrupted.data });
        const app = await appServerHealth(readAppServerEndpoint());
        events.push({ action: 'app-server-health-light', ok: app.ok, endpoint: app.endpoint });
        if (!app.ok) {
          try {
            await ensureAppServer(events, true);
          } catch (error) {
            events.push({ action: 'app-server-ensure', ok: false, error: error.message || String(error) });
          }
        }
      }
      result = { ok: events.every((event) => event.ok !== false), mode: 'watch', events };
    }
    writeJson(watchdogStateFile, {
      ok: result.ok,
      pid: process.pid,
      mode: 'watch',
      intervalMs: options.intervalMs,
      lastRunAt: now(),
      lastError: result.ok ? null : result.error,
      lastEvents: result.events
    });
    await sleep(options.intervalMs);
  }
}

async function status() {
  const endpoint = readAppServerEndpoint();
  return {
    ok: true,
    mode: 'status',
    web: await webHealth(),
    appServer: await appServerHealth(endpoint),
    endpoint,
    pids: {
      web: pidsForPort(webPort),
      appServer: pidsForPort(endpointPort(endpoint) || endpointPort(defaultAppServerUrl))
    },
    watchdog: (() => {
      try {
        const pid = Number(fs.readFileSync(watchdogPidFile, 'utf8').trim());
        return { pid, running: isPidRunning(pid) };
      } catch {
        return { pid: null, running: false };
      }
    })()
  };
}

const options = parseArgs(process.argv.slice(2));
let result;
if (options.mode === 'watch') {
  await watch(options);
} else if (options.mode === 'start-watchdog') {
  result = startWatchdog(options);
} else if (options.mode === 'status') {
  result = await status();
} else if (['ensure', 'recover', 'restart'].includes(options.mode)) {
  result = await recover(options);
} else {
  result = { ok: false, error: `unknown mode: ${options.mode}` };
  process.exitCode = 2;
}

if (result) {
  if (options.json) console.log(JSON.stringify(result, null, 2));
  else console.log(result.ok ? 'OK' : (result.error || 'FAILED'));
  if (!result.ok) process.exitCode = process.exitCode || 1;
}
