#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const manifestPath = path.join(root, 'parity', 'bidirectional-manifest.json');
const args = new Set(process.argv.slice(2));
const full = args.has('--full');
const json = args.has('--json');
const npmCommand = 'npm';

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const failures = [];
const checks = [];
const runStartedAt = new Date();
const runStartedHr = process.hrtime.bigint();
const phaseTimings = [];
const runId = `${runStartedAt.toISOString().replace(/[-:.]/g, '').slice(0, 15)}-${process.pid}`;

function rel(absPath) {
  return path.relative(root, absPath).replace(/\\/g, '/');
}

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function exists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

function record(id, ok, detail = {}) {
  checks.push({ id, ok, ...detail });
  if (!ok) failures.push({ id, ...detail });
}

function measure(id, fn) {
  const startedAt = new Date();
  const startedHr = process.hrtime.bigint();
  try {
    return fn();
  } finally {
    phaseTimings.push({
      id,
      startedAt: startedAt.toISOString(),
      durationMs: Number(process.hrtime.bigint() - startedHr) / 1_000_000
    });
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeAliases(text) {
  let next = text.replace(/\r\n/g, '\n');
  for (const alias of manifest.aliases || []) {
    next = next.replace(new RegExp(escapeRegExp(alias.from), 'g'), alias.to);
  }
  return next;
}

function stripBlockComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ');
}

function shouldExclude(value, pair) {
  if (!pair.allowExclusions) return false;
  const raw = String(value);
  return (manifest.excludedByLop || []).some((item) => raw.includes(item));
}

function sortedUnique(values, pair) {
  return [...new Set(values)]
    .map((value) => String(value).trim())
    .filter(Boolean)
    .filter((value) => !shouldExclude(value, pair))
    .sort((a, b) => a.localeCompare(b));
}

function collect(text, pattern, group = 1) {
  const out = [];
  for (const match of text.matchAll(pattern)) {
    const value = match[group];
    if (value !== undefined) out.push(value);
  }
  return out;
}

function literalValues(text) {
  const out = [];
  const patterns = [
    /'([^'\n]{1,180})'/g,
    /"([^"\n]{1,180})"/g,
    /`([^`\n]{1,180})`/g
  ];
  for (const pattern of patterns) out.push(...collect(text, pattern));
  return out;
}

function extractJsTsSignature(rawText, pair) {
  const text = stripBlockComments(normalizeAliases(rawText));
  const literals = literalValues(text);
  const calls = collect(text, /(?:^|[^\w$])([A-Za-z_$][\w$]*)\s*\(/g)
    .filter((name) => !new Set(['if', 'for', 'while', 'switch', 'catch', 'function']).has(name));

  const signature = {
    declarations: [
      ...collect(text, /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g),
      ...collect(text, /(?:export\s+)?class\s+([A-Za-z_$][\w$]*)\b/g),
      ...collect(text, /(?:export\s+)?(?:interface|type)\s+([A-Za-z_$][\w$]*)\b/g),
      ...collect(text, /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/g)
    ],
    routes: literals.filter((value) => /^\/(?!\/)[A-Za-z0-9_./:${}?=&%~-]+$/.test(value)),
    events: [
      ...collect(text, /\.addEventListener\(\s*['"`]([^'"`]+)['"`]/g),
      ...collect(text, /event:\s*['"`]([^'"`]+)['"`]/g),
      ...collect(text, /type:\s*['"`]([^'"`]+)['"`]/g)
    ],
    domIds: [
      ...collect(text, /\$\(\s*['"`]([^'"`]+)['"`]\s*\)/g),
      ...collect(text, /getElementById\(\s*['"`]([^'"`]+)['"`]\s*\)/g),
      ...collect(text, /querySelector\(\s*['"`]#([A-Za-z0-9_-]+)['"`]\s*\)/g)
    ],
    actions: [
      ...collect(text, /action:\s*['"`]([^'"`]+)['"`]/g),
      ...collect(text, /data-action=["']([^"']+)["']/g)
    ],
    storageKeys: [
      ...collect(text, /safeLocal(?:Get|Set|Remove)\(\s*['"`]([^'"`]+)['"`]/g),
      ...collect(text, /localStorage\.(?:getItem|setItem|removeItem)\(\s*['"`]([^'"`]+)['"`]/g)
    ],
    calls
  };

  return Object.fromEntries(
    Object.entries(signature).map(([key, values]) => [key, sortedUnique(values, pair)])
  );
}

function parseCssRules(rawText, pair) {
  const text = normalizeAliases(rawText)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\s+/g, ' ');
  const rules = [];
  const vars = [];
  for (const match of text.matchAll(/([^{}]+)\{([^{}]+)\}/g)) {
    const selector = match[1].trim();
    if (!selector || selector.startsWith('@')) continue;
    const body = match[2]
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => part.replace(/\s*:\s*/g, ':').replace(/\s+/g, ' '))
      .sort()
      .join(';');
    for (const varMatch of body.matchAll(/(--[A-Za-z0-9-]+):([^;]+)/g)) {
      vars.push(`${varMatch[1]}:${varMatch[2]}`);
    }
    for (const part of selector.split(',')) {
      const item = `${part.trim()} { ${body} }`;
      if (!shouldExclude(item, pair)) rules.push(item);
    }
  }
  return {
    selectors: sortedUnique(rules, pair),
    vars: sortedUnique(vars, pair)
  };
}

function extractHtmlLikeSignature(rawText, pair) {
  const text = normalizeAliases(rawText);
  return {
    ids: sortedUnique(collect(text, /\bid=\\?["']([^"'\\]+)\\?["']/g), pair),
    dataActions: sortedUnique(collect(text, /\bdata-action=\\?["']([^"'\\]+)\\?["']/g), pair),
    ariaControls: sortedUnique(collect(text, /\baria-controls=\\?["']([^"'\\]+)\\?["']/g), pair)
  };
}

function diffSets(left, right) {
  const rightSet = new Set(right);
  return left.filter((value) => !rightSet.has(value));
}

function compareCategory(id, category, sourceValues, targetValues) {
  const missingInTarget = diffSets(sourceValues, targetValues);
  const missingInSource = diffSets(targetValues, sourceValues);
  const ok = missingInTarget.length === 0 && missingInSource.length === 0;
  record(`${id}:${category}`, ok, {
    category,
    sourceCount: sourceValues.length,
    targetCount: targetValues.length,
    missingInTarget,
    missingInSource
  });
}

function comparePair(pair) {
  if (!exists(pair.source) || !exists(pair.target)) {
    record(pair.id, false, {
      message: 'source or target file is missing',
      source: pair.source,
      target: pair.target,
      sourceExists: exists(pair.source),
      targetExists: exists(pair.target)
    });
    return;
  }

  if (pair.kind === 'css') {
    const source = parseCssRules(read(pair.source), pair);
    const target = parseCssRules(read(pair.target), pair);
    compareCategory(pair.id, 'selectors', source.selectors, target.selectors);
    compareCategory(pair.id, 'vars', source.vars, target.vars);
    return;
  }

  const source = extractJsTsSignature(read(pair.source), pair);
  const target = extractJsTsSignature(read(pair.target), pair);
  for (const category of ['declarations', 'routes', 'events', 'domIds', 'actions', 'storageKeys', 'calls']) {
    compareCategory(pair.id, category, source[category] || [], target[category] || []);
  }
}

function checkUiShell(shell) {
  if (!exists(shell.source) || !exists(shell.target)) {
    record(shell.id, false, {
      message: 'source or target shell file is missing',
      source: shell.source,
      target: shell.target
    });
    return;
  }
  const source = extractHtmlLikeSignature(read(shell.source), shell);
  const target = extractHtmlLikeSignature(read(shell.target), shell);
  for (const category of ['ids', 'dataActions', 'ariaControls']) {
    compareCategory(shell.id, category, source[category] || [], target[category] || []);
  }
}

function checkInvariant(item) {
  if (!exists(item.file)) {
    record(item.id, false, { message: 'file missing', file: item.file });
    return;
  }
  const text = read(item.file);
  const missing = (item.mustContain || []).filter((value) => !text.includes(value));
  const forbidden = (item.mustNotContain || []).filter((value) => text.includes(value));
  record(item.id, missing.length === 0 && forbidden.length === 0, {
    file: item.file,
    missing,
    forbidden
  });
}

function checkLedger(ledger) {
  if (!exists(ledger.file)) {
    record(ledger.id, false, { message: 'ledger file missing', file: ledger.file });
    return;
  }
  const text = read(ledger.file);
  const hits = [];
  for (const term of ledger.blockedTerms || []) {
    const pattern = new RegExp(`\\b${escapeRegExp(term)}\\b`, term === term.toLowerCase() ? 'i' : '');
    if (pattern.test(text)) hits.push(term);
  }
  record(ledger.id, hits.length === 0, { file: ledger.file, hits });
}

function tail(value, lines = 20) {
  return String(value || '').split(/\r?\n/).slice(-lines).join('\n');
}

function runFullCommand(item) {
  const command = item.command === 'npm' ? npmCommand : item.command;
  const startedHr = process.hrtime.bigint();
  const result = spawnSync(command, item.args || [], {
    cwd: path.join(root, item.cwd),
    encoding: 'utf8',
    shell: process.platform === 'win32',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const durationMs = Number(process.hrtime.bigint() - startedHr) / 1_000_000;
  phaseTimings.push({
    id: `command:${item.id}`,
    startedAt: new Date(Date.now() - durationMs).toISOString(),
    durationMs
  });
  record(`command:${item.id}`, result.status === 0, {
    cwd: item.cwd,
    command: [item.command, ...(item.args || [])].join(' '),
    status: result.status,
    error: result.error?.message || '',
    durationMs,
    stdoutTail: tail(result.stdout),
    stderrTail: tail(result.stderr)
  });
}

function run() {
  measure('semantic-signature-pairs', () => {
    for (const pair of manifest.filePairs || []) comparePair(pair);
  });
  if (manifest.uiShell) measure('ui-shell', () => checkUiShell(manifest.uiShell));
  measure('invariants', () => {
    for (const invariant of manifest.invariants || []) checkInvariant(invariant);
  });
  if (manifest.ledger) measure('ledger', () => checkLedger(manifest.ledger));
  if (full) {
    for (const item of manifest.fullCommands || []) runFullCommand(item);
  }
}

function formatMs(value) {
  const ms = Number(value || 0);
  if (ms < 1000) return `${ms.toFixed(1)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function readRecentRuns(logPath, limit = 12) {
  let raw = '';
  try { raw = fs.readFileSync(logPath, 'utf8'); } catch {}
  return raw
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(-limit)
    .map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    })
    .filter(Boolean);
}

function markdownForRuns(runs, current) {
  const rows = runs.map((run) => {
    const status = run.ok ? 'pass' : 'fail';
    const failed = run.failureCount ? String(run.failureCount) : '-';
    return `| ${run.completedAt} | ${run.mode} | ${status} | ${formatMs(run.totalMs)} | ${failed} | ${run.runId} |`;
  }).join('\n');
  const phases = current.phases
    .map((phase) => `| ${phase.id} | ${formatMs(phase.durationMs)} |`)
    .join('\n');
  return [
    '# WebUI <-> React 同步性能对比',
    '',
    '计时边界：只记录本地 parity 检测、构建、静态检查和测试命令耗时；不包含大模型生成、等待用户输入或网络模型响应时间。',
    '',
    `最新运行：${current.completedAt}`,
    `模式：${current.mode}`,
    `结果：${current.ok ? 'pass' : 'fail'}`,
    `总耗时：${formatMs(current.totalMs)}`,
    `失败项：${current.failureCount || 0}`,
    '',
    '## 最新阶段耗时',
    '',
    '| 阶段 | 耗时 |',
    '|---|---:|',
    phases || '| - | - |',
    '',
    '## 最近运行对比',
    '',
    '| 完成时间 | 模式 | 结果 | 总耗时 | 失败项 | runId |',
    '|---|---|---|---:|---:|---|',
    rows || '| - | - | - | - | - | - |',
    ''
  ].join('\n');
}

function writePerformanceArtifacts(report) {
  const outputDir = path.join(root, 'outputs', 'parity-sync');
  fs.mkdirSync(outputDir, { recursive: true });
  const logPath = path.join(outputDir, 'performance-log.jsonl');
  const reportEntry = {
    runId,
    mode: report.mode,
    ok: report.ok,
    startedAt: runStartedAt.toISOString(),
    completedAt: new Date().toISOString(),
    totalMs: Number(process.hrtime.bigint() - runStartedHr) / 1_000_000,
    checkCount: checks.length,
    failureCount: failures.length,
    modelTimeExcluded: true,
    timingBoundary: 'local parity process only',
    phases: phaseTimings
  };
  fs.appendFileSync(logPath, `${JSON.stringify(reportEntry)}\n`, 'utf8');
  const recent = readRecentRuns(logPath, 12);
  const markdown = markdownForRuns(recent, reportEntry);
  const markdownPath = path.join(outputDir, 'performance-comparison.md');
  fs.writeFileSync(markdownPath, markdown, 'utf8');
  return {
    outputDir,
    logPath,
    markdownPath,
    latest: reportEntry
  };
}

run();

const report = {
  ok: failures.length === 0,
  mode: full ? 'full' : 'fast',
  root,
  checks,
  failures
};
const performanceArtifacts = writePerformanceArtifacts(report);
report.performance = {
  logPath: performanceArtifacts.logPath,
  markdownPath: performanceArtifacts.markdownPath,
  latest: performanceArtifacts.latest
};

if (json) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else if (report.ok) {
  process.stdout.write(`[parity] OK ${report.mode}: ${checks.length} checks passed under ${rel(root)}\n`);
  process.stdout.write(`[parity] performance: ${formatMs(performanceArtifacts.latest.totalMs)} (${rel(performanceArtifacts.markdownPath)})\n`);
} else {
  process.stderr.write(`[parity] FAIL ${report.mode}: ${failures.length} failed checks\n`);
  process.stderr.write(`[parity] performance: ${formatMs(performanceArtifacts.latest.totalMs)} (${rel(performanceArtifacts.markdownPath)})\n`);
  for (const failure of failures.slice(0, 40)) {
    process.stderr.write(`\n- ${failure.id}\n`);
    if (failure.message) process.stderr.write(`  ${failure.message}\n`);
    if (failure.missingInTarget?.length) process.stderr.write(`  missing in React target: ${failure.missingInTarget.slice(0, 20).join(', ')}\n`);
    if (failure.missingInSource?.length) process.stderr.write(`  missing in WebUI source: ${failure.missingInSource.slice(0, 20).join(', ')}\n`);
    if (failure.missing?.length) process.stderr.write(`  missing: ${failure.missing.join(', ')}\n`);
    if (failure.forbidden?.length) process.stderr.write(`  forbidden: ${failure.forbidden.join(', ')}\n`);
    if (failure.hits?.length) process.stderr.write(`  blocked terms: ${failure.hits.join(', ')}\n`);
    if (failure.stderrTail) process.stderr.write(`  stderr tail:\n${failure.stderrTail}\n`);
  }
}

process.exit(report.ok ? 0 : 1);
