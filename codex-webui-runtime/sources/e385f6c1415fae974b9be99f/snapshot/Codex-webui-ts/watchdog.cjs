const fs = require('fs');
const http = require('http');
const path = require('path');
const { execFile: execFileRaw, spawn } = require('child_process');

const WEBUI_DIR = __dirname;
const WEBUI_PORT = Number(process.env.CODEX_WEBUI_PORT || 5055);
const HEALTH_URL = `http://127.0.0.1:${WEBUI_PORT}/config`;
const CHECK_INTERVAL_MS = Number(process.env.CODEX_WEBUI_WATCHDOG_INTERVAL_MS || 5000);
const LOG_DIR = path.join(WEBUI_DIR, 'logs');
const WATCHDOG_PID_FILE = path.join(LOG_DIR, 'webui-watchdog.pid');
const WATCHDOG_LOG = path.join(LOG_DIR, 'webui-watchdog.log');
const WEBUI_OUT_LOG = path.join(LOG_DIR, `server-${WEBUI_PORT}.out.log`);
const WEBUI_ERR_LOG = path.join(LOG_DIR, `server-${WEBUI_PORT}.err.log`);

fs.mkdirSync(LOG_DIR, { recursive: true });

function log(message) {
  const line = `${new Date().toISOString()} ${message}\n`;
  fs.appendFileSync(WATCHDOG_LOG, line);
}

function execFile(file, args, options = {}) {
  return new Promise((resolve) => {
    execFileRaw(
      file,
      args,
      {
        cwd: WEBUI_DIR,
        encoding: 'utf8',
        windowsHide: true,
        maxBuffer: 8 * 1024 * 1024,
        ...options,
      },
      (error, stdout = '', stderr = '') => resolve({ error, stdout, stderr }),
    );
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function get(url, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      res.on('end', () => resolve({ ok: res.statusCode === 200, statusCode: res.statusCode }));
    });
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('timeout'));
    });
    req.on('error', (error) => resolve({ ok: false, error }));
  });
}

async function isHealthy() {
  const result = await get(HEALTH_URL);
  return result.ok;
}

async function listenerPids(port) {
  const { stdout } = await execFile('netstat.exe', ['-ano', '-p', 'tcp']);
  const pids = new Set();
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || !/\bLISTENING\b/i.test(trimmed)) continue;
    const parts = trimmed.split(/\s+/);
    const local = parts[1] || '';
    const pid = parts[parts.length - 1] || '';
    if ((local.endsWith(`:${port}`) || local.includes(`:${port}`)) && /^\d+$/.test(pid)) {
      pids.add(Number(pid));
    }
  }
  return [...pids];
}

async function processCommandLine(pid) {
  const query = `ProcessId=${Number(pid)}`;
  const { stdout } = await execFile('wmic.exe', ['process', 'where', query, 'get', 'CommandLine', '/value']);
  const match = stdout.match(/CommandLine=(.*)/i);
  return match ? match[1].trim() : '';
}

function isWebuiServerCommand(commandLine) {
  const normalized = commandLine.replace(/\\/g, '/').toLowerCase();
  return normalized.includes('/codex-webui-ts/')
    && normalized.includes('node')
    && normalized.includes('dist/server.js');
}

async function killPid(pid) {
  await execFile('taskkill.exe', ['/F', '/PID', String(pid)]);
}

function startWebui() {
  const out = fs.openSync(WEBUI_OUT_LOG, 'a');
  const err = fs.openSync(WEBUI_ERR_LOG, 'a');
  const child = spawn(process.execPath, ['dist/server.js'], {
    cwd: WEBUI_DIR,
    detached: true,
    windowsHide: true,
    stdio: ['ignore', out, err],
  });
  child.unref();
  log(`started webui pid=${child.pid}`);
  return child.pid;
}

let recovering = false;

async function recoverWebuiIfNeeded() {
  if (recovering) return;
  recovering = true;
  try {
    if (await isHealthy()) return;

    const pids = await listenerPids(WEBUI_PORT);
    if (pids.length === 0) {
      log(`webui unhealthy and port ${WEBUI_PORT} is free; starting`);
      startWebui();
      return;
    }

    const owned = [];
    const foreign = [];
    for (const pid of pids) {
      const commandLine = await processCommandLine(pid);
      if (isWebuiServerCommand(commandLine)) {
        owned.push(pid);
      } else {
        foreign.push({ pid, commandLine });
      }
    }

    if (owned.length > 0) {
      log(`webui unhealthy; killing stale webui listeners pid=${owned.join(',')}`);
      await Promise.allSettled(owned.map(killPid));
      await sleep(1000);
      startWebui();
      return;
    }

    log(`webui unhealthy but port ${WEBUI_PORT} is owned by foreign process pid=${foreign.map((item) => item.pid).join(',')}; skip`);
  } catch (error) {
    log(`recover failed: ${error && error.stack ? error.stack : error}`);
  } finally {
    recovering = false;
  }
}

fs.writeFileSync(WATCHDOG_PID_FILE, String(process.pid));
log(`watchdog started pid=${process.pid}`);

process.on('uncaughtException', (error) => {
  log(`uncaughtException: ${error && error.stack ? error.stack : error}`);
});

process.on('unhandledRejection', (error) => {
  log(`unhandledRejection: ${error && error.stack ? error.stack : error}`);
});

recoverWebuiIfNeeded();
setInterval(recoverWebuiIfNeeded, CHECK_INTERVAL_MS);
