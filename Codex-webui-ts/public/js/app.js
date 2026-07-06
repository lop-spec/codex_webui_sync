const CLIENT_BUILD = '20260706-project-window';
      document.documentElement.dataset.webuiBuild = CLIENT_BUILD;
      const DEBUG_NO_EVENTS = new URLSearchParams(location.search).has('debug_no_events');
      const SIDEBAR_VISIBLE_LIMIT = 10;
      const PROJECT_THREAD_RECENT_WINDOW_MS = 30 * 60 * 1000;
      const COMPOSER_DRAFT_KEY = 'plusComposerDraft';

      const $ = (id) => document.getElementById(id);
      const log = $('log');
      const emptyState = $('emptyState');
      const text = $('text');
      const send = $('send');
      const composerContext = $('composerContext');
      const composerContextLabel = $('composerContextLabel');
      const composerRunState = $('composerRunState');
      const composerFollowupHint = $('composerFollowupHint');
      const appNotificationViewport = $('appNotificationViewport');
      const slashCommandPalette = $('slashCommandPalette');
      const pinnedSessionsEl = $('pinnedSessions');
      const projectsEl = $('projects');
      const openFolderBtn = $('openFolderBtn');
      const createProjectBtn = $('createProjectBtn');
      const restoreHistoryBtn = $('restoreHistoryBtn');
      const openAccountBtn = $('openAccountBtn');
      const historyBackBtn = $('historyBackBtn');
      const historyForwardBtn = $('historyForwardBtn');
      const previewTargetInput = $('previewTargetInput');
      const previewLoadBtn = $('previewLoadBtn');
      const previewOpenExternal = $('previewOpenExternal');
      const previewPanel = $('previewPanel');
      const terminalCommandInput = $('terminalCommandInput');
      const terminalSpawnBtn = $('terminalSpawnBtn');
      const terminalRefreshBtn = $('terminalRefreshBtn');
      const terminalKillBtn = $('terminalKillBtn');
      const terminalTabs = $('terminalTabs');
      const terminalOutput = $('terminalOutput');
      const terminalStdinInput = $('terminalStdinInput');
      const terminalSendInputBtn = $('terminalSendInputBtn');
      const terminalStatusLine = $('terminalStatusLine');
      const gitBranchPill = $('gitBranchPill');
      const gitRepoMeta = $('gitRepoMeta');
      const gitRefreshBtn = $('gitRefreshBtn');
      const gitOpenRepoBtn = $('gitOpenRepoBtn');
      const gitScopeUnstaged = $('gitScopeUnstaged');
      const gitScopeStaged = $('gitScopeStaged');
      const gitChangeList = $('gitChangeList');
      const gitDiffTitle = $('gitDiffTitle');
      const gitDiffStats = $('gitDiffStats');
      const gitDiffView = $('gitDiffView');
      const gitStageSelected = $('gitStageSelected');
      const gitUnstageSelected = $('gitUnstageSelected');
      const gitDiscardSelected = $('gitDiscardSelected');
      const gitCommitMessage = $('gitCommitMessage');
      const gitCommitBtn = $('gitCommitBtn');
      const gitPullBtn = $('gitPullBtn');
      const gitPushBtn = $('gitPushBtn');
      const gitBranchCreate = $('gitBranchCreate');
      const gitStatusLine = $('gitStatusLine');
      const skillsPanel = $('skillsPanel');
      const skillsTabPlugins = $('skillsTabPlugins');
      const skillsTabInstalled = $('skillsTabInstalled');
      const skillsManageBtn = $('skillsManageBtn');
      const skillsRefreshBtn = $('skillsRefreshBtn');
      const skillsSearchInput = $('skillsSearchInput');
      const skillsMarketplaceFilter = $('skillsMarketplaceFilter');
      const skillsPluginStatusFilter = $('skillsPluginStatusFilter');
      const skillsMarketplaceFilterWrap = $('skillsMarketplaceFilterWrap');
      const skillsPluginStatusWrap = $('skillsPluginStatusWrap');
      const skillsManagementTabs = $('skillsManagementTabs');
      const skillsActionError = $('skillsActionError');
      const mcpPanel = $('mcpPanel');
      const projectPathInput = $('projectPathInput');
      const projectOpenConfirm = $('projectOpenConfirm');
      const projectBrowserRoots = $('projectBrowserRoots');
      const projectBrowserPath = $('projectBrowserPath');
      const projectBrowserList = $('projectBrowserList');
      const projectBreadcrumb = $('projectBreadcrumb');
      const projectPickFolder = $('projectPickFolder');
      const projectBrowseUp = $('projectBrowseUp');
      const projectBrowseRefresh = $('projectBrowseRefresh');
      const projectOpenExplorer = $('projectOpenExplorer');
      const mobileSidebarBtn = $('mobileSidebarBtn');
      const sidebarBackdrop = $('sidebarBackdrop');
      const connDot = $('connDot');
      const threadTitle = $('threadTitle');
      const threadMeta = $('threadMeta');
      const resumePill = $('resumePill');
      const modelPill = $('modelPill');
      const tokenStats = $('tokenStats');
      const accountIdentity = $('accountIdentity');
      const accountLimitCards = $('accountLimitCards');
      const accountUsageSummary = $('accountUsageSummary');
      const accountRawDetails = $('accountRawDetails');
      const accountStatusLine = $('accountStatusLine');
      const accountRefreshBtn = $('accountRefreshBtn');
      const accountLoginBtn = $('accountLoginBtn');
      const accountLogoutBtn = $('accountLogoutBtn');
      const composerMoreMenu = $('composerMoreMenu');
      const composerAddAttachment = $('composerAddAttachment');
      const composerPlanMenuBtn = $('composerPlanMenuBtn');
      const composerPlanValue = $('composerPlanValue');
      const composerSpeedValue = $('composerSpeedValue');
      const composerSpeedTrigger = $('composerSpeedTrigger');
      const composerSpeedMenu = $('composerSpeedMenu');
      const composerPermissionValue = $('composerPermissionValue');
      const sideFilter = $('sideFilter');
      const queuePanel = $('queuePanel');
      const userInputPrompt = $('userInputPrompt');
      function safeLocalGet(key, fallback = '') {
        try {
          const value = localStorage.getItem(key);
          return value == null ? fallback : value;
        } catch {
          return fallback;
        }
      }
      function safeLocalSet(key, value) {
        try { localStorage.setItem(key, value); } catch {}
      }
      function safeLocalRemove(key) {
        try { localStorage.removeItem(key); } catch {}
      }
      function notificationTriggerAllowed(payload = {}) {
        const mode = safeLocalGet('plusNotificationTriggerMode', 'background');
        if (mode === 'never') return false;
        if (mode === 'always') return true;
        if (payload.minVisible === false) return true;
        return !windowFocused;
      }
      function notificationDeliveryMode() {
        return safeLocalGet('plusNotificationDeliveryMode', 'system+sound');
      }
      function updateWindowFocusState() {
        windowFocused = !document.hidden && document.hasFocus();
        if (windowFocused) clearTitleAttention();
      }
      function truncateNotificationBody(value, maxLength = 200) {
        const textValue = String(value || '').trim();
        return textValue.length > maxLength ? `${textValue.slice(0, maxLength - 1)}…` : textValue;
      }
      function createNotificationId() {
        return `app-notification-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      }
      function dismissAppNotification(id) {
        const timer = appNotificationTimers.get(id);
        if (timer) clearTimeout(timer);
        appNotificationTimers.delete(id);
        appNotifications = appNotifications.filter((item) => item.id !== id);
        renderAppNotifications();
      }
      function renderAppNotifications() {
        if (!appNotificationViewport) return;
        appNotificationViewport.innerHTML = '';
        appNotifications.forEach((notification) => {
          const card = document.createElement('article');
          card.className = `app-notification-card app-notification-card-${escapeAttr(notification.kind || 'info')}`;
          card.setAttribute('role', 'status');
          card.innerHTML = `
            <div class="app-notification-copy">
              <strong class="app-notification-title">${escapeHtml(notification.title)}</strong>
              ${notification.body ? `<p class="app-notification-body">${escapeHtml(notification.body)}</p>` : ''}
            </div>
            <button type="button" class="app-notification-dismiss" aria-label="关闭通知：${escapeAttr(notification.title)}">×</button>`;
          card.querySelector('button')?.addEventListener('click', () => dismissAppNotification(notification.id));
          appNotificationViewport.appendChild(card);
        });
      }
      function showAppNotification(payload) {
        const id = createNotificationId();
        const notification = {
          id,
          title: String(payload.title || 'Codex'),
          body: truncateNotificationBody(payload.body || ''),
          kind: payload.kind || 'info'
        };
        appNotifications = [notification, ...appNotifications].slice(0, 4);
        renderAppNotifications();
        const timer = setTimeout(() => dismissAppNotification(id), 5000);
        appNotificationTimers.set(id, timer);
      }
      function clearTitleAttention() {
        if (titleAttentionTimer) clearInterval(titleAttentionTimer);
        titleAttentionTimer = null;
        document.title = originalDocumentTitle;
      }
      function requestTitleAttention(title) {
        if (windowFocused) return;
        clearTitleAttention();
        let flag = false;
        titleAttentionTimer = setInterval(() => {
          flag = !flag;
          document.title = flag ? `● ${title}` : originalDocumentTitle;
        }, 1000);
        setTimeout(clearTitleAttention, 15000);
      }
      function playNotificationTone(kind = 'success') {
        if (!notificationDeliveryMode().includes('sound')) return;
        try {
          const AudioContextImpl = window.AudioContext || window.webkitAudioContext;
          if (!AudioContextImpl) return;
          const context = new AudioContextImpl();
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.frequency.value = kind === 'error' ? 220 : 520;
          gain.gain.value = 0.04;
          oscillator.connect(gain);
          gain.connect(context.destination);
          oscillator.start();
          oscillator.stop(context.currentTime + 0.16);
          setTimeout(() => context.close?.(), 300);
        } catch (error) {
          console.error('Failed to play notification sound', error);
        }
      }
      async function sendBrowserNotification(title, body) {
        if (!notificationDeliveryMode().includes('system')) return;
        if (!('Notification' in window)) return;
        try {
          let permission = Notification.permission;
          if (permission === 'default') permission = await Notification.requestPermission();
          if (permission !== 'granted') return;
          new Notification(title, { body, silent: true });
        } catch (error) {
          console.error('Failed to show browser notification', error);
        }
      }
      function deliverAppNotification(payload) {
        if (!notificationTriggerAllowed(payload)) return;
        const title = String(payload.title || 'Codex');
        const body = truncateNotificationBody(payload.body || '');
        showAppNotification({ ...payload, title, body });
        requestTitleAttention(title);
        playNotificationTone(payload.kind || 'success');
        sendBrowserNotification(title, body);
      }
      function recordTurnStarted(sessionPath = activeRuntimeResumePath || currentResumePath) {
        lastTurnStartedAt = Date.now();
        latestAgentMessageText = '';
        activeStreamSessionPath = sessionPath || currentResumePath || activeStreamSessionPath || '';
      }
      function maybeNotifyAgentCompletion(textValue) {
        const completedAtMs = Date.now();
        const durationMs = lastTurnStartedAt ? completedAtMs - lastTurnStartedAt : 0;
        latestAgentMessageText = String(textValue || latestAgentMessageText || '');
        if (durationMs >= 60000 && Date.now() - lastCompletionNotificationAt > 1500) {
          lastCompletionNotificationAt = Date.now();
          deliverAppNotification({
            title: 'Agent Complete',
            body: latestAgentMessageText || 'Your agent has finished its task.',
            kind: 'success',
            durationMs,
            minVisible: true
          });
        }
        const meta = {
          completedAt: new Date(completedAtMs).toISOString(),
          durationMs,
          turnId: activeTurnId
        };
        lastTurnStartedAt = 0;
        return meta;
      }
      function rememberUserQuestion(textValue, options = {}) {
        const value = stripInternalMemoryBlocks(textValue);
        if (!value) return;
        latestUserQuestionText = value;
        const turnId = String(options.turnId || activeTurnId || '').trim();
        if (turnId) {
          activeTurnId = turnId;
          turnQuestionText.set(turnId, value);
        }
      }
      function questionForAssistant(options = {}) {
        const turnId = String(options.turnId || activeTurnId || '').trim();
        if (turnId && turnQuestionText.has(turnId)) return turnQuestionText.get(turnId) || '';
        return latestUserQuestionText || '';
      }
      function isVisible(el) {
        if (!el) return false;
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const intersectsViewport = rect.right > 0
          && rect.bottom > 0
          && rect.left < window.innerWidth
          && rect.top < window.innerHeight;
        return style.display !== 'none'
          && style.visibility !== 'hidden'
          && rect.width > 0
          && rect.height > 0
          && intersectsViewport;
      }
      function ensureSidebarVisible() {
        if (window.innerWidth <= 860) return;
        closeMobileSidebar();
        document.querySelectorAll('.sidebar, .side-top, .side-nav, .side-scroll').forEach((el) => {
          el.removeAttribute('hidden');
          el.style.removeProperty('display');
          el.style.removeProperty('visibility');
        });
      }
      function openMobileSidebar() {
        document.body.classList.add('mobile-sidebar-open');
        mobileSidebarBtn?.setAttribute('aria-expanded', 'true');
        exposeDebugState();
      }
      function closeMobileSidebar() {
        document.body.classList.remove('mobile-sidebar-open');
        mobileSidebarBtn?.setAttribute('aria-expanded', 'false');
        exposeDebugState();
      }
      function exposeDebugState() {
        window.__codexWebuiDebug = () => ({
          build: CLIENT_BUILD,
          href: location.href,
          sessions: sessionsCache.length,
          renderedPinned: pinnedSessionsEl ? pinnedSessionsEl.querySelectorAll('.thread-item').length : 0,
          renderedProjects: projectsEl ? projectsEl.querySelectorAll('.project-item, .workspace-root-row').length : 0,
          sidebarOverflowButtons: document.querySelectorAll('.sidebar-overflow-btn').length,
          runningSessions: document.querySelectorAll('.thread-item-running').length,
          editableUserMessages: document.querySelectorAll('.message-action-edit').length,
          favoriteButtons: document.querySelectorAll('.message-action-favorite').length,
          messageMetaRows: document.querySelectorAll('.message-footer').length,
          messageEditing: Boolean(messageEditState),
          relativeTimes: document.querySelectorAll('[data-relative-ms]').length,
          projectOpenButtons: document.querySelectorAll('.project-open-btn').length,
          workspaceRootMenuButtons: document.querySelectorAll('.workspace-root-menu-btn').length,
          workspaceRootRows: document.querySelectorAll('.workspace-root-row').length,
          workspaceThreadItems: document.querySelectorAll('.workspace-thread-item').length,
          workspaceRootMenus: document.querySelectorAll('.workspace-root-menu').length,
          workspaceCleanupOpen: Boolean(document.getElementById('workspaceCleanupModal')),
          recycleRestoreOpen: Boolean(document.getElementById('recycleRestoreModal')),
          hiddenProjectRoots: hiddenProjectPaths.size,
          expandedProjectCategories: expandedProjectCategories.size,
          expandedProjectThreadLists: expandedProjectThreadLists.size,
          projectCategorySections: document.querySelectorAll('.workspace-category').length,
          projectBrowserRows: document.querySelectorAll('.project-browser-row').length,
          projectBrowserPath: projectBrowserState.path,
          openFolderVisible: isVisible(openFolderBtn),
          mobileSidebarButtonVisible: isVisible(mobileSidebarBtn),
          mobileSidebarOpen: document.body.classList.contains('mobile-sidebar-open'),
          sidebarBackdropVisible: isVisible(sidebarBackdrop),
          projectModalOpen: $('projectModal')?.classList.contains('open') || false,
          localPathLinks: document.querySelectorAll('.local-path-link').length,
          currentResumePath,
          currentWorkdir,
          codexRunning,
          queuedFollowUps: queuedFollowUps.length,
          guidanceState,
          composerSurface: Boolean(document.querySelector('[data-plus-composer]')),
          composerContext: composerContextLabel ? composerContextLabel.textContent : '',
          composerRunState: composerRunState ? composerRunState.textContent : '',
          composerRunStateMode: composerRunState ? composerRunState.dataset.state : '',
          settingsSections: document.querySelectorAll('.settings-section').length,
          settingsOptions: document.querySelectorAll('.settings-field input, .settings-field select, .settings-field textarea').length,
          appNotifications: appNotifications.length,
          terminalSessions: terminalState.sessions.length,
          windowFocused,
          collaborationPreset,
          selectedServiceTier: currentServiceTier(),
          permissionLevel: currentPermissionLevel(),
          composerMoreMenuOpen: Boolean(composerMoreMenu && !composerMoreMenu.hidden),
          accountModalOpen: $('accountModal')?.classList.contains('open') || false,
          accountLimitCards: accountLimitCards ? accountLimitCards.querySelectorAll('.account-limit-card').length : 0,
          debugNoEvents: DEBUG_NO_EVENTS,
          sidebarVisible: isVisible(document.querySelector('.sidebar')),
          sideTopVisible: isVisible(document.querySelector('.side-top')),
          sideNavVisible: isVisible(document.querySelector('.side-nav')),
          sideScrollVisible: isVisible(document.querySelector('.side-scroll')),
          conversationBackCount: conversationNavBack.length,
          conversationForwardCount: conversationNavForward.length,
          conversationBackEnabled: Boolean(historyBackBtn && !historyBackBtn.disabled),
          conversationForwardEnabled: Boolean(historyForwardBtn && !historyForwardBtn.disabled)
        });
      }
      async function checkAssetVersion() {
        try {
          const response = await fetch('/asset-version', { cache: 'no-store' });
          const data = await response.json();
          if (!response.ok || !data.version) return;
          const key = 'plusWebAssetVersion';
          const previous = safeLocalGet(key, '');
          safeLocalSet(key, data.version);
          if (previous && previous !== data.version) {
            addSystem('检测到 WebUI 静态资源已更新，正在刷新页面。');
            setTimeout(() => location.reload(), 120);
          }
        } catch {}
      }
      function startAssetVersionWatch() {
        checkAssetVersion();
        setInterval(checkAssetVersion, 30000);
      }
      function readPinnedPaths() {
        try {
          const parsed = JSON.parse(safeLocalGet('plusPinnedSessions', '[]') || '[]');
          if (!Array.isArray(parsed)) throw new Error('Pinned session store is not an array');
          return new Set(parsed.filter((item) => typeof item === 'string' && item));
        } catch {
          safeLocalSet('plusPinnedSessions', '[]');
          return new Set();
        }
      }
      function isSessionPinned(session) {
        return Boolean(session?.pinned) || pinnedPaths.has(session?.path);
      }
      let streamEl = null;
      let activeStreamSessionPath = null;
      let activeRuntimeResumePath = null;
      let currentResumePath = null;
      let currentWorkdir = '';
      let currentProjectRootPath = '';
      let sessionsCache = [];
      let projectsCache = [];
      let projectRootsCache = [];
      let conversationCollectionsRefresh = null;
      let expandedProjectPaths = new Set();
      let hiddenProjectPaths = new Set();
      let expandedProjectCategories = new Set();
      let expandedProjectThreadLists = new Set();
      let expandedSessionLists = new Set();
      let conversationNavBack = [];
      let conversationNavForward = [];
      let projectBrowserState = { path: '', parent: null, roots: [], entries: [], loading: false, error: '' };
      let gitPanelState = { scope: 'unstaged', status: null, diffs: [], selectedPath: '', selectedStaged: false, selectedRows: new Set(), loading: false };
      let terminalState = { sessions: [], activeId: '', pollTimer: null };
      let previewState = { target: '', data: null };
      let skillsState = { activeTab: 'plugins', managerOpen: false, managementTab: 'plugins', query: '', marketplace: 'all', pluginStatus: 'all', skills: null, plugins: null, apps: null, mcp: null, error: '' };
      let mcpState = { data: null, editing: null, error: '', saving: false };
      let currentConfig = {};
      let pinnedPaths = readPinnedPaths();
      let eventStreamStarted = false;
      let composerAttachments = [];
      let queuedFollowUps = [];
      let guidanceState = { pending: 0, saved: 0, count: 0, items: [] };
      let queuePanelCollapsed = false;
      let codexRunning = false;
      let windowFocused = !document.hidden && document.hasFocus();
      let appNotifications = [];
      let lastTurnStartedAt = 0;
      let latestAgentMessageText = '';
      let latestUserQuestionText = '';
      let activeTurnId = '';
      let lastCompletionNotificationAt = 0;
      let messageEditState = null;
      let pendingEditedUserEcho = null;
      let pendingUserInputRequest = null;
      let userInputPromptCurrentIndex = 0;
      let userInputSelectedOptions = {};
      let userInputFreeText = {};
      let transcriptSwitchSerial = 0;
      let transcriptHistoryLoader = null;
      let transcriptPageState = { path: '', total: 0, start: 0, end: 0, nextBefore: null, hasMoreOlder: false, loadingOlder: false };
      let sidebarRenderTimer = null;
      let sidebarRenderFull = false;
      const appNotificationTimers = new Map();
      let titleAttentionTimer = null;
      const originalDocumentTitle = document.title;
      let collaborationPreset = safeLocalGet('plusCollaborationPreset', 'default') === 'plan' ? 'plan' : 'default';
      let selectedServiceTier = '';
      let serviceTierOverrideActive = false;
      let accountStatusCache = null;
      let composerRequestInFlight = false;
      const TRANSCRIPT_PAGE_LIMIT = 120;
      const SEND_BUTTON_SVG = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      const STOP_BUTTON_SVG = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M7 7h10v10H7z" fill="currentColor"/></svg>';
      const EDIT_BUTTON_SVG = '<svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5 14.8l.7-3.2 7.2-7.2a2 2 0 0 1 2.8 2.8l-7.2 7.2L5 14.8Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M11.7 5.6l2.8 2.8" stroke="currentColor" stroke-width="1.5"/></svg>';
      const FAVORITE_BUTTON_SVG = '<svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 2.8l2.1 4.3 4.8.7-3.5 3.4.8 4.8-4.2-2.3L5.8 16l.8-4.8L3.1 7.8l4.8-.7L10 2.8Z" stroke="currentColor" stroke-width="1.45" stroke-linejoin="round"/></svg>';
      const FOLDER_BUTTON_SVG = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M3.5 6.5h6l2 2h9v9a2 2 0 0 1-2 2h-15v-13Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';
      const turnQuestionText = new Map();
      const effortLabels = { minimal: '最小', low: '低', medium: '中', high: '高', xhigh: '超高' };
      const permissionLevels = {
        default: {
          label: '默认权限',
          approval_policy: 'on-request',
          sandbox_mode: 'workspace-write',
          approvals_reviewer: 'user'
        },
        autoReview: {
          label: '自动审查',
          approval_policy: 'on-request',
          sandbox_mode: 'workspace-write',
          approvals_reviewer: 'auto_review'
        },
        full: {
          label: '完全访问权限',
          approval_policy: 'never',
          sandbox_mode: 'danger-full-access',
          approvals_reviewer: 'user'
        }
      };
      const slashCommands = [
        { id:'model', description:'选择模型与推理强度。', flavor:'official', action:'openModel', meta:'Official', availableDuringTask:false },
        { id:'fast', description:'切换 Fast 模式。', flavor:'official', action:'toggleFast', meta:'Official', supportsInlineArgs:true, availableDuringTask:true },
        { id:'plan', description:'切换到 Plan collaboration preset。', flavor:'official', action:'togglePlan', meta:'Official', supportsInlineArgs:true, availableDuringTask:false },
        { id:'approvals', description:'选择 Codex 的权限级别。', flavor:'official', action:'openPermissions', meta:'Official', availableDuringTask:false },
        { id:'permissions', description:'选择 Codex 的权限级别。', flavor:'official', action:'openPermissions', meta:'Official', availableDuringTask:false },
        { id:'settings', description:'打开设置。', flavor:'official', action:'openSettings', meta:'Web', availableDuringTask:true },
        { id:'new', description:'开始一个新的聊天。', flavor:'official', action:'createThread', meta:'Local', availableDuringTask:false },
        { id:'clear', description:'清空输入并开始新的聊天。', flavor:'official', action:'createThread', meta:'Local', availableDuringTask:false },
        { id:'resume', description:'恢复一个已保存的线程。', flavor:'official', action:'openResume', meta:'Local', availableDuringTask:false },
        { id:'init', description:'初始化当前工作区的 AGENTS.md。', flavor:'official', action:'initAgents', meta:'Local', requiresWorkspace:true },
        { id:'review', description:'对当前改动发起 Review。', flavor:'official', action:'startReview', meta:'Official', requiresThread:true, supportsInlineArgs:true },
        { id:'status', description:'查看当前会话配置与 token 使用情况。', flavor:'official', action:'showStatus', meta:'Local', availableDuringTask:true },
        { id:'debug-config', description:'查看配置层与来源。', flavor:'official', action:'showDebugConfig', meta:'Local', availableDuringTask:true },
        { id:'diff', description:'显示当前工作区 diff。', flavor:'official', action:'showDiff', meta:'Local', requiresWorkspace:true, availableDuringTask:true },
        { id:'goal', description:'设置或查看长任务目标。', flavor:'official', action:'threadGoal', meta:'Official', requiresThread:true, supportsInlineArgs:true, availableDuringTask:true },
        { id:'compact', description:'压缩当前线程上下文。', flavor:'official', action:'compactThread', meta:'Official', requiresThread:true, availableDuringTask:false },
        { id:'fork', description:'从当前线程创建分支线程。', flavor:'official', action:'forkThread', meta:'Official', requiresThread:true, availableDuringTask:false },
        { id:'realtime', description:'查看 Realtime 可用语音。', flavor:'official', action:'showRealtime', meta:'Official', requiresThread:true, availableDuringTask:true },
        { id:'stop', description:'停止当前回复或清理后台终端。', flavor:'official', action:'stopThreadWork', meta:'Official', requiresThread:true, availableDuringTask:true },
        { id:'logout', description:'退出当前账号。', flavor:'official', action:'logoutAccount', meta:'Official' },
        { id:'setup-default-sandbox', description:'设置默认 Windows Sandbox。', flavor:'official', action:'setupSandbox', meta:'Official' }
      ];
      const slashCommandAliases = new Map([['clean', 'stop']]);
      let slashPaletteItems = [];
      let slashSelectedIndex = 0;

      function escapeHtml(value) {
        return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      }
      function escapeAttr(value) {
        return escapeHtml(value).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      }
      function stripLinkWrapper(value) {
        let target = String(value || '').trim();
        if ((target.startsWith('<') && target.endsWith('>')) || (target.startsWith('"') && target.endsWith('"'))) {
          target = target.slice(1, -1).trim();
        }
        return target;
      }
      function decodeInlineText(value) {
        const target = String(value || '');
        try { return decodeURIComponent(target); } catch {}
        try { return decodeURI(target); } catch {}
        return target;
      }
      function unescapeInlineHtml(value) {
        return String(value || '')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&amp;/g, '&');
      }
      function stripInternalMemoryBlocks(value) {
        return String(value || '')
          .replace(/<memory\b[^>]*>[\s\S]*?(?:<\/memory>|$)/gi, '')
          .replace(/<oai-mem-citation\b[^>]*>[\s\S]*?(?:<\/oai-mem-citation>|$)/gi, '')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
      }
      function decodeFileUrlPath(value) {
        const raw = stripLinkWrapper(value);
        if (!/^file:\/\//i.test(raw)) return raw;
        try {
          const fileUrl = new URL(raw);
          let decodedPath = decodeURIComponent(fileUrl.pathname || '');
          if (fileUrl.hostname && fileUrl.hostname.toLowerCase() !== 'localhost') {
            decodedPath = `\\\\${fileUrl.hostname}${decodedPath.replace(/\//g, '\\')}`;
          } else {
            decodedPath = decodedPath.replace(/^\/([A-Za-z]:)/, '$1');
            if (/^[A-Za-z]:\//.test(decodedPath)) decodedPath = decodedPath.replace(/\//g, '\\');
          }
          const lineAnchor = fileUrl.hash.match(/^#L(\d+)(?:C(\d+))?$/i);
          if (lineAnchor) decodedPath += `:${lineAnchor[1]}${lineAnchor[2] ? `:${lineAnchor[2]}` : ''}`;
          return decodedPath;
        } catch {
          return raw.replace(/^file:\/\/\/?/i, '');
        }
      }
      function normalizeLocalPathText(value) {
        return decodeInlineText(decodeFileUrlPath(stripLinkWrapper(value)));
      }
      function parseMessagePathLocation(value) {
        const target = normalizeLocalPathText(value);
        const hashMatch = target.match(/^(.*)#L(\d+)(?:C(\d+))?$/i);
        if (hashMatch) return { path: hashMatch[1], line: hashMatch[2], column: hashMatch[3] || '' };
        const colonMatch = target.match(/^(.*?)(?::(\d+)(?::(\d+))?)$/);
        if (colonMatch && colonMatch[1] && !/^[A-Za-z]$/.test(colonMatch[1])) {
          return { path: colonMatch[1], line: colonMatch[2], column: colonMatch[3] || '' };
        }
        return { path: target, line: '', column: '' };
      }
      function formatMessagePathLocation(location) {
        if (!location.line) return location.path;
        return `${location.path}:${location.line}${location.column ? `:${location.column}` : ''}`;
      }
      function isExternalUrl(value) {
        return /^(?:https?:\/\/|mailto:)/i.test(stripLinkWrapper(value));
      }
      function isLocalPathText(value) {
        const target = normalizeLocalPathText(value);
        return /^(?:[A-Za-z]:[\\/]|\\\\|\/|\.{1,2}[\\/])/.test(target) || isLikelyRelativeFilePath(target);
      }
      function hasLikelyFileName(localPath) {
        const base = parseMessagePathLocation(localPath).path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || '';
        return (base.startsWith('.') && base.length > 1) || base.includes('.');
      }
      function isLikelyRelativeFilePath(value) {
        const target = parseMessagePathLocation(value).path;
        if (!target || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(target) || !/[\\/]/.test(target)) return false;
        const parts = target.split(/[\\/]/).filter(Boolean);
        return parts.length >= 2 && hasLikelyFileName(target);
      }
      function joinWorkspacePath(relativePath) {
        const base = String(currentWorkdir || '').trim();
        const target = String(relativePath || '').replace(/^[/\\]+/, '');
        if (!base || !target) return base || target;
        const sep = base.includes('\\') ? '\\' : '/';
        return `${base.replace(/[\\/]+$/, '')}${sep}${target.replace(/[\\/]/g, sep)}`;
      }
      function resolveMessageLocalTarget(value) {
        if (!value || isExternalUrl(value) || /^#/.test(String(value).trim())) return null;
        const parsed = parseMessagePathLocation(value);
        let targetPath = parsed.path;
        if (!targetPath || /^(?:thread:\/\/|\/thread\/)/i.test(targetPath)) return null;
        if (/^(?:[A-Za-z]:[\\/]|\\\\)/.test(targetPath)) {
          return { ...parsed, path: targetPath, fullPath: formatMessagePathLocation({ ...parsed, path: targetPath }) };
        }
        const workspaceMatch = targetPath.match(/^\/workspaces\/[^/\\]+[\\/](.*)$/i) || targetPath.match(/^\/workspace[\\/](.*)$/i);
        if (workspaceMatch) {
          targetPath = joinWorkspacePath(workspaceMatch[1]);
          return { ...parsed, path: targetPath, fullPath: formatMessagePathLocation({ ...parsed, path: targetPath }) };
        }
        if (/^\.{1,2}[\\/]/.test(targetPath) || isLikelyRelativeFilePath(targetPath)) {
          targetPath = joinWorkspacePath(targetPath);
          return { ...parsed, path: targetPath, fullPath: formatMessagePathLocation({ ...parsed, path: targetPath }) };
        }
        return null;
      }
      function relativeMessageDisplayPath(localPath) {
        const normalizedPath = String(localPath || '').replace(/\\/g, '/');
        const normalizedWorkdir = String(currentWorkdir || '').replace(/\\/g, '/').replace(/\/+$/, '');
        if (normalizedWorkdir && normalizedPath.toLowerCase().startsWith(`${normalizedWorkdir.toLowerCase()}/`)) {
          return normalizedPath.slice(normalizedWorkdir.length + 1);
        }
        return normalizedPath;
      }
      function describeMessageLocalPath(localPath, label = '') {
        const location = parseMessagePathLocation(localPath);
        const displayPath = relativeMessageDisplayPath(location.path).replace(/\/+$/, '') || location.path;
        const parts = displayPath.split('/').filter(Boolean);
        const basename = parts.pop() || displayPath || location.path;
        const parentPath = parts.length ? parts.join('/') : (displayPath.startsWith('/') ? '/' : '');
        const useTargetLabel = hasLikelyFileName(location.path) || !label;
        return {
          fullPath: formatMessagePathLocation(location),
          name: useTargetLabel ? basename : String(label || basename),
          lineLabel: location.line ? `${location.line}${location.column ? `:${location.column}` : ''}` : '',
          parentPath: useTargetLabel ? parentPath : ''
        };
      }
      function localPathButton(target, label = target) {
        const resolved = resolveMessageLocalTarget(target);
        const localPath = resolved?.fullPath || normalizeLocalPathText(target);
        const description = describeMessageLocalPath(localPath, label);
        return `<button type="button" class="local-path-link message-file-link" data-path="${escapeAttr(localPath)}" title="${escapeAttr(description.fullPath)}"><span class="message-file-link-label"><span class="message-file-link-name">${escapeHtml(description.name)}</span>${description.lineLabel ? `<span class="message-file-link-line"> (line ${escapeHtml(description.lineLabel)})</span>` : ''}</span>${description.parentPath ? `<span class="message-file-link-path">${escapeHtml(description.parentPath)}</span>` : ''}</button>`;
      }
      function externalMessageLink(target, label = target) {
        const href = stripLinkWrapper(target);
        return `<a class="message-link message-external-link" href="${escapeAttr(href)}" target="_blank" rel="noreferrer noopener">${escapeHtml(label || href)}</a>`;
      }
      function splitMarkdownHref(value) {
        const target = stripLinkWrapper(value);
        const firstToken = target.split(/\s+/)[0] || target;
        if (isExternalUrl(firstToken) || /^file:\/\//i.test(firstToken)) return firstToken;
        return target;
      }
      function htmlPlaceholder(placeholders, html) {
        const token = `\u0000HTML_${placeholders.length}\u0000`;
        placeholders.push(html);
        return token;
      }
      function restoreHtmlPlaceholders(html, placeholders) {
        return html.replace(/\u0000HTML_(\d+)\u0000/g, (_match, index) => placeholders[Number(index)] || '');
      }
      function linkRawExternalUrls(escapedText) {
        return escapedText.replace(/(^|[\s(["'“])((?:https?:\/\/|mailto:)[^\r\n<>"`]*?)(?=$|[\s)\]，。；;！!？?])/gi, (match, prefix, target) => {
          const clean = target.replace(/[.,，。；;]+$/, '');
          const suffix = target.slice(clean.length);
          const href = unescapeInlineHtml(clean);
          if (!isExternalUrl(href)) return match;
          return `${prefix}${externalMessageLink(href)}${suffix}`;
        });
      }
      function linkRawLocalPaths(escapedText) {
        const localPattern = /(^|[\s(["'“])((?:file:\/\/\/?[^\s<>"`]+|[A-Za-z]:[\\/][^\r\n<>"`]*?|\\\\[^\r\n<>"`]*?|\/(?:workspace|workspaces)[\\/][^\r\n<>"`]*?|\.{1,2}[\\/][^\r\n<>"`]*?|[A-Za-z0-9._-]+(?:[\\/][A-Za-z0-9._-]+){1,}(?::\d+(?::\d+)?)?))(?=$|[\s)\]，。；;！!？?])/g;
        return escapedText.replace(localPattern, (match, prefix, target) => {
          const clean = target.replace(/[.,，。；;]+$/, '');
          const suffix = target.slice(clean.length);
          const localTarget = unescapeInlineHtml(clean);
          if (!resolveMessageLocalTarget(localTarget)) return match;
          return `${prefix}${localPathButton(localTarget)}${suffix}`;
        });
      }
      function renderInlineMarkdown(value) {
        const placeholders = [];
        let inlineText = String(value || '').replace(/`([^`]+)`/g, (_match, code) => htmlPlaceholder(placeholders, `<code>${escapeHtml(code)}</code>`));
        inlineText = inlineText.replace(/\[([^\]\r\n]+)\]\((<[^>\r\n]+>|[^)\r\n]+)\)/g, (match, label, target) => {
          const href = splitMarkdownHref(target);
          if (isExternalUrl(href)) return htmlPlaceholder(placeholders, externalMessageLink(href, label));
          if (resolveMessageLocalTarget(href)) return htmlPlaceholder(placeholders, localPathButton(href, label));
          return match;
        });
        inlineText = inlineText.replace(/<((?:https?:\/\/|mailto:)[^>\s]+)>/gi, (_match, href) => htmlPlaceholder(placeholders, externalMessageLink(href)));
        inlineText = inlineText.replace(/<((?:file:\/\/\/?|[A-Za-z]:[\\/]|\\\\|\/workspace[\\/]|\/workspaces[\\/]|\.{1,2}[\\/])[^>\r\n]+)>/g, (match, target) => {
          if (!resolveMessageLocalTarget(target)) return match;
          return htmlPlaceholder(placeholders, localPathButton(target));
        });
        return restoreHtmlPlaceholders(
          linkRawLocalPaths(linkRawExternalUrls(escapeHtml(inlineText)).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')),
          placeholders
        );
      }
      function isTableSeparator(line) {
        return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
      }
      function splitTableRow(line) {
        return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
      }
      function renderMarkdownBlocks(markdown) {
        const lines = String(markdown || '').split(/\r?\n/);
        const out = [];
        let paragraph = [];
        const flushParagraph = () => {
          if (!paragraph.length) return;
          out.push(`<p>${renderInlineMarkdown(paragraph.join(' '))}</p>`);
          paragraph = [];
        };
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i] || '';
          if (line.trim().startsWith('```')) {
            flushParagraph();
            const code = [];
            i++;
            while (i < lines.length && !(lines[i] || '').trim().startsWith('```')) {
              code.push(lines[i] || '');
              i++;
            }
            out.push(`<pre class="message-code"><code>${escapeHtml(code.join('\n'))}</code></pre>`);
            continue;
          }
          if (line.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1] || '')) {
            flushParagraph();
            const headers = splitTableRow(line);
            i += 2;
            const rows = [];
            while (i < lines.length && (lines[i] || '').includes('|') && (lines[i] || '').trim()) {
              rows.push(splitTableRow(lines[i] || ''));
              i++;
            }
            i--;
            out.push(`<div class="message-table-wrap"><table class="message-table"><thead><tr>${headers.map((cell) => `<th>${renderInlineMarkdown(cell)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((_h, index) => `<td>${renderInlineMarkdown(row[index] || '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
            continue;
          }
          if (!line.trim()) {
            flushParagraph();
            continue;
          }
          paragraph.push(line.trim());
        }
        flushParagraph();
        return out.join('');
      }
      function renderAttachmentImages(attachments = []) {
        const images = attachments.filter((item) => item && item.kind === 'image' && item.url);
        if (!images.length) return '';
        return `<div class="message-attachments">${images.map((item) => `<figure class="message-image"><img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.name || 'image')}" /><figcaption>${escapeHtml(item.name || 'image')}</figcaption></figure>`).join('')}</div>`;
      }
      function fmtDate(ms) {
        try { return new Date(ms).toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }); } catch { return ''; }
      }
      function formatCompletionTime(value) {
        const time = typeof value === 'number' ? value : Date.parse(String(value || ''));
        if (!Number.isFinite(time)) return '未记录';
        const date = new Date(time);
        const today = new Date();
        const sameDay = date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
        return date.toLocaleString('zh-CN', sameDay
          ? { hour:'2-digit', minute:'2-digit', second:'2-digit' }
          : { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
      }
      function formatDuration(ms) {
        const value = Number(ms || 0);
        if (!Number.isFinite(value) || value <= 0) return '未记录';
        if (value < 1000) return `${Math.max(0.1, value / 1000).toFixed(1)}s`;
        const totalSeconds = Math.max(1, Math.round(value / 1000));
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
      }
      function toKB(bytes) { return `${Math.max(1, Math.round((bytes || 0) / 1024))} KB`; }
      function prettyModel(model) {
        return String(model || 'gpt-5.5').replace(/^gpt/i, 'GPT').replace(/codex/i, 'Codex');
      }
      function effortLabel(effort) {
        return effortLabels[effort || 'xhigh'] || '超高';
      }
      function normalizeServiceTier(value) {
        return String(value || '').trim().toLowerCase() === 'fast' ? 'fast' : '';
      }
      function currentServiceTier() {
        return serviceTierOverrideActive ? normalizeServiceTier(selectedServiceTier) : normalizeServiceTier(currentConfig.service_tier);
      }
      function currentPermissionLevel(cfg = currentConfig) {
        const approval = String(cfg?.approval_policy || 'never');
        const sandbox = String(cfg?.sandbox_mode || 'danger-full-access');
        const reviewer = String(cfg?.approvals_reviewer || 'user');
        if (reviewer === 'auto_review') return 'autoReview';
        if (approval === 'never' && sandbox === 'danger-full-access') return 'full';
        return 'default';
      }
      function permissionLabel(level = currentPermissionLevel()) {
        return permissionLevels[level]?.label || permissionLevels.default.label;
      }
      function setComposerMoreMenuOpen(open) {
        if (!composerMoreMenu) return;
        composerMoreMenu.hidden = !open;
        $('attachmentBtn')?.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (!open) setComposerSpeedMenuOpen(false);
        updateComposerMenuState();
        exposeDebugState();
      }
      function closeComposerMoreMenu() {
        setComposerMoreMenuOpen(false);
      }
      function toggleComposerMoreMenu() {
        setComposerMoreMenuOpen(Boolean(composerMoreMenu?.hidden));
      }
      function updateComposerMenuState() {
        const tier = currentServiceTier();
        if (composerSpeedValue) composerSpeedValue.textContent = tier === 'fast' ? 'Fast' : 'Standard';
        composerMoreMenu?.querySelectorAll('[data-service-tier]').forEach((button) => {
          const active = normalizeServiceTier(button.getAttribute('data-service-tier')) === tier;
          button.dataset.active = active ? 'true' : 'false';
          button.setAttribute('aria-checked', active ? 'true' : 'false');
        });
        if (composerPlanMenuBtn) {
          const active = collaborationPreset === 'plan';
          composerPlanMenuBtn.setAttribute('aria-checked', active ? 'true' : 'false');
          composerPlanMenuBtn.dataset.active = active ? 'true' : 'false';
        }
        if (composerPlanValue) composerPlanValue.textContent = collaborationPreset === 'plan' ? 'On' : 'Off';
        const permissionLevel = currentPermissionLevel();
        if (composerPermissionValue) composerPermissionValue.textContent = permissionLabel(permissionLevel);
        const permissionBtn = $('permissionBtn');
        if (permissionBtn) permissionBtn.textContent = `${permissionLabel(permissionLevel)}⌄`;
        composerMoreMenu?.querySelectorAll('[data-permission-level]').forEach((button) => {
          button.dataset.active = button.getAttribute('data-permission-level') === permissionLevel ? 'true' : 'false';
        });
      }
      function slashCommandById(id) {
        const normalized = String(id || '').trim().toLowerCase();
        const canonical = slashCommandAliases.get(normalized) || normalized;
        return slashCommands.find((command) => command.id === canonical) || null;
      }
      function parseSlashInput(value) {
        const raw = String(value || '');
        if (!raw.startsWith('/')) return null;
        const line = raw.slice(1).split(/\r?\n/)[0] || '';
        const trimmed = line.trimStart();
        const spaceIndex = trimmed.search(/\s/);
        const typed = spaceIndex === -1 ? trimmed : trimmed.slice(0, spaceIndex);
        const args = spaceIndex === -1 ? '' : trimmed.slice(spaceIndex + 1).trim();
        const matched = slashCommandById(typed);
        return {
          raw: line,
          search: trimmed.toLowerCase(),
          typedCommandId: typed ? typed.toLowerCase() : null,
          command: matched,
          argumentsText: args
        };
      }
      function slashDisabledReason(command, parsed) {
        if (command.unavailableReason) return command.unavailableReason;
        if (command.requiresThread && !currentResumePath) return '请先打开一个线程。';
        if (command.requiresWorkspace && !currentWorkdir) return '请先选择工作区。';
        if (codexRunning && command.availableDuringTask === false) return '当前有任务正在执行，这条命令不能在运行中使用。';
        if (command.id === 'review' && parsed && parsed.command === command && !parsed.argumentsText && !currentResumePath) return '请先打开一个线程。';
        return null;
      }
      function listSlashPaletteItems(query) {
        const parsed = parseSlashInput(query);
        if (!parsed) return [];
        const exact = parsed.command ? [parsed.command] : null;
        const search = parsed.search.replace(/^\//, '');
        const source = exact || slashCommands.filter((command) => {
          if (!search) return true;
          return `${command.id} ${command.description}`.toLowerCase().includes(search);
        });
        return source.slice(0, 10).map((command) => {
          const disabledReason = slashDisabledReason(command, parsed);
          return {
            ...command,
            disabledReason,
            disabled: Boolean(disabledReason),
            label: `/${command.id}`,
            detail: disabledReason || command.description,
            argumentsText: parsed.argumentsText
          };
        });
      }
      function renderSlashCommandPalette() {
        if (!slashCommandPalette) return;
        if (!slashPaletteItems.length) {
          slashCommandPalette.hidden = true;
          slashCommandPalette.innerHTML = '';
          return;
        }
        slashCommandPalette.hidden = false;
        slashCommandPalette.innerHTML = `
          <div class="composer-command-palette-title">Slash 命令</div>
          <div class="composer-command-palette-list">
            ${slashPaletteItems.map((item, index) => `
              <button type="button" role="menuitem" class="composer-command-palette-item ${index === slashSelectedIndex ? 'composer-command-palette-item-selected' : ''} ${item.disabled ? 'composer-command-palette-item-disabled' : ''}" data-index="${index}" aria-disabled="${item.disabled}" title="${escapeAttr(item.detail)}">
                <span class="composer-command-palette-copy">
                  <span class="composer-command-palette-label">${escapeHtml(item.label)}</span>
                  <span class="composer-command-palette-description">${escapeHtml(item.detail)}</span>
                </span>
                <span class="composer-command-palette-detail">
                  <span class="composer-command-palette-meta">${escapeHtml(item.meta || (item.flavor === 'local' ? 'Local' : 'Official'))}</span>
                </span>
              </button>
            `).join('')}
          </div>`;
      }
      function updateSlashCommandPalette() {
        slashPaletteItems = listSlashPaletteItems(text.value);
        if (slashSelectedIndex >= slashPaletteItems.length) slashSelectedIndex = Math.max(0, slashPaletteItems.length - 1);
        renderSlashCommandPalette();
      }
      function closeSlashCommandPalette() {
        slashPaletteItems = [];
        slashSelectedIndex = 0;
        renderSlashCommandPalette();
      }
      function replaceComposerWith(value) {
        text.value = value;
        autoSizeText();
        updateComposerControls();
        closeSlashCommandPalette();
        text.focus();
      }
      function setCollaborationPreset(preset) {
        collaborationPreset = preset === 'plan' ? 'plan' : 'default';
        safeLocalSet('plusCollaborationPreset', collaborationPreset);
        updatePlanModeControls();
        exposeDebugState();
      }
      function updatePlanModeControls() {
        const active = collaborationPreset === 'plan';
        if (composerPlanMenuBtn) {
          composerPlanMenuBtn.classList.toggle('composer-mode-btn-active', active);
          composerPlanMenuBtn.setAttribute('aria-checked', active ? 'true' : 'false');
          composerPlanMenuBtn.title = active ? '计划模式已开启' : '计划模式';
        }
        updateComposerMenuState();
      }
      function togglePlanMode(argumentsText = '') {
        const arg = String(argumentsText || '').trim().toLowerCase();
        const next = ['off', 'false', '0', 'default'].includes(arg)
          ? 'default'
          : ['on', 'true', '1', 'plan'].includes(arg)
            ? 'plan'
            : collaborationPreset === 'plan' ? 'default' : 'plan';
        setCollaborationPreset(next);
        addSystem(next === 'plan'
          ? '已切换到 Plan 模式，下一次发送将使用官方 plan collaboration preset。'
          : '已关闭 Plan 模式，后续发送使用默认 collaboration preset。');
      }
      function formatWebStatus() {
        return [
          `模型：${currentConfig.model || 'gpt-5.5'}`,
          `推理强度：${effortLabel(currentConfig.model_reasoning_effort)}`,
          `Service tier：${currentServiceTier() === 'fast' ? 'Fast' : 'Auto'}`,
          `Collaboration preset：${collaborationPreset}`,
          `权限策略：${currentConfig.approval_policy || 'never'}`,
          `审批审查：${currentConfig.approvals_reviewer || 'user'}`,
          `沙盒：${currentConfig.sandbox_mode || 'danger-full-access'}`,
          `工作区：${currentWorkdir || '未选择'}`,
          `线程：${currentResumePath || '新会话'}`,
          `运行中：${codexRunning ? '是' : '否'}`,
          `排队：${queuedFollowUps.length} 条`,
          `引导：${guidanceState.count || 0} 条`
        ].join('\n');
      }
      async function showStatusDetail() {
        await loadConfig();
        const localStatus = formatWebStatus();
        try {
          const result = endpointResult(await fetchJsonEndpoint('/account/status'));
          addBubble(`Status\n\n${localStatus}\n\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``, 'agent');
        } catch (error) {
          addSystem(`${localStatus}\n\n账号状态读取失败：${error.message || error}`, true);
        }
      }
      function setComposerSpeedMenuOpen(open) {
        if (!composerSpeedMenu || !composerSpeedTrigger) return;
        composerSpeedMenu.classList.toggle('composer-attachment-service-menu-open', Boolean(open));
        composerSpeedMenu.setAttribute('aria-hidden', open ? 'false' : 'true');
        composerSpeedTrigger.classList.toggle('composer-attachment-folder-trigger-active', Boolean(open));
        composerSpeedTrigger.setAttribute('aria-expanded', open ? 'true' : 'false');
      }
      function toggleComposerSpeedMenu() {
        setComposerSpeedMenuOpen(!composerSpeedMenu?.classList.contains('composer-attachment-service-menu-open'));
      }
      async function fetchJsonEndpoint(endpoint) {
        const response = await fetch(endpoint, { cache: 'no-store' });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
        return data;
      }
      async function postJsonEndpoint(endpoint, payload = {}) {
        const response = await fetch(endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
        return data;
      }
      async function deleteJsonEndpoint(endpoint, payload = {}) {
        const response = await fetch(endpoint, { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
        return data;
      }
      function endpointResult(data) {
        return data && Object.prototype.hasOwnProperty.call(data, 'result') ? data.result : data;
      }
      function setAccountStatus(message = '', error = false) {
        if (!accountStatusLine) return;
        accountStatusLine.textContent = message;
        accountStatusLine.classList.toggle('account-status-error', Boolean(error));
      }
      function nestedPayload(value, key) {
        if (!value || typeof value !== 'object') return null;
        return value[key] && typeof value[key] === 'object' ? value[key] : value;
      }
      function accountPayload(status) {
        return nestedPayload(status?.account, 'account') || {};
      }
      function rateLimitsPayload(status) {
        return nestedPayload(status?.rateLimits, 'rateLimits') || {};
      }
      function usageSummaryPayload(status) {
        const usage = status?.usage || {};
        if (usage.summary && typeof usage.summary === 'object') return usage.summary;
        if (usage.usage?.summary && typeof usage.usage.summary === 'object') return usage.usage.summary;
        return {};
      }
      function clampPercent(value) {
        const numberValue = Number(value);
        if (!Number.isFinite(numberValue)) return 0;
        return Math.max(0, Math.min(100, Math.round(numberValue)));
      }
      function formatNumber(value) {
        const numberValue = Number(value);
        if (!Number.isFinite(numberValue)) return String(value ?? '0');
        return new Intl.NumberFormat('zh-CN').format(numberValue);
      }
      function formatWindowDuration(minutes) {
        const value = Number(minutes);
        if (!Number.isFinite(value) || value <= 0) return '';
        if (value < 60) return `${Math.round(value)} 分钟窗口`;
        if (value < 60 * 24) return `${Math.round(value / 60)} 小时窗口`;
        return `${Math.round(value / 60 / 24)} 天窗口`;
      }
      function formatResetTime(value) {
        if (!value) return '';
        const date = new Date(value);
        if (!Number.isFinite(date.getTime())) return '';
        const diffMs = date.getTime() - Date.now();
        const absMinutes = Math.max(1, Math.round(Math.abs(diffMs) / 60000));
        const suffix = diffMs >= 0 ? '后重置' : '前已重置';
        if (absMinutes < 60) return `${absMinutes} 分钟${suffix}`;
        const absHours = Math.round(absMinutes / 60);
        if (absHours < 48) return `${absHours} 小时${suffix}`;
        return `${Math.round(absHours / 24)} 天${suffix}`;
      }
      function limitCaption(limit) {
        const pieces = [formatResetTime(limit?.resetsAt), formatWindowDuration(limit?.windowDurationMins)].filter(Boolean);
        return pieces.join(' · ');
      }
      function buildAccountLimitCards(rateLimits) {
        const cards = [];
        if (rateLimits?.primary) {
          const remaining = clampPercent(100 - Number(rateLimits.primary.usedPercent || 0));
          cards.push({
            id: 'primary',
            title: 'Session remaining',
            value: `${remaining}%`,
            percent: remaining,
            caption: limitCaption(rateLimits.primary)
          });
        }
        if (rateLimits?.secondary) {
          const remaining = clampPercent(100 - Number(rateLimits.secondary.usedPercent || 0));
          cards.push({
            id: 'secondary',
            title: 'Weekly remaining',
            value: `${remaining}%`,
            percent: remaining,
            caption: limitCaption(rateLimits.secondary)
          });
        }
        if (rateLimits?.credits) {
          const credits = rateLimits.credits || {};
          cards.push({
            id: 'credits',
            title: 'Credits balance',
            value: credits.unlimited ? 'Unlimited' : String(credits.balance ?? 0),
            percent: credits.unlimited ? 100 : (credits.hasCredits ? 100 : 0),
            caption: credits.unlimited ? 'Unlimited credits' : (credits.hasCredits ? 'Credits available' : 'No credits available')
          });
        }
        return cards;
      }
      function renderAccountLimitCards(rateLimits) {
        if (!accountLimitCards) return;
        const cards = buildAccountLimitCards(rateLimits);
        if (!cards.length) {
          accountLimitCards.innerHTML = '<div class="account-limit-card"><div class="account-limit-card-title">Account limits</div><div class="account-limit-card-caption">当前账号未返回额度信息。</div></div>';
          return;
        }
        accountLimitCards.innerHTML = cards.map((card) => `
          <article class="account-limit-card" data-limit-id="${escapeAttr(card.id)}">
            <div class="account-limit-card-title">${escapeHtml(card.title)}</div>
            <div class="account-limit-card-value">${escapeHtml(card.value)}</div>
            <div class="account-limit-bar" aria-hidden="true"><span style="width:${clampPercent(card.percent)}%"></span></div>
            <div class="account-limit-card-caption">${escapeHtml(card.caption || '')}</div>
          </article>
        `).join('');
      }
      function renderAccountUsage(summary) {
        if (!accountUsageSummary) return;
        const items = [
          ['Lifetime tokens', summary.lifetimeTokens],
          ['Peak daily tokens', summary.peakDailyTokens],
          ['Longest turn', summary.longestRunningTurnSec ? `${formatNumber(summary.longestRunningTurnSec)} 秒` : '0'],
          ['Current streak', summary.currentStreakDays ? `${formatNumber(summary.currentStreakDays)} 天` : '0']
        ];
        accountUsageSummary.innerHTML = items.map(([label, value]) => `
          <div class="account-usage-item">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(formatNumber(value ?? 0))}</strong>
          </div>
        `).join('');
      }
      function redactAccountDetails(value) {
        const secretPattern = /(token|secret|key|authorization|password|credential)/i;
        if (Array.isArray(value)) return value.map(redactAccountDetails);
        if (!value || typeof value !== 'object') return value;
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [
          key,
          secretPattern.test(key) ? '[redacted]' : redactAccountDetails(item)
        ]));
      }
      function renderAccountPanel(status) {
        accountStatusCache = status || null;
        const accountResponse = status?.account || {};
        const account = accountPayload(status);
        const authStatus = account.type === 'chatgpt' || account.type === 'apiKey' || accountResponse.requiresOpenaiAuth === false
          ? '已登录'
          : accountResponse.requiresOpenaiAuth ? '未登录' : '未知';
        const identityTitle = account.email || (account.type === 'apiKey' ? 'API key account' : authStatus);
        const plan = account.planType || account.plan_type || 'unknown';
        if (accountIdentity) {
          accountIdentity.innerHTML = `
            <strong>${escapeHtml(identityTitle)}</strong>
            <div class="account-meta-row">
              <span>状态：${escapeHtml(authStatus)}</span>
              <span>方式：${escapeHtml(account.type || 'unknown')}</span>
              <span>计划：${escapeHtml(plan)}</span>
            </div>
          `;
        }
        renderAccountLimitCards(rateLimitsPayload(status));
        renderAccountUsage(usageSummaryPayload(status));
        if (accountRawDetails) {
          accountRawDetails.textContent = JSON.stringify(redactAccountDetails(status || {}), null, 2);
        }
        if (accountLoginBtn) accountLoginBtn.hidden = authStatus === '已登录';
        if (accountLogoutBtn) accountLogoutBtn.hidden = authStatus !== '已登录';
        setAccountStatus(status?.rateLimits?.ok === false ? `额度读取失败：${status.rateLimits.error || 'unknown error'}` : '账号状态已刷新。', status?.rateLimits?.ok === false);
        exposeDebugState();
      }
      async function loadAccountPanel() {
        setAccountStatus('正在读取账号状态...');
        try {
          const result = endpointResult(await fetchJsonEndpoint('/account/status'));
          renderAccountPanel(result);
        } catch (error) {
          setAccountStatus(`账号状态读取失败：${error.message || error}`, true);
          if (accountIdentity) accountIdentity.textContent = '账号状态读取失败。';
          if (accountLimitCards) accountLimitCards.innerHTML = '';
          if (accountUsageSummary) accountUsageSummary.innerHTML = '';
        }
      }
      async function openAccountPanel() {
        openModal('accountModal');
        await loadAccountPanel();
      }
      async function startAccountLogin() {
        setAccountStatus('正在启动登录...');
        const result = endpointResult(await postJsonEndpoint('/account/login/start', { type: 'chatgpt' }));
        const url = result?.authUrl || result?.verificationUri || result?.verification_uri || '';
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
        setAccountStatus(url ? '已打开登录页面，完成后请刷新账号状态。' : '已启动登录流程，请按返回信息完成登录。');
        if (accountRawDetails) accountRawDetails.textContent = JSON.stringify(redactAccountDetails(result || {}), null, 2);
      }
      function markdownTable(headers, rows) {
        const header = `| ${headers.join(' | ')} |`;
        const sep = `| ${headers.map(() => '---').join(' | ')} |`;
        return [header, sep, ...rows.map((row) => `| ${row.map((cell) => String(cell || '').replace(/\|/g, '\\|')).join(' | ')} |`)].join('\n');
      }
      function setGitStatusLine(message, error = false) {
        if (!gitStatusLine) return;
        gitStatusLine.textContent = message || '';
        gitStatusLine.classList.toggle('text-error', Boolean(error));
      }
      function gitChangeKey(path, staged) {
        return `${staged ? 'staged' : 'unstaged'}:${path}`;
      }
      function gitChangeStatusLabel(entry) {
        return String(entry.status || `${entry.indexStatus || ''}${entry.worktreeStatus || ''}` || '').trim() || entry.section || '??';
      }
      function gitSelectionPaths() {
        const keys = gitPanelState.selectedRows.size
          ? [...gitPanelState.selectedRows]
          : (gitPanelState.selectedPath ? [gitChangeKey(gitPanelState.selectedPath, gitPanelState.selectedStaged)] : []);
        return [...new Set(keys.map((key) => key.slice(key.indexOf(':') + 1)).filter(Boolean))];
      }
      function renderGitPanel() {
        const status = gitPanelState.status;
        const isRepo = Boolean(status?.isRepository || status?.isRepo);
        const branch = status?.branch?.detached
          ? `detached ${status.branch.head || ''}`.trim()
          : (status?.branch?.head || status?.branchName || '(未命名分支)');
        if (gitBranchPill) gitBranchPill.textContent = isRepo ? branch : '不是 Git 仓库';
        if (gitRepoMeta) {
          const aheadBehind = status?.branch ? `ahead ${status.branch.ahead || 0} / behind ${status.branch.behind || 0}` : '';
          gitRepoMeta.textContent = isRepo ? [status.repoRoot || status.root || currentWorkdir, status.remoteUrl || status.remoteName || '', aheadBehind].filter(Boolean).join(' · ') : (status?.error || currentWorkdir);
        }
        gitScopeUnstaged?.classList.toggle('active', gitPanelState.scope !== 'staged');
        gitScopeStaged?.classList.toggle('active', gitPanelState.scope === 'staged');
        if (!gitChangeList) return;
        gitChangeList.innerHTML = '';
        if (gitPanelState.loading) {
          gitChangeList.innerHTML = '<div class="project-browser-empty">正在读取 Git 变更...</div>';
          return;
        }
        if (!isRepo) {
          gitChangeList.innerHTML = '<div class="project-browser-empty">当前项目不是 Git 仓库。</div>';
          if (gitDiffView) gitDiffView.textContent = status?.error || '请选择一个 Git 仓库项目。';
          return;
        }
        if (!gitPanelState.diffs.length) {
          gitChangeList.innerHTML = '<div class="project-browser-empty">当前 scope 没有变更。</div>';
          if (gitDiffTitle) gitDiffTitle.textContent = '差异';
          if (gitDiffStats) gitDiffStats.textContent = '0 + / 0 -';
          if (gitDiffView) gitDiffView.textContent = '当前没有可显示的差异。';
        }
        for (const item of gitPanelState.diffs) {
          const key = gitChangeKey(item.path, item.staged);
          const row = document.createElement('button');
          row.type = 'button';
          row.className = `git-change-row ${gitPanelState.selectedPath === item.path && gitPanelState.selectedStaged === item.staged ? 'git-change-row-active' : ''}`;
          row.dataset.path = item.path;
          row.dataset.staged = String(item.staged);
          row.innerHTML = `
            <input type="checkbox" ${gitPanelState.selectedRows.has(key) ? 'checked' : ''} aria-label="选择 ${escapeAttr(item.path)}" />
            <span class="git-change-main">
              <span class="git-change-path">${escapeHtml(item.displayPath || item.path)}</span>
              <span class="git-change-sub">${escapeHtml(item.section || '')} · +${item.additions || 0} / -${item.deletions || 0}</span>
            </span>
            <span class="git-change-status">${escapeHtml(gitChangeStatusLabel(item))}</span>`;
          row.addEventListener('click', (event) => {
            if (event.target?.tagName === 'INPUT') return;
            selectGitDiff(item.path, item.staged).catch((error) => setGitStatusLine(`读取 diff 失败：${error.message || error}`, true));
          });
          row.querySelector('input')?.addEventListener('click', (event) => {
            event.stopPropagation();
            if (event.currentTarget.checked) gitPanelState.selectedRows.add(key);
            else gitPanelState.selectedRows.delete(key);
            renderGitPanel();
          });
          gitChangeList.appendChild(row);
        }
        const selectedCount = gitSelectionPaths().length;
        const stagedScope = gitPanelState.scope === 'staged';
        if (gitStageSelected) gitStageSelected.disabled = stagedScope || selectedCount === 0;
        if (gitUnstageSelected) gitUnstageSelected.disabled = !stagedScope || selectedCount === 0;
        if (gitDiscardSelected) gitDiscardSelected.disabled = stagedScope || selectedCount === 0;
        if (gitCommitBtn) gitCommitBtn.disabled = !isRepo;
        if (gitPullBtn) gitPullBtn.disabled = !isRepo;
        if (gitPushBtn) gitPushBtn.disabled = !isRepo;
        if (gitBranchCreate) gitBranchCreate.disabled = !isRepo;
      }
      async function loadGitPanel(scope = gitPanelState.scope) {
        gitPanelState.scope = scope === 'staged' ? 'staged' : 'unstaged';
        gitPanelState.loading = true;
        renderGitPanel();
        const data = await fetchJsonEndpoint(`/git/workspace-diffs?scope=${encodeURIComponent(gitPanelState.scope)}`);
        gitPanelState.status = data;
        gitPanelState.diffs = Array.isArray(data.diffs) ? data.diffs : [];
        gitPanelState.selectedRows.clear();
        gitPanelState.loading = false;
        const retained = gitPanelState.diffs.find((item) => item.path === gitPanelState.selectedPath && item.staged === gitPanelState.selectedStaged);
        const first = retained || gitPanelState.diffs[0];
        if (first) {
          gitPanelState.selectedPath = first.path;
          gitPanelState.selectedStaged = Boolean(first.staged);
          if (gitDiffTitle) gitDiffTitle.textContent = first.displayPath || first.path;
          if (gitDiffStats) gitDiffStats.textContent = `+${first.additions || 0} / -${first.deletions || 0}`;
          if (gitDiffView) gitDiffView.textContent = first.diff || '当前没有可显示的差异。';
        } else {
          gitPanelState.selectedPath = '';
          gitPanelState.selectedStaged = gitPanelState.scope === 'staged';
        }
        renderGitPanel();
        setGitStatusLine(data.isRepository || data.isRepo ? 'Git 状态已更新。' : '当前项目不是 Git 仓库。', !(data.isRepository || data.isRepo));
      }
      async function selectGitDiff(path, staged) {
        gitPanelState.selectedPath = path;
        gitPanelState.selectedStaged = Boolean(staged);
        renderGitPanel();
        const data = await fetchJsonEndpoint(`/git/file-diff?path=${encodeURIComponent(path)}&staged=${encodeURIComponent(String(Boolean(staged)))}`);
        const index = gitPanelState.diffs.findIndex((item) => item.path === data.path && item.staged === data.staged);
        if (index >= 0) gitPanelState.diffs[index] = data;
        if (gitDiffTitle) gitDiffTitle.textContent = data.displayPath || data.path;
        if (gitDiffStats) gitDiffStats.textContent = `+${data.additions || 0} / -${data.deletions || 0}`;
        if (gitDiffView) gitDiffView.textContent = data.diff || '当前没有可显示的差异。';
        renderGitPanel();
      }
      async function openGitPanel() {
        openModal('gitModal');
        await loadGitPanel(gitPanelState.scope);
      }
      async function runGitPathAction(endpoint, extra = {}) {
        const paths = gitSelectionPaths();
        if (!paths.length) {
          setGitStatusLine('请先选择一个 Git 变更文件。', true);
          return;
        }
        await postJsonEndpoint(endpoint, { paths, ...extra });
        await loadGitPanel(gitPanelState.scope);
      }
      async function discardSelectedGitChanges() {
        const paths = gitSelectionPaths();
        if (!paths.length) {
          setGitStatusLine('请先选择要丢弃的变更。', true);
          return;
        }
        if (!confirm('确定丢弃所选 Git 变更？未跟踪文件会被删除。')) return;
        await postJsonEndpoint('/git/discard', { paths, deleteUntracked: true });
        await loadGitPanel(gitPanelState.scope);
      }
      async function commitGitChanges() {
        const message = String(gitCommitMessage?.value || '').trim();
        if (!message) {
          setGitStatusLine('请输入提交消息。', true);
          gitCommitMessage?.focus();
          return;
        }
        await postJsonEndpoint('/git/commit', { message });
        if (gitCommitMessage) gitCommitMessage.value = '';
        await loadGitPanel('unstaged');
      }
      async function pushGitChanges() {
        const branch = gitPanelState.status?.branch?.head || '当前分支';
        if (!confirm(`推送 ${branch}？`)) return;
        await postJsonEndpoint('/git/push', { forceWithLease: false });
        await loadGitPanel(gitPanelState.scope);
      }
      async function pullGitChanges() {
        await postJsonEndpoint('/git/pull', {});
        await loadGitPanel(gitPanelState.scope);
      }
      async function createGitBranch() {
        const branchName = prompt('请输入新分支名');
        if (!branchName || !branchName.trim()) return;
        await postJsonEndpoint('/git/checkout', { branchName: branchName.trim(), create: true });
        await loadGitPanel(gitPanelState.scope);
      }
      function setTerminalStatus(message, error = false) {
        if (!terminalStatusLine) return;
        terminalStatusLine.textContent = message || '';
        terminalStatusLine.classList.toggle('text-error', Boolean(error));
      }
      function activeTerminalSession() {
        return terminalState.sessions.find((item) => item.id === terminalState.activeId) || terminalState.sessions[0] || null;
      }
      function terminalOutputText(session) {
        if (!session) return '暂无终端会话';
        return (session.output || []).map((chunk) => chunk.text || '').join('');
      }
      function renderTerminalPanel() {
        if (!terminalTabs || !terminalOutput) return;
        terminalTabs.innerHTML = '';
        terminalState.sessions.forEach((session) => {
          const tab = document.createElement('button');
          tab.type = 'button';
          tab.className = `terminal-tab ${session.running ? 'terminal-tab-running' : ''} ${session.id === terminalState.activeId ? 'terminal-tab-active' : ''}`;
          tab.innerHTML = `<span class="terminal-tab-status"></span><span>${escapeHtml(session.title || session.command || session.id)}</span>`;
          tab.addEventListener('click', () => {
            terminalState.activeId = session.id;
            renderTerminalPanel();
          });
          terminalTabs.appendChild(tab);
        });
        const active = activeTerminalSession();
        if (active && !terminalState.activeId) terminalState.activeId = active.id;
        terminalOutput.textContent = terminalOutputText(active);
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
        terminalStdinInput.disabled = !active || !active.running;
        terminalSendInputBtn.disabled = !active || !active.running;
        terminalKillBtn.disabled = !active || !active.running;
        setTerminalStatus(active ? `${active.cwd} · ${active.running ? '运行中' : `已退出 ${active.exitCode ?? active.signal ?? ''}`}` : '没有终端会话');
      }
      async function loadTerminalSessions() {
        const data = await fetchJsonEndpoint('/terminal/sessions');
        terminalState.sessions = Array.isArray(data.sessions) ? data.sessions : [];
        if (terminalState.activeId && !terminalState.sessions.some((item) => item.id === terminalState.activeId)) terminalState.activeId = '';
        if (!terminalState.activeId && terminalState.sessions[0]) terminalState.activeId = terminalState.sessions[0].id;
        renderTerminalPanel();
      }
      async function openTerminalPanel() {
        openModal('terminalModal');
        await loadTerminalSessions();
        if (!terminalState.pollTimer) {
          terminalState.pollTimer = setInterval(() => {
            if (!$('terminalModal')?.classList.contains('open')) return;
            loadTerminalSessions().catch(() => {});
          }, 1500);
        }
      }
      async function spawnTerminal() {
        const command = String(terminalCommandInput?.value || '').trim();
        const result = await postJsonEndpoint('/terminal/spawn', { command, cwd: currentWorkdir });
        const session = result.session || result;
        terminalState.activeId = session.id || terminalState.activeId;
        if (terminalCommandInput) terminalCommandInput.value = '';
        await loadTerminalSessions();
      }
      async function sendTerminalInput() {
        const active = activeTerminalSession();
        if (!active) return;
        const data = String(terminalStdinInput?.value || '');
        if (!data) return;
        await postJsonEndpoint('/terminal/stdin', { id: active.id, data: data.endsWith('\n') ? data : `${data}\n` });
        if (terminalStdinInput) terminalStdinInput.value = '';
        await loadTerminalSessions();
      }
      async function killActiveTerminal() {
        const active = activeTerminalSession();
        if (!active || !active.running) return;
        await postJsonEndpoint('/terminal/kill', { id: active.id });
        await loadTerminalSessions();
      }
      function renderPreviewPanel(data) {
        if (!previewPanel) return;
        if (!data) {
          previewPanel.innerHTML = '<div class="quick-preview-status">输入目标后开始预览。</div>';
          return;
        }
        if (data.kind === 'website') {
          previewPanel.innerHTML = `
            <div class="quick-preview-toolbar"><div class="quick-preview-breadcrumb">${escapeHtml(data.title || data.url)}</div><span>${escapeHtml(data.contentType || '')}</span></div>
            <div class="quick-preview-website">
              <h3>${escapeHtml(data.title || data.url)}</h3>
              <p>${escapeHtml(data.url || '')}</p>
              <pre class="quick-preview-text">${escapeHtml(data.text || '')}</pre>
            </div>`;
          return;
        }
        const title = `${data.name || data.path} ${data.extension ? `· ${String(data.extension).toUpperCase()}` : ''}`;
        if (data.fileKind === 'image' && data.dataUrl) {
          previewPanel.innerHTML = `
            <div class="quick-preview-toolbar"><div class="quick-preview-breadcrumb" title="${escapeAttr(data.path)}">${escapeHtml(title)}</div><span>${escapeHtml(data.mime || '')}</span></div>
            <div class="quick-preview-image-stage"><img class="quick-preview-image" src="${escapeAttr(data.dataUrl)}" alt="${escapeAttr(data.name || 'preview')}" /></div>`;
          return;
        }
        if (typeof data.text === 'string') {
          const body = data.markdown ? renderMarkdownBlocks(data.text) : `<pre class="quick-preview-text">${escapeHtml(data.text)}</pre>`;
          previewPanel.innerHTML = `
            <div class="quick-preview-toolbar"><div class="quick-preview-breadcrumb" title="${escapeAttr(data.path)}">${escapeHtml(title)}</div><span>${escapeHtml(data.mime || '')}</span></div>
            <div class="${data.markdown ? 'quick-preview-markdown-scroll' : 'quick-preview-text-scroll'}">${body}</div>`;
          return;
        }
        previewPanel.innerHTML = `
          <div class="quick-preview-toolbar"><div class="quick-preview-breadcrumb" title="${escapeAttr(data.path)}">${escapeHtml(title)}</div><span>${escapeHtml(data.mime || '')}</span></div>
          <div class="quick-preview-document-fallback">
            <strong>${escapeHtml(data.name || data.path)}</strong>
            <p>当前格式不能直接内嵌渲染，可以用系统默认应用打开。</p>
          </div>`;
      }
      async function loadQuickPreview(target = '') {
        const value = String(target || previewTargetInput?.value || '').trim();
        if (!value) {
          renderPreviewPanel(null);
          return;
        }
        previewState.target = value;
        if (previewPanel) previewPanel.innerHTML = '<div class="quick-preview-status">正在读取预览...</div>';
        const data = await fetchJsonEndpoint(`/preview?target=${encodeURIComponent(value)}`);
        previewState.data = data;
        renderPreviewPanel(data);
      }
      async function openPreviewPanel(target = '') {
        openModal('previewModal');
        if (target && previewTargetInput) previewTargetInput.value = target;
        if (target) await loadQuickPreview(target);
        else renderPreviewPanel(previewState.data);
      }
      async function openPreviewExternal() {
        const data = previewState.data;
        if (data?.kind === 'file' && data.path) {
          await openLocalPath(data.path);
          return;
        }
        if (data?.kind === 'website' && data.url) {
          window.open(data.url, '_blank', 'noopener');
        }
      }
      async function showGitDiff() {
        await openGitPanel();
        const data = await fetchJsonEndpoint('/git/diff');
        if (!data.isRepo) {
          addSystem(`Git：当前工作区不是 Git 仓库。\n${data.workdir || currentWorkdir}\n${data.error || ''}`.trim(), true);
          return;
        }
        const files = (data.files || []).slice(0, 40).map((file) => [file.status, file.path]);
        const table = files.length ? markdownTable(['状态', '文件'], files) : '当前没有未提交文件。';
        const diff = data.diff ? `\n\n\`\`\`diff\n${data.diff}\n\`\`\`` : '';
        addBubble(`Git 状态\n\n分支：${data.branch || '(detached)'}\n仓库：${data.root}\n\n${table}${diff}`, 'agent');
      }
      function setSkillsActionError(message = '') {
        if (!skillsActionError) return;
        skillsActionError.hidden = !message;
        skillsActionError.textContent = message;
      }
      function marketplaceDisplayName(name, displayName = '') {
        if (name === 'openai-curated') return 'Codex official';
        return displayName || name || 'local';
      }
      function normalizePluginCards(raw) {
        const result = endpointResult(raw || {});
        const catalog = result.catalog || result;
        const installed = result.installed || {};
        const featured = new Set(catalog.featuredPluginIds || []);
        const cards = new Map();
        const addMarketplace = (marketplace, installedSource = false) => {
          const marketName = marketplace.name || 'local';
          const marketDisplay = marketplaceDisplayName(marketName, marketplace.interface?.displayName);
          (marketplace.plugins || []).forEach((plugin) => {
            if (marketName === 'openai-bundled' && !plugin.installed && !plugin.enabled) return;
            const id = plugin.id || `${plugin.name}@${marketName}`;
            const previous = cards.get(id) || {};
            cards.set(id, {
              ...previous,
              id,
              name: plugin.interface?.displayName || plugin.name || id,
              pluginName: plugin.name || id,
              description: plugin.interface?.shortDescription || plugin.name || '',
              longDescription: plugin.interface?.longDescription || '',
              marketplaceName: marketName,
              marketplaceDisplayName: marketDisplay,
              marketplacePath: marketplace.path || null,
              installed: Boolean(plugin.installed || previous.installed || installedSource),
              enabled: Boolean(plugin.enabled ?? previous.enabled),
              installPolicy: plugin.installPolicy || previous.installPolicy || 'AVAILABLE',
              authPolicy: plugin.authPolicy || previous.authPolicy || 'ON_USE',
              category: plugin.interface?.category || previous.category || 'Coding',
              brandColor: plugin.interface?.brandColor || previous.brandColor || '',
              icon: plugin.interface?.logoUrl || plugin.interface?.composerIconUrl || plugin.interface?.logo || plugin.interface?.composerIcon || previous.icon || '',
              featured: featured.has(id) || previous.featured === true
            });
          });
        };
        (installed.marketplaces || []).forEach((marketplace) => addMarketplace(marketplace, true));
        (catalog.marketplaces || []).forEach((marketplace) => addMarketplace(marketplace, false));
        return [...cards.values()].sort((a, b) => Number(b.installed) - Number(a.installed) || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      }
      function skillAvatarHtml(item) {
        const name = String(item.name || item.id || '?');
        const color = item.brandColor || '';
        const icon = item.icon || '';
        if (/^(https?:|data:|blob:|asset:)/i.test(icon)) {
          return `<span class="skills-avatar skills-avatar-image"><img src="${escapeAttr(icon)}" alt="" /></span>`;
        }
        return `<span class="skills-avatar" ${color ? `style="background:${escapeAttr(color)}"` : ''}>${escapeHtml(name.slice(0, 1).toUpperCase())}</span>`;
      }
      function skillsQueryMatch(item) {
        const query = skillsState.query.trim().toLowerCase();
        if (!query) return true;
        return `${item.name || ''}\n${item.description || ''}\n${item.path || ''}\n${item.marketplaceDisplayName || ''}`.toLowerCase().includes(query);
      }
      function pluginVisible(plugin) {
        if (!skillsQueryMatch(plugin)) return false;
        if (skillsState.marketplace !== 'all' && plugin.marketplaceName !== skillsState.marketplace) return false;
        if (skillsState.pluginStatus === 'installed') return plugin.installed;
        if (skillsState.pluginStatus === 'available') return !plugin.installed && plugin.installPolicy !== 'NOT_AVAILABLE';
        return true;
      }
      function renderSkillsTabs() {
        skillsTabPlugins?.classList.toggle('skills-mode-tab-active', skillsState.activeTab === 'plugins');
        skillsTabInstalled?.classList.toggle('skills-mode-tab-active', skillsState.activeTab === 'skills');
        if (skillsManagementTabs) skillsManagementTabs.hidden = !skillsState.managerOpen;
        document.querySelectorAll('[data-management-tab]').forEach((button) => {
          button.classList.toggle('skills-manager-tab-active', button.dataset.managementTab === skillsState.managementTab);
        });
        if (skillsMarketplaceFilterWrap) skillsMarketplaceFilterWrap.hidden = skillsState.managerOpen || skillsState.activeTab !== 'plugins';
        if (skillsPluginStatusWrap) skillsPluginStatusWrap.hidden = skillsState.managerOpen || skillsState.activeTab !== 'plugins';
        if (skillsManageBtn) skillsManageBtn.textContent = skillsState.managerOpen ? '返回市场' : '管理';
      }
      function renderMarketplaceOptions(plugins) {
        if (!skillsMarketplaceFilter) return;
        const current = skillsState.marketplace;
        const options = new Map([['all', '全部市场']]);
        plugins.forEach((plugin) => options.set(plugin.marketplaceName, plugin.marketplaceDisplayName));
        skillsMarketplaceFilter.innerHTML = [...options.entries()].map(([id, label]) => `<option value="${escapeAttr(id)}">${escapeHtml(label)}</option>`).join('');
        skillsMarketplaceFilter.value = options.has(current) ? current : 'all';
        skillsState.marketplace = skillsMarketplaceFilter.value;
      }
      function renderPluginCard(plugin, manage = false) {
        const canInstall = !plugin.installed && plugin.installPolicy !== 'NOT_AVAILABLE';
        const action = plugin.installed
          ? `<button class="skills-manager-icon-button" data-skills-action="toggle-plugin" data-plugin-id="${escapeAttr(plugin.id)}">${plugin.enabled ? '停用' : '启用'}</button><button class="skills-manager-icon-button skills-danger-icon-button" data-skills-action="uninstall-plugin" data-plugin-id="${escapeAttr(plugin.id)}">卸载</button>`
          : `<button class="skills-manager-icon-button" ${canInstall ? '' : 'disabled'} data-skills-action="install-plugin" data-plugin-id="${escapeAttr(plugin.id)}">安装</button>`;
        return `<article class="${manage ? 'skills-manager-row' : 'plugin-row'}" title="${escapeAttr(plugin.longDescription || plugin.description || '')}">
          ${skillAvatarHtml(plugin)}
          <div class="${manage ? 'skills-manager-row-copy' : 'plugin-row-copy'}">
            <strong>${escapeHtml(plugin.name)}</strong>
            <p>${escapeHtml(plugin.description || plugin.marketplaceDisplayName || '')}</p>
          </div>
          <div class="skills-manager-row-actions">${action}</div>
        </article>`;
      }
      function renderSkillRow(skill, manage = false) {
        const canDelete = skill.scope === 'user' || skill.scope === 'repo';
        return `<article class="${manage ? 'skills-manager-row' : 'skills-card'}" title="${escapeAttr(skill.path)}">
          ${skillAvatarHtml(skill)}
          <div class="${manage ? 'skills-manager-row-copy' : 'skills-card-copy'}">
            <div class="skills-card-title-row"><strong>${escapeHtml(skill.name)}</strong><span class="skills-scope-pill">${escapeHtml(skill.scope || skill.source || '')}</span></div>
            <p>${escapeHtml(skill.description || '')}</p>
          </div>
          <div class="skills-card-actions">
            <button class="skills-manager-icon-button" data-skills-action="toggle-skill" data-skill-path="${escapeAttr(skill.path)}">${skill.enabled ? '停用' : '启用'}</button>
            <button class="skills-manager-icon-button skills-danger-icon-button" ${canDelete ? '' : 'disabled'} data-skills-action="delete-skill" data-skill-path="${escapeAttr(skill.path)}">删除</button>
          </div>
        </article>`;
      }
      function renderManagedAppRow(app) {
        return `<article class="skills-manager-row">
          <span class="skills-avatar">${escapeHtml(String(app.name || app.id || 'A').slice(0, 1).toUpperCase())}</span>
          <div class="skills-manager-row-copy"><strong>${escapeHtml(app.name || app.id)}</strong><p>${escapeHtml(app.description || app.id || '')}</p></div>
          <div class="skills-manager-row-actions"><button class="skills-manager-icon-button" data-skills-action="toggle-app" data-app-id="${escapeAttr(app.id)}">${app.isEnabled === false ? '启用' : '停用'}</button></div>
        </article>`;
      }
      function renderManagedMcpRow(server) {
        return `<article class="skills-manager-row">
          <span class="skills-manager-connector-icon">⌁</span>
          <div class="skills-manager-row-copy"><strong>${escapeHtml(server.name || server.id)}</strong><p>${escapeHtml(`${server.type || 'runtime'} · ${(server.envKeys || []).join(', ') || server.command || server.url || ''}`)}</p></div>
          <div class="skills-manager-row-actions">
            <button class="skills-manager-icon-button" data-skills-action="open-mcp">配置</button>
            <button class="skills-manager-icon-button" data-skills-action="toggle-mcp" data-mcp-id="${escapeAttr(server.id || server.name)}">${server.enabled === false ? '启用' : '停用'}</button>
          </div>
        </article>`;
      }
      function renderSkillsPanel() {
        if (!skillsPanel) return;
        renderSkillsTabs();
        setSkillsActionError(skillsState.error || '');
        const skills = (skillsState.skills?.skills || []).filter(skillsQueryMatch);
        const plugins = normalizePluginCards(skillsState.plugins).filter(pluginVisible);
        skillsState.pluginMap = new Map(normalizePluginCards(skillsState.plugins).map((plugin) => [plugin.id, plugin]));
        renderMarketplaceOptions(normalizePluginCards(skillsState.plugins));
        if (skillsState.managerOpen) {
          if (skillsState.managementTab === 'plugins') {
            const installed = normalizePluginCards(skillsState.plugins).filter((plugin) => plugin.installed && skillsQueryMatch(plugin));
            skillsPanel.innerHTML = installed.length ? installed.map((plugin) => renderPluginCard(plugin, true)).join('') : '<div class="skills-empty-state">没有已安装插件。</div>';
            return;
          }
          if (skillsState.managementTab === 'apps') {
            const appsResult = endpointResult(skillsState.apps || {});
            const apps = (appsResult.data || []).filter(skillsQueryMatch);
            skillsPanel.innerHTML = apps.length ? apps.map(renderManagedAppRow).join('') : '<div class="skills-empty-state">没有可管理 App，或 app-server 未返回数据。</div>';
            return;
          }
          if (skillsState.managementTab === 'mcp') {
            const servers = (skillsState.mcp?.servers || []).filter(skillsQueryMatch);
            skillsPanel.innerHTML = servers.length ? servers.map(renderManagedMcpRow).join('') : '<div class="skills-empty-state">没有 MCP 服务器。</div>';
            return;
          }
          skillsPanel.innerHTML = skills.length ? skills.map((skill) => renderSkillRow(skill, true)).join('') : '<div class="skills-empty-state">没有已安装技能。</div>';
          return;
        }
        if (skillsState.activeTab === 'skills') {
          const errors = skillsState.skills?.scanErrors || [];
          const banner = errors.length ? `<div class="skills-banner skills-banner-warning">${escapeHtml(errors[0].path)}：${escapeHtml(errors[0].message)}</div>` : '';
          skillsPanel.innerHTML = `${banner}<div class="skills-grid">${skills.length ? skills.map((skill) => renderSkillRow(skill, false)).join('') : '<div class="skills-empty-state">没有发现 SKILL.md。</div>'}</div>`;
          return;
        }
        const sections = new Map();
        plugins.forEach((plugin) => {
          const section = plugin.featured ? 'Featured' : (plugin.category || 'Coding');
          if (!sections.has(section)) sections.set(section, []);
          sections.get(section).push(plugin);
        });
        skillsPanel.innerHTML = sections.size
          ? [...sections.entries()].map(([section, items]) => `<section class="plugin-market-section"><h2>${escapeHtml(section)}</h2><div class="plugin-market-list">${items.map((plugin) => renderPluginCard(plugin)).join('')}</div></section>`).join('')
          : '<div class="skills-empty-state">没有返回插件条目；检查 app-server 或插件市场配置。</div>';
      }
      async function loadSkillsPanel() {
        if (skillsPanel) skillsPanel.innerHTML = '<div class="skills-empty-state">正在读取 Skills 与插件...</div>';
        const read = async (endpoint) => fetchJsonEndpoint(endpoint).catch((error) => ({ ok: false, error: error.message || String(error) }));
        const [skills, plugins, apps, mcp] = await Promise.all([
          read('/skills'),
          read('/plugins'),
          read('/apps'),
          read('/mcp')
        ]);
        skillsState.skills = skills;
        skillsState.plugins = plugins;
        skillsState.apps = apps;
        skillsState.mcp = mcp;
        skillsState.error = [skills, plugins, apps, mcp].filter((item) => item?.ok === false).map((item) => item.error).filter(Boolean).join('；');
        renderSkillsPanel();
      }
      async function openSkillsPanel() {
        openModal('skillsModal');
        await loadSkillsPanel();
      }
      async function handleSkillsAction(button) {
        const action = button.dataset.skillsAction;
        setSkillsActionError('');
        if (action === 'open-mcp') {
          await openMcpPanel();
          return;
        }
        if (action === 'toggle-skill') {
          const skill = (skillsState.skills?.skills || []).find((item) => item.path === button.dataset.skillPath);
          if (!skill) return;
          skillsState.skills = await postJsonEndpoint('/skills/toggle', { path: skill.path, enabled: !skill.enabled });
          renderSkillsPanel();
          return;
        }
        if (action === 'delete-skill') {
          const skillPath = button.dataset.skillPath || '';
          if (!confirm(`删除技能目录？\n${skillPath}`)) return;
          skillsState.skills = await postJsonEndpoint('/skills/delete', { path: skillPath });
          renderSkillsPanel();
          return;
        }
        if (action === 'toggle-mcp') {
          const server = (skillsState.mcp?.servers || []).find((item) => (item.id || item.name) === button.dataset.mcpId);
          if (!server) return;
          skillsState.mcp = await postJsonEndpoint('/mcp/toggle', { id: server.id || server.name, enabled: server.enabled === false });
          renderSkillsPanel();
          return;
        }
        if (action === 'toggle-app') {
          await postJsonEndpoint('/apps/toggle', { appId: button.dataset.appId, enabled: button.textContent === '启用' });
          skillsState.apps = endpointResult(await fetchJsonEndpoint('/apps'));
          await loadSkillsPanel();
          return;
        }
        const plugin = skillsState.pluginMap?.get(button.dataset.pluginId);
        if (!plugin) return;
        if (action === 'install-plugin') {
          const payload = plugin.marketplacePath ? { marketplacePath: plugin.marketplacePath, pluginName: plugin.pluginName } : { remoteMarketplaceName: plugin.marketplaceName, pluginName: plugin.pluginName };
          await postJsonEndpoint('/plugins/install', payload);
        } else if (action === 'uninstall-plugin') {
          if (!confirm(`卸载插件 ${plugin.name}？`)) return;
          await postJsonEndpoint('/plugins/uninstall', { pluginId: plugin.id });
        } else if (action === 'toggle-plugin') {
          await postJsonEndpoint('/plugins/toggle', { pluginId: plugin.id, enabled: !plugin.enabled });
        }
        await loadSkillsPanel();
      }
      async function showSkills() {
        await openSkillsPanel();
      }
      function mcpDefaultForm(server = null) {
        return {
          originalId: server?.id || '',
          id: server?.id || '',
          name: server && server.name !== server.id ? server.name : '',
          type: server?.type || 'stdio',
          command: server?.command || '',
          argsText: (server?.args || []).join('\n'),
          cwd: server?.cwd || '',
          envText: Object.entries(server?.env || {}).map(([k, v]) => `${k}=${v}`).join('\n'),
          envVarsText: (server?.envVars || []).map((item) => typeof item === 'string' ? item : JSON.stringify(item)).join('\n'),
          url: server?.url || '',
          bearerTokenEnvVar: server?.bearerTokenEnvVar || '',
          httpHeadersText: Object.entries(server?.httpHeaders || {}).map(([k, v]) => `${k}=${v}`).join('\n'),
          envHttpHeadersText: Object.entries(server?.envHttpHeaders || {}).map(([k, v]) => `${k}=${v}`).join('\n'),
          enabled: server?.enabled !== false
        };
      }
      function mcpField(name, label, value = '', textarea = false) {
        const input = textarea
          ? `<textarea class="mcp-form-input" name="${escapeAttr(name)}" rows="3">${escapeHtml(value)}</textarea>`
          : `<input class="mcp-form-input" name="${escapeAttr(name)}" value="${escapeAttr(value)}" />`;
        return `<label class="mcp-form-field"><span class="mcp-form-label">${escapeHtml(label)}</span>${input}</label>`;
      }
      function renderMcpForm(form) {
        const isStdio = form.type === 'stdio';
        return `<section class="mcp-editor-page">
          <button class="mcp-return-button" data-mcp-action="cancel-edit">返回</button>
          <form class="mcp-editor-form" id="mcpServerForm">
            <div class="mcp-editor-card mcp-editor-card-name">
              ${mcpField('id', '名称', form.id)}
              <label class="mcp-form-field"><span class="mcp-form-label">传输</span><select class="mcp-form-input" name="type"><option value="stdio" ${isStdio ? 'selected' : ''}>STDIO</option><option value="http" ${form.type === 'http' ? 'selected' : ''}>HTTP</option><option value="sse" ${form.type === 'sse' ? 'selected' : ''}>SSE</option></select></label>
              <label class="mcp-form-field"><span class="mcp-form-label">启用</span><select class="mcp-form-input" name="enabled"><option value="true" ${form.enabled ? 'selected' : ''}>启用</option><option value="false" ${!form.enabled ? 'selected' : ''}>停用</option></select></label>
              <input type="hidden" name="originalId" value="${escapeAttr(form.originalId || form.id)}" />
            </div>
            <div class="mcp-editor-card">
              ${mcpField('name', '显示名', form.name)}
              ${isStdio ? mcpField('command', '启动命令', form.command) : mcpField('url', 'URL', form.url)}
              ${isStdio ? mcpField('argsText', '参数（每行一个）', form.argsText, true) : mcpField('bearerTokenEnvVar', 'Bearer token 环境变量', form.bearerTokenEnvVar)}
              ${isStdio ? mcpField('envText', '环境变量 KEY=value', form.envText, true) : mcpField('httpHeadersText', 'HTTP headers KEY=value', form.httpHeadersText, true)}
              ${isStdio ? mcpField('envVarsText', '继承环境变量（每行一个）', form.envVarsText, true) : mcpField('envHttpHeadersText', '环境变量 headers KEY=value', form.envHttpHeadersText, true)}
              ${isStdio ? mcpField('cwd', '工作目录', form.cwd) : ''}
            </div>
            ${mcpState.error ? `<div class="mcp-form-submit-error">${escapeHtml(mcpState.error)}</div>` : ''}
            <div class="mcp-form-actions"><button class="primary" type="submit">${mcpState.saving ? '保存中...' : '保存'}</button></div>
          </form>
        </section>`;
      }
      function renderMcpPanel() {
        if (!mcpPanel) return;
        if (mcpState.editing) {
          mcpPanel.innerHTML = renderMcpForm(mcpState.editing);
          return;
        }
        const data = mcpState.data || {};
        const servers = data.servers || [];
        const shared = data.sharedPool || {};
        mcpPanel.innerHTML = `
          <section class="settings-card mcp-shared-pool-card">
            <div class="mcp-shared-pool-row"><div class="mcp-shared-pool-copy"><strong>STDIO 共享池</strong><p class="settings-note">按运行环境保存 MCP stdio 共享池开关。</p></div><button class="${shared.windowsNative ? 'settings-toggle settings-toggle-on' : 'settings-toggle'}" role="switch" aria-checked="${shared.windowsNative ? 'true' : 'false'}" data-mcp-action="toggle-shared"><span class="settings-toggle-knob"></span></button></div>
            <p class="settings-note settings-note-pad">${escapeHtml(data.configPath || '')}</p>
          </section>
          <section class="mcp-server-section">
            <div class="mcp-server-section-head"><strong>服务器</strong><button class="mcp-add-server-button" data-mcp-action="add-server">+ 添加服务器</button></div>
            ${mcpState.error ? `<p class="settings-status-note settings-status-note-error">${escapeHtml(mcpState.error)}</p>` : ''}
            <div class="settings-card mcp-server-list-card">
              ${servers.length ? servers.map((server) => `<div class="mcp-server-row">
                <div><strong class="mcp-server-name">${escapeHtml(server.name || server.id)}</strong><p class="settings-note">${escapeHtml(server.command || server.url || server.type || '')}</p></div>
                <div class="mcp-server-actions"><button class="mcp-icon-button" data-mcp-action="edit-server" data-mcp-id="${escapeAttr(server.id)}">编辑</button><button class="${server.enabled === false ? 'settings-toggle' : 'settings-toggle settings-toggle-on'}" role="switch" aria-checked="${server.enabled === false ? 'false' : 'true'}" data-mcp-action="toggle-server" data-mcp-id="${escapeAttr(server.id)}"><span class="settings-toggle-knob"></span></button><button class="mcp-icon-button skills-danger-icon-button" data-mcp-action="delete-server" data-mcp-id="${escapeAttr(server.id)}">删除</button></div>
              </div>`).join('') : '<div class="settings-empty">没有自定义 MCP 服务器。</div>'}
            </div>
          </section>`;
      }
      async function loadMcpPanel() {
        if (mcpPanel) mcpPanel.innerHTML = '<div class="skills-empty-state">正在读取 MCP 配置...</div>';
        mcpState.data = await fetchJsonEndpoint('/mcp');
        mcpState.error = '';
        renderMcpPanel();
      }
      async function openMcpPanel() {
        openModal('mcpModal');
        await loadMcpPanel();
      }
      async function handleMcpAction(button) {
        const action = button.dataset.mcpAction;
        mcpState.error = '';
        if (action === 'add-server') {
          mcpState.editing = mcpDefaultForm();
          renderMcpPanel();
          return;
        }
        if (action === 'cancel-edit') {
          mcpState.editing = null;
          renderMcpPanel();
          return;
        }
        if (action === 'edit-server') {
          const server = (mcpState.data?.servers || []).find((item) => item.id === button.dataset.mcpId);
          mcpState.editing = mcpDefaultForm(server);
          renderMcpPanel();
          return;
        }
        if (action === 'toggle-server') {
          const server = (mcpState.data?.servers || []).find((item) => item.id === button.dataset.mcpId);
          if (!server) return;
          mcpState.data = await postJsonEndpoint('/mcp/toggle', { id: server.id, enabled: server.enabled === false });
          renderMcpPanel();
          return;
        }
        if (action === 'delete-server') {
          const id = button.dataset.mcpId || '';
          if (!confirm(`删除 MCP 服务器 ${id}？`)) return;
          mcpState.data = await deleteJsonEndpoint('/mcp/server', { id });
          renderMcpPanel();
          return;
        }
        if (action === 'toggle-shared') {
          const enabled = !(mcpState.data?.sharedPool?.windowsNative === true);
          const result = await postJsonEndpoint('/mcp/shared-pool', { agentEnvironment: 'windowsNative', enabled });
          mcpState.data = { ...mcpState.data, sharedPool: result.settings };
          renderMcpPanel();
        }
      }
      async function saveMcpForm(event) {
        event.preventDefault();
        const form = new FormData(event.target);
        const payload = Object.fromEntries(form.entries());
        payload.enabled = payload.enabled === 'true';
        mcpState.saving = true;
        renderMcpPanel();
        try {
          mcpState.data = await postJsonEndpoint('/mcp/server', payload);
          mcpState.editing = null;
          mcpState.error = '';
        } catch (error) {
          mcpState.error = error.message || String(error);
        } finally {
          mcpState.saving = false;
          renderMcpPanel();
        }
      }
      async function showMcp() {
        await openMcpPanel();
      }
      async function showApps() {
        const result = endpointResult(await fetchJsonEndpoint('/apps'));
        const rows = (result.data || []).map((app) => [
          app.name || app.id,
          app.isEnabled ? 'enabled' : 'disabled',
          app.isAccessible ? 'accessible' : 'locked',
          (app.pluginDisplayNames || []).join(', '),
          app.description || ''
        ]);
        if (!rows.length) {
          addSystem('Apps：当前账号或配置没有返回可用 app。');
          return;
        }
        addBubble(`Apps\n\n${markdownTable(['名称', '启用', '可访问', '插件', '说明'], rows)}`, 'agent');
      }
      function pluginRows(marketplaces = []) {
        const rows = [];
        marketplaces.forEach((marketplace) => {
          (marketplace.plugins || []).forEach((plugin) => {
            rows.push([
              plugin.name || plugin.id,
              plugin.installed ? 'installed' : 'available',
              plugin.enabled ? 'enabled' : 'disabled',
              marketplace.name || '',
              plugin.localVersion || ''
            ]);
          });
        });
        return rows;
      }
      async function showPlugins() {
        const result = endpointResult(await fetchJsonEndpoint('/plugins'));
        const rows = [
          ...pluginRows(result.installed?.marketplaces || []),
          ...pluginRows(result.catalog?.marketplaces || [])
        ];
        if (!rows.length) {
          const errors = [...(result.installed?.marketplaceLoadErrors || []), ...(result.catalog?.marketplaceLoadErrors || [])];
          addSystem(`Plugins：没有返回插件条目。${errors.length ? '\n' + JSON.stringify(errors) : ''}`.trim());
          return;
        }
        addBubble(`Plugins\n\n${markdownTable(['名称', '安装', '启用', '市场', '版本'], rows)}`, 'agent');
      }
      async function initAgents() {
        const result = endpointResult(await postJsonEndpoint('/project/init-agents'));
        addSystem(result.created ? `已创建 ${result.path}` : `AGENTS.md 已存在：${result.path}`);
      }
      async function startReview(argumentsText = '') {
        const result = endpointResult(await postJsonEndpoint('/thread/review', { argumentsText }));
        addSystem(`已发起 Review：${result.reviewThreadId || currentResumePath || '当前线程'}`);
      }
      async function compactThread() {
        await postJsonEndpoint('/thread/compact');
        addSystem('已请求压缩当前线程上下文。');
      }
      async function forkThread() {
        const result = endpointResult(await postJsonEndpoint('/thread/fork'));
        if (result.thread?.path) currentResumePath = result.thread.path;
        if (result.thread?.cwd) currentWorkdir = result.thread.cwd;
        addSystem(`已创建分支线程：${result.thread?.path || result.thread?.id || '当前线程'}`);
        exposeDebugState();
      }
      async function handleThreadGoal(argumentsText = '') {
        const data = argumentsText
          ? await postJsonEndpoint('/thread/goal', { argumentsText })
          : await fetchJsonEndpoint('/thread/goal');
        const result = endpointResult(data);
        addBubble('```json\n' + JSON.stringify(result, null, 2) + '\n```', 'agent');
      }
      async function stopThreadWork() {
        if (codexRunning) {
          await stopCurrentTurn();
          return;
        }
        await postJsonEndpoint('/thread/background-terminals/clean');
        addSystem('已清理当前线程后台终端。');
      }
      async function showRealtime() {
        const result = endpointResult(await fetchJsonEndpoint('/realtime/voices'));
        const voices = Array.isArray(result.voices) ? result.voices : Array.isArray(result) ? result : [];
        if (!voices.length) {
          addBubble('```json\n' + JSON.stringify(result, null, 2) + '\n```', 'agent');
          return;
        }
        const rows = voices.map((voice) => [voice.name || voice.id || String(voice), voice.id || '', voice.description || '']);
        addBubble(`Realtime Voices\n\n${markdownTable(['名称', 'ID', '说明'], rows)}`, 'agent');
      }
      async function logoutAccount() {
        if (!confirm('退出当前 Codex 账号？')) return;
        await postJsonEndpoint('/account/logout');
        currentResumePath = null;
        codexRunning = false;
        addSystem('已退出当前 Codex 账号。');
      }
      async function setupSandbox() {
        const result = endpointResult(await postJsonEndpoint('/windows-sandbox/setup-default'));
        addBubble('```json\n' + JSON.stringify(result, null, 2) + '\n```', 'agent');
      }
      async function toggleFastMode(argumentsText = '') {
        await loadConfig();
        const arg = String(argumentsText || '').trim().toLowerCase();
        let nextTier;
        if (['on', 'true', '1', 'enable', 'enabled'].includes(arg)) nextTier = 'fast';
        else if (['off', 'false', '0', 'disable', 'disabled'].includes(arg)) nextTier = '';
        else nextTier = currentServiceTier() === 'fast' ? '' : 'fast';
        await selectServiceTier(nextTier);
      }
      async function selectServiceTier(tier = '') {
        await loadConfig();
        const nextTier = normalizeServiceTier(tier);
        const payload = {
          ...currentConfig,
          service_tier: nextTier
        };
        const response = await fetch('/config', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
        currentConfig = payload;
        selectedServiceTier = nextTier;
        serviceTierOverrideActive = true;
        updateComposerMenuState();
        setComposerSpeedMenuOpen(false);
        addSystem(nextTier === 'fast'
          ? '已开启 Fast 模式，本次发送将使用 fast service tier。'
          : '已选择 Standard 速度，本次发送使用默认速度。');
      }
      async function applyPermissionLevel(level = 'default') {
        await loadConfig();
        const preset = permissionLevels[level] || permissionLevels.default;
        const payload = {
          ...currentConfig,
          approval_policy: preset.approval_policy,
          sandbox_mode: preset.sandbox_mode,
          approvals_reviewer: preset.approvals_reviewer
        };
        const response = await fetch('/config', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
        currentConfig = payload;
        updateComposerMenuState();
        closeComposerMoreMenu();
        addSystem(`已切换权限：${preset.label}。`);
      }
      async function openPermissionMenu() {
        await loadConfig();
        setComposerMoreMenuOpen(true);
        composerMoreMenu?.querySelector('[data-permission-level]')?.focus();
      }
      async function runSlashCommand(item) {
        if (!item || item.disabled) {
          addSystem(item?.disabledReason || '这条命令当前不可用。', true);
          return;
        }
        if (item.action === 'openModel' || item.action === 'openSettings') {
          await loadConfig();
          openModal('settingsModal');
          setTimeout(() => $('cfgModel').focus(), 0);
          return;
        }
        if (item.action === 'openPermissions') {
          await openPermissionMenu();
          return;
        }
        if (item.action === 'createThread') {
          await startNewChat();
          return;
        }
        if (item.action === 'openResume') {
          openMobileSidebar();
          sideFilter.focus();
          addSystem('已打开历史会话列表，可搜索并点击恢复线程。');
          return;
        }
        if (item.action === 'showStatus') {
          await showStatusDetail();
          return;
        }
        if (item.action === 'showDebugConfig') {
          await loadConfig();
          addBubble('```json\n' + JSON.stringify(currentConfig, null, 2) + '\n```', 'agent');
          return;
        }
        if (item.action === 'showDiff') {
          await showGitDiff();
          return;
        }
        if (item.action === 'initAgents') {
          await initAgents();
          return;
        }
        if (item.action === 'startReview') {
          await startReview(item.argumentsText);
          return;
        }
        if (item.action === 'compactThread') {
          await compactThread();
          return;
        }
        if (item.action === 'forkThread') {
          await forkThread();
          return;
        }
        if (item.action === 'threadGoal') {
          await handleThreadGoal(item.argumentsText);
          return;
        }
        if (item.action === 'stopThreadWork') {
          await stopThreadWork();
          return;
        }
        if (item.action === 'showRealtime') {
          await showRealtime();
          return;
        }
        if (item.action === 'logoutAccount') {
          await logoutAccount();
          return;
        }
        if (item.action === 'setupSandbox') {
          await setupSandbox();
          return;
        }
        if (item.action === 'toggleFast') {
          await toggleFastMode(item.argumentsText);
          return;
        }
        if (item.action === 'togglePlan') {
          togglePlanMode(item.argumentsText);
          return;
        }
        addSystem(`/${item.id} 已在矩阵中登记，但当前还没有可执行 WebUI 实现。`, true);
      }
      async function selectSlashCommand(index = slashSelectedIndex) {
        const item = slashPaletteItems[index];
        if (!item) return false;
        try {
          await runSlashCommand(item);
        } catch (error) {
          addSystem(`命令执行失败：${error.message || error}`, true);
        }
        return true;
      }
      function sessionTitle(session) {
        return session.title || session.name || fmtDate(session.mtimeMs) || '未命名会话';
      }
      function sessionTimeMs(session) {
        return Number(session?.last_used || session?.mtimeMs || 0);
      }
      function relativeTime(ms) {
        const time = Number(ms || 0);
        if (!time) return '';
        const diff = Math.max(0, Date.now() - time);
        const minute = 60 * 1000;
        const hour = 60 * minute;
        const day = 24 * hour;
        if (diff < minute) return '刚刚';
        if (diff < hour) return `${Math.max(1, Math.floor(diff / minute))} 分钟前`;
        if (diff < day) return `${Math.max(1, Math.floor(diff / hour))} 小时前`;
        if (diff < 2 * day) return '昨天';
        if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;
        return fmtDate(time);
      }
      function relativeTimeMarkup(ms) {
        const time = Number(ms || 0);
        if (!time) return '';
        return `<span class="relative-time" data-relative-ms="${time}">${escapeHtml(relativeTime(time))}</span>`;
      }
      function refreshRelativeTimes() {
        document.querySelectorAll('[data-relative-ms]').forEach((node) => {
          node.textContent = relativeTime(Number(node.getAttribute('data-relative-ms') || 0));
        });
      }
      function sessionSub(session) {
        const cwd = session.cwd ? session.cwd.split(/[\\/]/).filter(Boolean).pop() : '';
        return [relativeTime(sessionTimeMs(session)), cwd, toKB(session.size)].filter(Boolean).join(' · ');
      }
      function sessionSubMarkup(session) {
        const cwd = session.cwd ? session.cwd.split(/[\\/]/).filter(Boolean).pop() : '';
        return [relativeTimeMarkup(sessionTimeMs(session)), cwd ? escapeHtml(cwd) : '', toKB(session.size) ? escapeHtml(toKB(session.size)) : ''].filter(Boolean).join(' · ');
      }
      function normalizeSessionPath(value) {
        return String(value || '').replace(/^\\\\\?\\/, '').replace(/\\/g, '/').toLowerCase();
      }
      function sameSessionPath(a, b) {
        return Boolean(a && b && normalizeSessionPath(a) === normalizeSessionPath(b));
      }
      function sessionPathForStreamingEvent(data = {}) {
        return data.resume_path || data.sessionPath || data.path || activeStreamSessionPath || activeRuntimeResumePath || currentResumePath || '';
      }
      function shouldRenderStreamingEvent(sessionPath) {
        return !sessionPath || !currentResumePath || sameSessionPath(sessionPath, currentResumePath);
      }
      function projectName(workdir) {
        return String(workdir || '').split(/[\\/]/).filter(Boolean).pop() || '新对话';
      }
      function sameProjectPath(a, b) {
        return Boolean(a && b && normalizeSessionPath(a) === normalizeSessionPath(b));
      }
      function readExpandedProjectPaths() {
        try {
          const parsed = JSON.parse(safeLocalGet('plusExpandedProjects', '[]') || '[]');
          if (!Array.isArray(parsed)) throw new Error('Expanded project store is not an array');
          return parsed.filter((item) => typeof item === 'string' && item);
        } catch {
          safeLocalSet('plusExpandedProjects', '[]');
          return [];
        }
      }
      function saveExpandedProjectPaths() {
        safeLocalSet('plusExpandedProjects', JSON.stringify([...expandedProjectPaths]));
      }
      function readHiddenProjectPaths() {
        try {
          const parsed = JSON.parse(safeLocalGet('plusHiddenProjectRoots', '[]') || '[]');
          if (!Array.isArray(parsed)) throw new Error('Hidden project store is not an array');
          return parsed.filter((item) => typeof item === 'string' && item);
        } catch {
          safeLocalSet('plusHiddenProjectRoots', '[]');
          return [];
        }
      }
      function saveHiddenProjectPaths() {
        safeLocalSet('plusHiddenProjectRoots', JSON.stringify([...hiddenProjectPaths]));
      }
      function restoreWorkspaceRoot(workdir) {
        const key = normalizeSessionPath(workdir);
        if (!hiddenProjectPaths.delete(key)) return;
        saveHiddenProjectPaths();
      }
      async function removeWorkspaceRoot(project) {
        if (!project?.workdir) return;
        if (sameProjectPath(project.workdir, currentProjectRootPath || currentWorkdir)) {
          addSystem('当前项目正在使用，先切换到其他项目后再从列表移除。', true);
          return;
        }
        const response = await fetch('/project/root', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ path: project.workdir }) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
        const key = normalizeSessionPath(project.workdir);
        hiddenProjectPaths.delete(key);
        saveHiddenProjectPaths();
        projectRootsCache = projectRootsCache.filter((root) => !sameProjectPath(root.path, project.workdir));
        projectsCache = projectsCache.filter((item) => !sameProjectPath(item.workdir, project.workdir));
        renderProjects();
        await loadProjects();
      }
      function projectRootHidden(project) {
        if (!project?.workdir) return false;
        if (sameProjectPath(project.workdir, currentProjectRootPath || currentWorkdir)) return false;
        return hiddenProjectPaths.has(normalizeSessionPath(project.workdir));
      }
      function projectDisplayName(workdir) {
        const root = projectRootsCache.find((item) => sameProjectPath(item.path, workdir));
        return root?.name || projectName(workdir);
      }
      function projectThreadsForWorkdir(workdir, entries = []) {
        const byPath = new Map(sessionsCache.map((session) => [normalizeSessionPath(session.path), session]));
        const seen = new Set();
        const threads = [];
        (entries || []).forEach((entry) => {
          const path = entry?.resume_path || entry?.path || '';
          if (!path || seen.has(normalizeSessionPath(path))) return;
          seen.add(normalizeSessionPath(path));
          const session = byPath.get(normalizeSessionPath(path));
          threads.push(session || {
            path,
            name: path.split(/[\\/]/).pop() || path,
            cwd: entry.workdir || workdir,
            mtimeMs: Number(entry.last_used || 0),
            size: 0,
            messageCount: 0
          });
        });
        sessionsCache.forEach((session) => {
          if (!(sameProjectPath(session.projectRoot, workdir) || sameProjectPath(session.cwd, workdir)) || seen.has(normalizeSessionPath(session.path))) return;
          seen.add(normalizeSessionPath(session.path));
          threads.push(session);
        });
        return threads.sort((a, b) => (b.mtimeMs || 0) - (a.mtimeMs || 0));
      }
      function projectMatchesQuery(project, query) {
        if (!query) return true;
        const haystack = `${project.workdir} ${projectDisplayName(project.workdir)}`.toLowerCase();
        if (haystack.includes(query)) return true;
        return projectThreadsForWorkdir(project.workdir, project.entries).some((thread) => (
          `${thread.path || ''} ${sessionTitle(thread)} ${thread.cwd || ''}`.toLowerCase().includes(query)
        ));
      }
      function projectLatestMs(project, threads = projectThreadsForWorkdir(project.workdir, project.entries)) {
        return threads.reduce((latest, thread) => Math.max(latest, Number(thread.last_used || thread.mtimeMs || 0)), 0);
      }
      function projectCategoryFor(project, threads = projectThreadsForWorkdir(project.workdir, project.entries)) {
        if (sameProjectPath(project.workdir, currentProjectRootPath || currentWorkdir)) return { id: 'current', label: '当前项目', order: 0 };
        return { id: 'other', label: '其他项目', order: 1 };
      }
      function categorizeProjects(projects) {
        const buckets = new Map();
        projects.forEach((project) => {
          const threads = projectThreadsForWorkdir(project.workdir, project.entries);
          const category = projectCategoryFor(project, threads);
          const item = { ...project, threads, latestMs: projectLatestMs(project, threads), category };
          if (!buckets.has(category.id)) buckets.set(category.id, { ...category, items: [] });
          buckets.get(category.id).items.push(item);
        });
        return [...buckets.values()]
          .sort((a, b) => a.order - b.order)
          .map((category) => ({
            ...category,
            items: category.items.sort((a, b) => {
              if (sameProjectPath(a.workdir, currentWorkdir)) return -1;
              if (sameProjectPath(b.workdir, currentWorkdir)) return 1;
              if (sameProjectPath(a.workdir, currentProjectRootPath)) return -1;
              if (sameProjectPath(b.workdir, currentProjectRootPath)) return 1;
              return b.latestMs - a.latestMs || projectDisplayName(a.workdir).localeCompare(projectDisplayName(b.workdir));
            })
          }));
      }
      function sidebarVisibleProjects() {
        const q = (sideFilter.value || '').toLowerCase();
        const searchActive = Boolean(q);
        const visible = [];
        const list = projectsCache.filter((project) => !projectRootHidden(project) && projectMatchesQuery(project, q));
        categorizeProjects(list).forEach((category) => {
          const categoryExpanded = searchActive || expandedProjectCategories.has(category.id);
          visible.push(...(categoryExpanded ? category.items : category.items.slice(0, SIDEBAR_VISIBLE_LIMIT)));
        });
        return visible;
      }
      function toggleProjectExpanded(workdir) {
        const key = normalizeSessionPath(workdir);
        if (expandedProjectPaths.has(key)) expandedProjectPaths.delete(key);
        else expandedProjectPaths.add(key);
        saveExpandedProjectPaths();
        renderProjects();
      }
      function toggleProjectCategoryExpanded(categoryId) {
        if (expandedProjectCategories.has(categoryId)) expandedProjectCategories.delete(categoryId);
        else expandedProjectCategories.add(categoryId);
        renderProjects();
      }
      function toggleProjectThreadListExpanded(workdir) {
        const key = normalizeSessionPath(workdir);
        if (expandedProjectThreadLists.has(key)) expandedProjectThreadLists.delete(key);
        else expandedProjectThreadLists.add(key);
        renderProjects();
      }
      function ensureCurrentProjectExpanded() {
        const projectPath = currentProjectRootPath || currentWorkdir;
        if (!projectPath) return;
        expandedProjectPaths.add(normalizeSessionPath(projectPath));
        saveExpandedProjectPaths();
      }
      function currentConversationSnapshot() {
        if (!currentResumePath) return null;
        const match = sessionsCache.find((session) => sameSessionPath(session.path, currentResumePath));
        return {
          ...(match || {}),
          path: currentResumePath,
          cwd: match?.cwd || currentWorkdir,
          title: match ? sessionTitle(match) : (threadTitle.textContent || currentResumePath),
          size: match?.size || 0,
          mtimeMs: match?.mtimeMs || Date.now()
        };
      }
      function pushConversationNav(stack, session) {
        if (!session?.path) return;
        const previous = stack[stack.length - 1];
        if (previous && sameSessionPath(previous.path, session.path)) return;
        stack.push(session);
        if (stack.length > 50) stack.shift();
      }
      function recordConversationNavigation(nextPath) {
        const previous = currentConversationSnapshot();
        if (!previous || sameSessionPath(previous.path, nextPath)) return;
        pushConversationNav(conversationNavBack, previous);
        conversationNavForward = [];
      }
      function dropConversationNavPath(path) {
        conversationNavBack = conversationNavBack.filter((item) => !sameSessionPath(item.path, path));
        conversationNavForward = conversationNavForward.filter((item) => !sameSessionPath(item.path, path));
      }
      function updateConversationNavControls() {
        if (historyBackBtn) {
          historyBackBtn.disabled = conversationNavBack.length === 0;
          historyBackBtn.classList.toggle('muted', historyBackBtn.disabled);
          historyBackBtn.title = historyBackBtn.disabled ? '没有上一个对话' : '返回上一个对话';
        }
        if (historyForwardBtn) {
          historyForwardBtn.disabled = conversationNavForward.length === 0;
          historyForwardBtn.classList.toggle('muted', historyForwardBtn.disabled);
          historyForwardBtn.title = historyForwardBtn.disabled ? '没有下一个对话' : '前进到下一个对话';
        }
      }
      async function navigateConversationHistory(direction) {
        const goingBack = direction === 'back';
        const stack = goingBack ? conversationNavBack : conversationNavForward;
        const target = stack.pop();
        if (!target) {
          updateConversationNavControls();
          exposeDebugState();
          return;
        }
        const current = currentConversationSnapshot();
        if (current) pushConversationNav(goingBack ? conversationNavForward : conversationNavBack, current);
        setActiveSession(target, true, false);
        updateConversationNavControls();
        renderSessions();
        await loadTranscript(target.path);
        await resumeSession(target.path, target);
        closeMobileSidebar();
      }
      function resetToEmptyProjectSession(workdir, detail = '已切换项目主目录') {
        currentResumePath = null;
        activeRuntimeResumePath = null;
        activeStreamSessionPath = null;
        currentWorkdir = workdir || currentWorkdir;
        currentProjectRootPath = workdir || currentProjectRootPath || currentWorkdir;
        codexRunning = false;
        queuedFollowUps = [];
        guidanceState = { pending: 0, saved: 0, count: 0, items: [] };
        streamEl = null;
        turnQuestionText.clear();
        latestUserQuestionText = '';
        activeTurnId = '';
        log.innerHTML = '';
        resetTranscriptPageState();
        log.appendChild(emptyState);
        emptyState.style.display = '';
        resumePill.textContent = '新会话';
        threadTitle.textContent = projectName(currentWorkdir);
        threadMeta.textContent = currentWorkdir || detail;
        updateComposerControls();
        renderQueuePanel();
        renderSessions();
        renderProjects();
        updateConversationNavControls();
        exposeDebugState();
      }
      function ensureNotEmpty() {
        if (emptyState) emptyState.style.display = log.children.length > 1 ? 'none' : '';
      }
      function bubbleStatusLabel(status) {
        if (status === 'streaming') return '生成中';
        if (status === 'done') return '完成';
        return status || '';
      }
      function messageHeader(kind, status = '') {
        const safeStatus = bubbleStatusLabel(status);
        return safeStatus ? `<div class="message-head"><span class="message-status">${escapeHtml(safeStatus)}</span></div>` : '';
      }
      function assistantFooterMarkup(options = {}) {
        const status = options.status || 'done';
        if (!shouldShowAssistantFooter(options)) return '';
        const duration = formatDuration(options.durationMs);
        const completed = formatCompletionTime(options.completedAt || Date.now());
        return `<div class="message-footer"><div class="message-meta"><span>耗时 ${escapeHtml(duration)}</span><span>完成 ${escapeHtml(completed)}</span></div><div class="message-actions"><button type="button" class="message-action message-action-favorite" data-message-action="favorite" title="收藏" aria-label="收藏">${FAVORITE_BUTTON_SVG}</button></div></div>`;
      }
      function shouldShowAssistantFooter(options = {}) {
        const status = options.status || 'done';
        if (status === 'streaming') return false;
        return Boolean(options.completedAt || Number(options.durationMs || 0) > 0 || options.showAssistantFooter === true);
      }
      function renderUserMessageActions(options = {}) {
        if (!options.turnId) return '';
        const disabled = codexRunning ? ' disabled aria-disabled="true"' : '';
        return `<div class="message-actions"><button type="button" class="message-action message-action-edit" data-message-action="edit" title="编辑消息" aria-label="编辑消息"${disabled}>${EDIT_BUTTON_SVG}</button></div>`;
      }
      function applyAssistantMetadata(row, messageText, options = {}) {
        if (!row) return;
        const card = row.querySelector('.bubble-card');
        if (!card) return;
        const turnId = String(options.turnId || row.dataset.turnId || activeTurnId || '').trim();
        const question = String(options.question || row.dataset.question || questionForAssistant({ turnId }) || '').trim();
        const completedAt = String(options.completedAt || row.dataset.completedAt || '');
        const durationMs = Number(options.durationMs || row.dataset.durationMs || 0) || 0;
        if (turnId) row.dataset.turnId = turnId;
        if (currentResumePath || options.sessionPath) row.dataset.sessionPath = options.sessionPath || currentResumePath || '';
        row.dataset.answer = messageText;
        row.dataset.question = question;
        if (completedAt) row.dataset.completedAt = completedAt;
        else delete row.dataset.completedAt;
        if (durationMs) row.dataset.durationMs = String(durationMs);
        else delete row.dataset.durationMs;
        row.querySelector('.message-footer')?.remove();
        const footerOptions = { ...options, completedAt, durationMs, status: row.dataset.status || options.status || 'done' };
        if (!shouldShowAssistantFooter(footerOptions)) return;
        card.insertAdjacentHTML('beforeend', assistantFooterMarkup(footerOptions));
        setupAssistantFavorite(row);
      }
      function favoritePayloadFromRow(row) {
        return {
          sessionPath: row.dataset.sessionPath || currentResumePath || '',
          turnId: row.dataset.turnId || '',
          question: row.dataset.question || '',
          answer: row.dataset.answer || row.querySelector('.message-text')?.textContent || '',
          durationMs: Number(row.dataset.durationMs || 0) || null,
          completedAt: row.dataset.completedAt || ''
        };
      }
      function setupAssistantFavorite(row) {
        const button = row.querySelector('[data-message-action="favorite"]');
        if (!button || button.dataset.bound === 'true') return;
        button.dataset.bound = 'true';
        button.addEventListener('click', async (event) => {
          event.preventDefault();
          event.stopPropagation();
          const payload = favoritePayloadFromRow(row);
          if (!payload.question || !payload.answer) {
            button.title = '缺少可收藏的问答';
            return;
          }
          button.disabled = true;
          try {
            const result = await postJsonEndpoint('/favorites', payload);
            row.dataset.favoriteId = result.id || '';
            button.classList.add('message-action-favorite-active');
            button.title = result.duplicate ? '已在收藏中' : '已收藏';
            button.setAttribute('aria-label', button.title);
          } catch (error) {
            button.disabled = false;
            button.title = `收藏失败：${error.message || error}`;
          }
        });
      }
      function addBubble(textValue, kind = 'agent', options = {}) {
        if (emptyState) emptyState.style.display = 'none';
        const messageText = stripInternalMemoryBlocks(textValue);
        const row = document.createElement('div');
        row.className = `bubble ${kind}`;
        row.dataset.status = options.status || 'done';
        if (options.turnId) row.dataset.turnId = options.turnId;
        if (kind === 'user') rememberUserQuestion(messageText, options);
        const actionMarkup = kind === 'user' ? renderUserMessageActions(options) : '';
        row.innerHTML = `<div class="bubble-card">${messageHeader(kind, options.status || '')}<div class="message-text">${renderMarkdownBlocks(messageText)}</div>${renderAttachmentImages(options.attachments || [])}${actionMarkup}</div>`;
        if (kind === 'user' && options.turnId) {
          setupUserMessageEdit(row, messageText, options);
        }
        if (kind === 'agent' && shouldShowAssistantFooter(options)) {
          applyAssistantMetadata(row, messageText, { ...options, question: options.question || questionForAssistant(options) });
        }
        if (options.beforeNode) log.insertBefore(row, options.beforeNode);
        else log.appendChild(row);
        if (options.scroll !== false) {
          scrollToBottom();
          updateTokenStats();
        }
        return row;
      }
      function setupUserMessageEdit(row, originalText, options = {}) {
        const editButton = row.querySelector('[data-message-action="edit"]');
        if (!editButton) return;
        editButton.addEventListener('click', (event) => {
          event.preventDefault();
          startUserMessageEdit(row, originalText, options);
        });
      }
      function updateMessageEditControls() {
        document.querySelectorAll('.message-action-edit').forEach((button) => {
          button.disabled = codexRunning || composerRequestInFlight;
          button.setAttribute('aria-disabled', button.disabled ? 'true' : 'false');
        });
      }
      function cancelUserMessageEdit() {
        if (!messageEditState) return;
        messageEditState.row.classList.remove('bubble-editing');
        messageEditState.editor?.remove();
        messageEditState = null;
      }
      function resizeMessageEditorInput(input) {
        if (!input) return;
        input.style.height = 'auto';
        const maxHeight = Math.min(Math.max(Math.floor(window.innerHeight * 0.46), 220), 520);
        const nextHeight = Math.max(132, Math.min(input.scrollHeight, maxHeight));
        input.style.height = `${nextHeight}px`;
        input.style.overflowY = input.scrollHeight > maxHeight ? 'auto' : 'hidden';
      }
      function startUserMessageEdit(row, originalText, options = {}) {
        if (codexRunning) {
          addSystem('当前回复仍在运行，结束或停止后才能编辑历史消息。', true);
          return;
        }
        if (!options.turnId) {
          addSystem('这条历史消息缺少 turnId，不能安全回滚重跑。', true);
          return;
        }
        cancelUserMessageEdit();
        row.classList.add('bubble-editing');
        const editor = document.createElement('div');
        editor.className = 'message-editor';
        editor.innerHTML = `
          <textarea class="message-editor-input" rows="5" aria-label="编辑消息"></textarea>
          <div class="message-editor-actions">
            <button type="button" class="message-editor-button" data-edit-action="cancel">取消</button>
            <button type="button" class="message-editor-button message-editor-button-primary" data-edit-action="submit">发送</button>
          </div>`;
        const card = row.querySelector('.bubble-card');
        card.appendChild(editor);
        const input = editor.querySelector('textarea');
        input.value = originalText;
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
        resizeMessageEditorInput(input);
        const state = {
          row,
          editor,
          input,
          originalText,
          turnId: options.turnId,
          path: options.sessionPath || currentResumePath,
          attachments: options.attachments || []
        };
        messageEditState = state;
        editor.querySelector('[data-edit-action="cancel"]').addEventListener('click', cancelUserMessageEdit);
        editor.querySelector('[data-edit-action="submit"]').addEventListener('click', () => submitUserMessageEdit(state));
        input.addEventListener('input', () => resizeMessageEditorInput(input));
        input.addEventListener('keydown', (event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            submitUserMessageEdit(state);
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            cancelUserMessageEdit();
          }
        });
        exposeDebugState();
      }
      function trimTimelineAfter(row) {
        let next = row.nextSibling;
        while (next) {
          const current = next;
          next = next.nextSibling;
          if (current !== emptyState) current.remove();
        }
        streamEl = null;
        activeStreamSessionPath = null;
      }
      async function submitUserMessageEdit(state = messageEditState) {
        if (!state || composerRequestInFlight) return;
        const editedText = state.input.value.trim();
        if (!editedText && !state.attachments.length) {
          addSystem('编辑后的消息不能为空。', true);
          return;
        }
        composerRequestInFlight = true;
        updateComposerControls();
        state.editor.querySelectorAll('button, textarea').forEach((node) => { node.disabled = true; });
        try {
          const response = await fetch('/message/edit', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({
              path: state.path || currentResumePath,
              turnId: state.turnId,
              text: editedText,
              attachments: state.attachments,
              collaborationPreset,
              serviceTier: currentServiceTier()
            })
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = await response.json().catch(() => ({}));
          if (data.ok === false) throw new Error(data.error || '编辑发送失败');
          pendingEditedUserEcho = { text: editedText, expiresAt: Date.now() + 5000 };
          currentResumePath = data.resume_path || currentResumePath;
          activeRuntimeResumePath = data.resume_path || activeRuntimeResumePath || currentResumePath;
          codexRunning = typeof data.running === 'boolean' ? data.running : true;
          if (data.status === 'started' || data.status === 'steered') recordTurnStarted(activeRuntimeResumePath);
          if (Array.isArray(data.queue)) queuedFollowUps = data.queue;
          const messageText = state.row.querySelector('.message-text');
          if (messageText) messageText.innerHTML = renderMarkdownBlocks(editedText);
          trimTimelineAfter(state.row);
          cancelUserMessageEdit();
          updateComposerControls();
          renderQueuePanel();
          renderSessions();
          renderProjects();
        } catch (error) {
          addSystem(`编辑消息失败：${error.message || error}`, true);
          state.editor.querySelectorAll('button, textarea').forEach((node) => { node.disabled = false; });
        } finally {
          composerRequestInFlight = false;
          updateComposerControls();
          exposeDebugState();
        }
      }
      function addSystem(textValue, error = false) {
        if (emptyState) emptyState.style.display = 'none';
        const row = document.createElement('div');
        row.className = `bubble ${error ? 'error' : 'system'}`;
        row.dataset.status = 'done';
        row.innerHTML = `<div class="bubble-card">${messageHeader(error ? 'error' : 'system')}<div class="message-text mono">${escapeHtml(textValue)}</div></div>`;
        log.appendChild(row);
        scrollToBottom();
      }
      window.addEventListener('error', (event) => {
        addSystem(`前端错误：${event.message || 'unknown'}`, true);
      });
      window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason && (event.reason.message || event.reason);
        addSystem(`前端异步错误：${reason || 'unknown'}`, true);
      });
      function isCommandLikeTool(value) {
        const itemKind = String(value || '').trim().toLowerCase();
        return itemKind === 'command'
          || itemKind === 'commandexecution'
          || itemKind === 'command_execution'
          || itemKind.includes('commandexecution')
          || itemKind.includes('command_execution');
      }
      function shouldRenderToolEvent(name) {
        return !isCommandLikeTool(name);
      }
      function shouldRenderTimelineItem(item) {
        if (!item) return false;
        return !isCommandLikeTool(item.kind || item.type || item.title);
      }
      function shouldExpandTimelineDetail(item) {
        if (!item) return false;
        if (item.kind === 'fileChange') return false;
        return true;
      }
      function addTool(name, detail) {
        if (!shouldRenderToolEvent(name)) return null;
        if (emptyState) emptyState.style.display = 'none';
        const row = document.createElement('div');
        row.className = 'tool-card';
        row.innerHTML = `<div class="tool-body"><div class="tool-title"><span>${escapeHtml(name || '工具')}</span><span class="pill">运行中</span></div>${renderToolDetail(name, detail)}</div>`;
        log.appendChild(row);
        scrollToBottom();
      }
      function timelineKindLabel(kind) {
        const labels = {
          commandExecution: 'Command',
          fileChange: 'File change',
          mcpToolCall: 'MCP',
          dynamicToolCall: 'Tool',
          functionCall: 'Function',
          webSearch: 'Web search',
          reasoning: 'Reasoning',
          plan: 'Plan',
          error: 'Error'
        };
        return labels[kind] || kind || 'Timeline';
      }
      function addTimelineItem(item, options = {}) {
        if (!shouldRenderTimelineItem(item)) return null;
        if (!item) return null;
        if (item.role === 'user' || item.role === 'assistant') {
          if (!item.kind || item.kind === 'message' || item.kind === 'userMessage' || item.kind === 'agentMessage') {
            return addBubble(item.text || '', item.role === 'user' ? 'user' : 'agent', {
              ...options,
              status: item.status || options.status,
              turnId: item.turnId || options.turnId,
              messageId: item.id || options.messageId,
              sessionPath: options.sessionPath || currentResumePath,
              startedAt: item.startedAt || options.startedAt,
              completedAt: item.completedAt || options.completedAt,
              durationMs: item.durationMs || options.durationMs,
              attachments: item.attachments || options.attachments || []
            });
          }
        }
        if (emptyState) emptyState.style.display = 'none';
        const row = document.createElement('div');
        row.className = `timeline-card timeline-card-${escapeAttr(item.kind || 'generic')}`;
        const detail = item.detail || item.text || '';
        const status = item.status ? `<span class="pill">${escapeHtml(item.status)}</span>` : '';
        const title = item.kind === 'commandExecution' ? timelineKindLabel(item.kind) : item.title || timelineKindLabel(item.kind);
        const head = `<span>${escapeHtml(title)}</span><span class="timeline-kind">${escapeHtml(timelineKindLabel(item.kind))}</span>${status}`;
        row.innerHTML = timelineDetailMarkup(item, detail, head);
        if (options.beforeNode) log.insertBefore(row, options.beforeNode);
        else log.appendChild(row);
        if (options.scroll !== false) {
          scrollToBottom();
          updateTokenStats();
        }
        return row;
      }
      function timelineDetailMarkup(item, detail, head) {
        if (!detail) return `<div class="timeline-card-head">${head}</div>`;
        return `<details class="timeline-card-disclosure"${shouldExpandTimelineDetail(item) ? ' open' : ''}><summary class="timeline-card-head">${head}</summary><pre class="timeline-card-detail">${escapeHtml(detail)}</pre></details>`;
      }
      function renderToolDetail(name, detail) {
        if (!detail) return '';
        const safeDetail = escapeHtml(detail);
        return `<div class="tool-detail">${safeDetail}</div>`;
      }
      function setListMessage(target, textValue, error = false) {
        target.innerHTML = '';
        const row = document.createElement('div');
        row.className = `list-message ${error ? 'list-message-error' : ''}`;
        row.textContent = textValue;
        target.appendChild(row);
      }
      function sidebarOverflowLabel(total, expanded, noun) {
        const hidden = Math.max(0, total - SIDEBAR_VISIBLE_LIMIT);
        return expanded ? `收起为 ${SIDEBAR_VISIBLE_LIMIT} ${noun}` : `显示剩余 ${hidden} ${noun}`;
      }
      function projectThreadVisibleCollapsed(thread, now = Date.now()) {
        const time = sessionTimeMs(thread);
        return Boolean(
          isRunningSession(thread)
          || sameSessionPath(thread?.path, currentResumePath)
          || (time > 0 && now - time <= PROJECT_THREAD_RECENT_WINDOW_MS)
        );
      }
      function visibleProjectThreads(threads, expanded, searchActive) {
        if (searchActive || expanded) return threads;
        const now = Date.now();
        return (threads || []).filter((thread) => projectThreadVisibleCollapsed(thread, now));
      }
      function projectThreadOverflowLabel(total, visibleCount, expanded) {
        const hidden = Math.max(0, total - visibleCount);
        return expanded ? '收起到近 30 分钟' : `显示剩余 ${hidden} 条项目会话`;
      }
      function createSidebarOverflowButton(label, onClick) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'sidebar-overflow-btn';
        button.textContent = label;
        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          onClick?.();
        });
        return button;
      }
      function scrollToBottom() {
        const timeline = $('timeline');
        timeline.scrollTop = timeline.scrollHeight;
      }
      function transcriptPageEndpoint(path, before = null) {
        const params = new URLSearchParams({ limit: String(TRANSCRIPT_PAGE_LIMIT) });
        if (path) params.set('path', path);
        if (before !== null && before !== undefined) params.set('before', String(before));
        return `/session-messages?${params.toString()}`;
      }
      function resetTranscriptPageState(path = '') {
        transcriptPageState = { path, total: 0, start: 0, end: 0, nextBefore: null, hasMoreOlder: false, loadingOlder: false };
        transcriptHistoryLoader?.remove();
        transcriptHistoryLoader = null;
      }
      function updateTranscriptPageState(data = {}, path = transcriptPageState.path) {
        transcriptPageState = {
          ...transcriptPageState,
          path: path || transcriptPageState.path || '',
          total: Number(data.total || 0) || 0,
          start: Number(data.start || 0) || 0,
          end: Number(data.end || 0) || 0,
          nextBefore: data.nextBefore ?? null,
          hasMoreOlder: Boolean(data.hasMoreOlder),
          loadingOlder: false
        };
      }
      function renderTranscriptHistoryLoader() {
        if (!transcriptPageState.hasMoreOlder && !transcriptPageState.loadingOlder) {
          transcriptHistoryLoader?.remove();
          transcriptHistoryLoader = null;
          return;
        }
        if (!transcriptHistoryLoader) {
          transcriptHistoryLoader = document.createElement('div');
          transcriptHistoryLoader.className = 'transcript-history-loader';
          transcriptHistoryLoader.innerHTML = '<button type="button" class="transcript-history-load-btn"></button>';
          transcriptHistoryLoader.querySelector('button').addEventListener('click', () => {
            loadOlderTranscriptPage().catch((error) => addSystem(`加载更早历史失败：${error.message || error}`, true));
          });
        }
        const button = transcriptHistoryLoader.querySelector('button');
        const remaining = Math.max(0, transcriptPageState.start);
        button.disabled = transcriptPageState.loadingOlder;
        button.textContent = transcriptPageState.loadingOlder ? '正在加载更早历史...' : `加载更早历史（剩余 ${remaining} 条）`;
        if (transcriptHistoryLoader.parentElement !== log) log.insertBefore(transcriptHistoryLoader, log.firstChild);
        else if (log.firstChild !== transcriptHistoryLoader) log.insertBefore(transcriptHistoryLoader, log.firstChild);
      }
      function renderTranscriptPageMessages(messages, path, beforeNode = null) {
        (messages || []).forEach((message) => {
          addTimelineItem(message, { scroll: false, sessionPath: path || currentResumePath, beforeNode });
        });
      }
      async function loadOlderTranscriptPage() {
        if (!transcriptPageState.hasMoreOlder || transcriptPageState.loadingOlder) return;
        const path = transcriptPageState.path || currentResumePath;
        if (!path) return;
        const before = transcriptPageState.nextBefore ?? transcriptPageState.start;
        if (before === null || before === undefined) return;
        transcriptPageState = { ...transcriptPageState, loadingOlder: true };
        renderTranscriptHistoryLoader();
        const timeline = $('timeline');
        const previousHeight = timeline.scrollHeight;
        const previousTop = timeline.scrollTop;
        try {
          const response = await fetch(transcriptPageEndpoint(path, before), { cache: 'no-store' });
          const data = await response.json();
          if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
          if (!sameSessionPath(path, currentResumePath)) {
            transcriptPageState = { ...transcriptPageState, loadingOlder: false };
            renderTranscriptHistoryLoader();
            return;
          }
          const anchor = transcriptHistoryLoader?.nextSibling || log.firstChild;
          renderTranscriptPageMessages(data.messages || [], path, anchor);
          updateTranscriptPageState(data, path);
          renderTranscriptHistoryLoader();
          timeline.scrollTop = previousTop + (timeline.scrollHeight - previousHeight);
          updateTokenStats();
          exposeDebugState();
        } catch (error) {
          transcriptPageState = { ...transcriptPageState, loadingOlder: false };
          renderTranscriptHistoryLoader();
          exposeDebugState();
          throw error;
        }
      }
      function updateTokenStats() {
        let allText = '';
        log.querySelectorAll('.message-text').forEach((el) => { allText += el.textContent + '\n'; });
        const chars = allText.length;
        const tokens = Math.ceil(chars / 4);
        tokenStats.textContent = chars ? `上下文约 ${tokens} tokens / ${chars} chars` : '轻量 Plus 风格 UI，保留聊天、工具过程、会话、记忆和设置。';
      }
      function updateComposerContext() {
        if (!composerContextLabel) return;
        const label = currentWorkdir ? projectDisplayName(currentWorkdir) : '未选择项目';
        composerContextLabel.textContent = label;
        if (composerContext) composerContext.title = currentWorkdir || label;
      }
      function setTheme(theme) {
        document.body.classList.toggle('dark', theme === 'dark');
        safeLocalSet('plusWebTheme', theme);
      }
      function openModal(id) { $(id).classList.add('open'); }
      function closeModal(id) { $(id).classList.remove('open'); }
      async function openProjectModal(initialPath = '') {
        const target = initialPath || currentWorkdir || projectPathInput.value || '';
        projectPathInput.value = target;
        openModal('projectModal');
        await loadProjectBrowser(target);
        setTimeout(() => {
          projectPathInput.focus();
          projectPathInput.select();
        }, 0);
      }
      function setProjectBrowserState(next) {
        projectBrowserState = { ...projectBrowserState, ...next };
        renderProjectBrowser();
        exposeDebugState();
      }
      function renderProjectBrowserMessage(message, error = false) {
        projectBrowserList.innerHTML = '';
        const row = document.createElement('div');
        row.className = `project-browser-empty ${error ? 'list-message-error' : ''}`;
        row.textContent = message;
        projectBrowserList.appendChild(row);
      }
      function pathLabel(localPath) {
        return String(localPath || '').split(/[\\/]/).filter(Boolean).pop() || localPath || '文件夹';
      }
      function pathJoin(base, name) {
        const value = String(base || '');
        const sep = value.includes('\\') ? '\\' : '/';
        if (!value) return name;
        if (/[\\/]$/.test(value)) return value + name;
        return value + sep + name;
      }
      function pathCrumbs(localPath) {
        const value = String(localPath || '');
        if (!value) return [];
        if (/^[A-Za-z]:[\\/]/.test(value)) {
          const root = value.slice(0, 3);
          const parts = value.slice(3).split(/[\\/]/).filter(Boolean);
          const crumbs = [{ label: root.replace(/[\\/]$/, ''), path: root }];
          let cursor = root;
          parts.forEach((part) => {
            cursor = pathJoin(cursor, part);
            crumbs.push({ label: part, path: cursor });
          });
          return crumbs;
        }
        if (value.startsWith('\\\\')) {
          const parts = value.split(/[\\/]/).filter(Boolean);
          if (parts.length >= 2) {
            const root = `\\\\${parts[0]}\\${parts[1]}\\`;
            const crumbs = [{ label: `\\\\${parts[0]}\\${parts[1]}`, path: root }];
            let cursor = root;
            parts.slice(2).forEach((part) => {
              cursor = pathJoin(cursor, part);
              crumbs.push({ label: part, path: cursor });
            });
            return crumbs;
          }
        }
        if (value.startsWith('/')) {
          const parts = value.split('/').filter(Boolean);
          const crumbs = [{ label: '/', path: '/' }];
          let cursor = '/';
          parts.forEach((part) => {
            cursor = pathJoin(cursor, part);
            crumbs.push({ label: part, path: cursor });
          });
          return crumbs;
        }
        return [{ label: value, path: value }];
      }
      function renderProjectBrowser() {
        if (!projectBrowserRoots || !projectBrowserList || !projectBrowserPath || !projectBreadcrumb) return;
        const currentPath = projectBrowserState.path || projectPathInput.value || currentWorkdir || '';
        projectBrowserPath.textContent = currentPath || '未选择项目目录';
        projectBrowseUp.disabled = !projectBrowserState.parent || projectBrowserState.loading;
        projectBrowseRefresh.disabled = projectBrowserState.loading;
        projectOpenExplorer.disabled = !currentPath || projectBrowserState.loading;

        projectBrowserRoots.innerHTML = '';
        (projectBrowserState.roots || []).forEach((root) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = `project-browser-root ${sameProjectPath(root.path, currentPath) ? 'project-browser-root-active' : ''}`;
          button.title = root.path;
          button.textContent = root.label || pathLabel(root.path);
          button.addEventListener('click', () => loadProjectBrowser(root.path));
          projectBrowserRoots.appendChild(button);
        });

        projectBreadcrumb.innerHTML = '';
        pathCrumbs(currentPath).forEach((crumb, index, crumbs) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'project-crumb';
          button.title = crumb.path;
          button.textContent = crumb.label;
          button.addEventListener('click', () => loadProjectBrowser(crumb.path));
          projectBreadcrumb.appendChild(button);
          if (index < crumbs.length - 1) {
            const sep = document.createElement('span');
            sep.className = 'project-crumb-separator';
            sep.textContent = '›';
            projectBreadcrumb.appendChild(sep);
          }
        });

        if (projectBrowserState.loading) {
          renderProjectBrowserMessage('正在读取目录...');
          return;
        }
        if (projectBrowserState.error) {
          renderProjectBrowserMessage(projectBrowserState.error, true);
          return;
        }

        projectBrowserList.innerHTML = '';
        const entries = projectBrowserState.entries || [];
        entries.forEach((entry) => {
          const row = document.createElement('button');
          row.type = 'button';
          row.className = `project-browser-row ${sameProjectPath(entry.path, currentWorkdir) ? 'project-browser-row-active' : ''}`;
          row.title = entry.path;
          row.innerHTML = `<span class="project-browser-row-icon">${FOLDER_BUTTON_SVG}</span><span class="project-browser-row-main"><span class="project-browser-row-name">${escapeHtml(entry.name)}</span><span class="project-browser-row-path">${escapeHtml(entry.path)}</span></span><span class="project-browser-row-action">进入</span>`;
          row.addEventListener('click', () => loadProjectBrowser(entry.path));
          projectBrowserList.appendChild(row);
        });
        if (!entries.length) renderProjectBrowserMessage('此目录没有可进入的子文件夹。');
      }
      async function loadProjectBrowser(targetPath = '') {
        const target = String(targetPath || projectPathInput.value || currentWorkdir || '').trim();
        if (!target) {
          setProjectBrowserState({ path: '', parent: null, roots: [], entries: [], loading: false, error: '请先输入或选择一个本地文件夹。' });
          return;
        }
        setProjectBrowserState({ loading: true, error: '', path: target });
        try {
          const response = await fetch('/filesystem/list?path=' + encodeURIComponent(target), { cache: 'no-store' });
          const data = await response.json().catch(() => ({}));
          if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
          projectPathInput.value = data.path || target;
          setProjectBrowserState({
            path: data.path || target,
            parent: data.parent || null,
            roots: Array.isArray(data.roots) ? data.roots : [],
            entries: Array.isArray(data.entries) ? data.entries : [],
            loading: false,
            error: ''
          });
        } catch (error) {
          setProjectBrowserState({ loading: false, error: `目录读取失败：${error.message || error}` });
        }
      }
      async function pickProjectFolder() {
        try {
          projectPickFolder.disabled = true;
          const response = await fetch('/project/pick', { method: 'POST' });
          const data = await response.json().catch(() => ({}));
          if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
          if (!data.path) return;
          projectPathInput.value = data.path;
          await loadProjectBrowser(data.path);
        } catch (error) {
          addSystem(`选择文件夹失败：${error.message || error}`, true);
        } finally {
          projectPickFolder.disabled = false;
        }
      }

      async function loadConfig() {
        try {
          setSettingsStatus('');
          const response = await fetch('/config', { cache: 'no-store' });
          const cfg = await response.json();
          if (!response.ok) throw new Error(cfg.error || `HTTP ${response.status}`);
          currentConfig = cfg;
          if (!serviceTierOverrideActive) selectedServiceTier = normalizeServiceTier(cfg.service_tier);
          modelPill.textContent = cfg.model || 'gpt-5.5';
          $('modelLabel').textContent = prettyModel(cfg.model);
          $('effortLabel').textContent = effortLabel(cfg.model_reasoning_effort);
          $('cfgModel').value = cfg.model || '';
          $('cfgEffort').value = cfg.model_reasoning_effort || 'xhigh';
          $('cfgApproval').value = cfg.approval_policy || 'never';
          $('cfgSandbox').value = cfg.sandbox_mode || 'danger-full-access';
          $('cfgSearch').value = String(cfg['tools.web_search_request'] === true);
          $('cfgShell').value = String(cfg.use_streamable_shell !== false);
          $('cfgExtra').value = cfg.instructions_extra || '';
          updateComposerMenuState();
        } catch (error) {
          setSettingsStatus(`配置读取失败：${error.message || error}`, true);
          addSystem(`配置读取失败：${error.message || error}`, true);
        }
      }
      function setSettingsStatus(message = '', error = false) {
        const row = $('settingsStatus');
        if (!row) return;
        row.textContent = message;
        row.classList.toggle('settings-status-error', Boolean(error));
      }
      async function saveConfig() {
        const payload = {
          model: $('cfgModel').value || 'gpt-5.5',
          model_reasoning_effort: $('cfgEffort').value || 'xhigh',
          approval_policy: $('cfgApproval').value,
          sandbox_mode: $('cfgSandbox').value || 'danger-full-access',
          approvals_reviewer: currentConfig.approvals_reviewer || 'user',
          service_tier: currentServiceTier() === 'fast' ? 'fast' : '',
          'tools.web_search_request': $('cfgSearch').value === 'true',
          use_streamable_shell: $('cfgShell').value === 'true',
          instructions_extra: $('cfgExtra').value || ''
        };
        setSettingsStatus('正在保存...');
        const response = await fetch('/config', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.ok === false) {
          const message = data.error || `HTTP ${response.status}`;
          setSettingsStatus(`保存失败：${message}`, true);
          throw new Error(message);
        }
        await loadConfig();
        setSettingsStatus('已保存');
      }
      async function loadSessions() {
        try {
          const response = await fetch('/sessions', { cache: 'no-store' });
          const data = await response.json();
          if (!response.ok || !Array.isArray(data.sessions)) throw new Error(data.error || `HTTP ${response.status}`);
          sessionsCache = data.sessions || [];
          currentResumePath = data.current || null;
          currentWorkdir = data.workdir || currentWorkdir;
          currentProjectRootPath = data.currentRoot || currentProjectRootPath || currentWorkdir;
          updateComposerContext();
          renderSessions();
        } catch (error) {
          sessionsCache = [];
          addSystem(`历史会话读取失败：${error.message || error}`, true);
        }
      }
      function renderSessions() {
        const q = (sideFilter.value || '').trim().toLowerCase();
        const matches = (session) => sessionMatchesQuery(session, q);
        const pinned = sessionsCache.filter((s) => isSessionPinned(s) && matches(s));
        $('pinnedCount').textContent = String(pinned.length);
        pinnedSessionsEl.innerHTML = '';
        renderSessionList(pinnedSessionsEl, pinned, 'pinned', q ? '没有匹配的置顶会话' : '暂无置顶会话');
        setSessionSectionVisibility(pinnedSessionsEl, pinned.length > 0 || Boolean(q));
        ensureSidebarVisible();
        updateConversationNavControls();
        refreshRelativeTimes();
        exposeDebugState();
      }
      function sessionDomKey(path) {
        return normalizeSessionPath(path);
      }
      function markSidebarActiveSession(path) {
        const activeKey = sessionDomKey(path);
        document.querySelectorAll('[data-session-key]').forEach((node) => {
          const match = node.getAttribute('data-session-key') === activeKey;
          if (node.classList.contains('thread-item')) node.classList.toggle('active', match);
          if (node.classList.contains('workspace-thread-item')) node.classList.toggle('workspace-thread-item-active', match);
          node.setAttribute('aria-current', match ? 'true' : 'false');
        });
      }
      function syncSidebarActiveState() {
        markSidebarActiveSession(currentResumePath);
        updateConversationNavControls();
        refreshRelativeTimes();
        exposeDebugState();
      }
      function scheduleSidebarRender(delay = 180, options = {}) {
        const full = options.full !== false;
        sidebarRenderFull = sidebarRenderFull || full;
        if (sidebarRenderTimer) return;
        sidebarRenderTimer = setTimeout(() => {
          sidebarRenderTimer = null;
          const shouldRenderFull = sidebarRenderFull;
          sidebarRenderFull = false;
          if (shouldRenderFull) {
            renderSessions();
            renderProjects();
            return;
          }
          syncSidebarActiveState();
        }, delay);
      }
      function sessionMatchesQuery(session, query) {
        if (isRunningSession(session)) return true;
        if (!query) return true;
        return `${session.path || ''} ${sessionTitle(session)} ${session.cwd || ''} ${sessionSub(session)}`.toLowerCase().includes(query);
      }
      function setSessionSectionVisibility(listEl, visible) {
        const section = listEl?.closest('.side-section');
        if (!section) return;
        section.hidden = !visible;
        section.setAttribute('aria-hidden', visible ? 'false' : 'true');
      }
      function sidebarVisibleSessions(list, key, query) {
        if (query || expandedSessionLists.has(key)) return list;
        const out = [];
        list.forEach((session, index) => {
          if (index < SIDEBAR_VISIBLE_LIMIT || isRunningSession(session)) out.push(session);
        });
        return out;
      }
      function renderSessionList(target, list, key, emptyText) {
        if (!list.length) {
          setListMessage(target, emptyText);
          return;
        }
        const query = (sideFilter.value || '').trim().toLowerCase();
        const visible = sidebarVisibleSessions(list, key, query);
        const seen = new Set();
        visible.forEach((session) => {
          const sessionKey = normalizeSessionPath(session.path);
          if (seen.has(sessionKey)) return;
          seen.add(sessionKey);
          target.appendChild(createSessionButton(session, isSessionPinned(session)));
        });
        if (!query && list.length > visible.length) {
          target.appendChild(createSidebarOverflowButton(
            sidebarOverflowLabel(list.length, expandedSessionLists.has(key), '条会话'),
            () => {
              if (expandedSessionLists.has(key)) expandedSessionLists.delete(key);
              else expandedSessionLists.add(key);
              renderSessions();
            }
          ));
        }
      }
      function setActiveSession(session, markConnected = true, recordNavigation = false) {
        if (!session) return;
        if (recordNavigation) recordConversationNavigation(session.path);
        currentResumePath = session.path;
        currentWorkdir = session.cwd || currentWorkdir;
        currentProjectRootPath = session.projectRoot || currentProjectRootPath || currentWorkdir;
        updateComposerContext();
        resumePill.textContent = '已恢复';
        threadTitle.textContent = sessionTitle(session);
        threadMeta.textContent = `${toKB(session.size)} · ${session.path}`;
        if (markConnected) connDot.className = 'status-dot ok';
        updateConversationNavControls();
        markSidebarActiveSession(session.path);
      }
      async function switchToSession(session) {
        if (!session?.path) return;
        const serial = ++transcriptSwitchSerial;
        setActiveSession(session, true, true);
        try {
          await loadTranscript(session.path, { smooth: true, serial });
          if (serial !== transcriptSwitchSerial) return;
          resumeSession(session.path, session);
          closeMobileSidebar();
        } catch (error) {
          addSystem(`切换会话失败：${error.message || error}`, true);
        }
      }
      if (DEBUG_NO_EVENTS) {
        window.__codexWebuiBench = {
          async switchToPath(path) {
            const target = sessionsCache.find((session) => sameSessionPath(session.path, path));
            if (!target) throw new Error('Benchmark target session not found');
            await switchToSession(target);
            return typeof window.__codexWebuiDebug === 'function' ? window.__codexWebuiDebug() : null;
          }
        };
      }
      function createSessionButton(s, pinned) {
        const btn = document.createElement('button');
        const running = isRunningSession(s);
        btn.className = `thread-item ${sameSessionPath(currentResumePath, s.path) ? 'active' : ''} ${running ? 'thread-item-running' : ''}`;
        btn.dataset.sessionKey = sessionDomKey(s.path);
        btn.setAttribute('aria-current', sameSessionPath(currentResumePath, s.path) ? 'true' : 'false');
        btn.title = running ? '运行中，点击恢复会话；右键打开菜单' : '右键打开菜单';
        const count = s.messageCount ? `${s.messageCount} 条` : toKB(s.size);
        const status = running
          ? '<span class="session-running"><span class="session-running-dot"></span>运行中</span>'
          : `<span class="pill">${escapeHtml(count)}</span>`;
        btn.innerHTML = `<span class="item-main"><span class="item-title">${escapeHtml(sessionTitle(s))}</span><span class="item-sub">${sessionSubMarkup(s)}</span></span>${status}`;
        btn.addEventListener('click', async () => {
          await switchToSession(s);
        });
        btn.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          showSessionMenu(event.clientX, event.clientY, s);
        });
        return btn;
      }
      function isRunningSession(session) {
        return Boolean(codexRunning && session && sameSessionPath(session.path, activeRuntimeResumePath || currentResumePath));
      }
      function closeContextMenu() {
        document.querySelectorAll('.context-menu').forEach((menu) => menu.remove());
      }
      function closeSessionMoveDialog() {
        document.getElementById('sessionMoveModal')?.remove();
        exposeDebugState();
      }
      function positionContextMenu(menu, x, y, width = 190, height = 170) {
        menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - width - 8))}px`;
        menu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - height - 8))}px`;
      }
      function sessionMoveProjectOptions(session) {
        const byKey = new Map();
        const add = (workdir, label, count = 0) => {
          const value = String(workdir || '').trim();
          if (!value) return;
          const key = normalizeSessionPath(value);
          if (byKey.has(key)) {
            const existing = byKey.get(key);
            existing.count = Math.max(existing.count || 0, count || 0);
            if (!existing.label && label) existing.label = label;
            return;
          }
          byKey.set(key, { workdir: value, label: label || projectDisplayName(value), count });
        };
        sidebarVisibleProjects().forEach((project) => {
          const threads = project.threads || projectThreadsForWorkdir(project.workdir, project.entries);
          add(project.workdir, projectDisplayName(project.workdir), threads.length);
        });
        const currentKey = normalizeSessionPath(session.projectRoot || session.cwd || '');
        return [...byKey.values()]
          .map((option) => ({ ...option, current: normalizeSessionPath(option.workdir) === currentKey }))
          .sort((a, b) => Number(a.current) - Number(b.current) || a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }));
      }
      async function moveSessionToProject(session, workdir) {
        const target = String(workdir || '').trim();
        if (!target) throw new Error('请选择目标项目');
        const response = await fetch('/session/move', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ path: session.path, workdir: target }) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
        sessionsCache = sessionsCache.map((item) => sameSessionPath(item.path, session.path)
          ? { ...item, cwd: data.workdir || target, originalCwd: item.originalCwd || item.cwd, projectRoot: data.root?.path || data.workdir || target }
          : item);
        if (sameSessionPath(currentResumePath, session.path)) {
          currentWorkdir = data.workdir || target;
          currentProjectRootPath = data.root?.path || data.workdir || target;
          updateComposerContext();
        }
        await Promise.all([loadSessions(), loadProjects()]);
        addSystem(`已移动会话到项目：${data.workdir || target}`);
        closeSessionMoveDialog();
      }
      async function showSessionMoveDialog(session) {
        closeContextMenu();
        closeSessionMoveDialog();
        if (!projectsCache.length && !projectRootsCache.length) {
          try { await loadProjects(); } catch {}
        }
        const overlay = document.createElement('div');
        overlay.className = 'modal open session-move-modal';
        overlay.id = 'sessionMoveModal';
        document.body.appendChild(overlay);
        let targetPath = '';
        let errorText = '';
        const render = () => {
          const options = sessionMoveProjectOptions(session);
          overlay.innerHTML = `
            <div class="dialog session-move-dialog" role="dialog" aria-modal="true" aria-label="移动会话到项目">
              <div class="dialog-head">
                <strong>移动会话</strong>
                <button class="icon-btn" data-action="close-move-session" aria-label="关闭">×</button>
              </div>
              <div class="dialog-body">
                <div class="session-move-summary">
                  <span>${escapeHtml(sessionTitle(session))}</span>
                  <span>${escapeHtml(session.projectRoot || session.cwd || session.path || '')}</span>
                </div>
                <div class="field session-move-field">
                  <label for="sessionMoveTarget">目标项目</label>
                  <input id="sessionMoveTarget" value="${escapeAttr(targetPath)}" placeholder="选择下方项目或粘贴项目目录" />
                </div>
                <div class="session-move-options">
                  ${options.map((option) => `
                    <button type="button" class="session-move-option ${normalizeSessionPath(targetPath) === normalizeSessionPath(option.workdir) ? 'session-move-option-selected' : ''}" data-workdir="${escapeAttr(option.workdir)}">
                      <span class="session-move-option-title">${escapeHtml(option.label)}</span>
                      <span class="session-move-option-path">${escapeHtml(option.workdir)}${option.current ? ' · 当前所在项目' : ''}${option.count ? ` · ${option.count} 条` : ''}</span>
                    </button>`).join('') || '<div class="session-move-empty">暂无可选项目</div>'}
                </div>
                <div class="session-move-error ${errorText ? '' : 'is-empty'}">${escapeHtml(errorText)}</div>
              </div>
              <div class="dialog-foot">
                <button class="ghost-btn" data-action="close-move-session">取消</button>
                <button class="primary" data-action="confirm-move-session">移动</button>
              </div>
            </div>`;
          const input = overlay.querySelector('#sessionMoveTarget');
          input?.focus();
          input?.addEventListener('input', () => {
            targetPath = input.value;
            errorText = '';
          });
        };
        overlay.addEventListener('click', (event) => {
          if (event.target === overlay) closeSessionMoveDialog();
        });
        overlay.addEventListener('click', async (event) => {
          const actionEl = event.target && event.target.closest ? event.target.closest('[data-action], .session-move-option') : null;
          if (!actionEl) return;
          event.stopPropagation();
          const action = actionEl.getAttribute('data-action');
          if (action === 'close-move-session') {
            closeSessionMoveDialog();
            return;
          }
          if (actionEl.classList.contains('session-move-option')) {
            targetPath = actionEl.getAttribute('data-workdir') || '';
            errorText = '';
            render();
            return;
          }
          if (action === 'confirm-move-session') {
            const input = overlay.querySelector('#sessionMoveTarget');
            targetPath = input?.value || targetPath;
            try {
              overlay.querySelectorAll('button').forEach((button) => { button.disabled = true; });
              await moveSessionToProject(session, targetPath);
            } catch (error) {
              errorText = `移动会话失败：${error.message || error}`;
              render();
            }
          }
        });
        render();
        exposeDebugState();
      }
      function showSessionMenu(x, y, session) {
        closeContextMenu();
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.setAttribute('role', 'menu');
        menu.setAttribute('aria-label', '会话操作菜单');
        const serverPinned = Boolean(session?.pinned);
        const pinned = isSessionPinned(session);
        menu.innerHTML = `
          <button data-action="pin" role="menuitem"${serverPinned ? ' disabled aria-disabled="true"' : ''}>${serverPinned ? '系统置顶' : pinned ? '取消置顶' : '置顶会话'}</button>
          <button data-action="move" role="menuitem">移动到项目...</button>
          <button data-action="delete" role="menuitem" class="danger">归档到回收区</button>
        `;
        positionContextMenu(menu, x, y, 164, 120);
        menu.addEventListener('click', async (event) => {
          event.stopPropagation();
          const button = event.target && event.target.closest('button');
          const action = button?.getAttribute('data-action');
          if (!action || button.disabled) return;
          if (action === 'pin') {
            if (serverPinned) return;
            if (pinnedPaths.has(session.path)) pinnedPaths.delete(session.path);
            else pinnedPaths.add(session.path);
            safeLocalSet('plusPinnedSessions', JSON.stringify([...pinnedPaths]));
            renderSessions();
          }
          if (action === 'move') {
            showSessionMoveDialog(session);
            return;
          }
          if (action === 'delete') {
            button.textContent = '归档中...';
            menu.querySelectorAll('button').forEach((item) => { item.disabled = true; });
            await deleteSession(session);
          }
          if (action !== 'delete' && action !== 'move') closeContextMenu();
        });
        document.body.appendChild(menu);
      }
      function workspaceCleanupCandidates(project, retentionDays) {
        const days = Math.max(0, Number(retentionDays) || 0);
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
        return projectThreadsForWorkdir(project.workdir, project.entries)
          .filter((session) => session?.path && !isRunningSession(session) && !sameSessionPath(session.path, currentResumePath))
          .filter((session) => {
            const modified = Number(session.mtimeMs || session.last_used || 0);
            return modified > 0 && modified <= cutoff;
          });
      }
      function removeWorkspaceSessionCleanupDialog() {
        document.getElementById('workspaceCleanupModal')?.remove();
        exposeDebugState();
      }
      async function cleanupWorkspaceSessions(project, retentionDays, onError) {
        const candidates = workspaceCleanupCandidates(project, retentionDays);
        if (!candidates.length) return 0;
        try {
          for (const session of candidates) await deleteSessionFile(session);
          const deleted = new Set(candidates.map((session) => normalizeSessionPath(session.path)));
          candidates.forEach((session) => {
            pinnedPaths.delete(session.path);
            dropConversationNavPath(session.path);
          });
          safeLocalSet('plusPinnedSessions', JSON.stringify([...pinnedPaths]));
          sessionsCache = sessionsCache.filter((item) => !deleted.has(normalizeSessionPath(item.path)));
          renderSessions();
          renderProjects();
          addSystem(`已清理 ${candidates.length} 个旧会话：${project.workdir}`);
          removeWorkspaceSessionCleanupDialog();
          return candidates.length;
        } catch (error) {
          onError?.(`清理旧会话失败：${error.message || error}`);
          return 0;
        }
      }
      function showWorkspaceSessionCleanupDialog(project) {
        removeWorkspaceSessionCleanupDialog();
        const overlay = document.createElement('div');
        overlay.className = 'modal open workspace-cleanup-modal';
        overlay.id = 'workspaceCleanupModal';
        document.body.appendChild(overlay);
        let retentionInput = safeLocalGet('plusWorkspaceCleanupRetentionDays', '30') || '30';
        let errorText = '';
        const render = () => {
          const parsed = Number.parseInt(retentionInput, 10);
          const valid = Number.isFinite(parsed) && parsed >= 0;
          const candidates = valid ? workspaceCleanupCandidates(project, parsed) : [];
          overlay.innerHTML = `
            <div class="dialog workspace-cleanup-dialog" role="dialog" aria-modal="true" aria-label="清理旧会话">
              <div class="dialog-head">
                <strong>清理旧会话</strong>
                <button class="icon-btn" data-action="close-cleanup" aria-label="关闭">×</button>
              </div>
              <div class="dialog-body">
                <div class="field">
                  <label for="workspaceCleanupRetention">保留天数</label>
                  <input id="workspaceCleanupRetention" type="number" min="0" step="1" value="${escapeAttr(retentionInput)}" />
                </div>
                <div class="workspace-cleanup-summary">
                  <span>${escapeHtml(projectDisplayName(project.workdir))}</span>
                  <span>${valid ? `将清理 ${candidates.length} 个早于 ${parsed} 天的会话` : '请输入 0 或更大的天数'}</span>
                </div>
                <div class="workspace-cleanup-error ${errorText ? '' : 'is-empty'}">${escapeHtml(errorText)}</div>
              </div>
              <div class="dialog-foot">
                <button class="ghost-btn" data-action="close-cleanup">取消</button>
                <button class="primary" data-action="confirm-cleanup" ${valid && candidates.length ? '' : 'disabled'}>清理</button>
              </div>
            </div>`;
          const input = overlay.querySelector('#workspaceCleanupRetention');
          input?.focus();
          input?.addEventListener('input', () => {
            retentionInput = input.value;
            errorText = '';
            render();
          });
        };
        overlay.addEventListener('click', (event) => {
          if (event.target === overlay) removeWorkspaceSessionCleanupDialog();
        });
        overlay.addEventListener('click', async (event) => {
          const action = event.target && event.target.closest ? event.target.closest('[data-action]')?.getAttribute('data-action') : '';
          if (!action) return;
          event.stopPropagation();
          if (action === 'close-cleanup') {
            removeWorkspaceSessionCleanupDialog();
            return;
          }
          if (action === 'confirm-cleanup') {
            const parsed = Number.parseInt(retentionInput, 10);
            safeLocalSet('plusWorkspaceCleanupRetentionDays', String(parsed));
            await cleanupWorkspaceSessions(project, parsed, (message) => {
              errorText = message;
              render();
            });
          }
        });
        render();
        exposeDebugState();
      }
      function removeRecycleRestoreDialog(state) {
        if (state?.filterTimer) {
          window.clearTimeout(state.filterTimer);
          state.filterTimer = 0;
        }
        document.getElementById('recycleRestoreModal')?.remove();
        exposeDebugState();
      }
      function recycleRestoreTime(item) {
        return Number(item?.archiveTime || item?.mtimeMs || item?.sessionTime || 0) || Date.now();
      }
      function recycleRestoreDays(state) {
        const value = Number.parseInt(String(state?.days || 1), 10);
        return [1, 3, 7, 14, 30].includes(value) ? value : 1;
      }
      function recycleRestoreDayOptions(state) {
        const selected = recycleRestoreDays(state);
        return [1, 3, 7, 14, 30].map((days) => `<option value="${days}" ${selected === days ? 'selected' : ''}>${days} 天</option>`).join('');
      }
      function renderRecycleRestoreItems(state) {
        if (state.loading) {
          return '<div class="recycle-restore-empty">正在读取 Codex_RECYCLE...</div>';
        }
        if (state.error) {
          return `<div class="recycle-restore-error">${escapeHtml(state.error)}</div>`;
        }
        if (!state.items.length) {
          const query = String(state.query || '').trim();
          return `<div class="recycle-restore-empty">${query ? `没有匹配“${escapeHtml(query)}”的可恢复历史对话` : `近 ${recycleRestoreDays(state)} 天没有可恢复的历史对话`}</div>`;
        }
        return state.items.map((item) => {
          const restoring = state.restoringPath && normalizeSessionPath(state.restoringPath) === normalizeSessionPath(item.recycledPath);
          return `
            <article class="recycle-restore-item">
              <div class="recycle-restore-copy">
                <div class="recycle-restore-title">${escapeHtml(item.title || item.name || '历史对话')}</div>
                <div class="recycle-restore-summary">${escapeHtml(item.summary || '未提取到最新回复')}</div>
                <div class="recycle-restore-meta">
                  <span>${escapeHtml(relativeTime(recycleRestoreTime(item)))}</span>
                  <span>${escapeHtml(item.bucket || '')}</span>
                  <span title="${escapeAttr(item.recycledPath || '')}">${escapeHtml(item.name || '')}</span>
                </div>
              </div>
              <button class="primary recycle-restore-action" data-action="restore-recycled-session" data-path="${escapeAttr(item.recycledPath || '')}" ${restoring ? 'disabled' : ''}>${restoring ? '恢复中...' : '恢复'}</button>
            </article>`;
        }).join('');
      }
      function renderRecycleRestoreDialog(overlay, state) {
        overlay.innerHTML = `
          <div class="dialog recycle-restore-dialog" role="dialog" aria-modal="true" aria-label="恢复历史对话">
            <div class="dialog-head">
              <div>
                <strong>恢复历史对话</strong>
                <div class="recycle-restore-headline">默认读取近 1 天 Codex_RECYCLE，可切换时间范围并恢复到历史对话项目</div>
              </div>
              <button class="icon-btn" data-action="close-recycle-restore" aria-label="关闭">×</button>
            </div>
            <div class="dialog-body">
              <div class="recycle-restore-summary-card">
                <span>目标项目</span>
                <strong>${escapeHtml(state.historyProject?.name || '历史对话')}</strong>
                <small title="${escapeAttr(state.historyProject?.path || '')}">${escapeHtml(state.historyProject?.path || '等待服务端创建')}</small>
              </div>
              <div class="recycle-restore-filter">
                <label class="recycle-restore-filter-field" for="recycleRestoreQuery">
                  <span>过滤</span>
                  <input id="recycleRestoreQuery" data-action="filter-recycle-restore" type="search" value="${escapeAttr(state.query || '')}" placeholder="输入关键字过滤历史会话" autocomplete="off" />
                </label>
                <label class="recycle-restore-filter-field recycle-restore-filter-range" for="recycleRestoreDays">
                  <span>范围</span>
                  <select id="recycleRestoreDays" data-action="set-recycle-days" aria-label="选择恢复历史对话读取天数">
                    ${recycleRestoreDayOptions(state)}
                  </select>
                </label>
                <small>${state.loading ? '读取中' : `${state.items.length} 条`}</small>
              </div>
              <div class="recycle-restore-list">${renderRecycleRestoreItems(state)}</div>
            </div>
            <div class="dialog-foot">
              <button class="ghost-btn" data-action="refresh-recycle-restore" ${state.loading ? 'disabled' : ''}>刷新</button>
              <button class="ghost-btn" data-action="close-recycle-restore">关闭</button>
            </div>
          </div>`;
        exposeDebugState();
      }
      async function loadRecycleRestoreCandidates(state, overlay) {
        state.loading = true;
        state.error = '';
        renderRecycleRestoreDialog(overlay, state);
        try {
          const params = new URLSearchParams({ days: String(recycleRestoreDays(state)), limit: '200' });
          if (String(state.query || '').trim()) params.set('q', String(state.query || '').trim());
          const response = await fetch(`/session/recycle-candidates?${params.toString()}`, { cache: 'no-store' });
          const data = await response.json().catch(() => ({}));
          if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
          state.items = Array.isArray(data.items) ? data.items : [];
          state.historyProject = data.historyProject || state.historyProject;
        } catch (error) {
          state.error = `读取回收区失败：${error.message || error}`;
        } finally {
          state.loading = false;
          renderRecycleRestoreDialog(overlay, state);
        }
      }
      async function restoreRecycledSessionFromDialog(state, overlay, recycledPath) {
        const target = state.items.find((item) => sameSessionPath(item.recycledPath, recycledPath));
        if (!target || state.restoringPath) return;
        state.restoringPath = target.recycledPath;
        state.error = '';
        renderRecycleRestoreDialog(overlay, state);
        try {
          const response = await fetch('/session/restore', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ recycledPath: target.recycledPath }) });
          const data = await response.json().catch(() => ({}));
          if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
          state.historyProject = data.historyProject || state.historyProject;
          state.items = state.items.filter((item) => !sameSessionPath(item.recycledPath, target.recycledPath));
          addSystem(`已恢复到历史对话：${target.title || target.name || '历史对话'}`);
          await Promise.all([loadSessions(), loadProjects()]);
        } catch (error) {
          state.error = `恢复失败：${error.message || error}`;
        } finally {
          state.restoringPath = '';
          renderRecycleRestoreDialog(overlay, state);
        }
      }
      function openRecycleRestoreDialog() {
        removeRecycleRestoreDialog();
        const overlay = document.createElement('div');
        overlay.className = 'modal open recycle-restore-modal';
        overlay.id = 'recycleRestoreModal';
        document.body.appendChild(overlay);
        const state = { loading: true, error: '', items: [], historyProject: null, restoringPath: '', query: '', days: 1, filterTimer: 0 };
        overlay.addEventListener('click', (event) => {
          if (event.target === overlay) removeRecycleRestoreDialog(state);
        });
        overlay.addEventListener('input', (event) => {
          const target = event.target;
          if (!target?.matches?.('[data-action="filter-recycle-restore"]')) return;
          state.query = target.value || '';
          if (state.filterTimer) window.clearTimeout(state.filterTimer);
          state.filterTimer = window.setTimeout(() => {
            state.filterTimer = 0;
            loadRecycleRestoreCandidates(state, overlay);
          }, 250);
        });
        overlay.addEventListener('change', (event) => {
          const target = event.target;
          if (!target?.matches?.('[data-action="set-recycle-days"]')) return;
          state.days = recycleRestoreDays({ days: target.value });
          if (state.filterTimer) {
            window.clearTimeout(state.filterTimer);
            state.filterTimer = 0;
          }
          loadRecycleRestoreCandidates(state, overlay);
        });
        overlay.addEventListener('click', async (event) => {
          const actionTarget = event.target && event.target.closest ? event.target.closest('[data-action]') : null;
          const action = actionTarget?.getAttribute('data-action') || '';
          if (!action) return;
          if (action === 'close-recycle-restore') {
            removeRecycleRestoreDialog(state);
            return;
          }
          if (action === 'refresh-recycle-restore') {
            await loadRecycleRestoreCandidates(state, overlay);
            return;
          }
          if (action === 'restore-recycled-session') {
            await restoreRecycledSessionFromDialog(state, overlay, actionTarget.getAttribute('data-path') || '');
          }
        });
        loadRecycleRestoreCandidates(state, overlay);
      }
      function showWorkspaceRootMenu(x, y, project) {
        closeContextMenu();
        const menu = document.createElement('div');
        menu.className = 'context-menu workspace-root-menu';
        menu.innerHTML = `
          <button data-action="set-current">设为项目主目录</button>
          <button data-action="new-thread">在此项目中新建会话</button>
          <button data-action="rename-project">重命名项目</button>
          <button data-action="open-explorer">在资源管理器中打开</button>
          <button data-action="cleanup-sessions">清理旧会话...</button>
          <button data-action="remove-root" class="danger">从列表中移除</button>
        `;
        positionContextMenu(menu, x, y, 210, 190);
        menu.addEventListener('click', async (event) => {
          event.stopPropagation();
          const action = event.target && event.target.closest('button')?.getAttribute('data-action');
          if (!action) return;
          try {
            if (action === 'set-current') await openProjectFolder(project.workdir);
            if (action === 'new-thread') await openProjectFolder(project.workdir);
            if (action === 'rename-project') await renameProjectFolder(project);
            if (action === 'open-explorer') await openLocalPath(project.workdir);
            if (action === 'cleanup-sessions') showWorkspaceSessionCleanupDialog(project);
            if (action === 'remove-root') await removeWorkspaceRoot(project);
          } catch (error) {
            addSystem(`项目操作失败：${error.message || error}`, true);
          } finally {
            closeContextMenu();
          }
        });
        document.body.appendChild(menu);
        exposeDebugState();
      }
      function openWorkspaceRootMenuFromEvent(event, project) {
        event.preventDefault();
        event.stopPropagation();
        showWorkspaceRootMenu(event.clientX, event.clientY, project);
      }
      async function deleteSessionFile(session) {
        const response = await fetch('/session', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ path: session.path }) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
      }
      function clearRemovedSessionState(session, reason) {
        pinnedPaths.delete(session.path);
        safeLocalSet('plusPinnedSessions', JSON.stringify([...pinnedPaths]));
        sessionsCache = sessionsCache.filter((item) => !sameSessionPath(item.path, session.path));
        dropConversationNavPath(session.path);
        if (sameSessionPath(currentResumePath, session.path)) {
          currentResumePath = null;
          if (sameSessionPath(activeRuntimeResumePath, session.path)) activeRuntimeResumePath = null;
          if (sameSessionPath(activeStreamSessionPath, session.path)) activeStreamSessionPath = null;
          streamEl = null;
          resumePill.textContent = '未恢复';
          threadTitle.textContent = '新对话';
          threadMeta.textContent = reason;
          log.innerHTML = '';
          log.appendChild(emptyState);
          emptyState.style.display = '';
        }
        updateConversationNavControls();
        renderSessions();
        renderProjects();
      }
      async function deleteSession(session) {
        try {
          await deleteSessionFile(session);
          clearRemovedSessionState(session, '会话已归档到回收区');
          addSystem(`已归档到回收区：${sessionTitle(session)}`);
          closeContextMenu();
        } catch (error) {
          addSystem(`归档到回收区失败：${error.message || error}`, true);
          closeContextMenu();
        }
      }
      async function resumeSession(path, session) {
        try {
          const response = await fetch('/resume', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ path, workdir: session?.cwd || '' }) });
          const data = await response.json().catch(() => ({}));
          if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
          currentResumePath = data.resume_path || path;
          activeRuntimeResumePath = currentResumePath;
          currentWorkdir = data.workdir || currentWorkdir;
          if (session) setActiveSession({ ...session, path: currentResumePath }, false);
          scheduleSidebarRender(80, { full: false });
        } catch (error) {
          addSystem(`恢复会话失败：${error.message || error}`, true);
        }
      }
      async function loadProjects() {
        setListMessage(projectsEl, '正在读取项目...');
        try {
          const response = await fetch('/projects', { cache: 'no-store' });
          const data = await response.json();
          if (!response.ok || !data.groups) throw new Error(data.error || `HTTP ${response.status}`);
          currentWorkdir = data.current || currentWorkdir;
          currentProjectRootPath = data.currentRoot || currentProjectRootPath || currentWorkdir;
          projectRootsCache = Array.isArray(data.roots) ? data.roots : [];
          projectsCache = Object.entries(data.groups || {}).map(([workdir, entries]) => ({ workdir, entries }));
          renderProjects();
        } catch (error) {
          projectsCache = [];
          projectRootsCache = [];
          $('projectCount').textContent = '!';
          setListMessage(projectsEl, `项目读取失败：${error.message || error}`, true);
        }
      }
      async function refreshConversationCollections() {
        if (conversationCollectionsRefresh) return conversationCollectionsRefresh;
        conversationCollectionsRefresh = (async () => {
          await loadSessions();
          await loadProjects();
          renderProjects();
        })().finally(() => {
          conversationCollectionsRefresh = null;
        });
        return conversationCollectionsRefresh;
      }
      function requestConversationCollectionsRefresh() {
        refreshConversationCollections().catch((error) => addSystem(`项目会话刷新失败：${error.message || error}`, true));
      }
      function createProjectThreadItem(thread, rootWorkdir) {
        const item = document.createElement('li');
        item.className = `workspace-thread-item ${sameSessionPath(currentResumePath, thread.path) ? 'workspace-thread-item-active' : ''}`;
        item.dataset.sessionKey = sessionDomKey(thread.path);
        item.setAttribute('aria-current', sameSessionPath(currentResumePath, thread.path) ? 'true' : 'false');
        item.addEventListener('contextmenu', (event) => {
          event.preventDefault();
          showSessionMenu(event.clientX, event.clientY, thread);
        });
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'workspace-thread-button';
        button.title = '点击恢复会话；右键打开菜单';
        const running = isRunningSession(thread);
        const threadMs = sessionTimeMs(thread);
        const status = running
          ? '<span class="workspace-thread-badge workspace-thread-badge-running">运行中</span>'
          : `<span class="workspace-thread-meta relative-time" data-relative-ms="${threadMs}">${escapeHtml(relativeTime(threadMs))}</span>`;
        button.innerHTML = `<span class="workspace-thread-title-row"><span class="workspace-thread-title">${escapeHtml(sessionTitle(thread))}</span>${status}</span>`;
        button.addEventListener('click', async () => {
          await switchToSession({ ...thread, cwd: thread.cwd || rootWorkdir });
        });
        item.appendChild(button);
        return item;
      }
      function renderProjects() {
        const q = (sideFilter.value || '').toLowerCase();
        const searchActive = Boolean(q);
        ensureCurrentProjectExpanded();
        const list = projectsCache.filter((p) => !projectRootHidden(p) && projectMatchesQuery(p, q));
        $('projectCount').textContent = String(list.length);
        projectsEl.innerHTML = '';
        if (!list.length) {
          setListMessage(projectsEl, q ? '没有匹配的项目' : '暂无项目历史');
          exposeDebugState();
          return;
        }
        const categoryList = document.createElement('div');
        categoryList.className = 'workspace-category-list';
        categorizeProjects(list).forEach((category) => {
          const section = document.createElement('section');
          section.className = 'workspace-category';
          section.innerHTML = `
            <div class="workspace-category-title" data-project-category="${escapeAttr(category.id)}">
              <span>${escapeHtml(category.label)}</span>
              <span class="workspace-category-count">${category.items.length}</span>
            </div>`;
          const rootList = document.createElement('div');
          rootList.className = 'workspace-root-list';
          const categoryExpanded = searchActive || expandedProjectCategories.has(category.id);
          const visibleProjects = categoryExpanded ? category.items : category.items.slice(0, SIDEBAR_VISIBLE_LIMIT);
          visibleProjects.forEach((p) => {
          const threads = p.threads || projectThreadsForWorkdir(p.workdir, p.entries);
          const latest = threads[0] || null;
          const key = normalizeSessionPath(p.workdir);
          const expanded = expandedProjectPaths.has(key) || Boolean(q);
          const active = sameProjectPath(p.workdir, currentProjectRootPath || currentWorkdir);
          const name = projectDisplayName(p.workdir);
          const root = document.createElement('div');
          root.className = 'workspace-root-item';
          root.innerHTML = `
            <div class="thread-item workspace-root-row ${active ? 'thread-item-active project-item-active' : ''}" data-workdir="${escapeAttr(p.workdir)}">
              <button type="button" class="workspace-root-button" aria-expanded="${expanded ? 'true' : 'false'}" title="${escapeAttr(p.workdir)}">
                <span class="workspace-root-chevron" aria-hidden="true">${expanded ? '⌄' : '›'}</span>
                <span class="workspace-folder-icon" aria-hidden="true">${FOLDER_BUTTON_SVG}</span>
                <span class="thread-label">${escapeHtml(name)}</span>
                <span class="workspace-root-meta">${threads.length ? `${threads.length} 条` : '空'}</span>
              </button>
              <div class="workspace-root-actions">
                <button type="button" class="workspace-root-menu-btn" title="更多项目操作" aria-label="更多项目操作">⋯</button>
                <button type="button" class="project-rename-btn" title="重命名项目" aria-label="重命名项目">✎</button>
                <button type="button" class="project-new-thread-btn" title="在此项目中新建会话" aria-label="在此项目中新建会话">+</button>
                <button type="button" class="project-open-btn" title="设为项目主目录" aria-label="设为项目主目录">${FOLDER_BUTTON_SVG}</button>
              </div>
            </div>`;
          root.querySelector('.workspace-root-row').addEventListener('contextmenu', (event) => openWorkspaceRootMenuFromEvent(event, p));
          root.querySelector('.workspace-root-button').addEventListener('click', () => toggleProjectExpanded(p.workdir));
          root.querySelector('.workspace-root-menu-btn').addEventListener('click', (event) => {
            openWorkspaceRootMenuFromEvent(event, p);
          });
          root.querySelector('.project-rename-btn').addEventListener('click', (event) => {
            event.stopPropagation();
            renameProjectFolder(p);
          });
          root.querySelector('.project-rename-btn').addEventListener('contextmenu', (event) => openWorkspaceRootMenuFromEvent(event, p));
          root.querySelector('.project-open-btn').addEventListener('click', (event) => {
            event.stopPropagation();
            openProjectFolder(p.workdir);
          });
          root.querySelector('.project-open-btn').addEventListener('contextmenu', (event) => openWorkspaceRootMenuFromEvent(event, p));
          root.querySelector('.project-new-thread-btn').addEventListener('click', (event) => {
            event.stopPropagation();
            openProjectFolder(p.workdir);
          });
          root.querySelector('.project-new-thread-btn').addEventListener('contextmenu', (event) => openWorkspaceRootMenuFromEvent(event, p));
          if (expanded) {
            const threadList = document.createElement('ul');
            threadList.className = 'workspace-thread-list';
            const threadListExpanded = searchActive || expandedProjectThreadLists.has(key);
            const visibleThreads = visibleProjectThreads(threads, threadListExpanded, searchActive);
            visibleThreads.forEach((thread) => threadList.appendChild(createProjectThreadItem(thread, p.workdir)));
            if (!searchActive && (threadListExpanded || visibleThreads.length < threads.length)) {
              const overflow = document.createElement('li');
              overflow.className = 'workspace-thread-overflow';
              overflow.appendChild(createSidebarOverflowButton(
                projectThreadOverflowLabel(threads.length, visibleThreads.length, threadListExpanded),
                () => toggleProjectThreadListExpanded(p.workdir)
              ));
              threadList.appendChild(overflow);
            }
            if (!threads.length) {
              const empty = document.createElement('li');
              empty.className = 'workspace-thread-empty';
              empty.textContent = '此项目暂无会话';
              threadList.appendChild(empty);
            }
            root.appendChild(threadList);
          }
          rootList.appendChild(root);
        });
          if (!searchActive && category.items.length > SIDEBAR_VISIBLE_LIMIT) {
            rootList.appendChild(createSidebarOverflowButton(
              sidebarOverflowLabel(category.items.length, categoryExpanded, '个项目'),
              () => toggleProjectCategoryExpanded(category.id)
            ));
          }
          section.appendChild(rootList);
          categoryList.appendChild(section);
        });
        projectsEl.appendChild(categoryList);
        exposeDebugState();
      }
      async function createProjectFolder(parentPath = '') {
        const parent = String(parentPath || currentProjectRootPath || currentWorkdir || projectPathInput.value || '').trim();
        if (!parent) {
          await openProjectModal();
          return;
        }
        const name = window.prompt(`新建项目文件夹\n位置：${parent}`, '新项目');
        if (name == null) return;
        const trimmed = name.trim();
        if (!trimmed) {
          addSystem('项目名称不能为空。', true);
          return;
        }
        try {
          const response = await fetch('/project/create', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ parentPath: parent, name: trimmed }) });
          const data = await response.json().catch(() => ({}));
          if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
          restoreWorkspaceRoot(data.path || data.workdir);
          currentProjectRootPath = data.root?.path || data.workdir || data.path || currentProjectRootPath;
          currentWorkdir = data.workdir || data.path || currentWorkdir;
          resetToEmptyProjectSession(currentWorkdir, '新建项目');
          closeMobileSidebar();
          await Promise.all([loadSessions(), loadProjects()]);
        } catch (error) {
          addSystem(`新建项目失败：${error.message || error}`, true);
        }
      }
      async function renameProjectFolder(project) {
        const oldPath = String(project?.workdir || '').trim();
        if (!oldPath) return;
        const name = window.prompt('重命名项目文件夹', projectDisplayName(oldPath));
        if (name == null) return;
        const trimmed = name.trim();
        if (!trimmed) {
          addSystem('项目名称不能为空。', true);
          return;
        }
        try {
          const response = await fetch('/project/rename', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ path: oldPath, name: trimmed }) });
          const data = await response.json().catch(() => ({}));
          if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
          const newPath = data.workdir || data.path || oldPath;
          const oldKey = normalizeSessionPath(oldPath);
          const newKey = normalizeSessionPath(newPath);
          if (expandedProjectPaths.delete(oldKey)) expandedProjectPaths.add(newKey);
          if (expandedProjectThreadLists.delete(oldKey)) expandedProjectThreadLists.add(newKey);
          hiddenProjectPaths.delete(oldKey);
          saveExpandedProjectPaths();
          saveHiddenProjectPaths();
          if (sameProjectPath(currentProjectRootPath, oldPath)) currentProjectRootPath = data.root?.path || newPath;
          if (sameProjectPath(currentWorkdir, oldPath)) {
            currentWorkdir = newPath;
            updateComposerContext();
          }
          await Promise.all([loadSessions(), loadProjects()]);
        } catch (error) {
          addSystem(`重命名项目失败：${error.message || error}`, true);
        }
      }
      async function openProjectFolder(workdir) {
        const target = String(workdir || '').trim();
        if (!target) {
          addSystem('请先输入项目主目录路径。', true);
          return;
        }
        try {
          const response = await fetch('/project/open', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ path: target }) });
          const data = await response.json().catch(() => ({}));
          if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
          restoreWorkspaceRoot(data.workdir || target);
          currentProjectRootPath = data.root?.path || data.workdir || target;
          resetToEmptyProjectSession(data.workdir || target, '项目主目录');
          closeMobileSidebar();
          closeModal('projectModal');
          await Promise.all([loadSessions(), loadProjects()]);
        } catch (error) {
          addSystem(`打开文件夹失败：${error.message || error}`, true);
        }
      }
      async function openLocalPath(localPath) {
        try {
          const response = await fetch('/path/open', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ path: localPath }) });
          const data = await response.json().catch(() => ({}));
          if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
          return data;
        } catch (error) {
          addSystem(`打开本地路径失败：${error.message || error}`, true);
        }
      }
      function assistantReplyCopyText(replyNode) {
        const clone = replyNode.cloneNode(true);
        clone.querySelectorAll([
          '.assistant-reply-copy-row',
          '.assistant-reply-copy-btn',
          '.context-menu',
          '.message-actions',
          '.timeline-actions',
          '.tool-actions',
          'button',
          'input',
          'textarea',
          'select'
        ].join(',')).forEach((node) => node.remove());
        const content = clone.querySelector([
          '.assistant-content',
          '.assistant-message-content',
          '.agent-message-content',
          '.message-content',
          '.markdown-body',
          '.timeline-content',
          '.message-text'
        ].join(',')) || clone;
        return (content.innerText || content.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
      }
      async function copyTextToClipboard(value) {
        const textValue = String(value || '');
        if (!textValue) return false;
        if (navigator.clipboard?.writeText && window.isSecureContext) {
          await navigator.clipboard.writeText(textValue);
          return true;
        }
        const area = document.createElement('textarea');
        area.value = textValue;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.left = '-9999px';
        area.style.top = '0';
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand('copy');
        area.remove();
        return ok;
      }
      function isAssistantReplyNode(node) {
        if (!node || node.nodeType !== 1) return false;
        const identity = [
          node.dataset?.role,
          node.dataset?.author,
          node.dataset?.type,
          node.dataset?.kind,
          node.className
        ].filter(Boolean).join(' ').toLowerCase();
        const hasReplyContent = Boolean(node.querySelector([
          '.assistant-content',
          '.assistant-message-content',
          '.agent-message-content',
          '.message-content',
          '.markdown-body',
          '.timeline-content',
          '.message-text',
          'p',
          'pre',
          'ol',
          'ul'
        ].join(',')));
        if (!hasReplyContent) return false;
        if (/(user|human|system|tool|function|terminal|command|error)/.test(identity) && !/(assistant|agent|codex|model)/.test(identity)) return false;
        if (/(assistant|agent|codex|model)/.test(identity)) return true;
        const label = (node.querySelector('.role,.speaker,.author,.timeline-role,.avatar')?.textContent || '').toLowerCase();
        if (/(user|human|system|tool|function|terminal|command|error)/.test(label)) return false;
        if (/(assistant|agent|codex|model|助手)/.test(label)) return true;
        return false;
      }
      function assistantReplyCandidates(root = log) {
        const selector = [
          '[data-role="assistant"]',
          '[data-author="assistant"]',
          '[data-type="assistant"]',
          '[data-kind="assistant"]',
          '[class*="assistant"]',
          '[class*="agent-message"]',
          '[class*="message-agent"]',
          '[class*="role-assistant"]',
          '.assistant-message',
          '.message-assistant',
          '.timeline-item-assistant',
          '.timeline-assistant',
          '.agent-message',
          '.model-message',
          '.codex-message'
        ].join(',');
        const found = [...root.querySelectorAll(selector)];
        const direct = [...root.children].filter(isAssistantReplyNode);
        return [...new Set([...found, ...direct])].filter(isAssistantReplyNode);
      }
      function installAssistantReplyCopyButtons(root = log) {
        assistantReplyCandidates(root).forEach((replyNode) => {
          const textValue = assistantReplyCopyText(replyNode);
          if (!textValue) return;
          let row = replyNode.querySelector('.assistant-reply-copy-row');
          let button = row?.querySelector('.assistant-reply-copy-btn');
          if (!row || !button) {
            row = document.createElement('div');
            row.className = 'assistant-reply-copy-row';
            row.style.cssText = 'display:flex;justify-content:flex-end;margin-top:8px;';
            button = document.createElement('button');
            button.type = 'button';
            button.className = 'assistant-reply-copy-btn ghost-btn';
            button.textContent = '复制';
            button.title = '复制本次完整回复';
            button.setAttribute('aria-label', '复制本次完整回复');
            button.style.cssText = 'min-height:26px;padding:4px 9px;font-size:12px;line-height:1;border-radius:6px;';
            button.addEventListener('click', async (event) => {
              event.preventDefault();
              event.stopPropagation();
              const latestText = assistantReplyCopyText(replyNode);
              if (!latestText) return;
              const copied = await copyTextToClipboard(latestText);
              button.textContent = copied ? '已复制' : '复制失败';
              window.setTimeout(() => { button.textContent = '复制'; }, 1200);
            });
            row.appendChild(button);
          }
          const mount = replyNode.querySelector('.assistant-content,.assistant-message-content,.agent-message-content,.message-content,.markdown-body,.timeline-content') || replyNode;
          if (row.parentElement !== mount) mount.appendChild(row);
        });
      }
      let assistantReplyCopyRefreshTimer = null;
      function scheduleAssistantReplyCopyRefresh() {
        window.clearTimeout(assistantReplyCopyRefreshTimer);
        assistantReplyCopyRefreshTimer = window.setTimeout(() => installAssistantReplyCopyButtons(), 80);
      }
      if (typeof MutationObserver === 'function') {
        const assistantReplyCopyObserver = new MutationObserver(scheduleAssistantReplyCopyRefresh);
        assistantReplyCopyObserver.observe(log, { childList: true, subtree: true });
      }
      scheduleAssistantReplyCopyRefresh();
      function beginTranscriptTransition() {
        log.classList.remove('timeline-entering');
        log.classList.add('timeline-switching');
      }
      function finishTranscriptTransition() {
        log.classList.remove('timeline-switching');
        log.classList.add('timeline-entering');
        setTimeout(() => log.classList.remove('timeline-entering'), 220);
      }
      async function loadTranscript(path, options = {}) {
        const serial = options.serial || ++transcriptSwitchSerial;
        const smooth = options.smooth === true;
        const transcriptPath = path || currentResumePath || '';
        if (smooth) beginTranscriptTransition();
        try {
          const response = await fetch(transcriptPageEndpoint(transcriptPath), { cache: 'no-store' });
          const data = await response.json();
          if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
          if (serial !== transcriptSwitchSerial) return;
          log.innerHTML = '';
          transcriptHistoryLoader = null;
          resetTranscriptPageState(data.current || transcriptPath);
          streamEl = null;
          if (emptyState) log.appendChild(emptyState);
          turnQuestionText.clear();
          latestUserQuestionText = '';
          activeTurnId = '';
          const messages = data.messages || [];
          updateTranscriptPageState(data, data.current || transcriptPath);
          renderTranscriptHistoryLoader();
          renderTranscriptPageMessages(messages, data.current || transcriptPath);
          if (!messages.length) addSystem('这个会话没有解析到可展示消息。', true);
          ensureNotEmpty();
          scrollToBottom();
          updateTokenStats();
          if (smooth) finishTranscriptTransition();
        } catch (error) {
          if (serial !== transcriptSwitchSerial) return;
          log.innerHTML = '';
          resetTranscriptPageState();
          if (emptyState) log.appendChild(emptyState);
          addSystem(`读取会话失败：${error.message || error}`, true);
          if (smooth) finishTranscriptTransition();
        }
      }
      async function loadMemory() {
        const body = $('memoryBody');
        body.innerHTML = '';
        try {
          const data = await (await fetch('/memory')).json();
          const facts = data.facts || [];
          if (!facts.length) body.innerHTML = '<div class="memory-row">暂无记忆。</div>';
          facts.forEach((fact) => {
            const row = document.createElement('div');
            row.className = 'memory-row';
            row.textContent = fact;
            row.title = '右键删除';
            row.addEventListener('contextmenu', async (event) => {
              event.preventDefault();
              if (!confirm('删除这条记忆？')) return;
              await fetch('/memory', { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ fact }) });
              row.remove();
            });
            body.appendChild(row);
          });
        } catch {
          body.innerHTML = '<div class="memory-row">读取失败。</div>';
        }
      }
      async function startNewChat() {
        const response = await fetch('/new-chat', { method:'POST' });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
        currentWorkdir = data.workdir || currentWorkdir;
        log.innerHTML = '';
        resetTranscriptPageState();
        log.appendChild(emptyState);
        emptyState.style.display = '';
        currentResumePath = null;
        activeRuntimeResumePath = null;
        activeStreamSessionPath = null;
        streamEl = null;
        codexRunning = false;
        queuedFollowUps = [];
        guidanceState = { pending: 0, saved: 0, count: 0, items: [] };
        turnQuestionText.clear();
        latestUserQuestionText = '';
        activeTurnId = '';
        updateComposerControls();
        renderQueuePanel();
        updateConversationNavControls();
        resumePill.textContent = '新会话';
        threadTitle.textContent = projectName(currentWorkdir);
        threadMeta.textContent = currentWorkdir ? `已新建空会话 · ${currentWorkdir}` : '已新建空会话';
        await refreshConversationCollections();
        closeMobileSidebar();
        closeSlashCommandPalette();
      }
      function queuePreview(item) {
        const textValue = stripInternalMemoryBlocks(item.text || '').trim();
        if (textValue) return textValue.length > 120 ? `${textValue.slice(0, 120)}…` : textValue;
        const count = (item.attachments || []).length;
        return count === 1 ? '包含 1 个附件' : `包含 ${count} 个附件`;
      }
      function normalizeGuidanceState(value) {
        const state = value && typeof value === 'object' ? value : {};
        const items = Array.isArray(state.items) ? state.items : [];
        return {
          pending: Number(state.pending || 0),
          saved: Number(state.saved || 0),
          count: Number(state.count || items.length || 0),
          items
        };
      }
      function applyGuidanceState(value) {
        guidanceState = normalizeGuidanceState(value);
      }
      function renderQueuePanel() {
        if (!queuePanel) return;
        if (!queuedFollowUps.length) {
          queuePanel.hidden = true;
          queuePanel.innerHTML = '';
          return;
        }
        queuePanel.hidden = false;
        queuePanel.innerHTML = `
          <section class="home-turn-plan-drawer composer-queue-drawer" aria-label="排队发送">
            <button type="button" class="home-turn-plan-handle" id="queueToggle" data-expanded="${queuePanelCollapsed ? '' : 'true'}" aria-expanded="${queuePanelCollapsed ? 'false' : 'true'}">
              <div class="home-turn-plan-handle-info">
                <span class="home-turn-plan-title">排队发送</span>
                <span class="home-turn-plan-progress">共 ${queuedFollowUps.length} 条待发送</span>
              </div>
              <span class="home-turn-plan-handle-icon" aria-hidden="true">›</span>
            </button>
            <div class="home-turn-plan-card composer-queue-card" ${queuePanelCollapsed ? 'hidden' : ''}>
              <div class="home-turn-plan-summary composer-queue-summary"><span>${codexRunning ? '当前回复完成后自动继续' : '将按顺序自动继续对话'}</span><button type="button" class="composer-queue-clear" id="queueClear">清空</button></div>
              <ol class="home-turn-plan-list">
                ${queuedFollowUps.map((item, index) => `
                  <li class="home-turn-plan-item composer-queue-item" data-id="${escapeHtml(item.id)}">
                    <span class="home-turn-plan-index">${index + 1}</span>
                    <div class="composer-queue-body">
                      <p class="home-turn-plan-text composer-queue-text">${escapeHtml(queuePreview(item))}</p>
                      ${(item.attachments || []).length ? `<div class="composer-queue-attachments">${item.attachments.map((att) => `<span class="attachment-clip">${escapeHtml(att.name || 'image')}</span>`).join('')}</div>` : ''}
                    </div>
                    <div class="composer-queue-actions">
                      <button type="button" class="home-turn-plan-status composer-queue-promote" data-action="promote" title="提前为下一条引导">引导</button>
                      <button type="button" class="composer-queue-remove" data-action="remove">移除</button>
                    </div>
                  </li>
                `).join('')}
              </ol>
            </div>
          </section>`;
      }
      function composerHasDraft() {
        return Boolean(text.value.trim()) || composerAttachments.length > 0;
      }
      function clearComposerDraft() {
        safeLocalRemove(COMPOSER_DRAFT_KEY);
      }
      function readComposerDraft() {
        try {
          const parsed = JSON.parse(safeLocalGet(COMPOSER_DRAFT_KEY, '') || 'null');
          if (!parsed || typeof parsed.text !== 'string') return null;
          return parsed;
        } catch {
          clearComposerDraft();
          return null;
        }
      }
      function persistComposerDraftSnapshot(value = '') {
        const draftText = String(value || '');
        if (!draftText.trim()) {
          clearComposerDraft();
          return;
        }
        safeLocalSet(COMPOSER_DRAFT_KEY, JSON.stringify({
          text: draftText,
          updatedAt: Date.now(),
          resumePath: currentResumePath || '',
          workdir: currentWorkdir || ''
        }));
      }
      function persistComposerDraft() {
        persistComposerDraftSnapshot(text.value);
      }
      function restoreComposerDraft() {
        if (text.value.trim()) return false;
        const draft = readComposerDraft();
        if (!draft?.text?.trim()) return false;
        text.value = draft.text;
        autoSizeText();
        updateSlashCommandPalette();
        return true;
      }
      function updateComposerControls() {
        const shouldStop = codexRunning;
        const title = shouldStop ? '停止当前回复' : '发送';
        send.dataset.mode = shouldStop ? 'stop' : 'send';
        send.classList.toggle('send-btn-stop', shouldStop);
        send.innerHTML = shouldStop ? STOP_BUTTON_SVG : SEND_BUTTON_SVG;
        send.title = title;
        send.setAttribute('aria-label', title);
        send.disabled = composerRequestInFlight;
        updateComposerContext();
        if (composerFollowupHint) {
          const showFollowupHint = codexRunning && composerHasDraft() && !composerRequestInFlight;
          composerFollowupHint.hidden = !showFollowupHint;
          composerFollowupHint.textContent = showFollowupHint ? '运行中按 Enter 发送引导，未接收则自动排队' : '';
        }
        if (composerRunState) {
          const state = composerRequestInFlight ? 'busy' : (shouldStop ? 'running' : 'idle');
          composerRunState.dataset.state = state;
          composerRunState.textContent = state === 'busy' ? '处理中' : (state === 'running' ? '回复中' : '就绪');
        }
        updateMessageEditControls();
      }
      async function updateQueueFromResponse(response) {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
        if (Array.isArray(data.queue)) queuedFollowUps = data.queue;
        codexRunning = Boolean(data.running);
        updateComposerControls();
        renderQueuePanel();
      }
      async function queueAction(action, id = '') {
        const urls = { promote: '/queue/promote', remove: '/queue/remove', clear: '/queue/clear' };
        const url = urls[action];
        if (!url) throw new Error('未知队列操作');
        const response = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id }) });
        await updateQueueFromResponse(response);
      }
      function setPendingUserInputRequest(request) {
        pendingUserInputRequest = request && Array.isArray(request.questions) ? request : null;
        userInputPromptCurrentIndex = 0;
        userInputSelectedOptions = {};
        userInputFreeText = {};
        renderUserInputPrompt();
      }
      function clearPendingUserInputRequest(requestId = '') {
        if (!pendingUserInputRequest) return;
        if (requestId && pendingUserInputRequest.requestId !== requestId) return;
        pendingUserInputRequest = null;
        userInputPromptCurrentIndex = 0;
        userInputSelectedOptions = {};
        userInputFreeText = {};
        renderUserInputPrompt();
      }
      function promptQuestions() {
        return pendingUserInputRequest?.questions || [];
      }
      function promptQuestion(index = userInputPromptCurrentIndex) {
        return promptQuestions()[index] || null;
      }
      function hasPromptOptions(question) {
        return Array.isArray(question?.options) && question.options.length > 0;
      }
      function promptUsesFreeText(question) {
        return Boolean(question?.isOther) || question?.options === null;
      }
      function promptQuestionAnswered(question) {
        if (!question) return false;
        const typed = String(userInputFreeText[question.id] || '').trim();
        const selected = String(userInputSelectedOptions[question.id] || '').trim();
        return Boolean(typed || selected);
      }
      function allPromptQuestionsAnswered() {
        const questions = promptQuestions();
        return questions.length > 0 && questions.every(promptQuestionAnswered);
      }
      function promptAnswerList(question) {
        const typed = String(userInputFreeText[question.id] || '').trim();
        if (typed) return [typed];
        const selected = String(userInputSelectedOptions[question.id] || '').trim();
        return selected ? [selected] : [];
      }
      function buildPromptAnswers() {
        return Object.fromEntries(promptQuestions().map((question) => [question.id, promptAnswerList(question)]));
      }
      function renderPromptProgress(total) {
        const prevDisabled = userInputPromptCurrentIndex <= 0 ? 'disabled' : '';
        const nextDisabled = userInputPromptCurrentIndex >= total - 1 ? 'disabled' : '';
        const nav = total > 1 ? `
          <div class="home-user-input-progress-nav">
            <button type="button" class="home-user-input-progress-button" data-prompt-nav="prev" aria-label="上一题" ${prevDisabled}><span class="home-user-input-progress-icon home-user-input-progress-icon-back" aria-hidden="true">›</span></button>
            <button type="button" class="home-user-input-progress-button" data-prompt-nav="next" aria-label="下一题" ${nextDisabled}><span class="home-user-input-progress-icon" aria-hidden="true">›</span></button>
          </div>` : '';
        return `<div class="home-user-input-progress"><span class="home-user-input-progress-count">${userInputPromptCurrentIndex + 1}/${total}</span>${nav}</div>`;
      }
      function renderPromptOptions(question) {
        if (!hasPromptOptions(question)) return '';
        const selected = String(userInputSelectedOptions[question.id] || '');
        return `<div class="home-user-input-options">${question.options.map((option, index) => `
          <div class="home-user-input-option-row">
            <button type="button" class="home-user-input-option" data-selected="${selected === option.label ? 'true' : 'false'}" data-prompt-option="${escapeAttr(option.label)}" data-question-id="${escapeAttr(question.id)}">
              <span class="home-user-input-option-index">${index + 1}</span>
              <span class="home-user-input-option-copy"><strong>${escapeHtml(option.label)}</strong>${option.description ? `<span>${escapeHtml(option.description)}</span>` : ''}</span>
            </button>
          </div>`).join('')}</div>`;
      }
      function renderPromptFreeText(question) {
        if (!promptUsesFreeText(question)) return '';
        const value = userInputFreeText[question.id] || '';
        const label = question.isOther ? '其他答案' : '回答';
        const placeholder = question.isSecret ? '请输入答案' : '输入你的回答';
        const input = question.isSecret
          ? `<input class="home-user-input-input" type="password" value="${escapeAttr(value)}" placeholder="${escapeAttr(placeholder)}" data-prompt-free="${escapeAttr(question.id)}" />`
          : `<textarea class="home-user-input-textarea" placeholder="${escapeAttr(placeholder)}" data-prompt-free="${escapeAttr(question.id)}">${escapeHtml(value)}</textarea>`;
        const isLast = userInputPromptCurrentIndex >= promptQuestions().length - 1;
        const disabled = isLast ? (allPromptQuestionsAnswered() ? '' : 'disabled') : (promptQuestionAnswered(question) ? '' : 'disabled');
        const action = isLast
          ? `<button type="button" class="plan-request-submit home-user-input-submit home-user-input-inline-action" data-prompt-submit ${disabled}>提交答案</button>`
          : `<button type="button" class="plan-request-submit home-user-input-inline-action" data-prompt-nav="next" ${disabled}>下一题</button>`;
        return `<label class="home-user-input-freeform"><span class="home-user-input-freeform-label">${label}</span>${input}<div class="home-user-input-freeform-actions">${action}</div></label>`;
      }
      function renderUserInputPrompt() {
        if (!userInputPrompt) return;
        const questions = promptQuestions();
        const question = promptQuestion();
        if (!pendingUserInputRequest || !question) {
          userInputPrompt.hidden = true;
          userInputPrompt.innerHTML = '';
          return;
        }
        userInputPrompt.hidden = false;
        const submitDisabled = allPromptQuestionsAnswered() ? '' : 'disabled';
        const optionActions = promptUsesFreeText(question) ? '' : `<div class="home-user-input-option-actions"><button type="button" class="plan-request-submit home-user-input-submit" data-prompt-submit ${submitDisabled}>提交答案</button></div>`;
        userInputPrompt.innerHTML = `
          <section class="home-turn-plan-drawer home-user-input-prompt" aria-label="需要补充信息" data-request-id="${escapeAttr(pendingUserInputRequest.requestId)}">
            <div class="home-turn-plan-handle home-user-input-prompt-header" data-expanded="true">
              <div class="home-turn-plan-handle-info"><span class="home-turn-plan-title">需要补充信息</span></div>
              ${renderPromptProgress(questions.length)}
            </div>
            <div class="home-turn-plan-card home-user-input-request-card">
              <div class="home-user-input-prompt-body">
                <div class="home-user-input-question">
                  <p class="home-user-input-question-header">${escapeHtml(question.header || 'Question')}</p>
                  <p class="home-user-input-question-copy">${escapeHtml(question.question || '')}</p>
                </div>
                ${renderPromptOptions(question)}
                ${renderPromptFreeText(question)}
                ${optionActions}
              </div>
            </div>
          </section>`;
      }
      async function submitUserInputPrompt() {
        if (!pendingUserInputRequest || !allPromptQuestionsAnswered()) return;
        const requestId = pendingUserInputRequest.requestId;
        const response = await fetch('/server-request/resolve', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ requestId, answers: buildPromptAnswers() })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
        clearPendingUserInputRequest(requestId);
      }
      async function sendMessage() {
        const value = text.value.trim();
        const attachments = composerAttachments.map((item) => ({ ...item }));
        if (!value && !attachments.length) return;
        const previousResumePath = currentResumePath;
        const promptText = value || '请分析附件图片。';
        composerRequestInFlight = true;
        updateComposerControls();
        persistComposerDraftSnapshot(value);
        text.value = '';
        composerAttachments = [];
        renderAttachments();
        autoSizeText();
        try {
          const response = await fetch('/message', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ text: promptText, attachments, collaborationPreset, serviceTier: currentServiceTier() }) });
          if (!response.ok && response.status !== 202) throw new Error(`HTTP ${response.status}`);
          const data = await response.json().catch(() => ({}));
          if (data.ok === false) throw new Error(data.error || '发送失败');
          if (data.resume_path) currentResumePath = data.resume_path;
          activeRuntimeResumePath = data.resume_path || activeRuntimeResumePath || currentResumePath;
          if (typeof data.running === 'boolean') codexRunning = data.running;
          else if (data.status === 'started' || data.status === 'steered' || data.status === 'queued') codexRunning = true;
          if (data.status === 'started' || data.status === 'steered') recordTurnStarted(activeRuntimeResumePath);
          if (Array.isArray(data.queue)) {
            queuedFollowUps = data.queue;
          }
          updateComposerControls();
          renderQueuePanel();
          clearComposerDraft();
          if (normalizeSessionPath(previousResumePath) !== normalizeSessionPath(currentResumePath) || data.status === 'started') {
            requestConversationCollectionsRefresh();
          }
        } catch (error) {
          text.value = value;
          composerAttachments = attachments;
          renderAttachments();
          autoSizeText();
          persistComposerDraft();
          addSystem(`发送失败：${error.message || error}`, true);
        } finally {
          composerRequestInFlight = false;
          updateComposerControls();
          text.focus();
        }
      }
      async function stopCurrentTurn() {
        if (!codexRunning) return;
        composerRequestInFlight = true;
        updateComposerControls();
        try {
          const response = await fetch('/cancel', { method:'POST' });
          const data = await response.json().catch(() => ({}));
          if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
          codexRunning = false;
          queuedFollowUps = [];
          guidanceState = { pending: 0, saved: 0, count: 0, items: [] };
          updateComposerControls();
          renderQueuePanel();
          addSystem('已停止当前 Codex 进程。');
        } catch (error) {
          addSystem(`停止失败：${error.message || error}`, true);
        } finally {
          composerRequestInFlight = false;
          updateComposerControls();
          text.focus();
        }
      }
      function autoSizeText() {
        text.style.height = 'auto';
        text.style.height = Math.min(text.scrollHeight, 180) + 'px';
      }
      function appendToComposer(value) {
        const prefix = text.value.trim() ? '\n\n' : '';
        text.value += prefix + value;
        autoSizeText();
        persistComposerDraft();
        updateComposerControls();
        text.focus();
      }
      function renderAttachments() {
        const tray = $('attachmentTray');
        tray.innerHTML = '';
        tray.classList.toggle('has-attachments', composerAttachments.length > 0);
        composerAttachments.forEach((item, index) => {
          const chip = document.createElement('div');
          chip.className = 'attachment-chip';
          chip.innerHTML = `<img src="${item.dataUrl}" alt="" /><span>${escapeHtml(item.name)}</span><button title="移除" data-index="${index}">×</button>`;
          chip.querySelector('button').addEventListener('click', () => {
            composerAttachments.splice(index, 1);
            renderAttachments();
          });
          tray.appendChild(chip);
        });
        updateComposerControls();
      }
      function readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(reader.error || new Error('读取图片失败'));
          reader.readAsDataURL(file);
        });
      }
      async function addImageAttachment(file) {
        if (!file || !file.type || !file.type.startsWith('image/')) return false;
        if (file.size > 8 * 1024 * 1024) {
          addSystem(`图片过大，已跳过：${file.name || '剪贴板图片'} (${toKB(file.size)})`, true);
          return true;
        }
        try {
          const dataUrl = await readFileAsDataUrl(file);
          composerAttachments.push({
            type: 'image',
            name: file.name || `pasted-image-${composerAttachments.length + 1}.png`,
            mime: file.type,
            size: file.size,
            dataUrl
          });
          renderAttachments();
        } catch (error) {
          addSystem(`读取图片失败：${error.message || error}`, true);
        }
        return true;
      }
      async function handlePickedFiles(files) {
        const picked = [...files];
        for (const file of picked) {
          if (await addImageAttachment(file)) continue;
          if (file.size > 220 * 1024) {
            addSystem(`附件过大，已跳过：${file.name} (${toKB(file.size)})`, true);
            continue;
          }
          try {
            const body = await file.text();
            appendToComposer(`<file name="${file.name}">\n${body}\n</file>`);
          } catch (error) {
            addSystem(`读取附件失败：${file.name}：${error.message || error}`, true);
          }
        }
      }
      let recognition = null;
      function toggleDictation() {
        const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!Speech) {
          addSystem('当前浏览器不支持 Web Speech 听写。', true);
          return;
        }
        if (recognition) {
          recognition.stop();
          recognition = null;
          $('dictationBtn').classList.remove('composer-mini-btn-active');
          return;
        }
        recognition = new Speech();
        recognition.lang = 'zh-CN';
        recognition.interimResults = false;
        recognition.onresult = (event) => {
          const transcript = [...event.results].map((result) => result[0]?.transcript || '').join('');
          if (transcript.trim()) appendToComposer(transcript.trim());
        };
        recognition.onerror = (event) => addSystem(`听写失败：${event.error || 'unknown'}`, true);
        recognition.onend = () => {
          recognition = null;
          $('dictationBtn').classList.remove('composer-mini-btn-active');
        };
        $('dictationBtn').classList.add('composer-mini-btn-active');
        recognition.start();
      }
      function startEvents() {
        if (eventStreamStarted) return;
        eventStreamStarted = true;
        const es = new EventSource('/events');
        es.addEventListener('open', () => { connDot.className = 'status-dot ok'; threadMeta.textContent = '已连接'; });
        es.addEventListener('status', (event) => {
          try {
            const data = JSON.parse(event.data);
            const previousResumePath = currentResumePath;
            const previousRuntimeResumePath = activeRuntimeResumePath;
            const previousRunning = codexRunning;
            const nextRuntimeResumePath = data.resume_path || null;
            const wasFollowingRuntimeSession = !currentResumePath || !previousRuntimeResumePath || sameSessionPath(currentResumePath, previousRuntimeResumePath);
            activeRuntimeResumePath = nextRuntimeResumePath;
            currentWorkdir = data.workdir || currentWorkdir;
            if (data.running && !codexRunning) recordTurnStarted(activeRuntimeResumePath);
            codexRunning = Boolean(data.running);
            queuedFollowUps = Array.isArray(data.queue) ? data.queue : [];
            if ('pendingUserInput' in data) {
              if (data.pendingUserInput) setPendingUserInputRequest(data.pendingUserInput);
              else clearPendingUserInputRequest();
            }
            updateComposerControls();
            renderQueuePanel();
            const shouldFollowRuntimeSession = wasFollowingRuntimeSession || !currentResumePath || sameSessionPath(currentResumePath, activeRuntimeResumePath);
            if (shouldFollowRuntimeSession) currentResumePath = activeRuntimeResumePath;
            resumePill.textContent = data.resumed && shouldFollowRuntimeSession ? '已恢复' : '新会话';
            const active = shouldFollowRuntimeSession ? sessionsCache.find((s) => sameSessionPath(s.path, currentResumePath)) : null;
            const activeKnown = Boolean(active);
            if (active) {
              setActiveSession(active, false);
            } else if (shouldFollowRuntimeSession) {
              threadTitle.textContent = data.resumed && data.resume_meta ? fmtDate(data.resume_meta.mtimeMs) : projectName(currentWorkdir);
              threadMeta.textContent = data.resume_meta ? `${toKB(data.resume_meta.size)} · ${data.resume_path}` : (currentWorkdir || '本地 Codex proto');
              markSidebarActiveSession(currentResumePath);
            } else {
              markSidebarActiveSession(currentResumePath);
            }
            const pathChanged = normalizeSessionPath(previousResumePath) !== normalizeSessionPath(currentResumePath);
            if (activeKnown && previousRunning === codexRunning) {
              scheduleSidebarRender(80, { full: false });
            } else {
              scheduleSidebarRender();
            }
            if (pathChanged && !activeKnown) {
              requestConversationCollectionsRefresh();
            }
          } catch {}
        });
        es.addEventListener('system', (event) => {
          const data = JSON.parse(event.data);
          addSystem(data.text || '');
        });
        es.addEventListener('stderr', (event) => {
          const data = JSON.parse(event.data);
          addSystem(data.text || '', true);
          if (/error|failed|失败|异常/i.test(data.text || '')) {
            deliverAppNotification({ title: 'Agent Error', body: data.text || '', kind: 'error', minVisible: false });
          }
        });
        es.addEventListener('tool', (event) => {
          const data = JSON.parse(event.data);
          addTool(data.name || '工具', data.detail || '');
        });
        es.addEventListener('timeline_item', (event) => {
          const data = JSON.parse(event.data);
          addTimelineItem(data);
          const serialized = JSON.stringify(data);
          if (/approval|elicitation|userInput|question/i.test(serialized)) {
            deliverAppNotification({ title: 'Input needed', body: data.text || data.detail || data.title || 'Your input is needed.', kind: 'warning', minVisible: false });
          }
          if (/\"type\":\"plan\"|\"kind\":\"plan\"|Plan ready/i.test(serialized)) {
            deliverAppNotification({ title: 'Plan ready', body: data.text || data.detail || data.title || 'A plan is ready for review.', kind: 'success', minVisible: false });
          }
        });
        es.addEventListener('server_request', (event) => {
          const data = JSON.parse(event.data);
          if (data.kind === 'userInput' && Array.isArray(data.questions)) {
            setPendingUserInputRequest(data);
            deliverAppNotification({ title: 'Input needed', body: data.questions[0]?.question || '需要补充信息。', kind: 'warning', minVisible: false });
          }
        });
        es.addEventListener('server_request_resolved', (event) => {
          const data = JSON.parse(event.data);
          clearPendingUserInputRequest(data.requestId || '');
        });
        es.addEventListener('user_message', (event) => {
          const data = JSON.parse(event.data);
          const eventSessionPath = sessionPathForStreamingEvent(data);
          if (!shouldRenderStreamingEvent(eventSessionPath)) return;
          activeStreamSessionPath = eventSessionPath || currentResumePath || activeRuntimeResumePath || '';
          if (pendingEditedUserEcho && Date.now() < pendingEditedUserEcho.expiresAt && String(data.text || '').trim() === pendingEditedUserEcho.text) {
            pendingEditedUserEcho = null;
            return;
          }
          activeTurnId = String(data.turnId || activeTurnId || '').trim();
          addBubble(data.text || '', 'user', { attachments: data.attachments || [], turnId: activeTurnId, startedAt: data.startedAt || data.timestamp || '', sessionPath: activeStreamSessionPath });
        });
        es.addEventListener('delta', (event) => {
          const data = JSON.parse(event.data);
          const eventSessionPath = sessionPathForStreamingEvent(data);
          if (!shouldRenderStreamingEvent(eventSessionPath)) return;
          activeStreamSessionPath = eventSessionPath || currentResumePath || activeRuntimeResumePath || '';
          if (streamEl && streamEl.dataset.sessionPath && !sameSessionPath(streamEl.dataset.sessionPath, activeStreamSessionPath)) streamEl = null;
          if (!streamEl) {
            if (emptyState) emptyState.style.display = 'none';
            streamEl = addBubble('', 'agent', { status: 'streaming', turnId: activeTurnId, question: questionForAssistant({ turnId: activeTurnId }), sessionPath: activeStreamSessionPath });
          }
          const inner = streamEl.querySelector('.message-text');
          const raw = (streamEl.dataset.raw || '') + (data.text || '');
          latestAgentMessageText = raw;
          streamEl.dataset.answer = stripInternalMemoryBlocks(raw);
          streamEl.dataset.raw = raw;
          inner.innerHTML = renderMarkdownBlocks(stripInternalMemoryBlocks(raw));
          scrollToBottom();
          updateTokenStats();
        });
        es.addEventListener('message', (event) => {
          const data = JSON.parse(event.data);
          const eventSessionPath = sessionPathForStreamingEvent(data);
          if (!shouldRenderStreamingEvent(eventSessionPath)) {
            if (streamEl && sameSessionPath(streamEl.dataset.sessionPath, eventSessionPath)) streamEl = null;
            if (sameSessionPath(activeStreamSessionPath, eventSessionPath)) activeStreamSessionPath = null;
            return;
          }
          activeStreamSessionPath = eventSessionPath || currentResumePath || activeRuntimeResumePath || '';
          if (streamEl && streamEl.dataset.sessionPath && !sameSessionPath(streamEl.dataset.sessionPath, activeStreamSessionPath)) streamEl = null;
          const finalText = stripInternalMemoryBlocks(data.text || latestAgentMessageText);
          const meta = maybeNotifyAgentCompletion(data.text || latestAgentMessageText);
          if (streamEl) {
            streamEl.dataset.status = 'done';
            const statusEl = streamEl.querySelector('.message-status');
            if (statusEl) statusEl.textContent = bubbleStatusLabel('done');
            applyAssistantMetadata(streamEl, finalText, { ...meta, turnId: meta.turnId || activeTurnId, question: questionForAssistant({ turnId: meta.turnId || activeTurnId }), sessionPath: activeStreamSessionPath || currentResumePath });
            streamEl = null;
          } else {
            addBubble(finalText, 'agent', { ...meta, turnId: meta.turnId || activeTurnId, question: questionForAssistant({ turnId: meta.turnId || activeTurnId }), sessionPath: activeStreamSessionPath || currentResumePath });
          }
          activeStreamSessionPath = null;
        });
        es.addEventListener('notification', (event) => {
          const data = JSON.parse(event.data);
          deliverAppNotification(data);
        });
        es.addEventListener('error', () => {
          connDot.className = 'status-dot err';
          threadMeta.textContent = 'SSE 重连中';
        });
      }

      document.querySelectorAll('[data-close]').forEach((btn) => {
        btn.addEventListener('click', () => closeModal(btn.getAttribute('data-close')));
      });
      window.addEventListener('click', () => {
        closeContextMenu();
        closeComposerMoreMenu();
      });
      window.addEventListener('focus', updateWindowFocusState);
      window.addEventListener('blur', updateWindowFocusState);
      document.addEventListener('visibilitychange', updateWindowFocusState);
      window.addEventListener('beforeunload', persistComposerDraft);
      window.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        closeContextMenu();
        closeComposerMoreMenu();
        closeMobileSidebar();
      });
      window.addEventListener('resize', () => {
        if (window.innerWidth > 860) closeMobileSidebar();
        if (messageEditState?.input) resizeMessageEditorInput(messageEditState.input);
      });
      queuePanel?.addEventListener('click', async (event) => {
        const button = event.target && event.target.closest('button');
        if (!button) return;
        try {
          if (button.id === 'queueToggle') {
            queuePanelCollapsed = !queuePanelCollapsed;
            renderQueuePanel();
            return;
          }
          if (button.id === 'queueClear') {
            await queueAction('clear');
            return;
          }
          const item = button.closest('.queue-item');
          const id = item?.getAttribute('data-id') || '';
          const action = button.getAttribute('data-action');
          if (action === 'promote' || action === 'remove') await queueAction(action, id);
        } catch (error) {
          addSystem(`队列操作失败：${error.message || error}`, true);
        }
      });
      userInputPrompt?.addEventListener('click', (event) => {
        const button = event.target && event.target.closest ? event.target.closest('button') : null;
        if (!button || !pendingUserInputRequest) return;
        const nav = button.getAttribute('data-prompt-nav');
        if (nav === 'prev') {
          userInputPromptCurrentIndex = Math.max(0, userInputPromptCurrentIndex - 1);
          renderUserInputPrompt();
          return;
        }
        if (nav === 'next') {
          const current = promptQuestion();
          if (current && !promptQuestionAnswered(current)) return;
          userInputPromptCurrentIndex = Math.min(promptQuestions().length - 1, userInputPromptCurrentIndex + 1);
          renderUserInputPrompt();
          return;
        }
        if (button.hasAttribute('data-prompt-option')) {
          const questionId = button.getAttribute('data-question-id') || '';
          const option = button.getAttribute('data-prompt-option') || '';
          const current = promptQuestion();
          userInputSelectedOptions = { ...userInputSelectedOptions, [questionId]: option };
          if (current && promptUsesFreeText(current)) userInputFreeText = { ...userInputFreeText, [questionId]: '' };
          if (userInputPromptCurrentIndex < promptQuestions().length - 1) userInputPromptCurrentIndex += 1;
          renderUserInputPrompt();
          return;
        }
        if (button.hasAttribute('data-prompt-submit')) {
          submitUserInputPrompt().catch((error) => addSystem(`提交引导答案失败：${error.message || error}`, true));
        }
      });
      userInputPrompt?.addEventListener('input', (event) => {
        const target = event.target;
        if (!target || !target.getAttribute) return;
        const questionId = target.getAttribute('data-prompt-free');
        if (!questionId) return;
        userInputFreeText = { ...userInputFreeText, [questionId]: target.value || '' };
        if (String(target.value || '').trim()) userInputSelectedOptions = { ...userInputSelectedOptions, [questionId]: '' };
        renderUserInputPrompt();
        const nextField = userInputPrompt.querySelector(`[data-prompt-free="${CSS.escape(questionId)}"]`);
        if (nextField) {
          nextField.focus();
          if (typeof nextField.setSelectionRange === 'function') {
            const end = String(nextField.value || '').length;
            nextField.setSelectionRange(end, end);
          }
        }
      });
      slashCommandPalette?.addEventListener('mousemove', (event) => {
        const button = event.target && event.target.closest ? event.target.closest('.composer-command-palette-item') : null;
        if (!button) return;
        slashSelectedIndex = Number(button.dataset.index || 0);
        renderSlashCommandPalette();
      });
      slashCommandPalette?.addEventListener('click', async (event) => {
        const button = event.target && event.target.closest ? event.target.closest('.composer-command-palette-item') : null;
        if (!button) return;
        event.preventDefault();
        await selectSlashCommand(Number(button.dataset.index || 0));
      });
      historyBackBtn.addEventListener('click', () => {
        navigateConversationHistory('back').catch((error) => addSystem(`返回上一个对话失败：${error.message || error}`, true));
      });
      historyForwardBtn.addEventListener('click', () => {
        navigateConversationHistory('forward').catch((error) => addSystem(`前进到下一个对话失败：${error.message || error}`, true));
      });
      $('themeToggle').addEventListener('click', () => setTheme(document.body.classList.contains('dark') ? 'light' : 'dark'));
      mobileSidebarBtn.addEventListener('click', openMobileSidebar);
      sidebarBackdrop.addEventListener('click', closeMobileSidebar);
      openFolderBtn.addEventListener('click', () => openProjectModal());
      createProjectBtn.addEventListener('click', () => createProjectFolder());
      restoreHistoryBtn?.addEventListener('click', openRecycleRestoreDialog);
      openAccountBtn?.addEventListener('click', () => openAccountPanel().catch((error) => setAccountStatus(`账号面板打开失败：${error.message || error}`, true)));
      skillsTabPlugins.addEventListener('click', () => { skillsState.activeTab = 'plugins'; skillsState.managerOpen = false; renderSkillsPanel(); });
      skillsTabInstalled.addEventListener('click', () => { skillsState.activeTab = 'skills'; skillsState.managerOpen = false; renderSkillsPanel(); });
      skillsManageBtn.addEventListener('click', () => { skillsState.managerOpen = !skillsState.managerOpen; renderSkillsPanel(); });
      skillsRefreshBtn.addEventListener('click', () => loadSkillsPanel().catch((error) => setSkillsActionError(`刷新失败：${error.message || error}`)));
      skillsSearchInput.addEventListener('input', () => { skillsState.query = skillsSearchInput.value || ''; renderSkillsPanel(); });
      skillsMarketplaceFilter.addEventListener('change', () => { skillsState.marketplace = skillsMarketplaceFilter.value || 'all'; renderSkillsPanel(); });
      skillsPluginStatusFilter.addEventListener('change', () => { skillsState.pluginStatus = skillsPluginStatusFilter.value || 'all'; renderSkillsPanel(); });
      skillsManagementTabs.addEventListener('click', (event) => {
        const button = event.target && event.target.closest ? event.target.closest('[data-management-tab]') : null;
        if (!button) return;
        skillsState.managementTab = button.dataset.managementTab || 'plugins';
        renderSkillsPanel();
      });
      skillsPanel.addEventListener('click', (event) => {
        const button = event.target && event.target.closest ? event.target.closest('[data-skills-action]') : null;
        if (!button) return;
        handleSkillsAction(button).catch((error) => setSkillsActionError(error.message || String(error)));
      });
      mcpPanel.addEventListener('click', (event) => {
        const button = event.target && event.target.closest ? event.target.closest('[data-mcp-action]') : null;
        if (!button) return;
        handleMcpAction(button).catch((error) => { mcpState.error = error.message || String(error); renderMcpPanel(); });
      });
      mcpPanel.addEventListener('change', (event) => {
        if (event.target?.name === 'type' && mcpState.editing) {
          const form = new FormData(document.getElementById('mcpServerForm'));
          mcpState.editing = { ...mcpState.editing, ...Object.fromEntries(form.entries()), enabled: form.get('enabled') === 'true' };
          renderMcpPanel();
        }
      });
      mcpPanel.addEventListener('submit', (event) => {
        if (event.target?.id === 'mcpServerForm') saveMcpForm(event);
      });
      previewLoadBtn.addEventListener('click', () => loadQuickPreview().catch((error) => {
        if (previewPanel) previewPanel.innerHTML = `<div class="quick-preview-status quick-preview-error">预览失败：${escapeHtml(error.message || error)}</div>`;
      }));
      previewOpenExternal.addEventListener('click', () => openPreviewExternal().catch((error) => addSystem(`外部打开失败：${error.message || error}`, true)));
      previewTargetInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          loadQuickPreview().catch((error) => {
            if (previewPanel) previewPanel.innerHTML = `<div class="quick-preview-status quick-preview-error">预览失败：${escapeHtml(error.message || error)}</div>`;
          });
        }
      });
      terminalSpawnBtn.addEventListener('click', () => spawnTerminal().catch((error) => setTerminalStatus(`终端创建失败：${error.message || error}`, true)));
      terminalRefreshBtn.addEventListener('click', () => loadTerminalSessions().catch((error) => setTerminalStatus(`终端刷新失败：${error.message || error}`, true)));
      terminalKillBtn.addEventListener('click', () => killActiveTerminal().catch((error) => setTerminalStatus(`终端结束失败：${error.message || error}`, true)));
      terminalSendInputBtn.addEventListener('click', () => sendTerminalInput().catch((error) => setTerminalStatus(`stdin 发送失败：${error.message || error}`, true)));
      terminalStdinInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          sendTerminalInput().catch((error) => setTerminalStatus(`stdin 发送失败：${error.message || error}`, true));
        }
      });
      gitRefreshBtn.addEventListener('click', () => loadGitPanel(gitPanelState.scope).catch((error) => setGitStatusLine(`Git 刷新失败：${error.message || error}`, true)));
      gitOpenRepoBtn.addEventListener('click', () => {
        const repo = gitPanelState.status?.repoRoot || gitPanelState.status?.root || currentWorkdir;
        if (repo) openLocalPath(repo);
      });
      gitScopeUnstaged.addEventListener('click', () => loadGitPanel('unstaged').catch((error) => setGitStatusLine(`Git 读取失败：${error.message || error}`, true)));
      gitScopeStaged.addEventListener('click', () => loadGitPanel('staged').catch((error) => setGitStatusLine(`Git 读取失败：${error.message || error}`, true)));
      gitStageSelected.addEventListener('click', () => runGitPathAction('/git/stage').catch((error) => setGitStatusLine(`暂存失败：${error.message || error}`, true)));
      gitUnstageSelected.addEventListener('click', () => runGitPathAction('/git/unstage').catch((error) => setGitStatusLine(`取消暂存失败：${error.message || error}`, true)));
      gitDiscardSelected.addEventListener('click', () => discardSelectedGitChanges().catch((error) => setGitStatusLine(`丢弃失败：${error.message || error}`, true)));
      gitCommitBtn.addEventListener('click', () => commitGitChanges().catch((error) => setGitStatusLine(`提交失败：${error.message || error}`, true)));
      gitPullBtn.addEventListener('click', () => pullGitChanges().catch((error) => setGitStatusLine(`拉取失败：${error.message || error}`, true)));
      gitPushBtn.addEventListener('click', () => pushGitChanges().catch((error) => setGitStatusLine(`推送失败：${error.message || error}`, true)));
      gitBranchCreate.addEventListener('click', () => createGitBranch().catch((error) => setGitStatusLine(`创建分支失败：${error.message || error}`, true)));
      projectOpenConfirm.addEventListener('click', () => openProjectFolder(projectPathInput.value));
      projectPickFolder.addEventListener('click', pickProjectFolder);
      projectBrowseUp.addEventListener('click', () => {
        if (projectBrowserState.parent) loadProjectBrowser(projectBrowserState.parent);
      });
      projectBrowseRefresh.addEventListener('click', () => loadProjectBrowser(projectPathInput.value || projectBrowserState.path));
      projectOpenExplorer.addEventListener('click', () => {
        const target = projectBrowserState.path || projectPathInput.value;
        if (target) openLocalPath(target);
      });
      projectPathInput.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        openProjectFolder(projectPathInput.value);
      });
      $('newChatBtn').addEventListener('click', () => {
        startNewChat().catch((error) => addSystem(`新建会话失败：${error.message || error}`, true));
      });
      $('cancelBtn').addEventListener('click', stopCurrentTurn);
      $('restartBtn').addEventListener('click', async () => {
        await fetch('/restart', { method:'POST' });
        addSystem('已请求重启当前会话。');
      });
      $('openSettingsBtn').addEventListener('click', async () => { await loadConfig(); openModal('settingsModal'); });
      $('modelSelectBtn').addEventListener('click', async () => { await loadConfig(); openModal('settingsModal'); });
      $('effortSelectBtn').addEventListener('click', async () => { await loadConfig(); openModal('settingsModal'); });
      $('permissionBtn').addEventListener('click', (event) => { event.stopPropagation(); openPermissionMenu().catch((error) => addSystem(`权限菜单打开失败：${error.message || error}`, true)); });
      $('localModeBtn').addEventListener('click', () => addSystem('当前会话运行在本地 Codex CLI。'));
      $('openMemoryBtn').addEventListener('click', async () => { await loadMemory(); openModal('memoryModal'); });
      accountRefreshBtn?.addEventListener('click', () => loadAccountPanel());
      accountLoginBtn?.addEventListener('click', () => startAccountLogin().catch((error) => setAccountStatus(`登录启动失败：${error.message || error}`, true)));
      accountLogoutBtn?.addEventListener('click', () => logoutAccount().then(loadAccountPanel).catch((error) => setAccountStatus(`退出失败：${error.message || error}`, true)));
      $('settingsSave').addEventListener('click', async () => { await saveConfig(); closeModal('settingsModal'); });
      $('settingsRestart').addEventListener('click', async () => {
        await saveConfig();
        await fetch('/restart', { method:'POST' });
        closeModal('settingsModal');
      });
      $('attachmentBtn').addEventListener('click', (event) => {
        event.stopPropagation();
        toggleComposerMoreMenu();
      });
      composerMoreMenu?.addEventListener('click', (event) => {
        event.stopPropagation();
        const button = event.target && event.target.closest ? event.target.closest('button') : null;
        if (!button) return;
        if (button.id === 'composerAddAttachment') {
          closeComposerMoreMenu();
          $('filePicker').click();
          return;
        }
        if (button.id === 'composerSpeedTrigger') {
          toggleComposerSpeedMenu();
          return;
        }
        if (button.hasAttribute('data-service-tier')) {
          selectServiceTier(button.getAttribute('data-service-tier') || '').catch((error) => addSystem(`Speed 切换失败：${error.message || error}`, true));
          return;
        }
        if (button.id === 'composerPlanMenuBtn') {
          togglePlanMode();
          return;
        }
        if (button.hasAttribute('data-permission-level')) {
          applyPermissionLevel(button.getAttribute('data-permission-level') || 'default').catch((error) => addSystem(`权限切换失败：${error.message || error}`, true));
        }
      });
      $('filePicker').addEventListener('change', (event) => {
        handlePickedFiles(event.currentTarget.files || []);
        event.currentTarget.value = '';
      });
      $('dictationBtn').addEventListener('click', toggleDictation);
      sideFilter.addEventListener('input', () => { renderSessions(); renderProjects(); });
      $('timeline').addEventListener('scroll', () => {
        const timeline = $('timeline');
        if (timeline.scrollTop <= 80) loadOlderTranscriptPage().catch((error) => addSystem(`加载更早历史失败：${error.message || error}`, true));
      });
      log.addEventListener('click', (event) => {
        const trigger = event.target && event.target.closest ? event.target.closest('.local-path-link') : null;
        if (!trigger) return;
        event.preventDefault();
        openLocalPath(trigger.dataset.path || trigger.textContent || '');
      });
      send.addEventListener('click', () => {
        if (send.dataset.mode === 'stop') stopCurrentTurn();
        else sendMessage();
      });
      text.addEventListener('input', () => {
        autoSizeText();
        persistComposerDraft();
        updateComposerControls();
        updateSlashCommandPalette();
      });
      text.addEventListener('focus', updateSlashCommandPalette);
      text.addEventListener('paste', (event) => {
        const files = [...(event.clipboardData?.files || [])].filter((file) => file.type.startsWith('image/'));
        if (!files.length) return;
        event.preventDefault();
        files.forEach((file) => { addImageAttachment(file); });
      });
      text.addEventListener('keydown', (event) => {
        if (slashPaletteItems.length) {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            slashSelectedIndex = (slashSelectedIndex + 1) % slashPaletteItems.length;
            renderSlashCommandPalette();
            return;
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            slashSelectedIndex = (slashSelectedIndex - 1 + slashPaletteItems.length) % slashPaletteItems.length;
            renderSlashCommandPalette();
            return;
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            closeSlashCommandPalette();
            return;
          }
          if (event.key === 'Tab') {
            event.preventDefault();
            selectSlashCommand();
            return;
          }
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            selectSlashCommand();
            return;
          }
        }
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          sendMessage();
        }
      });

      async function boot() {
        document.body.dataset.webuiBuild = CLIENT_BUILD;
        setTheme(safeLocalGet('plusWebTheme', 'light') || 'light');
        ensureSidebarVisible();
        updatePlanModeControls();
        updateConversationNavControls();
        exposeDebugState();
        await checkAssetVersion();
        if (DEBUG_NO_EVENTS) {
          connDot.className = 'status-dot ok';
          threadMeta.textContent = '诊断模式：已跳过 SSE';
        } else {
          startEvents();
        }
        expandedProjectPaths = new Set(readExpandedProjectPaths().map((item) => normalizeSessionPath(item)));
        hiddenProjectPaths = new Set(readHiddenProjectPaths().map((item) => normalizeSessionPath(item)));
        await Promise.all([loadConfig(), loadSessions(), loadProjects()]);
        if (currentResumePath) await loadTranscript(currentResumePath);
        restoreComposerDraft();
        if (!DEBUG_NO_EVENTS) startAssetVersionWatch();
        setInterval(refreshRelativeTimes, 60 * 1000);
        exposeDebugState();
        updateComposerControls();
        text.focus();
      }
      boot().catch((error) => {
        addSystem(`启动失败：${error.message || error}`, true);
      });
