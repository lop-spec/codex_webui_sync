#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

export const DEFAULT_CONFIG = {
  owner: '',
  repo: '',
  branch: 'main',
  createRepo: true,
  private: false,
  repoDescription: 'Realtime synced source and rule files from local github-ui workspace.',
  runtimeRoot: 'codex-webui-runtime',
  sourceMarkerPath: 'sync-meta/source.json',
  sourceStatePath: 'logs/github-sync-state.json',
  messagePrefix: 'sync(github-ui)',
  debounceMs: 1500,
  maxFileBytes: 2 * 1024 * 1024,
  maxChangesPerCommit: 800,
  include: [
    'AGENTS.md',
    'github-pull.config.json',
    'github-sync.config.example.json',
    'package.json',
    'RULES.md',
    'codex/AGENTS.md',
    'codex/agents/lop-*.toml',
    'codex/config/developer_instructions.mirror.toml',
    'codex/prompts/*.md',
    'codex/prompts/**/*.md',
    'codex/rules/*.md',
    'codex/skills/lop-*/**',
    'codex/workspace/Documents-Codex/AGENTS.md',
    'codex/workspace/Documents-Codex/RULES.md',
    'parity/**',
    'scripts/**',
    'Codex-webui-ts/AGENTS.md',
    'Codex-webui-ts/RULES.md',
    'Codex-webui-ts/*.cmd',
    'Codex-webui-ts/*.vbs',
    'Codex-webui-ts/*.cjs',
    'Codex-webui-ts/scripts/**',
    'Codex-webui-ts/package.json',
    'Codex-webui-ts/tsconfig*.json',
    'Codex-webui-ts/src/**',
    'Codex-webui-ts/public/**',
    'Codex-webui-react/AGENTS.md',
    'Codex-webui-react/RULES.md',
    'Codex-webui-react/package.json',
    'Codex-webui-react/tsconfig*.json',
    'Codex-webui-react/vite.config.*',
    'Codex-webui-react/index.html',
    'Codex-webui-react/server/**',
    'Codex-webui-react/src/**',
    'Codex-webui-react/static/**',
    'Codex-webui-react/docs/source-to-target-ledger.md'
  ],
  externalRoots: [
    {
      localPath: '~/.codex/AGENTS.md',
      repoPath: 'codex/AGENTS.md'
    },
    {
      localPath: '~/.codex/agents',
      repoPath: 'codex/agents',
      include: ['lop-*.toml'],
      exclude: ['*.bak*', '*.tmp']
    },
    {
      localPath: '~/.codex/prompts',
      repoPath: 'codex/prompts',
      include: ['*.md', '**/*.md'],
      exclude: ['*.bak*', '**/*.bak*', '*.tmp', '**/*.tmp']
    },
    {
      localPath: '~/.codex/rules',
      repoPath: 'codex/rules',
      include: ['*.md'],
      exclude: ['*.bak*', 'default.rules']
    },
    {
      localPath: '~/.codex/skills',
      repoPath: 'codex/skills',
      include: ['lop-*/**'],
      exclude: [
        '**/.git/**',
        '**/node_modules/**',
        '**/__pycache__/**',
        '**/.pytest_cache/**',
        '**/.venv/**',
        '**/venv/**',
        '**/outputs/**',
        '**/logs/**',
        '**/*.pyc',
        '**/*.tmp',
        '**/*.bak*',
        '**/.env',
        '**/.env.*'
      ]
    },
    {
      localPath: '~/Documents/Codex/AGENTS.md',
      repoPath: 'codex/workspace/Documents-Codex/AGENTS.md'
    },
    {
      localPath: '~/Documents/Codex/RULES.md',
      repoPath: 'codex/workspace/Documents-Codex/RULES.md'
    }
  ],
  configMirror: {
    sourcePath: '~/.codex/config.toml',
    repoPath: 'codex/config/developer_instructions.mirror.toml'
  },
  exclude: [
    '**/.git/**',
    '**/.codex/**',
    '**/.agents/**',
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/coverage/**',
    '**/outputs/**',
    '**/logs/**',
    '**/run-logs/**',
    '**/docs/**',
    '**/tmp/**',
    '**/temp/**',
    '**/.cache/**',
    '**/transfers/**',
    '**/sessions/**',
    '**/auth/**',
    '**/tests/**',
    '**/history.json',
    '**/package-lock.json',
    '**/default.rules',
    'codex/skills/.system/**',
    '**/.system/**',
    '**/*.log',
    '**/*.tmp',
    '**/*.bak*',
    '**/*.before-*',
    '**/*.zip',
    '**/*.7z',
    '**/*.tar',
    '**/*.tar.gz',
    '**/*.gz',
    '.env',
    '.env.*',
    '**/.env',
    '**/.env.*',
    'github-sync.config.json',
    'github-sync.config.local.json',
    'github-pull.config.local.json',
    '**/config.toml',
    '**/*.pem',
    '**/*.key',
    '**/*.pfx',
    '**/*.crt'
  ],
  pruneRemote: [
    'github-sync.config.json',
    'github-sync.config.local.json',
    'github-pull.config.local.json'
  ],
  watchTargets: [
    'package.json',
    'RULES.md',
    '~/.codex/AGENTS.md',
    '~/.codex/agents',
    '~/.codex/config.toml',
    '~/.codex/prompts',
    '~/.codex/rules',
    '~/.codex/skills',
    '~/Documents/Codex/AGENTS.md',
    '~/Documents/Codex/RULES.md',
    'parity',
    'scripts',
    'github-pull.config.json',
    'github-sync.config.example.json',
    'Codex-webui-ts/AGENTS.md',
    'Codex-webui-ts/RULES.md',
    'Codex-webui-ts/*.cmd',
    'Codex-webui-ts/*.vbs',
    'Codex-webui-ts/*.cjs',
    'Codex-webui-ts/scripts',
    'Codex-webui-ts/package.json',
    'Codex-webui-ts/tsconfig.json',
    'Codex-webui-ts/src',
    'Codex-webui-ts/public',
    'Codex-webui-react/AGENTS.md',
    'Codex-webui-react/RULES.md',
    'Codex-webui-react/package.json',
    'Codex-webui-react/tsconfig.server.json',
    'Codex-webui-react/vite.config.ts',
    'Codex-webui-react/index.html',
    'Codex-webui-react/server',
    'Codex-webui-react/src',
    'Codex-webui-react/static',
    'Codex-webui-react/docs/source-to-target-ledger.md'
  ]
};

