export interface SessionEntry {
  path: string;
  cwd?: string;
  originalCwd?: string;
  title?: string;
  summary?: string;
  mtimeMs?: number;
  size?: number;
  projectRoot?: string;
  pinned?: boolean;
}

export interface ProjectEntry {
  resume_path?: string;
  workdir?: string;
  last_used?: number;
}

export interface SessionsResponse {
  sessions: SessionEntry[];
  current: string | null;
  workdir: string;
  currentRoot?: string;
}

export interface ProjectsResponse {
  groups: Record<string, ProjectEntry[]>;
  current: string;
  currentRoot?: string;
  roots?: Array<{ id?: string; path: string; label?: string }>;
  selectedRootId?: string;
}

export interface TranscriptMessage {
  kind?: 'user' | 'agent' | 'system' | 'error' | string;
  role?: string;
  text?: string;
  message?: string;
  content?: string;
  turnId?: string;
  status?: string;
  attachments?: Array<{ kind: string; name: string; url?: string }>;
}

export interface StatusEvent {
  resumed?: boolean;
  resume_path?: string | null;
  resume_meta?: { size?: number; mtimeMs?: number };
  running?: boolean;
  workdir?: string;
  queue?: QueueItem[];
  pendingUserInput?: PendingUserInput | null;
  config?: Record<string, unknown>;
}

export interface QueueItem {
  id: string;
  text?: string;
  createdAt?: string;
  status?: string;
}

export interface PendingUserInput {
  requestId: string;
  kind?: string;
  questions?: Array<{
    id: string;
    header?: string;
    question: string;
    options?: Array<{ label: string; description?: string }>;
  }>;
}

export interface TimelineItem {
  type?: string;
  kind?: string;
  title?: string;
  text?: string;
  detail?: string;
  status?: string;
  [key: string]: unknown;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent' | 'system' | 'error' | 'tool' | 'timeline';
  text: string;
  status?: string;
  turnId?: string;
  raw?: unknown;
}

export interface TransferFile {
  id?: string;
  name: string;
  size?: number;
  createdAt?: string;
  downloadUrl?: string;
}

export type ModalKey =
  | 'settings'
  | 'project'
  | 'account'
  | 'preview'
  | 'skills'
  | 'mcp'
  | 'transfer'
  | 'memory'
  | null;
