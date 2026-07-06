import fs from 'fs';
import os from 'os';
import path from 'path';

export type McpTransportType = 'stdio' | 'http' | 'sse';

export interface McpServerEntry {
  id: string;
  name: string;
  type: McpTransportType;
  enabled: boolean;
  command?: string;
  args: string[];
  cwd?: string;
  env: Record<string, string>;
  envVars: Array<string | Record<string, unknown>>;
  url?: string;
  bearerTokenEnvVar?: string;
  httpHeaders: Record<string, string>;
  envHttpHeaders: Record<string, string>;
  envKeys: string[];
  source: string;
  writable: boolean;
}

export interface McpServerFormState {
  id: string;
  name: string;
  type: McpTransportType;
  command: string;
  argsText: string;
  cwd: string;
  envText: string;
  envVarsText: string;
  url: string;
  bearerTokenEnvVar: string;
  httpHeadersText: string;
  envHttpHeadersText: string;
  enabled: boolean;
}

type McpServerConfig = {
  name?: string;
  type?: McpTransportType;
  enabled?: boolean;
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  env_vars?: Array<string | Record<string, unknown>>;
  url?: string;
  bearer_token_env_var?: string;
  http_headers?: Record<string, string>;
  headers?: Record<string, string>;
  env_http_headers?: Record<string, string>;
};

const MANAGED_KEYS = new Set([
  'name',
  'type',
  'enabled',
  'command',
  'args',
  'cwd',
  'env',
  'env_vars',
  'url',
  'bearer_token_env_var',
  'headers',
  'http_headers',
  'env_http_headers'
]);

export function codexConfigPath(): string {
  return process.env.CODEX_HOME
    ? path.join(process.env.CODEX_HOME, 'config.toml')
    : path.join(os.homedir(), '.codex', 'config.toml');
}

function codexHomePath(): string {
  return process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
}

function sharedPoolPath(): string {
  return path.join(codexHomePath(), 'mcp-shared-pool.json');
}

function parseTomlString(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

function parseTomlValue(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) return parseTomlArray(trimmed);
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return parseInlineObject(trimmed);
  return parseTomlString(trimmed);
}

function parseTomlArray(value: string): string[] {
  const body = value.trim().slice(1, -1).trim();
  if (!body) return [];
  const items: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let escaped = false;
  for (const char of body) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === '\\' && quote === '"') {
      current += char;
      escaped = true;
      continue;
    }
    if ((char === '"' || char === "'") && quote === null) {
      quote = char;
      current += char;
      continue;
    }
    if (char === quote) {
      quote = null;
      current += char;
      continue;
    }
    if (char === ',' && quote === null) {
      const item = current.trim();
      if (item) items.push(parseTomlString(item));
      current = '';
      continue;
    }
    current += char;
  }
  const item = current.trim();
  if (item) items.push(parseTomlString(item));
  return items;
}

