import { create } from 'zustand';
import { api, deleteJson, postJson, putJson } from '@/lib/api';
import { textOf } from '@/lib/utils';
import type {
  ChatMessage,
  ModalKey,
  PendingUserInput,
  ProjectsResponse,
  QueueItem,
  SessionEntry,
  SessionsResponse,
  StatusEvent,
  TransferFile
} from '@/types/webui';

let eventSource: EventSource | null = null;

function msg(role: ChatMessage['role'], text: string, raw?: unknown): ChatMessage {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, role, text, raw };
}

function messageText(item: any): string {
  return String(item?.text || item?.message || item?.content || '');
}

function messageRole(item: any): ChatMessage['role'] {
  const role = String(item?.kind || item?.role || '').toLowerCase();
  if (role.includes('user')) return 'user';
  if (role.includes('error')) return 'error';
  if (role.includes('system')) return 'system';
  return 'agent';
}

interface WebuiState {
  booted: boolean;
  connection: 'connecting' | 'connected' | 'error';
  running: boolean;
  workdir: string;
  currentResumePath: string | null;
  config: Record<string, any>;
  sessions: SessionEntry[];
  projects: ProjectsResponse['groups'];
  projectRoots: ProjectsResponse['roots'];
  search: string;
  messages: ChatMessage[];
  streamMessageId: string | null;
  queue: QueueItem[];
  pendingUserInput: PendingUserInput | null;
  input: string;
  attachments: Array<{ kind: 'image'; name: string; dataUrl: string }>;
  collaborationPreset: 'default' | 'plan';
  serviceTier: '' | 'fast';
  modal: ModalKey;
  error: string;
  memoryFacts: string[];
  accountStatus: any;
  previewTarget: string;
  previewData: any;
  skillsData: any;
  mcpData: any;
  transferFiles: TransferFile[];
  transferEvents: any[];
  setSearch: (search: string) => void;
  setInput: (input: string) => void;
  addAttachment: (file: File) => Promise<void>;
  removeAttachment: (index: number) => void;
  setCollaborationPreset: (preset: 'default' | 'plan') => void;
  setServiceTier: (tier: '' | 'fast') => void;
  setModal: (modal: ModalKey) => void;
  init: () => Promise<void>;
  connectEvents: () => void;
  loadSessions: () => Promise<void>;
  loadProjects: () => Promise<void>;
  loadTranscript: (path?: string | null) => Promise<void>;
  resumeSession: (session: SessionEntry) => Promise<void>;
  newChat: () => Promise<void>;
  sendMessage: () => Promise<void>;
  cancel: () => Promise<void>;
  restart: () => Promise<void>;
  loadConfig: () => Promise<void>;
  saveConfig: (patch: Record<string, any>) => Promise<void>;
  resolveUserInput: (answers: Record<string, string>) => Promise<void>;
  queueAction: (action: 'promote' | 'remove' | 'clear', id?: string) => Promise<void>;
  openProject: (path: string) => Promise<void>;
  loadMemory: () => Promise<void>;
  removeMemory: (fact: string) => Promise<void>;
  loadAccount: () => Promise<void>;
  accountAction: (action: 'login' | 'logout') => Promise<void>;
  loadPreview: (target: string) => Promise<void>;
  loadSkills: () => Promise<void>;
  loadMcp: () => Promise<void>;
  loadTransfer: () => Promise<void>;
  sendTransferText: (text: string) => Promise<void>;
}

