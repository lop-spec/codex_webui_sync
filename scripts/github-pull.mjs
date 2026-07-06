#!/usr/bin/env node
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  DEFAULT_CONFIG as SYNC_DEFAULT_CONFIG,
  collectSyncFiles,
  createPathMatcher,
  createSyncFilter,
  gitBlobSha,
  localPathForSyncPath,
  localSourceInfo,
  loadConfig,
  toPosixPath
} from './github-sync.mjs';

export const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

export const DEFAULT_PULL_CONFIG = {
  owner: 'lop-spec',
  repo: 'codex_webui_sync',
  branch: 'main',
  intervalMs: 30000,
  maxApplyPerRun: 200,
  sourceMarkerPath: 'sync-meta/source.json',
  backupRoot: 'outputs/github-pull-backups',
  statePath: 'logs/github-pull-state.json',
  protectedPaths: [
    'Codex-webui-ts/src/public-tunnel.ts',
    'Codex-webui-react/server/public-tunnel.ts',
    'Codex-webui-ts/src/p2p-helper.ts',
    'Codex-webui-ts/public/p2p-phone.html',
    'Codex-webui-ts/public/css/p2p-phone.css',
    'Codex-webui-ts/public/js/p2p-phone.js',
    'Codex-webui-ts/public/js/p2p-transfer.js',
    'Codex-webui-ts/history.json',
    'Codex-webui-react/history.json',
    '.codex/**',
    '.agents/**',
    'logs/**',
    'outputs/**'
  ],
  protectedTerms: [
    'Tailscale',
    'taild612f8.ts.net',
    'trycloudflare',
    'cloudflared',
    'public-tunnel',
    'publicTunnel',
    'CODEX_WEBUI_PUBLIC_PASSWORD',
    'CODEX_WEBUI_PUBLIC_URL',
    'CODEX_APP_SERVER_URL',
    '5055',
    '5056',
    '5155',
    '5156',
    '127.0.0.1',
    'localhost',
    'localPath',
    'openLocalPath',
    'ShellExecute',
    'p2p-phone',
    'p2p-transfer',
    'p2p-helper',
    'androidInbox',
    'Codex_RECYCLE',
    'C:\\Users\\lop',
    'C:/Users/lop'
  ],
  protectedRuleTerms: [
    '本机',
    '公网',
    'Tailscale',
    'trycloudflare',
    '5055',
    '5056',
    '5155',
    '5156',
    'Codex_RECYCLE',
    'C:\\Users\\lop',
    'C:/Users/lop'
  ]
};

function stamp() {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false });
}

function parseBool(value, fallback) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  return Boolean(fallback);
}

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function mergeConfig(base, next) {
  const out = structuredClone(base);
  for (const [key, value] of Object.entries(next || {})) {
    if (Array.isArray(value)) out[key] = value.slice();
    else if (isObject(value) && isObject(out[key])) out[key] = mergeConfig(out[key], value);
    else if (value !== undefined) out[key] = value;
  }
  return out;
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function loadPullConfig(rootDir = root, env = process.env) {
  const syncConfig = loadConfig(rootDir, env);
  let pull = mergeConfig(DEFAULT_PULL_CONFIG, syncConfig.pull || {});
  for (const name of ['github-pull.config.json', 'github-pull.config.local.json']) {
    const loaded = readJsonIfExists(path.join(rootDir, name));
    if (loaded) pull = mergeConfig(pull, loaded);
  }
  pull.owner = env.GITHUB_PULL_OWNER || env.GITHUB_SYNC_OWNER || pull.owner || syncConfig.owner || '';
  pull.repo = env.GITHUB_PULL_REPO || env.GITHUB_SYNC_REPO || pull.repo || syncConfig.repo || path.basename(rootDir);
  pull.branch = env.GITHUB_PULL_BRANCH || env.GITHUB_SYNC_BRANCH || pull.branch || syncConfig.branch || 'main';
  pull.token = env.GITHUB_PULL_TOKEN || env.GITHUB_SYNC_TOKEN || env.GITHUB_TOKEN || '';
  pull.intervalMs = Number(env.GITHUB_PULL_INTERVAL_MS || pull.intervalMs || DEFAULT_PULL_CONFIG.intervalMs);
  pull.maxApplyPerRun = Number(pull.maxApplyPerRun || DEFAULT_PULL_CONFIG.maxApplyPerRun);
  pull.sourceMarkerPath = toPosixPath(pull.sourceMarkerPath || syncConfig.sourceMarkerPath || DEFAULT_PULL_CONFIG.sourceMarkerPath);
  pull.backupRoot = toPosixPath(pull.backupRoot || DEFAULT_PULL_CONFIG.backupRoot);
  pull.statePath = toPosixPath(pull.statePath || DEFAULT_PULL_CONFIG.statePath);
  pull.protectedPaths = (pull.protectedPaths || []).map(toPosixPath).filter(Boolean);
  pull.protectedTerms = (pull.protectedTerms || []).filter(Boolean);
  pull.protectedRuleTerms = (pull.protectedRuleTerms || []).filter(Boolean);
  pull.applyDeletes = parseBool(env.GITHUB_PULL_APPLY_DELETES, pull.applyDeletes || false);
  return { syncConfig, pull };
}

function repoApiBase(config) {
  if (!config.owner || !config.repo) throw new Error('missing GitHub pull owner/repo');
  return `/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}`;
}

function branchRefPath(branch) {
  return String(branch || 'main').split('/').map(encodeURIComponent).join('/');
}

async function githubRequest(config, route) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'github-ui-realtime-pull',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  if (config.token) headers.Authorization = `Bearer ${config.token}`;
  const response = await fetch(`https://api.github.com${route}`, { headers });
  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = { message: text }; }
  }
  if (!response.ok) {
    throw new Error(`GitHub GET ${route} failed: ${response.status} ${data?.message || response.statusText}`);
  }
  return data;
}

