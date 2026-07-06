import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { Config } from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CONFIG_FILE = process.env.CODEX_WEBUI_CONFIG
  ? path.resolve(process.env.CODEX_WEBUI_CONFIG)
  : path.resolve(__dirname, '../../config.toml');
const APPROVAL_POLICIES = new Set(['untrusted', 'on-failure', 'on-request', 'granular', 'never']);
const APPROVALS_REVIEWERS = new Set(['user', 'auto_review', 'guardian_subagent']);

export function defaultConfig(): Config {
  return {
    model: 'gpt-5.5',
    model_reasoning_effort: 'xhigh',
    'tools.web_search_request': false,
    use_streamable_shell: true,
    sandbox_mode: 'danger-full-access',
    approval_policy: 'never',
    approvals_reviewer: 'user',
    service_tier: '',
    instructions_extra: ''
  };
}

export function getConfigSafe(): Config {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return defaultConfig();
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    return sanitizeConfig(parseToml(raw, defaultConfig()));
  } catch { return defaultConfig(); }
}

export function writeConfig(obj: Partial<Config>): void {
  const cfg = sanitizeConfig(Object.assign(defaultConfig(), getConfigSafe(), obj || {}));
  const toml = dumpToml(cfg);
  fs.writeFileSync(CONFIG_FILE, toml, 'utf8');
}

function normalizeApprovalPolicy(value: unknown): string {
  const raw = String(value || '').trim();
  if (raw === 'ask') return 'on-request';
  return APPROVAL_POLICIES.has(raw) ? raw : 'never';
}

function sanitizeConfig(cfg: Config): Config {
  return {
    ...cfg,
    approval_policy: normalizeApprovalPolicy(cfg.approval_policy),
    approvals_reviewer: APPROVALS_REVIEWERS.has(String(cfg.approvals_reviewer || '').trim())
      ? String(cfg.approvals_reviewer).trim()
      : 'user'
  };
}

function parseToml(src: string, fallback: Config): Config {
  const out = { ...fallback } as Config;
  const lines = String(src || '').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('[')) continue;
    const idx = line.indexOf('=');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    let value: string | number | boolean = line.slice(idx + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    } else if (value === 'true' || value === 'false') {
      value = value === 'true';
    } else if (/^-?\d+(?:\.\d+)?$/.test(value)) {
      value = Number(value);
    }
    out[key] = value;
  }
  return out;
}

function dumpToml(obj: Config): string {
  const parts = ['# Codex WebUI configuration'];
  const keys = Object.keys(obj || {});
  keys.forEach(k => {
    const v = obj[k];
    if (typeof v === 'string') parts.push(`${k} = "${v.replace(/"/g, '\\"')}"`);
    else if (typeof v === 'boolean') parts.push(`${k} = ${v ? 'true' : 'false'}`);
    else parts.push(`${k} = ${String(v)}`);
  });
  return parts.join('\n') + '\n';
}
