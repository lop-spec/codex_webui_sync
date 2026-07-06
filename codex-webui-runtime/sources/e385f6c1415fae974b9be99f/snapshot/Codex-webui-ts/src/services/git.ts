import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const MAX_DIFF_CHARS = 180_000;
const TEXT_PREVIEW_BYTES = 180_000;

type GitWorkspaceDiffSection = 'unstaged' | 'staged' | 'untracked' | 'conflicted';
type GitWorkspaceDiffScope = 'unstaged' | 'staged';

interface GitStatusEntry {
  path: string;
  originalPath: string | null;
  indexStatus: string;
  worktreeStatus: string;
}

interface GitStatusOutput {
  ok: true;
  isRepo: boolean;
  isRepository: boolean;
  workdir: string;
  root: string | null;
  repoRoot: string | null;
  branch: {
    head: string | null;
    upstream: string | null;
    ahead: number;
    behind: number;
    detached: boolean;
  } | null;
  branchName: string;
  remoteName: string | null;
  remoteUrl: string | null;
  branches: Array<{ name: string; upstream: string | null; isCurrent: boolean }>;
  porcelain: string;
  files: Array<{ status: string; path: string }>;
  staged: GitStatusEntry[];
  unstaged: GitStatusEntry[];
  untracked: GitStatusEntry[];
  conflicted: GitStatusEntry[];
  isClean: boolean;
  error?: string;
}

interface GitFileDiffOutput {
  ok: true;
  path: string;
  displayPath: string;
  originalPath: string | null;
  status: string;
  staged: boolean;
  section: GitWorkspaceDiffSection;
  diff: string;
  diffLoaded: true;
  additions: number;
  deletions: number;
  truncated: boolean;
}

function gitCommand(): string {
  const configured = process.env.GIT_CMD;
  if (configured && fs.existsSync(configured)) return configured;
  const candidates = process.platform === 'win32'
    ? ['C:\\Program Files\\Git\\cmd\\git.exe', 'C:\\Program Files\\Git\\bin\\git.exe', 'git']
    : ['git'];
  return candidates.find((candidate) => candidate === 'git' || fs.existsSync(candidate)) || 'git';
}

async function runGit(args: string[], cwd: string): Promise<string> {
  const result = await execFileAsync(gitCommand(), args, {
    cwd,
    timeout: 15000,
    maxBuffer: 1024 * 1024 * 8,
    windowsHide: true
  });
  return String(result.stdout || '').trimEnd();
}

function truncate(value: string, marker = '[diff truncated by Codex WebUI]'): { text: string; truncated: boolean } {
  if (value.length <= MAX_DIFF_CHARS) return { text: value, truncated: false };
  return { text: value.slice(0, MAX_DIFF_CHARS) + `\n\n${marker}`, truncated: true };
}

function normalizeSlashPath(value: string): string {
  return value.replace(/\\/g, '/');
}

function ensureInside(parent: string, child: string): void {
  const parentPath = path.resolve(parent);
  const childPath = path.resolve(child);
  const relative = path.relative(parentPath, childPath);
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) return;
  throw new Error('Path must stay inside the Git repository');
}