export async function fetchRemoteSnapshot(pullConfig) {
  const base = repoApiBase(pullConfig);
  const ref = await githubRequest(pullConfig, `${base}/git/ref/heads/${branchRefPath(pullConfig.branch)}`);
  const headSha = ref.object?.sha;
  if (!headSha) throw new Error('GitHub branch ref has no commit sha');
  const commit = await githubRequest(pullConfig, `${base}/git/commits/${headSha}`);
  const treeSha = commit.tree?.sha;
  if (!treeSha) throw new Error('GitHub head commit has no tree sha');
  const tree = await githubRequest(pullConfig, `${base}/git/trees/${treeSha}?recursive=1`);
  if (tree.truncated) throw new Error('GitHub tree response is truncated; narrow sync include patterns before pulling');
  const files = (tree.tree || [])
    .filter((item) => item.type === 'blob' && item.path && item.sha)
    .map((item) => ({
      path: toPosixPath(item.path),
      sha: item.sha,
      size: item.size || 0,
      url: item.url
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
  return { headSha, treeSha, files };
}

async function fetchBlobContent(pullConfig, sha) {
  const base = repoApiBase(pullConfig);
  const blob = await githubRequest(pullConfig, `${base}/git/blobs/${sha}`);
  if (blob.encoding !== 'base64') throw new Error(`unsupported blob encoding for ${sha}: ${blob.encoding}`);
  return Buffer.from(String(blob.content || '').replace(/\s+/g, ''), 'base64');
}

function textFromBuffer(buffer) {
  return buffer.toString('utf8');
}

function includesAnyTerm(text, terms) {
  return terms.some((term) => text.includes(term));
}

export function createProtectedMatcher(pullConfig) {
  const protectedPath = createPathMatcher(pullConfig.protectedPaths || []);
  return (relPath, localText = '', remoteText = '') => {
    const normalized = toPosixPath(relPath);
    if (protectedPath(normalized)) return { protected: true, reason: 'protected-path' };
    const terms = /\.md$/i.test(normalized)
      ? [...(pullConfig.protectedTerms || []), ...(pullConfig.protectedRuleTerms || [])]
      : (pullConfig.protectedTerms || []);
    if (includesAnyTerm(localText, terms) || includesAnyTerm(remoteText, terms)) {
      return { protected: true, reason: 'protected-term' };
    }
    return { protected: false, reason: '' };
  };
}

function backupPathFor(rootDir, pullConfig, relPath, runId) {
  return path.join(rootDir, pullConfig.backupRoot, runId, relPath);
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function readJson(filePath, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return fallback; }
}

function writePullState(rootDir, pullConfig, data) {
  writeJson(path.join(rootDir, pullConfig.statePath), {
    ...data,
    updatedAt: new Date().toISOString()
  });
}

async function remoteSourceInfo(pullConfig, remoteSnapshot) {
  const markerPath = pullConfig.sourceMarkerPath || DEFAULT_PULL_CONFIG.sourceMarkerPath;
  const marker = remoteSnapshot.files.find((file) => file.path === markerPath);
  if (!marker) return null;
  const content = await fetchBlobContent(pullConfig, marker.sha);
  try {
    return JSON.parse(content.toString('utf8'));
  } catch {
    return null;
  }
}

export function collectLocalPortableFiles(rootDir, syncConfig) {
  return collectSyncFiles(rootDir, syncConfig).files;
}

export async function compareRemoteToLocal({ rootDir = root, syncConfig, pullConfig, remoteSnapshot, includeContent = false } = {}) {
  const shouldSync = createSyncFilter(syncConfig);
  const protectedMatcher = createProtectedMatcher(pullConfig);
  const localFiles = collectLocalPortableFiles(rootDir, syncConfig);
  const localByPath = new Map(localFiles.map((file) => [file.path, file]));
  const remoteFiles = remoteSnapshot.files.filter((file) => shouldSync(file.path));
  const remoteByPath = new Map(remoteFiles.map((file) => [file.path, file]));
  const changed = [];
  const protectedChanged = [];
  const missingRemote = [];

  for (const remote of remoteFiles) {
    if (remote.path === pullConfig.sourceMarkerPath) continue;
    const local = localByPath.get(remote.path);
    const localSha = local?.sha || null;
    if (localSha === remote.sha) continue;
    const localText = local ? textFromBuffer(local.content) : '';
    let remoteContent = null;
    let remoteText = '';
    if (includeContent || local) {
      remoteContent = await fetchBlobContent(pullConfig, remote.sha);
      remoteText = textFromBuffer(remoteContent);
    }
    const guard = protectedMatcher(remote.path, localText, remoteText);
    const item = {
      path: remote.path,
      localSha,
      remoteSha: remote.sha,
      existsLocal: Boolean(local),
      reason: guard.reason
    };
    if (remoteContent) item.remoteContent = remoteContent;
    if (guard.protected) protectedChanged.push(item);
    else changed.push(item);
  }

  for (const local of localFiles) {
    if (!remoteByPath.has(local.path)) missingRemote.push({ path: local.path, localSha: local.sha });
  }

  return {
    headSha: remoteSnapshot.headSha,
    remoteCount: remoteFiles.length,
    localCount: localFiles.length,
    changed,
    protectedChanged,
    missingRemote
  };
}

export async function pullOnce({ rootDir = root, syncConfig, pullConfig, dryRun = false } = {}) {
  const remoteSnapshot = await fetchRemoteSnapshot(pullConfig);
  const pullState = readJson(path.join(rootDir, pullConfig.statePath), null);
  const source = localSourceInfo(rootDir, syncConfig);
  const remoteSource = await remoteSourceInfo(pullConfig, remoteSnapshot);
  if (pullState?.headSha === remoteSnapshot.headSha) {
    return {
      ok: true,
      dryRun,
      skipped: true,
      skipReason: 'already-processed-head',
      applied: [],
      headSha: remoteSnapshot.headSha,
      remoteSource,
      localSource: source,
      remoteCount: remoteSnapshot.files.length,
      localCount: collectLocalPortableFiles(rootDir, syncConfig).length,
      changed: [],
      protectedChanged: [],
      missingRemote: []
    };
  }
  const syncState = readJson(path.join(rootDir, syncConfig.sourceStatePath || 'logs/github-sync-state.json'), null);
  const knownOwnHead = syncState?.headSha === remoteSnapshot.headSha || syncState?.commitSha === remoteSnapshot.headSha;
  if (remoteSource?.sourceId === source.sourceId && knownOwnHead) {
    writePullState(rootDir, pullConfig, {
      headSha: remoteSnapshot.headSha,
      skipped: true,
      skipReason: 'own-source',
      remoteSource,
      localSource: source
    });
    return {
      ok: true,
      dryRun,
      skipped: true,
      skipReason: 'own-source',
      applied: [],
      headSha: remoteSnapshot.headSha,
      remoteSource,
      localSource: source,
      remoteCount: remoteSnapshot.files.length,
      localCount: collectLocalPortableFiles(rootDir, syncConfig).length,
      changed: [],
      protectedChanged: [],
      missingRemote: []
    };
  }
  const comparison = await compareRemoteToLocal({
    rootDir,
    syncConfig,
    pullConfig,
    remoteSnapshot,
    includeContent: true
  });
  if (comparison.changed.length > pullConfig.maxApplyPerRun) {
    throw new Error(`refusing to apply ${comparison.changed.length} files in one pull; inspect status or raise maxApplyPerRun`);
  }
  if (dryRun) return { ok: true, dryRun: true, applied: [], remoteSource, localSource: source, ...comparison };

  const runId = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const applied = [];
  for (const item of comparison.changed) {
    let remoteContent = item.remoteContent;
    if (!remoteContent) remoteContent = await fetchBlobContent(pullConfig, item.remoteSha);
    const localPath = localPathForSyncPath(rootDir, syncConfig, item.path);
    if (fs.existsSync(localPath)) {
      const backupPath = backupPathFor(rootDir, pullConfig, item.path, runId);
      fs.mkdirSync(path.dirname(backupPath), { recursive: true });
      fs.copyFileSync(localPath, backupPath);
    }
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    fs.writeFileSync(localPath, remoteContent);
    applied.push({ path: item.path, remoteSha: item.remoteSha, backup: item.existsLocal ? toPosixPath(path.relative(rootDir, backupPathFor(rootDir, pullConfig, item.path, runId))) : null });
  }

  const state = {
    headSha: comparison.headSha,
    remoteSource,
    localSource: source,
    applied,
    protectedChanged: comparison.protectedChanged.map(({ path, localSha, remoteSha, reason }) => ({ path, localSha, remoteSha, reason })),
    missingRemote: comparison.missingRemote
  };
  writePullState(rootDir, pullConfig, state);
  return { ok: true, dryRun: false, applied, remoteSource, localSource: source, ...comparison };
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = { status: false, once: false, watch: false, dryRun: false, json: false };
  for (const arg of argv) {
    if (arg === '--status') out.status = true;
    else if (arg === '--once') out.once = true;
    else if (arg === '--watch') out.watch = true;
    else if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--json') out.json = true;
    else if (arg === '--help' || arg === '-h') out.help = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!out.status && !out.once && !out.watch) out.status = true;
  return out;
}

function printHelp() {
  console.log([
    'GitHub realtime pull/merge',
    '',
    'Commands:',
    '  node scripts/github-pull.mjs --status',
    '  node scripts/github-pull.mjs --once --dry-run',
    '  node scripts/github-pull.mjs --once',
    '  node scripts/github-pull.mjs --watch'
  ].join('\n'));
}

function summarize(result) {
  return {
    headSha: result.headSha,
    skipReason: result.skipReason || '',
    remoteCount: result.remoteCount,
    localCount: result.localCount,
    changedCount: result.changed.length,
    protectedChangedCount: result.protectedChanged.length,
    missingRemoteCount: result.missingRemote.length,
    appliedCount: result.applied?.length || 0
  };
}

function printResult(result, mode) {
  const summary = summarize(result);
  console.log(`[github-pull] ${mode}: remote=${summary.remoteCount}, local=${summary.localCount}, apply=${summary.appliedCount}, pending=${summary.changedCount}, protected=${summary.protectedChangedCount}, missingRemote=${summary.missingRemoteCount}`);
  if (summary.skipReason) console.log(`[github-pull] skipped: ${summary.skipReason}`);
  if (result.remoteSource?.sourceId) console.log(`[github-pull] remote source: ${result.remoteSource.sourceName || 'unknown'} (${result.remoteSource.sourceId})`);
  if (result.localSource?.sourceId) console.log(`[github-pull] local source: ${result.localSource.sourceName || 'unknown'} (${result.localSource.sourceId})`);
  if (result.applied?.length) {
    for (const item of result.applied.slice(0, 40)) console.log(`  applied ${item.path}`);
  }
  if (result.protectedChanged?.length) {
    for (const item of result.protectedChanged.slice(0, 20)) console.log(`  protected ${item.path} (${item.reason})`);
  }
}

async function runStatus(rootDir, syncConfig, pullConfig) {
  const remoteSnapshot = await fetchRemoteSnapshot(pullConfig);
  const remoteSource = await remoteSourceInfo(pullConfig, remoteSnapshot);
  const result = await compareRemoteToLocal({ rootDir, syncConfig, pullConfig, remoteSnapshot, includeContent: true });
  return { ok: true, applied: [], remoteSource, localSource: localSourceInfo(rootDir, syncConfig), ...result, state: readJson(path.join(rootDir, pullConfig.statePath), null) };
}

async function runWatch(rootDir, syncConfig, pullConfig) {
  let running = false;
  let timer = null;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const result = await pullOnce({ rootDir, syncConfig, pullConfig, dryRun: false });
      printResult(result, 'watch');
    } catch (error) {
      console.error(`[github-pull] ${error.message}`);
    } finally {
      running = false;
      timer = setTimeout(run, pullConfig.intervalMs);
    }
  };
  console.log(`[${stamp()}] watching GitHub -> local portable source/rules (${pullConfig.owner}/${pullConfig.repo}#${pullConfig.branch}, ${pullConfig.intervalMs}ms)`);
  run();
  process.on('SIGINT', () => {
    clearTimeout(timer);
    process.exit(0);
  });
}

async function main() {
  const args = parseArgs();
  if (args.help) {
    printHelp();
    return;
  }
  const { syncConfig, pull } = loadPullConfig(root);
  if (args.status) {
    const result = await runStatus(root, syncConfig, pull);
    if (args.json) console.log(JSON.stringify(result, null, 2));
    else printResult(result, 'status');
    return;
  }
  if (args.watch) {
    await runWatch(root, syncConfig, pull);
    return;
  }
  const result = await pullOnce({ rootDir: root, syncConfig, pullConfig: pull, dryRun: args.dryRun });
  if (args.json) console.log(JSON.stringify(result, null, 2));
  else printResult(result, args.dryRun ? 'dry-run' : 'once');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`[github-pull] ${error.message}`);
    process.exit(1);
  });
}