const PRUNE_DIR_NAMES = new Set([
  '.git',
  '.codex',
  '.agents',
  'node_modules',
  'dist',
  'build',
  'coverage',
  'outputs',
  'logs',
  'run-logs',
  'tmp',
  'temp',
  '.cache',
  '__pycache__',
  '.pytest_cache',
  '.venv',
  'venv',
  'transfers',
  'sessions'
]);

function stamp() {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false });
}

export function toPosixPath(value) {
  return String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '');
}

function isPathInside(targetPath, parentPath) {
  const relative = path.relative(path.resolve(parentPath), path.resolve(targetPath));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export function resolveConfigPath(rootDir, value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw === '~') return os.homedir();
  if (raw.startsWith('~/') || raw.startsWith('~\\')) {
    return path.resolve(os.homedir(), raw.slice(2));
  }
  return path.isAbsolute(raw) ? path.resolve(raw) : path.resolve(rootDir, raw);
}

function safeLocalJoin(baseDir, relPath = '') {
  const normalized = toPosixPath(relPath);
  const parts = normalized ? normalized.split('/').filter(Boolean) : [];
  if (parts.some((part) => part === '..')) {
    throw new Error(`refusing unsafe relative path: ${relPath}`);
  }
  const targetPath = path.resolve(baseDir, ...parts);
  if (!isPathInside(targetPath, baseDir)) {
    throw new Error(`refusing path outside sync root: ${relPath}`);
  }
  return targetPath;
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

export function loadConfig(rootDir = root, env = process.env) {
  let config = structuredClone(DEFAULT_CONFIG);
  for (const name of ['github-sync.config.json', 'github-sync.config.local.json']) {
    const loaded = readJsonIfExists(path.join(rootDir, name));
    if (loaded) config = mergeConfig(config, loaded);
  }

  config.owner = env.GITHUB_SYNC_OWNER || env.GITHUB_OWNER || config.owner || '';
  config.repo = env.GITHUB_SYNC_REPO || env.GITHUB_REPO || config.repo || path.basename(rootDir);
  config.branch = env.GITHUB_SYNC_BRANCH || env.GITHUB_BRANCH || config.branch || 'main';
  config.token = env.GITHUB_SYNC_TOKEN || env.GITHUB_TOKEN || '';
  config.authorName = env.GITHUB_SYNC_AUTHOR_NAME || config.authorName || 'github-ui sync';
  config.authorEmail = env.GITHUB_SYNC_AUTHOR_EMAIL || config.authorEmail || 'github-ui-sync@users.noreply.github.com';
  config.sourceId = env.GITHUB_SYNC_SOURCE_ID || config.sourceId || '';
  config.sourceName = env.GITHUB_SYNC_SOURCE_NAME || config.sourceName || '';
  config.runtimeRoot = toPosixPath(env.GITHUB_SYNC_RUNTIME_ROOT || config.runtimeRoot || DEFAULT_CONFIG.runtimeRoot);
  config.sourceMarkerPath = toPosixPath(env.GITHUB_SYNC_SOURCE_MARKER_PATH || config.sourceMarkerPath || DEFAULT_CONFIG.sourceMarkerPath);
  config.sourceStatePath = toPosixPath(env.GITHUB_SYNC_STATE_PATH || config.sourceStatePath || DEFAULT_CONFIG.sourceStatePath);
  if (env.GITHUB_SYNC_CREATE_REPO !== undefined) config.createRepo = parseBool(env.GITHUB_SYNC_CREATE_REPO, config.createRepo);
  if (env.GITHUB_SYNC_PRIVATE !== undefined) config.private = parseBool(env.GITHUB_SYNC_PRIVATE, config.private);

  config.include = (config.include || []).map(toPosixPath).filter(Boolean);
  config.exclude = (config.exclude || []).map(toPosixPath).filter(Boolean);
  config.pruneRemote = (config.pruneRemote || []).map(toPosixPath).filter(Boolean);
  config.externalRoots = normalizeExternalRoots(rootDir, config);
  config.configMirror = normalizeConfigMirror(rootDir, config.configMirror);
  config.watchTargets = (config.watchTargets || []).map(toPosixPath).filter(Boolean);
  config.debounceMs = Number(config.debounceMs || DEFAULT_CONFIG.debounceMs);
  config.maxFileBytes = Number(config.maxFileBytes || DEFAULT_CONFIG.maxFileBytes);
  config.maxChangesPerCommit = Number(config.maxChangesPerCommit || DEFAULT_CONFIG.maxChangesPerCommit);
  return config;
}

function normalizeExternalRoot(rootDir, entry) {
  const raw = typeof entry === 'string' ? { localPath: entry } : (entry || {});
  const localPath = resolveConfigPath(rootDir, raw.localPath || raw.path || raw.root);
  const repoPath = toPosixPath(raw.repoPath || raw.prefix || raw.target || '');
  if (!localPath || !repoPath) return null;
  const kind = fs.existsSync(localPath) && fs.statSync(localPath).isFile() ? 'file' : 'directory';
  return {
    localPath,
    repoPath,
    kind,
    include: (raw.include?.length ? raw.include : ['**']).map(toPosixPath).filter(Boolean),
    exclude: (raw.exclude || []).map(toPosixPath).filter(Boolean)
  };
}

function normalizeConfigMirror(rootDir, entry) {
  const raw = entry || {};
  const sourcePath = resolveConfigPath(rootDir, raw.sourcePath || raw.localPath || raw.path);
  const repoPath = toPosixPath(raw.repoPath || raw.target || '');
  if (!sourcePath || !repoPath) return null;
  return { sourcePath, repoPath };
}

export function normalizeExternalRoots(rootDir = root, config = loadConfig(rootDir)) {
  return (config.externalRoots || [])
    .map((entry) => normalizeExternalRoot(rootDir, entry))
    .filter(Boolean);
}

export function localSourceInfo(rootDir = root, config = loadConfig(rootDir)) {
  const machineSeed = [
    os.hostname().toLowerCase(),
    os.userInfo().username.toLowerCase()
  ].join('|');
  const seed = [
    os.hostname(),
    os.userInfo().username,
    path.resolve(rootDir)
  ].join('|');
  const sourceId = config.sourceId || createHash('sha256').update(seed).digest('hex').slice(0, 24);
  const machineId = config.machineId || createHash('sha256').update(machineSeed).digest('hex').slice(0, 24);
  return {
    version: 2,
    sourceId,
    sourceName: config.sourceName || `machine-${sourceId.slice(0, 8)}`,
    sourceKind: 'machine-workspace-hash',
    machineId,
    machineName: os.hostname(),
    workspace: path.basename(rootDir),
    workspacePath: path.resolve(rootDir),
    scope: 'source-rules-skills'
  };
}

function sourceIdSegment(source) {
  const sourceId = String(source?.sourceId || '').trim();
  if (!/^[A-Za-z0-9._-]+$/.test(sourceId)) throw new Error(`unsafe sourceId: ${sourceId}`);
  return sourceId;
}

export function runtimeRootPath(config = DEFAULT_CONFIG) {
  return toPosixPath(config.runtimeRoot || DEFAULT_CONFIG.runtimeRoot);
}

export function sourceRuntimeRoot(config = DEFAULT_CONFIG, source = localSourceInfo(root, config)) {
  return toPosixPath(path.posix.join(runtimeRootPath(config), 'sources', sourceIdSegment(source)));
}

export function sourceSnapshotRoot(config = DEFAULT_CONFIG, source = localSourceInfo(root, config)) {
  return toPosixPath(path.posix.join(sourceRuntimeRoot(config, source), 'snapshot'));
}

export function sourceInfoPath(config = DEFAULT_CONFIG, source = localSourceInfo(root, config)) {
  return toPosixPath(path.posix.join(sourceRuntimeRoot(config, source), 'source.json'));
}

export function sourceManifestPath(config = DEFAULT_CONFIG, source = localSourceInfo(root, config)) {
  return toPosixPath(path.posix.join(sourceRuntimeRoot(config, source), 'manifest.json'));
}

export function remoteSnapshotPath(config = DEFAULT_CONFIG, source = localSourceInfo(root, config), relPath = '') {
  return toPosixPath(path.posix.join(sourceSnapshotRoot(config, source), toPosixPath(relPath)));
}

function sourceMarkerBuffer(rootDir, config) {
  const marker = {
    ...localSourceInfo(rootDir, config),
    updatedAt: new Date().toISOString()
  };
  return Buffer.from(`${JSON.stringify(marker, null, 2)}\n`, 'utf8');
}

function syncPathCategory(relPath) {
  const normalized = toPosixPath(relPath);
  if (/^Codex-webui-(ts|react)\//.test(normalized)) return 'webui-source';
  if (/^(AGENTS\.md|RULES\.md|codex\/(AGENTS\.md|agents\/|prompts\/|rules\/|skills\/|workspace\/))/.test(normalized)) return 'rules';
  if (/^scripts\/.*\.(mjs|js|cmd|ps1|sh)$/i.test(normalized)) return 'runtime-script';
  if (/config|example/i.test(normalized)) return 'config-example';
  return 'source';
}

function manifestBuffer(rootDir, config, snapshot, source) {
  const manifest = {
    version: 1,
    source,
    generatedAt: new Date().toISOString(),
    fullSnapshot: true,
    mergePolicy: {
      'webui-source': 'remote-newer-wins-then-verify',
      rules: 'remote-wins-preserve-local-new-lop',
      'runtime-script': 'apply-only-after-runtime-verify',
      'local-machine': 'do-not-cross-machine-apply-use-examples',
      artifacts: 'never-upload-never-apply'
    },
    fileCount: snapshot.files.length,
    files: snapshot.files.map((file) => ({
      path: file.path,
      sha: file.sha,
      size: file.size,
      category: syncPathCategory(file.path)
    }))
  };
  return Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

function syncStatePath(rootDir, config) {
  return path.join(rootDir, config.sourceStatePath || DEFAULT_CONFIG.sourceStatePath);
}

function writeSyncState(rootDir, config, data) {
  const filePath = syncStatePath(rootDir, config);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify({
    ...data,
    source: localSourceInfo(rootDir, config),
    updatedAt: new Date().toISOString()
  }, null, 2)}\n`, 'utf8');
}

function parseBool(value, fallback) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  return Boolean(fallback);
}

export function globToRegExp(pattern) {
  const normalized = toPosixPath(pattern);
  let source = '';
  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    const next = normalized[i + 1];
    if (char === '*' && next === '*') {
      source += '.*';
      i += 1;
    } else if (char === '*') {
      source += '[^/]*';
    } else if (char === '?') {
      source += '[^/]';
    } else {
      source += char.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
    }
  }
  return new RegExp(`^${source}$`);
}

export function createPathMatcher(patterns) {
  const regexes = (patterns || []).map(globToRegExp);
  return (relPath) => {
    const normalized = toPosixPath(relPath);
    return regexes.some((regex) => regex.test(normalized));
  };
}

export function createSyncFilter(config) {
  const include = createPathMatcher(config.include || []);
  const exclude = createPathMatcher(config.exclude || []);
  return (relPath) => {
    const normalized = toPosixPath(relPath);
    return Boolean(normalized) && include(normalized) && !exclude(normalized);
  };
}

export function gitBlobSha(buffer) {
  return createHash('sha1')
    .update(`blob ${buffer.length}\0`)
    .update(buffer)
    .digest('hex');
}

function shouldPruneDir(entryName) {
  return PRUNE_DIR_NAMES.has(entryName);
}

function joinRepoPath(prefix, innerPath) {
  const normalizedInner = toPosixPath(innerPath);
  return toPosixPath(normalizedInner ? path.posix.join(prefix, normalizedInner) : prefix);
}

export function localPathForSyncPath(rootDir = root, config = loadConfig(rootDir), relPath) {
  const normalized = toPosixPath(relPath);
  for (const externalRoot of normalizeExternalRoots(rootDir, config)) {
    if (externalRoot.kind === 'file' && normalized === externalRoot.repoPath) {
      return externalRoot.localPath;
    }
    if (externalRoot.kind === 'file') continue;
    if (normalized === externalRoot.repoPath || normalized.startsWith(`${externalRoot.repoPath}/`)) {
      const innerPath = normalized.slice(externalRoot.repoPath.length).replace(/^\/+/, '');
      return safeLocalJoin(externalRoot.localPath, innerPath);
    }
  }
  return safeLocalJoin(rootDir, normalized);
}

export function syncPathForLocalPath(rootDir = root, config = loadConfig(rootDir), absPath) {
  const resolved = path.resolve(absPath);
  for (const externalRoot of normalizeExternalRoots(rootDir, config)) {
    if (externalRoot.kind === 'file' && resolved === externalRoot.localPath) {
      return externalRoot.repoPath;
    }
    if (externalRoot.kind === 'file') continue;
    if (isPathInside(resolved, externalRoot.localPath)) {
      const innerPath = toPosixPath(path.relative(externalRoot.localPath, resolved));
      return joinRepoPath(externalRoot.repoPath, innerPath);
    }
  }
  if (config.configMirror?.sourcePath && resolved === config.configMirror.sourcePath) {
    return config.configMirror.repoPath;
  }
  if (isPathInside(resolved, rootDir)) return toPosixPath(path.relative(rootDir, resolved));
  return '';
}

function addCollectedFile(files, skipped, seen, config, shouldSync, absPath, relPath, virtualContent = null) {
  if (!shouldSync(relPath)) return;
  if (seen.has(relPath)) throw new Error(`duplicate sync path: ${relPath}`);
  const content = virtualContent || fs.readFileSync(absPath);
  const size = content.length;
  if (size > config.maxFileBytes) {
    skipped.push({ path: relPath, size, reason: 'maxFileBytes' });
    return;
  }
  seen.add(relPath);
  files.push({
    path: relPath,
    absPath,
    size,
    sha: gitBlobSha(content),
    content,
    virtual: Boolean(virtualContent)
  });
}

export function extractDeveloperInstructionsMirror(configText) {
  const text = String(configText || '');
  const match = text.match(/(?:^|\n)developer_instructions\s*=\s*('''[\s\S]*?'''|"""[\s\S]*?"""|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/);
  const assignment = match ? match[0].replace(/^\n/, '').trim() : 'developer_instructions = ""';
  return [
    '# Sanitized mirror generated from ~/.codex/config.toml.',
    '# Full config.toml is intentionally not synced.',
    assignment,
    ''
  ].join('\n');
}

export function collectSyncFiles(rootDir = root, config = loadConfig(rootDir)) {
  const shouldSync = createSyncFilter(config);
  const files = [];
  const skipped = [];
  const seen = new Set();
  const configMirrorRepoPath = config.configMirror?.repoPath || '';

  function addFile(absPath, relPath) {
    if (configMirrorRepoPath && toPosixPath(relPath) === configMirrorRepoPath) return;
    addCollectedFile(files, skipped, seen, config, shouldSync, absPath, relPath);
  }

  function walk(absDir, baseDir, repoPrefix = '', localFilter = () => true) {
    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
      if (entry.name === '.' || entry.name === '..') continue;
      if (entry.isDirectory() && shouldPruneDir(entry.name)) continue;
      const absPath = path.join(absDir, entry.name);
      const innerPath = toPosixPath(path.relative(baseDir, absPath));
      const relPath = repoPrefix ? joinRepoPath(repoPrefix, innerPath) : innerPath;
      if (entry.isDirectory()) {
        walk(absPath, baseDir, repoPrefix, localFilter);
        continue;
      }
      if (!entry.isFile() || !localFilter(innerPath)) continue;
      addFile(absPath, relPath);
    }
  }

  walk(rootDir, rootDir);
  for (const externalRoot of normalizeExternalRoots(rootDir, config)) {
    if (!fs.existsSync(externalRoot.localPath)) continue;
    const stat = fs.statSync(externalRoot.localPath);
    if (stat.isFile()) {
      addFile(externalRoot.localPath, externalRoot.repoPath);
      continue;
    }
    if (!stat.isDirectory()) continue;
    const include = createPathMatcher(externalRoot.include || ['**']);
    const exclude = createPathMatcher(externalRoot.exclude || []);
    const localFilter = (innerPath) => include(innerPath) && !exclude(innerPath);
    walk(externalRoot.localPath, externalRoot.localPath, externalRoot.repoPath, localFilter);
  }
  if (config.configMirror?.sourcePath && fs.existsSync(config.configMirror.sourcePath)) {
    const content = Buffer.from(extractDeveloperInstructionsMirror(fs.readFileSync(config.configMirror.sourcePath, 'utf8')), 'utf8');
    addCollectedFile(files, skipped, seen, config, shouldSync, config.configMirror.sourcePath, config.configMirror.repoPath, content);
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  skipped.sort((a, b) => a.path.localeCompare(b.path));
  return { files, skipped };
}

function safeRepoPart(value, label) {
  const raw = String(value || '').trim();
  if (!raw) throw new Error(`missing ${label}`);
  return encodeURIComponent(raw);
}

function branchRefPath(branch) {
  return String(branch || 'main')
    .split('/')
    .map(encodeURIComponent)
    .join('/');
}

function contentsPath(relPath) {
  return toPosixPath(relPath)
    .split('/')
    .map(encodeURIComponent)
    .join('/');
}

function repoApiBase(config) {
  return `/repos/${safeRepoPart(config.owner, 'owner')}/${safeRepoPart(config.repo, 'repo')}`;
}

function validateRemoteConfig(config) {
  const missing = [];
  if (!config.repo) missing.push('GITHUB_SYNC_REPO');
  if (!config.branch) missing.push('GITHUB_SYNC_BRANCH');
  if (!config.token) missing.push('GITHUB_SYNC_TOKEN');
  if (missing.length) {
    throw new Error(`missing GitHub sync config: ${missing.join(', ')}`);
  }
}

class GitHubRequestError extends Error {
  constructor(message, response, data, route) {
    super(message);
    this.name = 'GitHubRequestError';
    this.status = response.status;
    this.data = data;
    this.route = route;
  }
}

async function githubRequest(config, method, route, body) {
  const response = await fetch(`https://api.github.com${route}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'github-ui-realtime-sync',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = { message: text }; }
  }
  if (!response.ok) {
    const message = data?.message || response.statusText;
    throw new GitHubRequestError(`GitHub ${method} ${route} failed: ${response.status} ${message}`, response, data, route);
  }
  return data;
}

async function authenticatedUser(config) {
  const user = await githubRequest(config, 'GET', '/user');
  if (!user?.login) throw new Error('GitHub /user response did not include login');
  return user;
}

async function ensureRepo(config) {
  const user = await authenticatedUser(config);
  if (!config.owner) config.owner = user.login;
  const base = repoApiBase(config);
  try {
    const repo = await githubRequest(config, 'GET', base);
    return { repo, created: false, user };
  } catch (error) {
    if (!(error instanceof GitHubRequestError) || error.status !== 404) throw error;
    if (!config.createRepo) {
      throw new Error(`GitHub repository ${config.owner}/${config.repo} does not exist; create it or set GITHUB_SYNC_CREATE_REPO=1`);
    }
  }

  const body = {
    name: config.repo,
    private: Boolean(config.private),
    description: config.repoDescription || undefined,
    auto_init: false
  };
  const route = config.owner === user.login ? '/user/repos' : `/orgs/${safeRepoPart(config.owner, 'owner')}/repos`;
  const repo = await githubRequest(config, 'POST', route, body);
  return { repo, created: true, user };
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      out[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

async function getRemoteState(config, repoState) {
  const base = repoApiBase(config);
  let ref = null;
  try {
    ref = await githubRequest(config, 'GET', `${base}/git/ref/heads/${branchRefPath(config.branch)}`);
  } catch (error) {
    if (error instanceof GitHubRequestError && [404, 409].includes(error.status)) {
      return {
        empty: true,
        headSha: null,
        treeSha: null,
        blobs: new Map(),
        createdRepo: Boolean(repoState?.created)
      };
    }
    throw error;
  }
  const headSha = ref.object?.sha;
  if (!headSha) throw new Error('GitHub branch ref has no commit sha');
  const commit = await githubRequest(config, 'GET', `${base}/git/commits/${headSha}`);
  const treeSha = commit.tree?.sha;
  if (!treeSha) throw new Error('GitHub head commit has no tree sha');
  const tree = await githubRequest(config, 'GET', `${base}/git/trees/${treeSha}?recursive=1`);
  if (tree.truncated) {
    throw new Error('GitHub tree response is truncated; narrow github-sync include patterns before syncing');
  }
  return {
    headSha,
    treeSha,
    empty: false,
    blobs: new Map((tree.tree || [])
      .filter((item) => item.type === 'blob' && item.path)
      .map((item) => [toPosixPath(item.path), item.sha]))
  };
}

async function bootstrapEmptyRepo(config, file, message) {
  const base = repoApiBase(config);
  const commitMessage = message || `${config.messagePrefix}: initialize repository`;
  return githubRequest(config, 'PUT', `${base}/contents/${contentsPath(file.remotePath || file.path)}`, {
    message: commitMessage,
    content: file.content.toString('base64'),
    branch: config.branch,
    author: {
      name: config.authorName,
      email: config.authorEmail
    },
    committer: {
      name: config.authorName,
      email: config.authorEmail
    }
  });
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function summarizeSnapshot(snapshot) {
  const totalBytes = snapshot.files.reduce((sum, file) => sum + file.size, 0);
  return {
    fileCount: snapshot.files.length,
    totalBytes,
    skippedCount: snapshot.skipped.length,
    skipped: snapshot.skipped
  };
}

function assertChangeLimit(config, count) {
  if (count <= config.maxChangesPerCommit) return;
  throw new Error(`refusing ${count} GitHub changes in one commit; raise maxChangesPerCommit only after checking the dry-run list`);
}

export async function syncOnce({ rootDir = root, config = loadConfig(rootDir), dryRun = false, message = '' } = {}) {
  const snapshot = collectSyncFiles(rootDir, config);
  const summary = summarizeSnapshot(snapshot);
  const source = localSourceInfo(rootDir, config);
  const markerContent = sourceMarkerBuffer(rootDir, config);
  const manifestContent = manifestBuffer(rootDir, config, snapshot, source);
  const ownSourceRoot = sourceRuntimeRoot(config, source);
  const ownSnapshotRoot = sourceSnapshotRoot(config, source);
  const syncEntries = [
    ...snapshot.files.map((file) => ({
      ...file,
      remotePath: remoteSnapshotPath(config, source, file.path)
    })),
    {
      path: 'source.json',
      remotePath: sourceInfoPath(config, source),
      absPath: null,
      size: markerContent.length,
      sha: gitBlobSha(markerContent),
      content: markerContent,
      virtual: true
    },
    {
      path: 'manifest.json',
      remotePath: sourceManifestPath(config, source),
      absPath: null,
      size: manifestContent.length,
      sha: gitBlobSha(manifestContent),
      content: manifestContent,
      virtual: true
    }
  ];

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      root: rootDir,
      owner: config.owner,
      repo: config.repo,
      branch: config.branch,
      source,
      runtimeRoot: runtimeRootPath(config),
      sourceRoot: ownSourceRoot,
      snapshotRoot: ownSnapshotRoot,
      ...summary,
      files: snapshot.files.map((file) => ({
        path: file.path,
        remotePath: remoteSnapshotPath(config, source, file.path),
        size: file.size,
        sha: file.sha
      }))
    };
  }

  validateRemoteConfig(config);
  const repoState = await ensureRepo(config);
  let remote = await getRemoteState(config, repoState);
  if (remote.empty && syncEntries.length) {
    await bootstrapEmptyRepo(config, syncEntries.find((file) => file.remotePath === sourceInfoPath(config, source)) || syncEntries[0], `${config.messagePrefix}: initialize repository`);
    remote = await getRemoteState(config, repoState);
  }
  const localByRemotePath = new Map(syncEntries.map((file) => [file.remotePath, file]));
  const changedFiles = syncEntries.filter((file) => remote.blobs.get(file.remotePath) !== file.sha);
  const removedPaths = [...remote.blobs.keys()]
    .filter((remotePath) => (
      (remotePath === ownSourceRoot || remotePath.startsWith(`${ownSourceRoot}/`))
      && !localByRemotePath.has(remotePath)
    ));
  const changeCount = changedFiles.length + removedPaths.length;
  assertChangeLimit(config, changeCount);

  if (changeCount === 0) {
    writeSyncState(rootDir, config, {
      headSha: remote.headSha,
      commitSha: remote.headSha,
      upToDate: true
    });
    return {
      ok: true,
      dryRun: false,
      upToDate: true,
      headSha: remote.headSha,
      changedCount: 0,
      removedCount: 0,
      ...summary
    };
  }

  if (
    changedFiles.every((file) => file.remotePath === sourceInfoPath(config, source) || file.remotePath === sourceManifestPath(config, source))
    && removedPaths.length === 0
    && remote.blobs.has(sourceInfoPath(config, source))
    && remote.blobs.has(sourceManifestPath(config, source))
  ) {
    writeSyncState(rootDir, config, {
      headSha: remote.headSha,
      commitSha: remote.headSha,
      markerOnlySkipped: true
    });
    return {
      ok: true,
      dryRun: false,
      upToDate: true,
      markerOnlySkipped: true,
      headSha: remote.headSha,
      changedCount: 0,
      removedCount: 0,
      ...summary
    };
  }

  const base = repoApiBase(config);
  const created = await mapLimit(changedFiles, 4, async (file) => {
    const blob = await githubRequest(config, 'POST', `${base}/git/blobs`, {
      content: file.content.toString('base64'),
      encoding: 'base64'
    });
    return {
      path: file.remotePath,
      mode: '100644',
      type: 'blob',
      sha: blob.sha
    };
  });

  const removals = removedPaths.map((remotePath) => ({
    path: remotePath,
    mode: '100644',
    type: 'blob',
    sha: null
  }));
  const treePayload = { tree: [...created, ...removals] };
  if (remote.treeSha) treePayload.base_tree = remote.treeSha;
  const tree = await githubRequest(config, 'POST', `${base}/git/trees`, treePayload);
  const commitMessage = message || `${config.messagePrefix}: ${changeCount} file change${changeCount === 1 ? '' : 's'}`;
  const commitPayload = {
    message: commitMessage,
    tree: tree.sha,
    parents: remote.headSha ? [remote.headSha] : [],
    author: {
      name: config.authorName,
      email: config.authorEmail,
      date: new Date().toISOString()
    }
  };
  const commit = await githubRequest(config, 'POST', `${base}/git/commits`, commitPayload);
  if (remote.empty) {
    await githubRequest(config, 'POST', `${base}/git/refs`, {
      ref: `refs/heads/${config.branch}`,
      sha: commit.sha
    });
  } else {
    await githubRequest(config, 'PATCH', `${base}/git/refs/heads/${branchRefPath(config.branch)}`, {
      sha: commit.sha,
      force: false
    });
  }

  writeSyncState(rootDir, config, {
    headSha: commit.sha,
    commitSha: commit.sha,
    changedCount: changedFiles.length,
    removedCount: removedPaths.length
  });

  return {
    ok: true,
    dryRun: false,
    upToDate: false,
    commitSha: commit.sha,
    htmlUrl: repoState.repo?.html_url || `https://github.com/${config.owner}/${config.repo}`,
    createdRepo: Boolean(repoState.created),
    changedCount: changedFiles.length,
    removedCount: removedPaths.length,
    changedPaths: changedFiles.map((file) => file.remotePath),
    removedPaths,
    sourceRoot: ownSourceRoot,
    snapshotRoot: ownSnapshotRoot,
    ...summary
  };
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    once: false,
    watch: false,
    dryRun: false,
    status: false,
    json: false,
    noInitial: false,
    tokenStdin: false,
    message: ''
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--once') out.once = true;
    else if (arg === '--watch') out.watch = true;
    else if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--status') out.status = true;
    else if (arg === '--json') out.json = true;
    else if (arg === '--no-initial') out.noInitial = true;
    else if (arg === '--token-stdin') out.tokenStdin = true;
    else if (arg === '--message') {
      out.message = argv[index + 1] || '';
      index += 1;
    } else if (arg.startsWith('--message=')) {
      out.message = arg.slice('--message='.length);
    } else if (arg === '--help' || arg === '-h') {
      out.help = true;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  if (!out.once && !out.watch && !out.status) out.status = true;
  return out;
}

function printHelp() {
  console.log([
    'GitHub realtime sync',
    '',
    'Commands:',
    '  node scripts/github-sync.mjs --status',
    '  node scripts/github-sync.mjs --once --dry-run',
    '  node scripts/github-sync.mjs --once',
    '  node scripts/github-sync.mjs --watch',
    '  node scripts/github-sync.mjs --once --token-stdin',
    '',
    'Environment:',
    '  GITHUB_SYNC_OWNER, GITHUB_SYNC_REPO, GITHUB_SYNC_BRANCH',
    '  GITHUB_SYNC_TOKEN',
    '  GITHUB_SYNC_AUTHOR_NAME, GITHUB_SYNC_AUTHOR_EMAIL'
  ].join('\n'));
}

async function readStdinToken() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8').trim();
}

function statusReport(rootDir, config) {
  const snapshot = collectSyncFiles(rootDir, config);
  const summary = summarizeSnapshot(snapshot);
  const source = localSourceInfo(rootDir, config);
  return {
    root: rootDir,
    owner: config.owner || null,
    repo: config.repo || null,
    branch: config.branch || null,
    tokenConfigured: Boolean(config.token),
    source,
    runtimeRoot: runtimeRootPath(config),
    sourceRoot: sourceRuntimeRoot(config, source),
    snapshotRoot: sourceSnapshotRoot(config, source),
    createRepo: Boolean(config.createRepo),
    private: Boolean(config.private),
    includeCount: config.include.length,
    excludeCount: config.exclude.length,
    pruneRemoteCount: config.pruneRemote.length,
    externalRootCount: config.externalRoots.length,
    watchTargetCount: config.watchTargets.length,
    ...summary
  };
}

function printStatus(report) {
  console.log(`[github-sync] root: ${report.root}`);
  console.log(`[github-sync] target: ${report.owner || '<token user>'}/${report.repo || '<missing repo>'}#${report.branch || '<missing branch>'}`);
  console.log(`[github-sync] token: ${report.tokenConfigured ? 'configured' : 'missing'}`);
  console.log(`[github-sync] source: ${report.source.sourceName} (${report.source.sourceId})`);
  console.log(`[github-sync] source root: ${report.sourceRoot}`);
  console.log(`[github-sync] snapshot root: ${report.snapshotRoot}`);
  console.log(`[github-sync] create missing repo: ${report.createRepo ? 'yes' : 'no'} (${report.private ? 'private' : 'public'})`);
  console.log(`[github-sync] local source files: ${report.fileCount} (${formatBytes(report.totalBytes)})`);
  console.log(`[github-sync] external rule roots: ${report.externalRootCount}`);
  console.log(`[github-sync] skipped: ${report.skippedCount}`);
  if (report.skipped?.length) {
    for (const item of report.skipped.slice(0, 20)) {
      console.log(`  - ${item.path} (${formatBytes(item.size)}, ${item.reason})`);
    }
  }
}

function printSyncResult(result) {
  if (result.dryRun) {
    console.log(`[github-sync] dry-run files: ${result.fileCount} (${formatBytes(result.totalBytes)})`);
    console.log(`[github-sync] source root: ${result.sourceRoot}`);
    if (result.skippedCount) console.log(`[github-sync] skipped: ${result.skippedCount}`);
    for (const file of result.files.slice(0, 80)) {
      console.log(`  ${file.path} -> ${file.remotePath} ${formatBytes(file.size)}`);
    }
    if (result.files.length > 80) console.log(`  ... ${result.files.length - 80} more`);
    return;
  }
  if (result.upToDate) {
    console.log(`[github-sync] up to date at ${result.headSha}`);
    return;
  }
  console.log(`[github-sync] pushed ${result.changedCount} changed, ${result.removedCount} removed -> ${result.commitSha}`);
  if (result.createdRepo) console.log('[github-sync] repository created');
  if (result.htmlUrl) console.log(`[github-sync] url: ${result.htmlUrl}`);
}

function npmScriptExists(scriptName, rootDir = root) {
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    return Boolean(packageJson.scripts?.[scriptName]);
  } catch {
    return false;
  }
}

function runLocalPreflight(rootDir) {
  if (!npmScriptExists('test', rootDir)) return;
  const result = spawnSync(process.execPath, ['--test', 'tests/github-sync.test.mjs'], {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  if (result.status !== 0) {
    throw new Error(`github-sync local preflight failed:\n${result.stdout}\n${result.stderr}`);
  }
}

async function runWatch({ rootDir, config, noInitial, dryRun, message }) {
  if (!dryRun) validateRemoteConfig(config);
  runLocalPreflight(rootDir);
  let timer = null;
  let running = false;
  let pending = false;
  let lastChange = 'startup';

  const schedule = (change) => {
    if (change) lastChange = toPosixPath(change);
    clearTimeout(timer);
    timer = setTimeout(run, config.debounceMs);
  };

  const run = async () => {
    if (running) {
      pending = true;
      return;
    }
    running = true;
    pending = false;
    try {
      console.log(`[${stamp()}] github sync started: ${lastChange}`);
      const result = await syncOnce({ rootDir, config, dryRun, message });
      printSyncResult(result);
    } catch (error) {
      console.error(`[github-sync] ${error.message}`);
    } finally {
      running = false;
      if (pending) schedule('queued changes');
    }
  };

  const shouldSync = createSyncFilter(config);
  const watchers = [];
  for (const relTarget of config.watchTargets) {
    const absTarget = resolveConfigPath(rootDir, relTarget);
    if (!fs.existsSync(absTarget)) continue;
    const stat = fs.statSync(absTarget);
    const watchPath = stat.isDirectory() ? absTarget : path.dirname(absTarget);
    const watcher = fs.watch(watchPath, { recursive: stat.isDirectory() }, (_event, filename) => {
      const changedAbs = filename
        ? path.join(watchPath, filename.toString())
        : absTarget;
      const changed = syncPathForLocalPath(rootDir, config, changedAbs);
      if (shouldSync(changed)) schedule(changed);
    });
    watchers.push(watcher);
  }
  if (!watchers.length) throw new Error('no existing watch targets found');
  console.log(`[${stamp()}] watching GitHub sync targets (${dryRun ? 'dry-run' : 'push'} mode)`);
  if (!noInitial) schedule('startup');
  process.on('SIGINT', () => {
    for (const watcher of watchers) watcher.close();
    process.exit(0);
  });
}

async function main() {
  const args = parseArgs();
  if (args.help) {
    printHelp();
    return;
  }
  const config = loadConfig(root);
  if (args.tokenStdin) {
    config.token = await readStdinToken();
  }
  if (args.status) {
    const report = statusReport(root, config);
    if (args.json) console.log(JSON.stringify(report, null, 2));
    else printStatus(report);
    return;
  }
  if (args.watch) {
    await runWatch({ rootDir: root, config, noInitial: args.noInitial, dryRun: args.dryRun, message: args.message });
    return;
  }
  const result = await syncOnce({ rootDir: root, config, dryRun: args.dryRun, message: args.message });
  if (args.json) console.log(JSON.stringify(result, null, 2));
  else printSyncResult(result);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`[github-sync] ${error.message}`);
    process.exit(1);
  });
}