function normalizeRepoPath(repoRoot: string, input: unknown): string {
  const raw = String(input || '').trim().replace(/^["']|["']$/g, '');
  if (!raw || raw.includes('\0')) throw new Error('Git path is required');
  const resolved = path.isAbsolute(raw) ? path.resolve(raw) : path.resolve(repoRoot, raw);
  ensureInside(repoRoot, resolved);
  const relative = normalizeSlashPath(path.relative(repoRoot, resolved));
  if (!relative || relative.startsWith('..')) throw new Error('Git path is required');
  return relative;
}

function normalizeRepoPaths(repoRoot: string, paths: unknown): string[] {
  if (!Array.isArray(paths)) throw new Error('paths must be an array');
  const normalized = [...new Set(paths.map((item) => normalizeRepoPath(repoRoot, item)))];
  if (!normalized.length) throw new Error('at least one Git path is required');
  return normalized;
}

function parsePorcelainPath(value: string): { path: string; originalPath: string | null } {
  const arrow = ' -> ';
  const arrowIndex = value.indexOf(arrow);
  if (arrowIndex < 0) return { path: value, originalPath: null };
  return { originalPath: value.slice(0, arrowIndex), path: value.slice(arrowIndex + arrow.length) };
}

function isConflictStatus(indexStatus: string, worktreeStatus: string): boolean {
  const pair = `${indexStatus}${worktreeStatus}`;
  return ['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU'].includes(pair) || indexStatus === 'U' || worktreeStatus === 'U';
}

function parseStatusEntries(porcelain: string): {
  files: Array<{ status: string; path: string }>;
  staged: GitStatusEntry[];
  unstaged: GitStatusEntry[];
  untracked: GitStatusEntry[];
  conflicted: GitStatusEntry[];
} {
  const files: Array<{ status: string; path: string }> = [];
  const staged: GitStatusEntry[] = [];
  const unstaged: GitStatusEntry[] = [];
  const untracked: GitStatusEntry[] = [];
  const conflicted: GitStatusEntry[] = [];
  for (const line of porcelain.split(/\r?\n/)) {
    if (!line || line.startsWith('##') || line.startsWith('!!')) continue;
    const indexStatus = line[0] || ' ';
    const worktreeStatus = line[1] || ' ';
    const status = `${indexStatus}${worktreeStatus}`;
    const parsed = parsePorcelainPath(line.slice(3));
    const entry: GitStatusEntry = {
      path: parsed.path,
      originalPath: parsed.originalPath,
      indexStatus,
      worktreeStatus
    };
    files.push({ status, path: entry.path });
    if (isConflictStatus(indexStatus, worktreeStatus)) {
      conflicted.push(entry);
      continue;
    }
    if (indexStatus === '?' && worktreeStatus === '?') {
      untracked.push(entry);
      continue;
    }
    if (indexStatus !== ' ' && indexStatus !== '?' && indexStatus !== '!') staged.push(entry);
    if (worktreeStatus !== ' ' && worktreeStatus !== '?' && worktreeStatus !== '!') unstaged.push(entry);
  }
  return { files, staged, unstaged, untracked, conflicted };
}

async function readBranch(cwd: string) {
  let head: string | null = null;
  let detached = false;
  try {
    head = await runGit(['symbolic-ref', '--quiet', '--short', 'HEAD'], cwd);
  } catch {
    detached = true;
    head = await runGit(['rev-parse', '--short', 'HEAD'], cwd).catch(() => null);
  }
  const upstream = await runGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], cwd).catch(() => null);
  let ahead = 0;
  let behind = 0;
  if (upstream) {
    const counts = await runGit(['rev-list', '--left-right', '--count', `HEAD...${upstream}`], cwd).catch(() => '');
    const [left, right] = counts.split(/\s+/).map((item) => Number(item || 0));
    ahead = Number.isFinite(left) ? left : 0;
    behind = Number.isFinite(right) ? right : 0;
  }
  return { head, upstream, ahead, behind, detached };
}

async function readBranches(cwd: string): Promise<Array<{ name: string; upstream: string | null; isCurrent: boolean }>> {
  const raw = await runGit(['for-each-ref', '--format=%(refname:short)%00%(upstream:short)%00%(HEAD)', 'refs/heads'], cwd).catch(() => '');
  return raw.split(/\r?\n/).filter(Boolean).map((line) => {
    const [name, upstream, headMarker] = line.split('\0');
    return { name, upstream: upstream || null, isCurrent: headMarker === '*' };
  }).filter((item) => item.name);
}

async function readRemote(cwd: string, upstream: string | null): Promise<{ remoteName: string | null; remoteUrl: string | null }> {
  let remoteName = upstream && upstream.includes('/') ? upstream.split('/')[0] : null;
  if (!remoteName) {
    const remotes = await runGit(['remote'], cwd).catch(() => '');
    remoteName = remotes.split(/\r?\n/).find(Boolean) || null;
  }
  const remoteUrl = remoteName ? await runGit(['remote', 'get-url', remoteName], cwd).catch(() => null) : null;
  return { remoteName, remoteUrl };
}

function countDiffStats(diff: string, section: GitWorkspaceDiffSection): { additions: number; deletions: number } {
  if (section === 'untracked' && !/^diff --git/m.test(diff)) {
    const lines = diff ? diff.split(/\r?\n/).filter((line) => line.length > 0).length : 0;
    return { additions: lines, deletions: 0 };
  }
  let additions = 0;
  let deletions = 0;
  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith('+++') || line.startsWith('---')) continue;
    if (line.startsWith('+')) additions += 1;
    if (line.startsWith('-')) deletions += 1;
  }
  return { additions, deletions };
}

function findEntry(status: GitStatusOutput, relativePath: string, staged: boolean): { entry: GitStatusEntry | null; section: GitWorkspaceDiffSection } {
  if (staged) return { entry: status.staged.find((item) => item.path === relativePath) || null, section: 'staged' };
  const conflict = status.conflicted.find((item) => item.path === relativePath);
  if (conflict) return { entry: conflict, section: 'conflicted' };
  const untracked = status.untracked.find((item) => item.path === relativePath);
  if (untracked) return { entry: untracked, section: 'untracked' };
  return { entry: status.unstaged.find((item) => item.path === relativePath) || null, section: 'unstaged' };
}

