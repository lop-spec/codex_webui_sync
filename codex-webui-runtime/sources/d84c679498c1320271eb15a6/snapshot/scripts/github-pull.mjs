#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  collectSyncFiles,
  createPathMatcher,
  createSyncFilter,
  gitBlobSha,
  localPathForSyncPath,
  localSourceInfo,
  loadConfig,
  runtimeRootPath,
  toPosixPath
} from './github-sync.mjs';

export const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

export const DEFAULT_PULL_CONFIG = {
  owner: 'lop-spec',
  repo: 'codex_webui_sync',
  branch: 'main',
  intervalMs: 30000,
  maxApplyPerRun: 200,
  backupRoot: 'outputs/github-pull-backups',
  statePath: 'logs/github-pull-state.json',
  protectedPaths: [
    'Codex-webui-ts/history.json',
    'Codex-webui-react/history.json',
    'codex/rules/default.rules',
    'codex/skills/.system/**',
    '.codex/**',
    '.agents/**',
    'logs/**',
    'outputs/**',
    '**/logs/**',
    '**/outputs/**',
    '**/history/**',
    '**/sessions/**',
    '**/auth/**',
    '**/.system/**',
    '**/config.toml'
  ],
  protectedTerms: [],
  protectedRuleTerms: [],
  verifyAfterApply: true,
  verifyCommands: [
    {
      name: 'github-sync-focused-tests',
      command: process.execPath,
      args: ['--test', 'tests/github-sync.test.mjs', 'tests/github-pull.test.mjs']
    }
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

function mergeGuardList(defaultValues, configuredValues, normalize = (value) => value) {
  const out = [];
  const seen = new Set();
  for (const value of [...(defaultValues || []), ...(configuredValues || [])]) {
    const item = normalize(value);
    if (!item || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
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
  pull.runtimeRoot = toPosixPath(pull.runtimeRoot || syncConfig.runtimeRoot || runtimeRootPath(syncConfig));
  pull.backupRoot = toPosixPath(pull.backupRoot || DEFAULT_PULL_CONFIG.backupRoot);
  pull.statePath = toPosixPath(pull.statePath || DEFAULT_PULL_CONFIG.statePath);
  pull.protectedPaths = mergeGuardList(DEFAULT_PULL_CONFIG.protectedPaths, pull.protectedPaths, toPosixPath);
  pull.protectedTerms = mergeGuardList(DEFAULT_PULL_CONFIG.protectedTerms, pull.protectedTerms);
  pull.protectedRuleTerms = mergeGuardList(DEFAULT_PULL_CONFIG.protectedRuleTerms, pull.protectedRuleTerms);
  pull.applyDeletes = parseBool(env.GITHUB_PULL_APPLY_DELETES, pull.applyDeletes || false);
  pull.verifyAfterApply = parseBool(env.GITHUB_PULL_VERIFY_AFTER_APPLY, pull.verifyAfterApply ?? DEFAULT_PULL_CONFIG.verifyAfterApply);
  pull.verifyCommands = normalizeVerifyCommands(pull.verifyCommands);
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

export function isSameLocalSource(remoteSource, localSource) {
  if (!remoteSource || !localSource) return false;
  if (remoteSource.sourceId && localSource.sourceId && remoteSource.sourceId === localSource.sourceId) return true;
  return false;
}

function backupPathFor(rootDir, pullConfig, relPath, runId) {
  return path.join(rootDir, pullConfig.backupRoot, runId, relPath);
}

function requiresRuntimeVerify(relPath) {
  return /^scripts\/.*\.m?js$/i.test(toPosixPath(relPath));
}

function verifyRuntimeContent(relPath, content) {
  if (!requiresRuntimeVerify(relPath)) return { ok: true };
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'github-pull-verify-'));
  const tempFile = path.join(tempDir, path.basename(relPath));
  try {
    fs.writeFileSync(tempFile, content);
    const result = spawnSync(process.execPath, ['--check', tempFile], { encoding: 'utf8' });
    if (result.status === 0) return { ok: true };
    return {
      ok: false,
      reason: 'verify-runtime-failed',
      detail: String(result.stderr || result.stdout || '').trim()
    };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function trimOutput(text, max = 4000) {
  const value = String(text || '').trim();
  if (value.length <= max) return value;
  return value.slice(0, max) + '\n... truncated ...';
}

function normalizeVerifyCommands(commands = []) {
  if (!Array.isArray(commands)) return [];
  return commands
    .map((item) => {
      if (typeof item === 'string') return { name: item, command: item, args: [] };
      if (!isObject(item) || !item.command) return null;
      return {
        name: String(item.name || item.command),
        command: String(item.command),
        args: Array.isArray(item.args) ? item.args.map(String) : []
      };
    })
    .filter(Boolean);
}

export function runPostApplyVerify(rootDir, pullConfig) {
  if (!pullConfig.verifyAfterApply || !pullConfig.verifyCommands?.length) {
    return { ok: true, skipped: true, commands: [] };
  }
  const commands = [];
  for (const command of pullConfig.verifyCommands) {
    const result = spawnSync(command.command, command.args || [], {
      cwd: rootDir,
      encoding: 'utf8',
      windowsHide: true
    });
    const item = {
      name: command.name || command.command,
      command: command.command,
      args: command.args || [],
      status: result.status,
      signal: result.signal || null,
      stdout: trimOutput(result.stdout),
      stderr: trimOutput(result.stderr)
    };
    commands.push(item);
    if (result.error || result.status !== 0) {
      return {
        ok: false,
        failed: item,
        detail: result.error ? result.error.message : (item.stderr || item.stdout || `exit ${result.status}`),
        commands
      };
    }
  }
  return { ok: true, commands };
}

export function rollbackAppliedFiles({ rootDir, syncConfig, pullConfig, applied }) {
  const rolledBack = [];
  for (const item of [...(applied || [])].reverse()) {
    const localPath = localPathForSyncPath(rootDir, syncConfig, item.path);
    if (item.backup) {
      const backupPath = path.join(rootDir, item.backup);
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
      fs.copyFileSync(backupPath, localPath);
      rolledBack.push({ path: item.path, restoredFrom: item.backup });
    } else {
      fs.rmSync(localPath, { force: true });
      rolledBack.push({ path: item.path, removed: true });
    }
  }
  return rolledBack.reverse();
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

export function collectLocalPortableFiles(rootDir, syncConfig) {
  return collectSyncFiles(rootDir, syncConfig).files;
}

function runtimeSourcesPrefix(syncConfig, pullConfig) {
  return toPosixPath(path.posix.join(pullConfig.runtimeRoot || runtimeRootPath(syncConfig), 'sources'));
}

export function parseRuntimeSourcePath(syncConfig, pullConfig, relPath) {
  const normalized = toPosixPath(relPath);
  const prefix = `${runtimeSourcesPrefix(syncConfig, pullConfig)}/`;
  if (!normalized.startsWith(prefix)) return null;
  const rest = normalized.slice(prefix.length);
  const slash = rest.indexOf('/');
  if (slash <= 0) return null;
  const sourceId = rest.slice(0, slash);
  const sourceRel = rest.slice(slash + 1);
  if (sourceRel === 'source.json') return { sourceId, kind: 'source', innerPath: '' };
  if (sourceRel === 'manifest.json') return { sourceId, kind: 'manifest', innerPath: '' };
  const snapshotPrefix = 'snapshot/';
  if (sourceRel.startsWith(snapshotPrefix)) {
    return { sourceId, kind: 'snapshot', innerPath: sourceRel.slice(snapshotPrefix.length) };
  }
  return null;
}

async function remoteFileContent(pullConfig, file) {
  if (file.content) return Buffer.isBuffer(file.content) ? file.content : Buffer.from(String(file.content), 'utf8');
  return fetchBlobContent(pullConfig, file.sha);
}

async function remoteSourceInfos(syncConfig, pullConfig, remoteSnapshot) {
  const out = new Map();
  const sourceFiles = remoteSnapshot.files
    .map((file) => ({ file, parsed: parseRuntimeSourcePath(syncConfig, pullConfig, file.path) }))
    .filter((item) => item.parsed?.kind === 'source');
  for (const { file, parsed } of sourceFiles) {
    try {
      const content = await remoteFileContent(pullConfig, file);
      out.set(parsed.sourceId, JSON.parse(content.toString('utf8')));
    } catch {
      out.set(parsed.sourceId, { sourceId: parsed.sourceId, sourceName: parsed.sourceId, updatedAt: '' });
    }
  }
  return out;
}

function sourceUpdatedAtValue(source) {
  const value = Date.parse(source?.updatedAt || '');
  return Number.isFinite(value) ? value : 0;
}

function selectLatestRemoteSource(sourceInfos, localSource) {
  const sources = [...sourceInfos.values()]
    .filter((source) => source?.sourceId && !isSameLocalSource(source, localSource))
    .sort((a, b) => {
      const byTime = sourceUpdatedAtValue(b) - sourceUpdatedAtValue(a);
      if (byTime) return byTime;
      return String(b.sourceId).localeCompare(String(a.sourceId));
    });
  return sources[0] || null;
}

export async function compareRemoteToLocal({ rootDir = root, syncConfig, pullConfig, remoteSnapshot, includeContent = false } = {}) {
  const shouldSync = createSyncFilter(syncConfig);
  const protectedMatcher = createProtectedMatcher(pullConfig);
  const localSource = localSourceInfo(rootDir, syncConfig);
  const sourceInfos = await remoteSourceInfos(syncConfig, pullConfig, remoteSnapshot);
  const remoteSource = selectLatestRemoteSource(sourceInfos, localSource);
  const localFiles = collectLocalPortableFiles(rootDir, syncConfig);
  const localByPath = new Map(localFiles.map((file) => [file.path, file]));
  const remoteFiles = remoteSource
    ? remoteSnapshot.files
      .map((file) => ({ file, parsed: parseRuntimeSourcePath(syncConfig, pullConfig, file.path) }))
      .filter((item) => item.parsed?.kind === 'snapshot' && item.parsed.sourceId === remoteSource.sourceId && shouldSync(item.parsed.innerPath))
      .map(({ file, parsed }) => ({ ...file, path: parsed.innerPath, remotePath: file.path, sourceId: parsed.sourceId }))
    : [];
  const remoteByPath = new Map(remoteFiles.map((file) => [file.path, file]));
  const changed = [];
  const protectedChanged = [];
  const missingRemote = [];

  for (const remote of remoteFiles) {
    const local = localByPath.get(remote.path);
    const localSha = local?.sha || null;
    if (localSha === remote.sha) continue;
    const localText = local ? textFromBuffer(local.content) : '';
    let remoteContent = null;
    let remoteText = '';
    if (includeContent || local) {
      remoteContent = await remoteFileContent(pullConfig, remote);
      remoteText = textFromBuffer(remoteContent);
    }
    const guard = protectedMatcher(remote.path, localText, remoteText);
    const item = {
      path: remote.path,
      remotePath: remote.remotePath,
      sourceId: remote.sourceId,
      localSha,
      remoteSha: remote.sha,
      existsLocal: Boolean(local),
      reason: guard.reason
    };
    if (remoteContent) item.remoteContent = remoteContent;
    if (guard.protected) protectedChanged.push(item);
    else changed.push(item);
  }

  if (remoteSource) {
    for (const local of localFiles) {
      if (!remoteByPath.has(local.path)) missingRemote.push({ path: local.path, localSha: local.sha });
    }
  }

  return {
    headSha: remoteSnapshot.headSha,
    remoteSource,
    sourceCount: sourceInfos.size,
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
  const comparison = await compareRemoteToLocal({
    rootDir,
    syncConfig,
    pullConfig,
    remoteSnapshot,
    includeContent: true
  });
  const hasLocalDiff = Boolean(
    comparison.changed.length
    || comparison.protectedChanged.length
    || comparison.missingRemote.length
  );
  const remoteSource = comparison.remoteSource;
  if (pullState?.headSha === remoteSnapshot.headSha && !hasLocalDiff) {
    return {
      ok: true,
      dryRun,
      skipped: true,
      skipReason: 'already-processed-head',
      applied: [],
      headSha: remoteSnapshot.headSha,
      remoteSource,
      localSource: source,
      remoteCount: comparison.remoteCount,
      localCount: collectLocalPortableFiles(rootDir, syncConfig).length,
      changed: comparison.changed,
      protectedChanged: comparison.protectedChanged,
      missingRemote: comparison.missingRemote
    };
  }
  if (comparison.changed.length > pullConfig.maxApplyPerRun) {
    throw new Error(`refusing to apply ${comparison.changed.length} files in one pull; inspect status or raise maxApplyPerRun`);
  }
  if (dryRun) return { ok: true, dryRun: true, applied: [], remoteSource, localSource: source, ...comparison };

  const runId = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const applied = [];
  const runtimeRejected = [];
  let postApplyVerify = { ok: true, skipped: true, commands: [] };
  let rolledBack = [];
  let postApplyRejected = [];
  for (const item of comparison.changed) {
    let remoteContent = item.remoteContent;
    if (!remoteContent) remoteContent = await fetchBlobContent(pullConfig, item.remoteSha);
    const verification = verifyRuntimeContent(item.path, remoteContent);
    if (!verification.ok) {
      runtimeRejected.push({
        path: item.path,
        localSha: item.localSha,
        remoteSha: item.remoteSha,
        reason: verification.reason,
        detail: verification.detail
      });
      continue;
    }
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

  if (applied.length) {
    postApplyVerify = runPostApplyVerify(rootDir, pullConfig);
    if (!postApplyVerify.ok) {
      rolledBack = rollbackAppliedFiles({ rootDir, syncConfig, pullConfig, applied });
      postApplyRejected = applied.map((item) => ({
        path: item.path,
        remoteSha: item.remoteSha,
        reason: 'post-apply-verify-failed',
        detail: postApplyVerify.detail
      }));
      applied.length = 0;
    }
  }

  const state = {
    headSha: comparison.headSha,
    remoteSource,
    localSource: source,
    applied,
    postApplyVerify,
    rolledBack,
    protectedChanged: [
      ...comparison.protectedChanged.map(({ path, localSha, remoteSha, reason }) => ({ path, localSha, remoteSha, reason })),
      ...runtimeRejected,
      ...postApplyRejected
    ],
    missingRemote: comparison.missingRemote
  };
  writePullState(rootDir, pullConfig, state);
  return {
    ok: true,
    dryRun: false,
    applied,
    remoteSource,
    localSource: source,
    ...comparison,
    postApplyVerify,
    rolledBack,
    protectedChanged: [...comparison.protectedChanged, ...runtimeRejected, ...postApplyRejected],
    changed: comparison.changed.filter((item) => !runtimeRejected.some((rejected) => rejected.path === item.path && rejected.remoteSha === item.remoteSha))
  };
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
  if (result.postApplyVerify?.ok === false) console.log(`[github-pull] post-apply verify failed: ${result.postApplyVerify.failed?.name || 'verify'}`);
  if (result.applied?.length) {
    for (const item of result.applied.slice(0, 40)) console.log(`  applied ${item.path}`);
  }
  if (result.protectedChanged?.length) {
    for (const item of result.protectedChanged.slice(0, 20)) console.log(`  protected ${item.path} (${item.reason})`);
  }
}

async function runStatus(rootDir, syncConfig, pullConfig) {
  const remoteSnapshot = await fetchRemoteSnapshot(pullConfig);
  const result = await compareRemoteToLocal({ rootDir, syncConfig, pullConfig, remoteSnapshot, includeContent: true });
  return { ok: true, applied: [], localSource: localSourceInfo(rootDir, syncConfig), ...result, state: readJson(path.join(rootDir, pullConfig.statePath), null) };
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
  console.log(`[${stamp()}] watching GitHub -> local portable source/rules/skills (${pullConfig.owner}/${pullConfig.repo}#${pullConfig.branch}, ${pullConfig.intervalMs}ms)`);
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
