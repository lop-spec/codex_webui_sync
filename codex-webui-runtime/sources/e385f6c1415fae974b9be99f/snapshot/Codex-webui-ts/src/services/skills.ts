import fs from 'fs';
import os from 'os';
import path from 'path';

export type SkillScope = 'user' | 'repo' | 'system' | 'admin';

export interface SkillEntry {
  name: string;
  path: string;
  description: string;
  shortDescription: string;
  source: string;
  scope: SkillScope;
  enabled: boolean;
  icon: string | null;
  brandColor: string | null;
}

interface SkillScanError {
  path: string;
  message: string;
}

interface SkillState {
  disabledPaths: string[];
}

function codexHome(): string {
  return process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
}

function statePath(): string {
  return path.join(codexHome(), 'webui-skills-state.json');
}

function normalizePathForState(value: string): string {
  return path.resolve(value).toLowerCase();
}

function readSkillState(): SkillState {
  try {
    const parsed = JSON.parse(fs.readFileSync(statePath(), 'utf8')) as unknown;
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      const disabledPaths = (parsed as { disabledPaths?: unknown }).disabledPaths;
      return {
        disabledPaths: Array.isArray(disabledPaths)
          ? disabledPaths.filter((item): item is string => typeof item === 'string')
          : []
      };
    }
  } catch {}
  return { disabledPaths: [] };
}

function writeSkillState(state: SkillState): void {
  fs.mkdirSync(path.dirname(statePath()), { recursive: true });
  fs.writeFileSync(statePath(), JSON.stringify(state, null, 2) + '\n', 'utf8');
}

function skillRoots(cwd = process.cwd()): Array<{ path: string; source: string; scope: SkillScope }> {
  const roots = [
    { path: path.join(codexHome(), 'skills'), source: 'global', scope: 'user' as SkillScope },
    { path: path.resolve(cwd, '.codex', 'skills'), source: 'workspace', scope: 'repo' as SkillScope }
  ];
  const seen = new Set<string>();
  return roots.filter((root) => {
    const resolved = path.resolve(root.path);
    const key = normalizePathForState(resolved);
    if (seen.has(key) || !fs.existsSync(resolved)) return false;
    seen.add(key);
    root.path = resolved;
    return true;
  });
}

function frontMatterValue(text: string, key: string): string {
  const match = text.match(new RegExp(`^${escapeRegex(key)}:\\s*(.+)$`, 'mi'));
  return match ? match[1].trim().replace(/^["']|["']$/g, '') : '';
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fallbackDescription(raw: string): string {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('---') && !line.includes(':')) || '';
}

function readSkill(dir: string, root: { source: string; scope: SkillScope }, disabled: Set<string>, errors: SkillScanError[]): SkillEntry | null {
  const skillPath = path.join(dir, 'SKILL.md');
  if (!fs.existsSync(skillPath)) return null;
  let raw = '';
  try {
    raw = fs.readFileSync(skillPath, 'utf8');
  } catch (error) {
    errors.push({ path: skillPath, message: error instanceof Error ? error.message : String(error) });
    return null;
  }
  const displayName = frontMatterValue(raw, 'displayName') || frontMatterValue(raw, 'display_name');
  const name = displayName || frontMatterValue(raw, 'name') || path.basename(dir);
  const shortDescription = frontMatterValue(raw, 'shortDescription') || frontMatterValue(raw, 'short_description');
  const description = shortDescription || frontMatterValue(raw, 'description') || fallbackDescription(raw);
  const icon = frontMatterValue(raw, 'icon') || frontMatterValue(raw, 'iconSmall') || frontMatterValue(raw, 'icon_small');
  const brandColor = frontMatterValue(raw, 'brandColor') || frontMatterValue(raw, 'brand_color');
  return {
    name,
    description,
    shortDescription: shortDescription || description,
    path: dir,
    source: root.source,
    scope: root.scope,
    enabled: !disabled.has(normalizePathForState(dir)),
    icon: icon || null,
    brandColor: brandColor || null
  };
}

function isPathInside(child: string, parent: string): boolean {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel === '' || (!!rel && !rel.startsWith('..') && !path.isAbsolute(rel));
}

function assertManagedSkillPath(targetPath: string, cwd = process.cwd()): string {
  const resolved = path.resolve(targetPath);
  const roots = skillRoots(cwd);
  if (!roots.some((root) => isPathInside(resolved, root.path))) {
    throw new Error('Skill path is outside managed skill roots');
  }
  if (!fs.existsSync(path.join(resolved, 'SKILL.md'))) {
    throw new Error('SKILL.md not found for selected skill');
  }
  return resolved;
}

export function listSkills(cwd = process.cwd()) {
  const state = readSkillState();
  const disabled = new Set(state.disabledPaths.map(normalizePathForState));
  const roots = skillRoots(cwd);
  const skills: SkillEntry[] = [];
  const scanErrors: SkillScanError[] = [];
  for (const root of roots) {
    const stack = [root.path];
    while (stack.length) {
      const current = stack.pop();
      if (!current) continue;
      let entries: fs.Dirent[] = [];
      try {
        entries = fs.readdirSync(current, { withFileTypes: true });
      } catch (error) {
        scanErrors.push({ path: current, message: error instanceof Error ? error.message : String(error) });
        continue;
      }
      const currentSkill = readSkill(current, root, disabled, scanErrors);
      if (currentSkill) {
        skills.push(currentSkill);
        continue;
      }
      for (const ent of entries) {
        if (ent.isDirectory()) stack.push(path.join(current, ent.name));
      }
    }
  }
  skills.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  return {
    ok: true,
    roots: roots.map((root) => root.path),
    data: [{ cwd, errors: scanErrors, skills }],
    scanErrors,
    skills
  };
}

export function setSkillEnabled(skillPath: string, enabled: boolean, cwd = process.cwd()) {
  const resolved = assertManagedSkillPath(skillPath, cwd);
  const key = normalizePathForState(resolved);
  const state = readSkillState();
  const disabled = new Set(state.disabledPaths.map(normalizePathForState));
  if (enabled) disabled.delete(key);
  else disabled.add(key);
  writeSkillState({ disabledPaths: [...disabled].sort() });
  return { ok: true, path: resolved, effectiveEnabled: enabled, ...listSkills(cwd) };
}

export function deleteSkill(skillPath: string, cwd = process.cwd()) {
  const resolved = assertManagedSkillPath(skillPath, cwd);
  fs.rmSync(resolved, { recursive: true, force: true });
  const state = readSkillState();
  writeSkillState({
    disabledPaths: state.disabledPaths
      .map(normalizePathForState)
      .filter((item) => item !== normalizePathForState(resolved))
  });
  return { ok: true, removed: resolved, ...listSkills(cwd) };
}