function isUntracked(status: GitStatusOutput, relativePath: string): boolean {
  return status.untracked.some((entry) => entry.path === relativePath);
}

function readTextPreview(repoRoot: string, relativePath: string): { text: string; truncated: boolean } {
  const abs = path.resolve(repoRoot, relativePath);
  ensureInside(repoRoot, abs);
  const data = fs.readFileSync(abs);
  const truncated = data.length > TEXT_PREVIEW_BYTES;
  return {
    text: data.subarray(0, TEXT_PREVIEW_BYTES).toString('utf8') + (truncated ? '\n\n[file preview truncated by Codex WebUI]' : ''),
    truncated
  };
}

function diffArgs(relativePath: string, staged: boolean, ignoreWhitespaceChanges: boolean): string[] {
  const args = ['diff'];
  if (staged) args.push('--cached');
  if (ignoreWhitespaceChanges) args.push('-w');
  args.push('--', relativePath);
  return args;
}

export async function getGitStatus(workdir: string): Promise<GitStatusOutput> {
  const cwd = path.resolve(workdir);
  try {
    const root = await runGit(['rev-parse', '--show-toplevel'], cwd);
    const porcelain = await runGit(['status', '--porcelain=v1', '-b'], root);
    const parsed = parseStatusEntries(porcelain);
    const branch = await readBranch(root);
    const { remoteName, remoteUrl } = await readRemote(root, branch.upstream);
    const branches = await readBranches(root);
    const isClean = parsed.staged.length === 0 && parsed.unstaged.length === 0 && parsed.untracked.length === 0 && parsed.conflicted.length === 0;
    return {
      ok: true,
      isRepo: true,
      isRepository: true,
      workdir: cwd,
      root,
      repoRoot: root,
      branch,
      branchName: branch.head || '',
      remoteName,
      remoteUrl,
      branches,
      porcelain,
      files: parsed.files,
      staged: parsed.staged,
      unstaged: parsed.unstaged,
      untracked: parsed.untracked,
      conflicted: parsed.conflicted,
      isClean
    };
  } catch (error) {
    return {
      ok: true,
      isRepo: false,
      isRepository: false,
      workdir: cwd,
      root: null,
      repoRoot: null,
      branch: null,
      branchName: '',
      remoteName: null,
      remoteUrl: null,
      branches: [],
      porcelain: '',
      files: [],
      staged: [],
      unstaged: [],
      untracked: [],
      conflicted: [],
      isClean: true,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function getGitDiff(workdir: string) {
  const status = await getGitStatus(workdir);
  if (!status.isRepo || !status.repoRoot) return { ...status, stat: '', diff: '', stagedDiff: '', truncated: false };
  const cwd = status.repoRoot;
  const stat = await runGit(['diff', '--stat'], cwd).catch((error) => `diff --stat failed: ${error instanceof Error ? error.message : String(error)}`);
  const unstaged = await runGit(['diff', '--', '.'], cwd).catch((error) => `diff failed: ${error instanceof Error ? error.message : String(error)}`);
  const staged = await runGit(['diff', '--cached', '--', '.'], cwd).catch((error) => `diff --cached failed: ${error instanceof Error ? error.message : String(error)}`);
  const combined = truncate([unstaged, staged ? `\n\n# Staged diff\n${staged}` : ''].filter(Boolean).join(''));
  return { ...status, stat, diff: combined.text, stagedDiff: staged, truncated: combined.truncated };
}

export async function getGitFileDiff(workdir: string, filePath: unknown, staged = false, ignoreWhitespaceChanges = false): Promise<GitFileDiffOutput> {
  const status = await getGitStatus(workdir);
  if (!status.isRepo || !status.repoRoot) throw new Error('Current workdir is not a Git repository');
  const relativePath = normalizeRepoPath(status.repoRoot, filePath);
  const { entry, section } = findEntry(status, relativePath, staged);
  const statusCode = entry ? `${entry.indexStatus}${entry.worktreeStatus}` : staged ? 'S ' : ' M';
  let diffText = '';
  let truncated = false;
  if (!staged && isUntracked(status, relativePath)) {
    const preview = readTextPreview(status.repoRoot, relativePath);
    diffText = preview.text;
    truncated = preview.truncated;
  } else {
    const output = await runGit(diffArgs(relativePath, staged, ignoreWhitespaceChanges), status.repoRoot);
    const limited = truncate(output);
    diffText = limited.text;
    truncated = limited.truncated;
  }
  const stats = countDiffStats(diffText, section);
  return {
    ok: true,
    path: relativePath,
    displayPath: entry?.originalPath ? `${entry.originalPath} -> ${relativePath}` : relativePath,
    originalPath: entry?.originalPath || null,
    status: statusCode,
    staged,
    section,
    diff: diffText || '当前没有可显示的差异。',
    diffLoaded: true,
    additions: stats.additions,
    deletions: stats.deletions,
    truncated
  };
}

export async function getGitWorkspaceDiffs(workdir: string, scope: GitWorkspaceDiffScope = 'unstaged', ignoreWhitespaceChanges = false) {
  const status = await getGitStatus(workdir);
  if (!status.isRepo || !status.repoRoot) return { ok: true, ...status, scope, diffs: [] };
  const entries = scope === 'staged'
    ? status.staged.map((entry) => ({ entry, staged: true }))
    : [...status.conflicted, ...status.unstaged, ...status.untracked].map((entry) => ({ entry, staged: false }));
  const diffs: GitFileDiffOutput[] = [];
  for (const item of entries) {
    diffs.push(await getGitFileDiff(status.repoRoot, item.entry.path, item.staged, ignoreWhitespaceChanges));
  }
  return { ok: true, ...status, scope, diffs };
}

export async function stageGitPaths(workdir: string, paths: unknown) {
  const status = await getGitStatus(workdir);
  if (!status.isRepo || !status.repoRoot) throw new Error('Current workdir is not a Git repository');
  const normalized = normalizeRepoPaths(status.repoRoot, paths);
  await runGit(['add', '--', ...normalized], status.repoRoot);
  return { ok: true, status: await getGitStatus(status.repoRoot) };
}

export async function unstageGitPaths(workdir: string, paths: unknown) {
  const status = await getGitStatus(workdir);
  if (!status.isRepo || !status.repoRoot) throw new Error('Current workdir is not a Git repository');
  const normalized = normalizeRepoPaths(status.repoRoot, paths);
  await runGit(['restore', '--staged', '--', ...normalized], status.repoRoot);
  return { ok: true, status: await getGitStatus(status.repoRoot) };
}

export async function discardGitPaths(workdir: string, paths: unknown, deleteUntracked = false) {
  const status = await getGitStatus(workdir);
  if (!status.isRepo || !status.repoRoot) throw new Error('Current workdir is not a Git repository');
  const normalized = normalizeRepoPaths(status.repoRoot, paths);
  const untracked = new Set(status.untracked.map((entry) => entry.path));
  const restorePaths: string[] = [];
  for (const relativePath of normalized) {
    if (untracked.has(relativePath)) {
      if (!deleteUntracked) continue;
      const abs = path.resolve(status.repoRoot, relativePath);
      ensureInside(status.repoRoot, abs);
      fs.rmSync(abs, { recursive: true, force: true });
    } else {
      restorePaths.push(relativePath);
    }
  }
  if (restorePaths.length) await runGit(['restore', '--worktree', '--', ...restorePaths], status.repoRoot);
  return { ok: true, status: await getGitStatus(status.repoRoot) };
}

export async function commitGit(workdir: string, message: unknown) {
  const status = await getGitStatus(workdir);
  if (!status.isRepo || !status.repoRoot) throw new Error('Current workdir is not a Git repository');
  const commitMessage = String(message || '').trim();
  if (!commitMessage) throw new Error('Commit message is required');
  const output = await runGit(['commit', '-m', commitMessage], status.repoRoot);
  return { ok: true, output, status: await getGitStatus(status.repoRoot) };
}

export async function pushGit(workdir: string, forceWithLease = false) {
  const status = await getGitStatus(workdir);
  if (!status.isRepo || !status.repoRoot) throw new Error('Current workdir is not a Git repository');
  const args = ['push'];
  if (forceWithLease) args.push('--force-with-lease');
  const output = await runGit(args, status.repoRoot);
  return { ok: true, output, status: await getGitStatus(status.repoRoot) };
}

export async function checkoutGitBranch(workdir: string, branchName: unknown, create = false) {
  const status = await getGitStatus(workdir);
  if (!status.isRepo || !status.repoRoot) throw new Error('Current workdir is not a Git repository');
  const name = String(branchName || '').trim();
  if (!name || name.startsWith('-') || name.includes('..') || name.includes('@{') || !/^[A-Za-z0-9._/-]+$/.test(name)) {
    throw new Error('Invalid branch name');
  }
  const args = create ? ['checkout', '-b', name] : ['checkout', name];
  const output = await runGit(args, status.repoRoot);
  return { ok: true, output, status: await getGitStatus(status.repoRoot) };
}

export async function pullGit(workdir: string) {
  const status = await getGitStatus(workdir);
  if (!status.isRepo || !status.repoRoot) throw new Error('Current workdir is not a Git repository');
  const output = await runGit(['pull', '--ff-only'], status.repoRoot);
  return { ok: true, output, status: await getGitStatus(status.repoRoot) };
}
