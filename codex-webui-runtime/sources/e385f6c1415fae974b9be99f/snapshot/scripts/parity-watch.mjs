#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const full = process.argv.includes('--full');
const checkScript = path.join(root, 'scripts', 'parity-check.mjs');
const debounceMs = 700;
const watchTargets = [
  'Codex-webui-ts/src',
  'Codex-webui-ts/public',
  'Codex-webui-ts/AGENTS.md',
  'Codex-webui-ts/RULES.md',
  'Codex-webui-ts/package.json',
  'Codex-webui-react/server',
  'Codex-webui-react/src',
  'Codex-webui-react/static',
  'Codex-webui-react/docs',
  'Codex-webui-react/AGENTS.md',
  'Codex-webui-react/RULES.md',
  'Codex-webui-react/index.html',
  'Codex-webui-react/package.json',
  'parity',
  'scripts/parity-check.mjs'
];

const ignored = /(^|[\\/])(node_modules|dist|outputs|logs|tests|public[\\/]assets|\.git)([\\/]|$)/i;
let timer = null;
let running = false;
let pending = false;
let lastChange = 'initial';

function stamp() {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false });
}

function schedule(change) {
  if (change && !ignored.test(change)) lastChange = change;
  clearTimeout(timer);
  timer = setTimeout(runCheck, debounceMs);
}

function runCheck() {
  if (running) {
    pending = true;
    return;
  }
  running = true;
  pending = false;
  const checkArgs = [checkScript, ...(full ? ['--full'] : [])];
  console.log(`[${stamp()}] parity ${full ? 'full' : 'fast'} check started: ${lastChange}`);
  const child = spawn(process.execPath, checkArgs, {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true
  });
  child.on('exit', (code) => {
    running = false;
    console.log(`[${stamp()}] parity check ${code === 0 ? 'passed' : `failed (${code})`}`);
    if (pending) schedule('queued changes');
  });
}

for (const relTarget of watchTargets) {
  const absTarget = path.join(root, relTarget);
  if (!fs.existsSync(absTarget)) continue;
  const stat = fs.statSync(absTarget);
  const watchPath = stat.isDirectory() ? absTarget : path.dirname(absTarget);
  fs.watch(watchPath, { recursive: stat.isDirectory() }, (_event, filename) => {
    const changed = filename ? path.join(relTarget, filename.toString()).replace(/\\/g, '/') : relTarget;
    if (!ignored.test(changed)) schedule(changed);
  });
}

console.log(`[${stamp()}] watching WebUI <-> React parity (${full ? 'full' : 'fast'} mode)`);
schedule('startup');