function parseInlineObject(value: string): Record<string, string> {
  const body = value.trim().slice(1, -1).trim();
  if (!body) return {};
  const result: Record<string, string> = {};
  for (const part of body.split(',')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim().replace(/^["']|["']$/g, '');
    result[key] = parseTomlString(part.slice(idx + 1).trim());
  }
  return result;
}

function parseConfigText(raw: string): Map<string, McpServerConfig> {
  const servers = new Map<string, McpServerConfig>();
  let currentId: string | null = null;
  let currentSubsection: 'server' | 'env' | 'http_headers' | 'headers' | 'env_http_headers' | null = null;
  for (const lineRaw of raw.split(/\r?\n/)) {
    const line = lineRaw.trim();
    if (!line || line.startsWith('#')) continue;
    const section = line.match(/^\[mcp_servers\.([A-Za-z0-9_-]+)(?:\.(env|http_headers|headers|env_http_headers))?\]$/);
    if (section) {
      currentId = section[1];
      currentSubsection = (section[2] as typeof currentSubsection) || 'server';
      if (!servers.has(currentId)) servers.set(currentId, {});
      continue;
    }
    if (line.startsWith('[')) {
      currentId = null;
      currentSubsection = null;
      continue;
    }
    if (!currentId || !currentSubsection) continue;
    const idx = line.indexOf('=');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    const value = parseTomlValue(line.slice(idx + 1));
    const server = servers.get(currentId)!;
    if (currentSubsection === 'env' || currentSubsection === 'http_headers' || currentSubsection === 'headers' || currentSubsection === 'env_http_headers') {
      const target = server[currentSubsection] ?? {};
      if (typeof value === 'string') target[key] = value;
      server[currentSubsection] = target;
      continue;
    }
    if (key === 'enabled' && typeof value === 'boolean') server.enabled = value;
    else if (key === 'args' && Array.isArray(value)) server.args = value.filter((item): item is string => typeof item === 'string');
    else if (key === 'env_vars' && Array.isArray(value)) server.env_vars = value;
    else if (key === 'type' && isTransportType(String(value))) server.type = String(value) as McpTransportType;
    else if (typeof value === 'string' || typeof value === 'boolean' || Array.isArray(value) || isStringRecord(value)) {
      (server as Record<string, unknown>)[key] = value;
    }
  }
  return servers;
}

function isTransportType(value: string): boolean {
  return value === 'stdio' || value === 'http' || value === 'sse';
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && Object.values(value).every((item) => typeof item === 'string');
}

function toServerEntry(id: string, config: McpServerConfig, configPath: string): McpServerEntry {
  const type = config.type || (config.url ? 'http' : 'stdio');
  const httpHeaders = config.http_headers || config.headers || {};
  const env = config.env || {};
  return {
    id,
    name: config.name || id,
    type,
    enabled: config.enabled !== false,
    command: config.command,
    args: Array.isArray(config.args) ? config.args : [],
    cwd: config.cwd,
    env,
    envVars: Array.isArray(config.env_vars) ? config.env_vars : [],
    url: config.url,
    bearerTokenEnvVar: config.bearer_token_env_var,
    httpHeaders,
    envHttpHeaders: config.env_http_headers || {},
    envKeys: Object.keys(env),
    source: configPath,
    writable: true
  };
}

export function listMcpServers() {
  const configPath = codexConfigPath();
  if (!fs.existsSync(configPath)) {
    return {
      ok: true,
      configPath,
      servers: [] as McpServerEntry[],
      sharedPool: readSharedPoolSettings(),
      message: 'Codex config not found'
    };
  }
  const raw = fs.readFileSync(configPath, 'utf8');
  const servers = [...parseConfigText(raw).entries()]
    .map(([id, config]) => toServerEntry(id, config, configPath))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  return {
    ok: true,
    configPath,
    servers,
    sharedPool: readSharedPoolSettings(),
    message: servers.length ? 'configured' : 'No MCP servers configured'
  };
}

function splitNonEmptyLines(value: string): string[] {
  return String(value || '')
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseKeyValueText(value: string, label: string): { data: Record<string, string>; error: string | null } {
  const data: Record<string, string> = {};
  for (const line of splitNonEmptyLines(value)) {
    const idx = line.indexOf('=');
    if (idx <= 0) return { data: {}, error: `${label} 必须使用 KEY=value 格式` };
    const key = line.slice(0, idx).trim();
    if (!key) return { data: {}, error: `${label} 的 key 不能为空` };
    data[key] = line.slice(idx + 1).trim();
  }
  return { data, error: null };
}

function parseEnvVarsText(value: string): Array<string | Record<string, unknown>> {
  return splitNonEmptyLines(value).map((line) => {
    if (!line.startsWith('{')) return line;
    try {
      const parsed = JSON.parse(line) as unknown;
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {}
    return line;
  });
}

export function createMcpServerFormState(server?: McpServerEntry | null): McpServerFormState {
  if (!server) {
    return {
      id: '',
      name: '',
      type: 'stdio',
      command: '',
      argsText: '',
      cwd: '',
      envText: '',
      envVarsText: '',
      url: '',
      bearerTokenEnvVar: '',
      httpHeadersText: '',
      envHttpHeadersText: '',
      enabled: true
    };
  }
  return {
    id: server.id,
    name: server.name === server.id ? '' : server.name,
    type: server.type,
    command: server.command || '',
    argsText: server.args.join('\n'),
    cwd: server.cwd || '',
    envText: recordToLines(server.env),
    envVarsText: server.envVars.map((item) => typeof item === 'string' ? item : JSON.stringify(item)).join('\n'),
    url: server.url || '',
    bearerTokenEnvVar: server.bearerTokenEnvVar || '',
    httpHeadersText: recordToLines(server.httpHeaders),
    envHttpHeadersText: recordToLines(server.envHttpHeaders),
    enabled: server.enabled
  };
}

function recordToLines(record: Record<string, string>): string {
  return Object.entries(record).map(([key, value]) => `${key}=${value}`).join('\n');
}

export function validateMcpServerForm(state: McpServerFormState): Record<string, string> {
  const errors: Record<string, string> = {};
  const id = String(state.id || '').trim();
  if (!id) errors.id = '名称不能为空';
  else if (id.includes('.')) errors.id = '名称不能包含 .';
  else if (!/^[A-Za-z0-9_-]+$/.test(id)) errors.id = '名称只能包含字母、数字、下划线或短横线';
  if (state.type === 'stdio' && !String(state.command || '').trim()) errors.command = 'STDIO 服务必须填写启动命令';
  if (state.type !== 'stdio') {
    const url = String(state.url || '').trim();
    if (!url) errors.url = `${state.type.toUpperCase()} 服务必须填写 URL`;
    else {
      try { new URL(url); } catch { errors.url = 'URL 格式不正确'; }
    }
  }
  const envError = parseKeyValueText(state.envText, '环境变量').error;
  const headersError = parseKeyValueText(state.httpHeadersText, 'HTTP headers').error;
  const envHeadersError = parseKeyValueText(state.envHttpHeadersText, '环境变量 headers').error;
  if (envError) errors.envText = envError;
  if (headersError) errors.httpHeadersText = headersError;
  if (envHeadersError) errors.envHttpHeadersText = envHeadersError;
  return errors;
}

export function buildMcpServerConfigValue(state: McpServerFormState, previous?: McpServerConfig): McpServerConfig {
  const next: McpServerConfig = omitManagedFields(previous);
  const name = String(state.name || '').trim();
  if (name) next.name = name;
  next.enabled = state.enabled !== false;
  next.type = state.type;
  if (state.type === 'stdio') {
    next.command = String(state.command || '').trim();
    const args = splitNonEmptyLines(state.argsText);
    if (args.length) next.args = args;
    const cwd = String(state.cwd || '').trim();
    if (cwd) next.cwd = cwd;
    const env = parseKeyValueText(state.envText, '环境变量').data;
    if (Object.keys(env).length) next.env = env;
    const envVars = parseEnvVarsText(state.envVarsText);
    if (envVars.length) next.env_vars = envVars;
    return next;
  }
  next.url = String(state.url || '').trim();
  const bearerTokenEnvVar = String(state.bearerTokenEnvVar || '').trim();
  if (bearerTokenEnvVar) next.bearer_token_env_var = bearerTokenEnvVar;
  const headers = parseKeyValueText(state.httpHeadersText, 'HTTP headers').data;
  const envHeaders = parseKeyValueText(state.envHttpHeadersText, '环境变量 headers').data;
  if (Object.keys(headers).length) next.http_headers = headers;
  if (Object.keys(envHeaders).length) next.env_http_headers = envHeaders;
  return next;
}

function omitManagedFields(value?: McpServerConfig): McpServerConfig {
  const next: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value || {})) {
    if (!MANAGED_KEYS.has(key)) next[key] = item;
  }
  return next as McpServerConfig;
}

function readConfigState(): { raw: string; servers: Map<string, McpServerConfig>; configPath: string } {
  const configPath = codexConfigPath();
  const raw = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : '';
  return { raw, servers: parseConfigText(raw), configPath };
}

function stripMcpSections(raw: string): string {
  const kept: string[] = [];
  let dropping = false;
  for (const line of raw.split(/\r?\n/)) {
    const section = line.trim().match(/^\[([^\]]+)\]$/);
    if (section) dropping = section[1].startsWith('mcp_servers.');
    if (!dropping) kept.push(line);
  }
  return kept.join('\n').replace(/\s+$/g, '');
}

function serializeTomlString(value: string): string {
  return JSON.stringify(value);
}

function serializeStringArray(items: string[]): string {
  return `[${items.map(serializeTomlString).join(', ')}]`;
}

function serializeServerSection(id: string, config: McpServerConfig): string {
  const lines: string[] = [`[mcp_servers.${id}]`];
  if (config.name) lines.push(`name = ${serializeTomlString(config.name)}`);
  lines.push(`enabled = ${config.enabled === false ? 'false' : 'true'}`);
  lines.push(`type = ${serializeTomlString(config.type || (config.url ? 'http' : 'stdio'))}`);
  if (config.command) lines.push(`command = ${serializeTomlString(config.command)}`);
  if (config.args?.length) lines.push(`args = ${serializeStringArray(config.args)}`);
  if (config.cwd) lines.push(`cwd = ${serializeTomlString(config.cwd)}`);
  if (config.env_vars?.length) {
    const envVars = config.env_vars.map((item) => typeof item === 'string' ? serializeTomlString(item) : serializeTomlString(JSON.stringify(item)));
    lines.push(`env_vars = [${envVars.join(', ')}]`);
  }
  if (config.url) lines.push(`url = ${serializeTomlString(config.url)}`);
  if (config.bearer_token_env_var) lines.push(`bearer_token_env_var = ${serializeTomlString(config.bearer_token_env_var)}`);
  appendRecordSection(lines, id, 'env', config.env);
  appendRecordSection(lines, id, 'http_headers', config.http_headers || config.headers);
  appendRecordSection(lines, id, 'env_http_headers', config.env_http_headers);
  return lines.join('\n');
}

function appendRecordSection(lines: string[], id: string, name: 'env' | 'http_headers' | 'env_http_headers', record?: Record<string, string>): void {
  if (!record || Object.keys(record).length === 0) return;
  lines.push('', `[mcp_servers.${id}.${name}]`);
  for (const key of Object.keys(record).sort()) {
    lines.push(`${key} = ${serializeTomlString(record[key])}`);
  }
}

function writeConfigState(raw: string, servers: Map<string, McpServerConfig>): void {
  const configPath = codexConfigPath();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  const base = stripMcpSections(raw);
  const sections = [...servers.entries()]
    .sort(([left], [right]) => left.localeCompare(right, undefined, { sensitivity: 'base' }))
    .map(([id, config]) => serializeServerSection(id, config));
  const next = [base, ...sections].filter((part) => part.trim()).join('\n\n') + '\n';
  fs.writeFileSync(configPath, next, 'utf8');
}

export function saveMcpServer(body: Partial<McpServerFormState> & { originalId?: string }) {
  const state: McpServerFormState = { ...createMcpServerFormState(null), ...body };
  const errors = validateMcpServerForm(state);
  if (Object.keys(errors).length) return { ok: false, errors };
  const { raw, servers } = readConfigState();
  const id = state.id.trim();
  const originalId = String(body.originalId || id).trim();
  const previous = servers.get(originalId);
  if (originalId && originalId !== id) servers.delete(originalId);
  servers.set(id, buildMcpServerConfigValue(state, previous));
  writeConfigState(raw, servers);
  return { ok: true, server: toServerEntry(id, servers.get(id)!, codexConfigPath()), ...listMcpServers() };
}

export function toggleMcpServer(id: string, enabled: boolean) {
  const { raw, servers } = readConfigState();
  const normalizedId = String(id || '').trim();
  const current = servers.get(normalizedId);
  if (!current) return { ok: false, error: 'MCP server not found' };
  servers.set(normalizedId, { ...current, enabled: enabled === true });
  writeConfigState(raw, servers);
  return { ok: true, server: toServerEntry(normalizedId, servers.get(normalizedId)!, codexConfigPath()), ...listMcpServers() };
}

export function deleteMcpServer(id: string) {
  const { raw, servers } = readConfigState();
  const normalizedId = String(id || '').trim();
  if (!servers.has(normalizedId)) return { ok: false, error: 'MCP server not found' };
  servers.delete(normalizedId);
  writeConfigState(raw, servers);
  return { ok: true, ...listMcpServers() };
}

export function readSharedPoolSettings(): Record<string, boolean> {
  const defaults = { windowsNative: false, wsl: false };
  try {
    const parsed = JSON.parse(fs.readFileSync(sharedPoolPath(), 'utf8')) as unknown;
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return { ...defaults, ...(parsed as Record<string, boolean>) };
    }
  } catch {}
  return defaults;
}

export function writeSharedPoolSettings(agentEnvironment: string, enabled: boolean) {
  const next = { ...readSharedPoolSettings(), [agentEnvironment || 'windowsNative']: enabled === true };
  fs.mkdirSync(path.dirname(sharedPoolPath()), { recursive: true });
  fs.writeFileSync(sharedPoolPath(), JSON.stringify(next, null, 2) + '\n', 'utf8');
  return { ok: true, settings: next };
}