export const useWebuiStore = create<WebuiState>((set, get) => ({
  booted: false,
  connection: 'connecting',
  running: false,
  workdir: '',
  currentResumePath: null,
  config: {},
  sessions: [],
  projects: {},
  projectRoots: [],
  search: '',
  messages: [],
  streamMessageId: null,
  queue: [],
  pendingUserInput: null,
  input: '',
  attachments: [],
  collaborationPreset: 'default',
  serviceTier: '',
  modal: null,
  error: '',
  memoryFacts: [],
  accountStatus: null,
  previewTarget: '',
  previewData: null,
  skillsData: null,
  mcpData: null,
  transferFiles: [],
  transferEvents: [],
  setSearch: (search) => set({ search }),
  setInput: (input) => set({ input }),
  addAttachment: async (file) => {
    if (!file.type.startsWith('image/')) return;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Failed to read image'));
      reader.readAsDataURL(file);
    });
    set((state) => ({ attachments: [...state.attachments, { kind: 'image', name: file.name || 'image.png', dataUrl }] }));
  },
  removeAttachment: (index) => set((state) => ({ attachments: state.attachments.filter((_item, itemIndex) => itemIndex !== index) })),
  setCollaborationPreset: (collaborationPreset) => set({ collaborationPreset }),
  setServiceTier: (serviceTier) => set({ serviceTier }),
  setModal: (modal) => set({ modal }),
  init: async () => {
    if (get().booted) return;
    set({ booted: true, connection: 'connecting' });
    get().connectEvents();
    await Promise.allSettled([get().loadConfig(), get().loadSessions(), get().loadProjects(), get().loadTranscript()]);
  },
  connectEvents: () => {
    if (eventSource) return;
    eventSource = new EventSource('/events');
    eventSource.addEventListener('open', () => set({ connection: 'connected', error: '' }));
    eventSource.addEventListener('error', () => set({ connection: 'error', error: 'SSE 连接异常，浏览器会自动重试。' }));
    eventSource.addEventListener('status', (event) => {
      const data = JSON.parse((event as MessageEvent).data) as StatusEvent;
      set({
        running: Boolean(data.running),
        workdir: data.workdir || get().workdir,
        currentResumePath: data.resume_path || null,
        queue: data.queue || [],
        pendingUserInput: data.pendingUserInput || null,
        config: data.config || get().config
      });
      get().loadSessions().catch(() => undefined);
      get().loadProjects().catch(() => undefined);
    });
    eventSource.addEventListener('system', (event) => set((state) => ({ messages: [...state.messages, msg('system', JSON.parse((event as MessageEvent).data).text || '')] })));
    eventSource.addEventListener('stderr', (event) => set((state) => ({ messages: [...state.messages, msg('error', JSON.parse((event as MessageEvent).data).text || '')] })));
    eventSource.addEventListener('tool', (event) => {
      const data = JSON.parse((event as MessageEvent).data);
      set((state) => ({ messages: [...state.messages, msg('tool', `${data.name || '工具'}\n${data.detail || ''}`, data)] }));
    });
    eventSource.addEventListener('timeline_item', (event) => {
      const data = JSON.parse((event as MessageEvent).data);
      set((state) => ({ messages: [...state.messages, msg('timeline', data.text || data.detail || data.title || textOf(data), data)] }));
    });
    eventSource.addEventListener('server_request', (event) => {
      const data = JSON.parse((event as MessageEvent).data);
      set({ pendingUserInput: data });
    });
    eventSource.addEventListener('server_request_resolved', () => set({ pendingUserInput: null }));
    eventSource.addEventListener('user_message', (event) => {
      const data = JSON.parse((event as MessageEvent).data);
      set((state) => ({ messages: [...state.messages, { ...msg('user', data.text || '', data), turnId: data.turnId || '' }] }));
    });
    eventSource.addEventListener('delta', (event) => {
      const data = JSON.parse((event as MessageEvent).data);
      set((state) => {
        const text = data.text || '';
        if (!state.streamMessageId) {
          const item = { ...msg('agent', text), status: 'streaming' };
          return { messages: [...state.messages, item], streamMessageId: item.id };
        }
        return {
          messages: state.messages.map((item) => (item.id === state.streamMessageId ? { ...item, text: item.text + text, status: 'streaming' } : item))
        };
      });
    });
    eventSource.addEventListener('message', (event) => {
      const data = JSON.parse((event as MessageEvent).data);
      set((state) => {
        if (state.streamMessageId) {
          return {
            messages: state.messages.map((item) => (item.id === state.streamMessageId ? { ...item, status: 'done', text: item.text || data.text || '' } : item)),
            streamMessageId: null
          };
        }
        return { messages: [...state.messages, msg('agent', data.text || '')] };
      });
    });
  },
  loadSessions: async () => {
    const data = await api<SessionsResponse>('/sessions');
    set({ sessions: data.sessions || [], currentResumePath: data.current || get().currentResumePath, workdir: data.workdir || get().workdir });
  },
  loadProjects: async () => {
    const data = await api<ProjectsResponse>('/projects');
    set({ projects: data.groups || {}, projectRoots: data.roots || [], workdir: data.current || get().workdir });
  },
  loadTranscript: async (path) => {
    const suffix = path ? `?path=${encodeURIComponent(path)}` : '';
    const data = await api<{ messages: any[]; current?: string | null }>(`/session-messages${suffix}`);
    set({
      messages: (data.messages || []).map((item) => ({
        ...msg(messageRole(item), messageText(item), item),
        turnId: item.turnId || item.turn_id || '',
        status: item.status || 'done'
      })),
      currentResumePath: data.current || path || get().currentResumePath,
      streamMessageId: null
    });
  },
  resumeSession: async (session) => {
    await postJson('/resume', { path: session.path, workdir: session.cwd || '' });
    await get().loadTranscript(session.path);
    await Promise.allSettled([get().loadSessions(), get().loadProjects()]);
  },
  newChat: async () => {
    await postJson('/new-chat');
    set({ messages: [], currentResumePath: null, streamMessageId: null });
    await Promise.allSettled([get().loadSessions(), get().loadProjects()]);
  },
  sendMessage: async () => {
    const text = get().input.trim();
    if (!text) return;
    const attachments = get().attachments;
    set((state) => ({ input: '', attachments: [], messages: [...state.messages, msg('user', text)] }));
    const result = await postJson<{ queue?: QueueItem[]; running?: boolean; resume_path?: string | null }>('/message', {
      text,
      attachments,
      collaborationPreset: get().collaborationPreset,
      serviceTier: get().serviceTier
    });
    set({ queue: result.queue || get().queue, running: Boolean(result.running), currentResumePath: result.resume_path || get().currentResumePath });
  },
  cancel: async () => {
    await postJson('/cancel');
    set({ running: false });
  },
  restart: async () => {
    await postJson('/restart');
    await Promise.allSettled([get().loadSessions(), get().loadTranscript()]);
  },
  loadConfig: async () => set({ config: await api<Record<string, any>>('/config') }),
  saveConfig: async (patch) => {
    await putJson('/config', patch);
    await get().loadConfig();
  },
  resolveUserInput: async (answers) => {
    const requestId = get().pendingUserInput?.requestId;
    if (!requestId) return;
    const data = await postJson<{ queue?: QueueItem[]; pendingUserInput?: PendingUserInput | null }>('/server-request/resolve', { requestId, answers });
    set({ queue: data.queue || get().queue, pendingUserInput: data.pendingUserInput || null });
  },
  queueAction: async (action, id) => {
    const url = action === 'clear' ? '/queue/clear' : action === 'promote' ? '/queue/promote' : '/queue/remove';
    const data = await postJson<{ queue?: QueueItem[] }>(url, { id });
    set({ queue: data.queue || [] });
  },
  openProject: async (target) => {
    await postJson('/project/open', { path: target });
    await Promise.allSettled([get().loadProjects(), get().loadSessions()]);
  },
  loadMemory: async () => {
    const data = await api<{ facts: string[] }>('/memory');
    set({ memoryFacts: data.facts || [] });
  },
  removeMemory: async (fact) => {
    await deleteJson('/memory', { fact });
    await get().loadMemory();
  },
  loadAccount: async () => set({ accountStatus: await api('/account/status') }),
  accountAction: async (action) => {
    await postJson(action === 'login' ? '/account/login/start' : '/account/logout');
    await get().loadAccount();
  },
  loadPreview: async (target) => {
    const data = await api(`/preview?target=${encodeURIComponent(target)}`);
    set({ previewTarget: target, previewData: data });
  },
  loadSkills: async () => {
    const [skills, plugins, apps] = await Promise.allSettled([api('/skills'), api('/plugins'), api('/apps')]);
    set({ skillsData: { skills, plugins, apps } });
  },
  loadMcp: async () => set({ mcpData: await api('/mcp') }),
  loadTransfer: async () => {
    const [files, messages] = await Promise.all([
      api<{ files?: TransferFile[] }>('/transfer/files').catch(() => ({ files: [] })),
      api<{ events?: any[] }>('/transfer/messages').catch(() => ({ events: [] }))
    ]);
    set({ transferFiles: files.files || [], transferEvents: messages.events || [] });
  },
  sendTransferText: async (text) => {
    await postJson('/transfer/messages', { text });
    await get().loadTransfer();
  }
}));
