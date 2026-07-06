export interface Config {
  model: string;
  model_reasoning_effort: string;
  'tools.web_search_request': boolean;
  use_streamable_shell: boolean;
  sandbox_mode: string;
  approval_policy: string;
  approvals_reviewer: string;
  service_tier: string;
  instructions_extra: string;
  [key: string]: string | boolean | number;
}

export interface SessionEntry {
  path: string;
  name: string;
  mtimeMs: number;
  size: number;
  title?: string;
  cwd?: string;
  originalCwd?: string;
  projectRoot?: string;
  messageCount?: number;
  pinned?: boolean;
}

export interface HistoryEntry {
  resume_path: string;
  workdir: string;
  last_used: number;
  pinned?: boolean;
}

export interface ProjectRoot {
  id: string;
  name: string;
  path: string;
  last_used: number;
}

export interface History {
  entries: HistoryEntry[];
  roots?: ProjectRoot[];
  selectedRootId?: string;
  archivedSessionPaths?: string[];
}

export interface Message {
  role: string;
  text: string;
  id?: string;
  turnId?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  kind?: string;
  title?: string;
  detail?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface ResumeMeta {
  name: string;
  mtimeMs: number;
  size: number;
}
