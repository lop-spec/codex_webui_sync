import fs from 'fs';
import os from 'os';
import path from 'path';

export interface CodexLaunch {
  command: string;
  argsPrefix: string[];
}

function readArgsPrefixEnv(): string[] {
  const raw = process.env.CODEX_CMD_ARGS_PREFIX_JSON;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function resolveBundledWindowsCodexExe(): string | null {
  const archPackage = process.arch === 'arm64' ? 'codex-win32-arm64' : 'codex-win32-x64';
  const archTriple = process.arch === 'arm64' ? 'aarch64-pc-windows-msvc' : 'x86_64-pc-windows-msvc';
  const nativeCodex = path.join(
    os.homedir(),
    'AppData',
    'Roaming',
    'npm',
    'node_modules',
    '@openai',
    'codex',
    'node_modules',
    '@openai',
    archPackage,
    'vendor',
    archTriple,
    'bin',
    'codex.exe'
  );
  return fs.existsSync(nativeCodex) ? nativeCodex : null;
}

export function resolveCodexLaunch(): CodexLaunch {
  if (process.env.CODEX_CMD) return { command: process.env.CODEX_CMD, argsPrefix: readArgsPrefixEnv() };
  if (process.platform === 'win32') {
    const nativeCodex = resolveBundledWindowsCodexExe();
    if (nativeCodex) return { command: nativeCodex, argsPrefix: [] };
    const npmCodex = path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
    if (fs.existsSync(npmCodex)) return { command: process.execPath, argsPrefix: [npmCodex] };
  }
  return { command: 'codex', argsPrefix: [] };
}
