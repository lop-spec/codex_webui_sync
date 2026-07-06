(() => {
  const $ = (id) => document.getElementById(id);
  const token = new URLSearchParams(location.search).get('token') || '';

  const els = {
    dot: $('dot'),
    status: $('status'),
    peerState: $('peerState'),
    queueState: $('queueState'),
    workdir: $('workdir'),
    threadTitle: $('threadTitle'),
    messages: $('messages'),
    messageScroll: $('messageScroll'),
    emptyState: $('emptyState'),
    composer: document.querySelector('.composer'),
    text: $('text'),
    send: $('send'),
    attachFiles: $('attachFiles'),
    chatFilePicker: $('chatFilePicker'),
    attachmentTray: $('attachmentTray'),
    reconnect: $('reconnect'),
    newChat: $('newChat'),
    sessionDrawer: $('sessionDrawer'),
    transferToggle: $('transferToggle'),
    sessionList: $('sessionList'),
    sessionCount: $('sessionCount'),
    sessionSearch: $('sessionSearch'),
    drawerToggle: $('drawerToggle'),
    closeDrawer: $('closeDrawer'),
    sidebarBackdrop: $('sidebarBackdrop'),
    queuePanel: $('queuePanel'),
    toastViewport: $('toastViewport')
  };

  let pc = null;
  let dc = null;
  let requestSeq = 0;
  let streamBubble = null;
  let streamRaw = '';
  let eventStreamStarted = false;
  let transcriptSerial = 0;
  let lastLocalUser = null;
  let latestUserQuestionText = '';
  let currentTurnId = '';
  let currentTurnStartedAt = 0;
  let messageEditState = null;
  let attachmentSeq = 0;
  let chatAttachments = [];
  let composerBusy = false;

  const pending = new Map();
  const encoder = new TextEncoder();
  const SUPPORTED_IMAGE_MIME = /^(image\/png|image\/jpeg|image\/webp|image\/gif)$/i;
  const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
  const state = {
    ready: false,
    running: false,
    sessions: [],
    currentPath: '',
    currentWorkdir: '',
    queue: [],
    filter: ''
  };

  function setStatus(textValue, mode = 'warn') {
    els.status.textContent = textValue;
    els.dot.classList.toggle('ok', mode === 'ok');
    els.dot.classList.toggle('bad', mode === 'bad');
  }

  function updateReady() {
    const ready = state.ready;
    const hasDraft = Boolean(els.text.value.trim() || chatAttachments.length);
    const attachmentBusy = chatAttachments.some((item) => item.status === 'reading' || item.status === 'uploading');
    const attachmentInvalid = chatAttachments.some((item) => item.status === 'error');
    els.send.disabled = !ready || (!state.running && (!hasDraft || attachmentBusy || attachmentInvalid || composerBusy));
    els.send.dataset.mode = state.running ? 'stop' : 'send';
    els.send.classList.toggle('send-btn-stop', state.running);
    els.send.title = state.running ? '停止当前回复' : '发送';
    els.send.setAttribute('aria-label', state.running ? '停止当前回复' : '发送');
    els.send.innerHTML = state.running ? '<span aria-hidden="true">停</span>' : '<span aria-hidden="true">&#8593;</span>';
    els.newChat.disabled = !ready;
    if (els.transferToggle) els.transferToggle.disabled = !ready;
    if (els.attachFiles) els.attachFiles.disabled = !ready || composerBusy;
    if (els.chatFilePicker) els.chatFilePicker.disabled = !ready || composerBusy;
    els.text.disabled = !ready || composerBusy;
    els.peerState.textContent = `WebRTC ${pc?.connectionState || 'new'} · DataChannel ${dc?.readyState || 'new'}`;
    els.workdir.textContent = state.currentWorkdir || '等待本机项目';
    els.workdir.title = state.currentWorkdir || '';
    els.queueState.hidden = !state.queue.length;
    els.queueState.textContent = state.queue.length ? `${state.queue.length} 条排队` : '';
    window.dispatchEvent(new CustomEvent('codex-p2p-state', {
      detail: { ready, running: state.running, workdir: state.currentWorkdir, currentPath: state.currentPath }
    }));
    updateMessageEditControls();
  }

  function toast(textValue, error = false) {
    const node = document.createElement('div');
    node.className = `toast ${error ? 'error' : ''}`;
    node.textContent = textValue;
    els.toastViewport.appendChild(node);
    setTimeout(() => node.remove(), error ? 5200 : 3200);
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function stripInternalBlocks(value) {
    return String(value || '')
      .replace(/<memory\b[^>]*>[\s\S]*?<\/memory>/gi, '')
      .replace(/<oai-mem-citation\b[^>]*>[\s\S]*?<\/oai-mem-citation>/gi, '')
      .trim();
  }

  function linkify(html) {
    return html.replace(
      /(https?:\/\/[^\s<>"']+)/g,
      '<a href="$1" target="_blank" rel="noreferrer noopener">$1</a>'
    );
  }

  function renderText(value) {
    const textValue = stripInternalBlocks(value);
    if (!textValue) return '';
    const parts = textValue.split(/```/);
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        const lines = part.replace(/^\w+\r?\n/, '');
        return `<pre><code>${escapeHtml(lines)}</code></pre>`;
      }
      return linkify(escapeHtml(part))
        .split(/\n{2,}/)
        .map((para) => `<p>${para.replace(/\r?\n/g, '<br>')}</p>`)
        .join('');
    }).join('');
  }

  function renderMessageAttachments(attachments = []) {
    const items = Array.isArray(attachments) ? attachments.filter(Boolean) : [];
    if (!items.length) return null;
    const wrap = document.createElement('div');
    wrap.className = 'msg-attachments';
    items.forEach((item) => {
      const href = item.url || item.downloadUrl || '';
      const node = href ? document.createElement('a') : document.createElement('span');
      node.className = 'msg-attachment';
      if (href) {
        node.href = href;
        node.target = '_blank';
        node.rel = 'noreferrer noopener';
      }
      const label = item.name || (item.kind === 'image' ? 'image' : 'file');
      if (item.kind === 'image' && item.url) {
        node.innerHTML = `<img src="${escapeHtml(item.url)}" alt=""><span>${escapeHtml(label)}</span>`;
      } else {
        node.innerHTML = `<span aria-hidden="true">#</span><span>${escapeHtml(label)}</span>`;
      }
      wrap.appendChild(node);
    });
    return wrap;
  }

  function scrollBottom() {
    requestAnimationFrame(() => {
      els.messageScroll.scrollTop = els.messageScroll.scrollHeight;
    });
  }

  function setEmptyVisible() {
    els.emptyState.hidden = els.messages.children.length > 0;
  }

  function timeMs(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value > 10_000_000_000 ? value : value * 1000;
    if (!value) return 0;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function formatDuration(ms) {
    const value = Number(ms || 0);
    if (!Number.isFinite(value) || value <= 0) return '未记录';
    const total = Math.max(1, Math.round(value / 1000));
    if (total < 60) return `${total}s`;
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }

  function formatCompletionTime(value) {
    const date = new Date(value || Date.now());
    if (!Number.isFinite(date.getTime())) return '刚刚';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function rememberQuestion(textValue, options = {}) {
    const value = stripInternalBlocks(textValue || '');
    if (!value) return;
    latestUserQuestionText = value;
    currentTurnId = String(options.turnId || currentTurnId || '').trim();
    currentTurnStartedAt = timeMs(options.startedAt || options.timestamp) || currentTurnStartedAt || Date.now();
  }

  function shouldShowAssistantFooter(options = {}) {
    return Boolean(options.completedAt || Number(options.durationMs || 0) > 0 || options.showAssistantFooter === true);
  }

  function assistantMeta(node, options = {}) {
    const completedAt = options.completedAt || node.dataset.completedAt || '';
    const durationMs = Number(options.durationMs || 0) || 0;
    const turnId = String(options.turnId || node.dataset.turnId || currentTurnId || '').trim();
    const question = String(options.question || node.dataset.question || latestUserQuestionText || '').trim();
    if (turnId) node.dataset.turnId = turnId;
    if (question) node.dataset.question = question;
    if (completedAt) node.dataset.completedAt = completedAt;
    else delete node.dataset.completedAt;
    if (durationMs) node.dataset.durationMs = String(durationMs);
    else delete node.dataset.durationMs;
    return { completedAt, durationMs, turnId, question };
  }

  function renderAssistantFooter(node, options = {}) {
    if (!node || !node.classList.contains('agent')) return;
    node.querySelector('.msg-footer')?.remove();
    if (!shouldShowAssistantFooter(options)) return;
    const meta = assistantMeta(node, options);
    const footer = document.createElement('div');
    footer.className = 'msg-footer';
    footer.innerHTML = `
      <span class="msg-footer-meta">耗时 ${escapeHtml(formatDuration(meta.durationMs))} · 完成 ${escapeHtml(formatCompletionTime(meta.completedAt))}</span>
      <button class="msg-favorite" type="button" aria-label="收藏" title="收藏" data-action="favorite">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.8 2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6L7.1 19l.9-5.5-4-3.9 5.5-.8L12 3.8Z"/></svg>
      </button>`;
    footer.querySelector('[data-action="favorite"]')?.addEventListener('click', () => saveFavorite(node).catch((error) => toast(`收藏失败：${error.message}`, true)));
    node.querySelector('.msg-card')?.appendChild(footer);
  }

  async function saveFavorite(node) {
    const payload = {
      sessionPath: state.currentPath || '',
      turnId: node.dataset.turnId || '',
      question: node.dataset.question || latestUserQuestionText || '',
      answer: node.dataset.raw || '',
      completedAt: node.dataset.completedAt || new Date().toISOString(),
      durationMs: Number(node.dataset.durationMs || 0) || 0
    };
    const result = await p2pJson('POST', '/favorites', payload);
    node.querySelector('.msg-favorite')?.classList.add('saved');
    toast(result.duplicate ? '已在收藏' : '已收藏');
  }

  function setupUserMessageEdit(node, originalText, options = {}) {
    if (!node || !options.turnId || node.dataset.editBound === 'true') return;
    const card = node.querySelector('.msg-card');
    if (!card) return;
    node.dataset.editBound = 'true';
    node.dataset.turnId = options.turnId;
    node.dataset.sessionPath = options.sessionPath || state.currentPath || '';
    const actions = document.createElement('div');
    actions.className = 'msg-actions';
    actions.innerHTML = '<button class="msg-edit" type="button" data-action="edit-user" aria-label="编辑消息" title="编辑消息">编辑</button>';
    actions.querySelector('[data-action="edit-user"]')?.addEventListener('click', () => startUserMessageEdit(node, originalText, options));
    card.appendChild(actions);
  }

  function updateMessageEditControls() {
    els.messages?.querySelectorAll('.msg-edit').forEach((button) => {
      button.disabled = state.running || !state.ready || Boolean(messageEditState);
      button.setAttribute('aria-disabled', button.disabled ? 'true' : 'false');
    });
  }

  function cancelUserMessageEdit() {
    if (!messageEditState) return;
    messageEditState.node.classList.remove('editing');
    messageEditState.editor?.remove();
    messageEditState = null;
    updateMessageEditControls();
  }

  function resizeMessageEditorInput(input) {
    if (!input) return;
    input.style.height = 'auto';
    const maxHeight = Math.min(Math.max(Math.floor(window.innerHeight * 0.42), 160), 360);
    input.style.height = `${Math.max(96, Math.min(input.scrollHeight, maxHeight))}px`;
    input.style.overflowY = input.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }

  function startUserMessageEdit(node, originalText, options = {}) {
    if (state.running) {
      addMessage('system', '当前回复仍在运行，结束或停止后才能编辑历史消息。');
      return;
    }
    const turnId = String(options.turnId || node.dataset.turnId || '').trim();
    if (!turnId) {
      addMessage('system', '这条历史消息缺少 turnId，不能安全回滚重跑。');
      return;
    }
    cancelUserMessageEdit();
    node.classList.add('editing');
    const editor = document.createElement('div');
    editor.className = 'msg-editor';
    editor.innerHTML = `
      <textarea class="msg-editor-input" rows="4" aria-label="编辑消息"></textarea>
      <div class="msg-editor-actions">
        <button class="msg-editor-btn" type="button" data-edit-action="cancel">取消</button>
        <button class="msg-editor-btn primary" type="button" data-edit-action="submit">发送</button>
      </div>`;
    node.querySelector('.msg-card')?.appendChild(editor);
    const input = editor.querySelector('textarea');
    input.value = node.dataset.raw || originalText || '';
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    resizeMessageEditorInput(input);
    messageEditState = {
      node,
      editor,
      input,
      turnId,
      path: node.dataset.sessionPath || state.currentPath || '',
      attachments: options.attachments || []
    };
    editor.querySelector('[data-edit-action="cancel"]')?.addEventListener('click', cancelUserMessageEdit);
    editor.querySelector('[data-edit-action="submit"]')?.addEventListener('click', () => submitUserMessageEdit());
    input.addEventListener('input', () => resizeMessageEditorInput(input));
    input.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        submitUserMessageEdit();
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        cancelUserMessageEdit();
      }
    });
    updateMessageEditControls();
  }

  function trimMessagesAfter(node) {
    let next = node.nextSibling;
    while (next) {
      const current = next;
      next = next.nextSibling;
      current.remove();
    }
    streamBubble = null;
    streamRaw = '';
  }

  async function submitUserMessageEdit() {
    const editState = messageEditState;
    if (!editState) return;
    const editedText = editState.input.value.trim();
    if (!editedText) {
      addMessage('system', '编辑后的消息不能为空。');
      return;
    }
    editState.editor.querySelectorAll('button, textarea').forEach((node) => { node.disabled = true; });
    try {
      const data = await p2pJson('POST', '/message/edit', {
        path: editState.path || state.currentPath,
        turnId: editState.turnId,
        text: editedText,
        attachments: editState.attachments,
        collaborationPreset: 'default',
        serviceTier: null
      });
      const body = editState.node.querySelector('.msg-body');
      if (body) body.innerHTML = renderText(editedText);
      editState.node.dataset.raw = editedText;
      editState.node.classList.add('pending');
      rememberQuestion(editedText, { turnId: editState.turnId, startedAt: Date.now() });
      lastLocalUser = { text: editedText, at: Date.now(), node: editState.node };
      currentTurnStartedAt = Date.now();
      trimMessagesAfter(editState.node);
      cancelUserMessageEdit();
      state.running = Boolean(data.running || data.status === 'started' || data.status === 'steered' || data.status === 'queued');
      state.currentPath = data.resume_path || state.currentPath;
      state.currentWorkdir = data.workdir || state.currentWorkdir;
      renderQueue(data.queue || []);
      updateReady();
      if (data.status === 'queued') toast('已加入排队');
      loadSessions().catch(() => undefined);
    } catch (error) {
      addMessage('system', `编辑消息失败：${error.message || error}`);
      editState.editor.querySelectorAll('button, textarea').forEach((node) => { node.disabled = false; });
      updateMessageEditControls();
    }
  }

  function addMessage(role, textValue, options = {}) {
    const node = document.createElement('article');
    node.className = `msg ${role} ${options.pending ? 'pending' : ''}`;
    const body = document.createElement('div');
    body.className = 'msg-body';
    body.innerHTML = role === 'system' ? escapeHtml(textValue || '') : renderText(textValue || '');
    const card = document.createElement('div');
    card.className = 'msg-card';
    card.appendChild(body);
    const attachmentNode = renderMessageAttachments(options.attachments || []);
    if (attachmentNode) card.appendChild(attachmentNode);
    node.appendChild(card);
    if (options.turnId) node.dataset.turnId = options.turnId;
    if (options.sessionPath || state.currentPath) node.dataset.sessionPath = options.sessionPath || state.currentPath || '';
    if (options.meta) {
      const meta = document.createElement('div');
      meta.className = 'msg-meta';
      meta.textContent = options.meta;
      node.appendChild(meta);
    }
    node.dataset.raw = textValue || '';
    if (role === 'user') rememberQuestion(textValue, options);
    if (role === 'user' && options.turnId) setupUserMessageEdit(node, textValue || '', options);
    if (role === 'agent' && !options.meta && shouldShowAssistantFooter(options)) renderAssistantFooter(node, options);
    els.messages.appendChild(node);
    setEmptyVisible();
    scrollBottom();
    return node;
  }

  function updateMessage(node, textValue, render = false) {
    if (!node) return;
    node.dataset.raw = textValue || '';
    const body = node.querySelector('.msg-body');
    if (!body) return;
    if (render) body.innerHTML = renderText(textValue || '');
    else body.textContent = stripInternalBlocks(textValue || '');
    scrollBottom();
  }

  function clearMessages() {
    cancelUserMessageEdit();
    els.messages.textContent = '';
    streamBubble = null;
    streamRaw = '';
    latestUserQuestionText = '';
    currentTurnId = '';
    currentTurnStartedAt = 0;
    setEmptyVisible();
  }

  function normalizePath(value) {
    return String(value || '').replace(/^\\\\\?\\/, '').replace(/\\/g, '/').toLowerCase();
  }

  function samePath(a, b) {
    return Boolean(a && b && normalizePath(a) === normalizePath(b));
  }

  function fmtDate(ms) {
    const time = Number(ms || 0);
    if (!time) return '';
    return new Date(time).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
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

  function toKB(bytes) {
    const size = Number(bytes || 0);
    if (!size) return '';
    if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }

  function oneLine(value, max = 300) {
    return String(value || '').replace(/[\r\n]+/g, ' ').trim().slice(0, max);
  }

  function attachmentClientId() {
    const key = 'p2pChatAttachmentClientId';
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`).replace(/[^A-Za-z0-9_-]+/g, '');
    localStorage.setItem(key, id);
    return id;
  }

  function isSupportedImageFile(file) {
    return Boolean(file && SUPPORTED_IMAGE_MIME.test(file.type || ''));
  }

  function dataTransferHasFiles(dataTransfer) {
    return [...(dataTransfer?.types || [])].includes('Files');
  }

  function attachmentStatus(item) {
    if (item.status === 'reading') return '读取中';
    if (item.status === 'uploading') return `上传 ${Math.max(1, Math.round(item.progress || 0))}%`;
    if (item.status === 'error') return item.error || '失败';
    return `${item.kind === 'image' ? '图片' : '文件'} ${toKB(item.size)}`;
  }

  function renderChatAttachments() {
    if (!els.attachmentTray) return;
    els.attachmentTray.textContent = '';
    els.attachmentTray.hidden = chatAttachments.length === 0;
    chatAttachments.forEach((item) => {
      const chip = document.createElement('div');
      chip.className = `chat-attachment-chip ${item.status === 'error' ? 'bad' : ''}`;
      chip.dataset.id = item.id;
      const thumb = item.kind === 'image' && item.dataUrl
        ? `<img src="${escapeHtml(item.dataUrl)}" alt="">`
        : (item.kind === 'image' ? 'IMG' : 'FILE');
      chip.innerHTML = `
        <span class="chat-attachment-thumb">${thumb}</span>
        <span class="chat-attachment-main">
          <span class="chat-attachment-name">${escapeHtml(item.name)}</span>
          <span class="chat-attachment-meta">${escapeHtml(attachmentStatus(item))}</span>
        </span>
        <button class="chat-attachment-remove" type="button" data-remove-attachment="${escapeHtml(item.id)}" aria-label="移除附件">&times;</button>`;
      chip.querySelector('button')?.addEventListener('click', () => {
        if (composerBusy) return;
        chatAttachments = chatAttachments.filter((entry) => entry.id !== item.id);
        renderChatAttachments();
      });
      els.attachmentTray.appendChild(chip);
    });
    updateReady();
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('读取失败'));
      reader.readAsDataURL(file);
    });
  }

  async function addChatFiles(files) {
    const incoming = [...(files || [])].filter(Boolean);
    if (!incoming.length) return;
    for (const file of incoming) {
      const item = {
        id: `att-${Date.now()}-${++attachmentSeq}`,
        kind: isSupportedImageFile(file) ? 'image' : 'file',
        file,
        name: file.name || (isSupportedImageFile(file) ? `image-${attachmentSeq}.png` : `file-${attachmentSeq}`),
        mime: file.type || 'application/octet-stream',
        size: Number(file.size || 0),
        status: 'ready',
        progress: 0,
        dataUrl: ''
      };
      chatAttachments.push(item);
      renderChatAttachments();
      if (item.kind !== 'image') continue;
      if (item.size > MAX_IMAGE_BYTES) {
        item.status = 'error';
        item.error = `图片超过 ${toKB(MAX_IMAGE_BYTES)}`;
        renderChatAttachments();
        continue;
      }
      item.status = 'reading';
      renderChatAttachments();
      try {
        item.dataUrl = await readFileAsDataUrl(file);
        item.status = 'ready';
      } catch (error) {
        item.status = 'error';
        item.error = error.message || '读取失败';
      }
      renderChatAttachments();
    }
    toast(`已添加 ${incoming.length} 个附件`);
  }

  function transferProxyUrl(suffix, extra = {}) {
    const url = new URL(`/p2p-transfer${suffix}`, location.origin);
    url.searchParams.set('p2pToken', token);
    Object.entries(extra).forEach(([key, value]) => {
      if (value != null && value !== '') url.searchParams.set(key, String(value));
    });
    return url.toString();
  }

  function transferDownloadUrl(file) {
    if (file.rawDownloadUrl || file.downloadUrl) return file.rawDownloadUrl || file.downloadUrl;
    return transferProxyUrl(`/files/${encodeURIComponent(file.id)}/download`, { token: file.downloadToken || '' });
  }

  function transferStoreContentPath(storePath, id) {
    const root = String(storePath || '').replace(/[\\/]+$/, '');
    if (!root || !id) return '';
    const sep = root.includes('\\') ? '\\' : '/';
    return `${root}${sep}files${sep}${id}.bin`;
  }

  async function inferTransferLocalPath(file) {
    if (file.localPath || !file.id) return file.localPath || '';
    try {
      const listing = await p2pJson('GET', '/transfer/files');
      return transferStoreContentPath(listing.storePath, file.id);
    } catch {
      return '';
    }
  }

  function uploadChatFileContent(fileId, item) {
    return new Promise((resolveUpload, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', transferProxyUrl(`/files/${encodeURIComponent(fileId)}/content`));
      xhr.setRequestHeader('Content-Type', item.mime || 'application/octet-stream');
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        item.progress = event.total ? (event.loaded / event.total) * 100 : item.progress;
        renderChatAttachments();
      };
      xhr.onload = () => {
        let data = {};
        try { data = JSON.parse(xhr.responseText || '{}'); } catch {}
        if (xhr.status < 200 || xhr.status >= 300 || data.ok === false) {
          reject(new Error(data.error || `HTTP ${xhr.status}`));
          return;
        }
        resolveUpload(data.file || {});
      };
      xhr.onerror = () => reject(new Error('upload network error'));
      xhr.onabort = () => reject(new Error('upload aborted'));
      xhr.send(item.file);
    });
  }

  async function uploadChatFile(item) {
    if (item.transfer) return item.transfer;
    item.status = 'uploading';
    item.progress = 1;
    renderChatAttachments();
    const created = await p2pJson('POST', '/transfer/files', {
      name: item.name || 'download.bin',
      mime: item.mime || 'application/octet-stream',
      size: item.size,
      uploaderId: attachmentClientId()
    });
    const uploaded = { ...(created.file || {}), ...(await uploadChatFileContent(created.file.id, item)) };
    const localPath = uploaded.localPath || await inferTransferLocalPath(uploaded);
    const transfer = {
      id: uploaded.id || created.file.id,
      name: uploaded.name || item.name || 'download.bin',
      mime: uploaded.mime || item.mime || 'application/octet-stream',
      size: Number(uploaded.size || item.size || 0),
      localPath,
      downloadUrl: transferDownloadUrl(uploaded)
    };
    item.transfer = transfer;
    item.status = 'ready';
    item.progress = 100;
    renderChatAttachments();
    return transfer;
  }

  function fileReferenceBlock(files) {
    if (!files.length) return '';
    const lines = files.map((file) => {
      const parts = [`- ${oneLine(file.name)} (${toKB(file.size) || '0 B'})`];
      if (file.localPath) parts.push(`  本机路径: ${file.localPath}`);
      if (file.downloadUrl) parts.push(`  下载链接: ${file.downloadUrl}`);
      return parts.join('\n');
    });
    return `\n\n附加文件:\n${lines.join('\n')}`;
  }

  async function prepareChatSubmission(textValue, items) {
    const imageAttachments = [];
    const fileRefs = [];
    const displayAttachments = [];
    for (const item of items) {
      if (item.status === 'error') throw new Error(`${item.name}: ${item.error || '附件不可用'}`);
      if (item.kind === 'image') {
        if (!item.dataUrl) item.dataUrl = await readFileAsDataUrl(item.file);
        imageAttachments.push({
          type: 'image',
          name: item.name,
          mime: item.mime,
          size: item.size,
          dataUrl: item.dataUrl
        });
        displayAttachments.push({ kind: 'image', name: item.name, url: item.dataUrl });
        continue;
      }
      const uploaded = await uploadChatFile(item);
      fileRefs.push(uploaded);
      displayAttachments.push({ kind: 'file', name: uploaded.name, url: uploaded.downloadUrl, localPath: uploaded.localPath });
    }
    let finalText = textValue.trim();
    if (!finalText) {
      finalText = imageAttachments.length && fileRefs.length
        ? '请查看这些图片和文件。'
        : (imageAttachments.length ? '请分析这些图片。' : '请查看这些文件。');
    }
    finalText += fileReferenceBlock(fileRefs);
    return { text: finalText, imageAttachments, displayAttachments };
  }

  function projectName(pathValue) {
    return String(pathValue || '').split(/[\\/]/).filter(Boolean).pop() || '本机 Codex';
  }

  function sessionTitle(session) {
    return session?.title || session?.name || fmtDate(session?.mtimeMs) || '未命名会话';
  }

  function sessionMeta(session) {
    const cwd = session?.cwd ? projectName(session.cwd) : '';
    const count = session?.messageCount ? `${session.messageCount} 条` : toKB(session?.size);
    return [relativeTime(session?.mtimeMs || session?.last_used), cwd, count].filter(Boolean).join(' · ');
  }

  function openDrawer() {
    document.body.classList.add('drawer-open');
    els.sidebarBackdrop.hidden = false;
  }

  function closeDrawer() {
    document.body.classList.remove('drawer-open');
    els.sidebarBackdrop.hidden = true;
  }

  function renderSessions() {
    const query = state.filter.trim().toLowerCase();
    const list = state.sessions
      .filter((session) => {
        if (!query) return true;
        return `${sessionTitle(session)} ${session.cwd || ''} ${session.path || ''}`.toLowerCase().includes(query);
      })
      .sort((a, b) => Number(b.mtimeMs || b.last_used || 0) - Number(a.mtimeMs || a.last_used || 0));

    els.sessionCount.textContent = `${list.length} 条会话`;
    els.sessionList.textContent = '';
    if (!list.length) {
      const empty = document.createElement('div');
      empty.className = 'session-meta';
      empty.textContent = query ? '没有匹配会话' : '暂无历史会话';
      els.sessionList.appendChild(empty);
      return;
    }
    list.slice(0, 120).forEach((session) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `session-item ${samePath(session.path, state.currentPath) ? 'active' : ''}`;
      button.title = session.path || '';
      button.setAttribute('role', 'listitem');
      button.innerHTML = `
        <span class="session-main">
          <span class="session-title">${escapeHtml(sessionTitle(session))}</span>
          <span class="session-meta">${escapeHtml(sessionMeta(session))}</span>
        </span>
        <span class="session-badge">${escapeHtml(session.messageCount ? `${session.messageCount}` : toKB(session.size) || '-')}</span>`;
      button.addEventListener('click', () => selectSession(session));
      els.sessionList.appendChild(button);
    });
  }

  function base64ToBytes(value) {
    const binary = atob(value || '');
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
    return out;
  }

  function bytesToBase64(bytes) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  function waitIceComplete(peer, ms = 3500) {
    if (peer.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      peer.addEventListener('icegatheringstatechange', () => {
        if (peer.iceGatheringState === 'complete') {
          clearTimeout(timer);
          resolve();
        }
      });
    });
  }

  function channelSend(packet) {
    if (!dc || dc.readyState !== 'open') throw new Error('P2P 未连接');
    dc.send(JSON.stringify(packet));
  }

  function p2pRequest(method, path, body, options = {}) {
    const id = `r${Date.now()}-${++requestSeq}`;
    const chunks = [];
    return new Promise((resolve, reject) => {
      pending.set(id, {
        chunks,
        resolve,
        reject,
        onChunk: options.onChunk,
        decoder: new TextDecoder(),
        status: 0,
        headers: {}
      });
      const payload = body === undefined ? null : encoder.encode(typeof body === 'string' ? body : JSON.stringify(body));
      channelSend({
        type: 'request',
        id,
        method,
        path,
        headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
        bodyBase64: payload ? bytesToBase64(payload) : '',
        stream: options.stream === true
      });
    });
  }

  async function p2pJson(method, path, body) {
    const response = await p2pRequest(method, path, body);
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`HTTP ${response.status}: ${response.text.slice(0, 180)}`);
    }
    return response.text ? JSON.parse(response.text) : {};
  }

  window.CodexP2PPhone = {
    token,
    request: p2pRequest,
    json: p2pJson,
    toast,
    ready: () => state.ready
  };

  function rejectPending(error) {
    pending.forEach((item) => item.reject(error));
    pending.clear();
  }

  function handlePacket(packet) {
    const item = pending.get(packet.id);
    if (!item) return;
    if (packet.type === 'response-start') {
      item.status = Number(packet.status || 0);
      item.headers = packet.headers || {};
      return;
    }
    if (packet.type === 'response-chunk') {
      const bytes = base64ToBytes(packet.dataBase64 || '');
      if (item.onChunk) item.onChunk(item.decoder.decode(bytes, { stream: true }));
      else item.chunks.push(bytes);
      return;
    }
    if (packet.type === 'response-end') {
      pending.delete(packet.id);
      if (item.onChunk) item.onChunk(item.decoder.decode());
      const total = item.chunks.reduce((sum, part) => sum + part.length, 0);
      const merged = new Uint8Array(total);
      let offset = 0;
      for (const part of item.chunks) {
        merged.set(part, offset);
        offset += part.length;
      }
      item.resolve({ status: item.status, headers: item.headers, bytes: merged, text: new TextDecoder().decode(merged) });
      return;
    }
    if (packet.type === 'response-error') {
      pending.delete(packet.id);
      item.reject(new Error(packet.error || 'P2P request failed'));
    }
  }

  function renderQueue(queue = []) {
    state.queue = Array.isArray(queue) ? queue : [];
    updateReady();
    if (!state.queue.length) {
      els.queuePanel.hidden = true;
      els.queuePanel.textContent = '';
      return;
    }
    els.queuePanel.hidden = false;
    els.queuePanel.innerHTML = `
      <div class="queue-head">
        <strong>排队发送</strong>
        <button type="button" class="queue-clear" data-queue-action="clear">清空</button>
      </div>
      <div class="queue-list">
        ${state.queue.map((item, index) => `
          <div class="queue-item" data-id="${escapeHtml(item.id || '')}">
            <span>${index + 1}. ${escapeHtml(String(item.text || '').slice(0, 80) || '空消息')}</span>
            <div class="queue-actions">
              <button type="button" data-queue-action="promote">提前</button>
              <button type="button" data-queue-action="remove">移除</button>
            </div>
          </div>`).join('')}
      </div>`;
  }

  async function queueAction(action, id = '') {
    const urls = { promote: '/queue/promote', remove: '/queue/remove', clear: '/queue/clear' };
    const url = urls[action];
    if (!url) return;
    const data = await p2pJson('POST', url, { id });
    state.running = Boolean(data.running);
    renderQueue(data.queue || []);
    updateReady();
  }

  function processSseEvent(name, dataText) {
    let data = {};
    try { data = dataText ? JSON.parse(dataText) : {}; } catch { data = { text: dataText }; }
    if (name === 'status') {
      state.running = Boolean(data.running);
      state.currentWorkdir = data.workdir || state.currentWorkdir;
      setStatus(state.running ? 'P2P 已连接 · Codex 运行中' : 'P2P 已连接', 'ok');
      updateReady();
      if (!state.running) loadSessions().catch(() => undefined);
      return;
    }
    if (name === 'user_message') {
      const incoming = String(data.text || '');
      const incomingAttachments = Array.isArray(data.attachments) ? data.attachments : [];
      currentTurnId = String(data.turnId || data.turn_id || currentTurnId || '').trim();
      currentTurnStartedAt = timeMs(data.startedAt || data.timestamp) || Date.now();
      if (lastLocalUser && incoming === lastLocalUser.text && Date.now() - lastLocalUser.at < 7000) {
        lastLocalUser.node.classList.remove('pending');
        if (currentTurnId) {
          lastLocalUser.node.dataset.turnId = currentTurnId;
          lastLocalUser.node.dataset.sessionPath = state.currentPath || '';
          setupUserMessageEdit(lastLocalUser.node, incoming, { turnId: currentTurnId, startedAt: currentTurnStartedAt, sessionPath: state.currentPath || '', attachments: incomingAttachments });
        }
        rememberQuestion(incoming, { turnId: currentTurnId, startedAt: currentTurnStartedAt });
        lastLocalUser = null;
        updateMessageEditControls();
        return;
      }
      addMessage('user', incoming, { turnId: currentTurnId, startedAt: currentTurnStartedAt, attachments: incomingAttachments });
      return;
    }
    if (name === 'delta') {
      if (!streamBubble) {
        streamRaw = '';
        if (!currentTurnStartedAt) currentTurnStartedAt = Date.now();
        streamBubble = addMessage('agent', '', { meta: '生成中', turnId: currentTurnId, question: latestUserQuestionText });
      }
      streamRaw += data.text || '';
      updateMessage(streamBubble, streamRaw, false);
      return;
    }
    if (name === 'message') {
      const completedAt = data.completedAt || new Date().toISOString();
      const completedMs = timeMs(completedAt) || Date.now();
      const durationMs = Number(data.durationMs || 0) || (currentTurnStartedAt ? Math.max(0, completedMs - currentTurnStartedAt) : 0);
      if (streamBubble) {
        if (!streamRaw && data.text) streamRaw = data.text;
        updateMessage(streamBubble, streamRaw, true);
        streamBubble.querySelector('.msg-meta')?.remove();
        renderAssistantFooter(streamBubble, { completedAt, durationMs, turnId: currentTurnId, question: latestUserQuestionText });
        streamBubble = null;
        streamRaw = '';
      } else if (data.text) {
        addMessage('agent', data.text, { completedAt, durationMs, turnId: currentTurnId, question: latestUserQuestionText });
      }
      currentTurnStartedAt = 0;
      return;
    }
    if (name === 'stderr' || name === 'error') {
      addMessage('system', data.text || data.error || name);
      return;
    }
    if (name === 'server_request') {
      addMessage('system', data.question || data.title || '需要补充信息');
      return;
    }
    if (name === 'system' || name === 'tool' || name === 'timeline_item' || name === 'notification') {
      const textValue = data.text || data.detail || data.title || data.kind || name;
      if (textValue) addMessage('system', textValue);
    }
  }

  function startEvents() {
    if (eventStreamStarted) return;
    eventStreamStarted = true;
    let buffer = '';
    p2pRequest('GET', '/events', undefined, {
      stream: true,
      onChunk: (chunkText) => {
        buffer += chunkText;
        const parts = buffer.split(/\r?\n\r?\n/);
        buffer = parts.pop() || '';
        for (const part of parts) {
          let eventName = 'message';
          const dataLines = [];
          for (const line of part.split(/\r?\n/)) {
            if (line.startsWith('event:')) eventName = line.slice(6).trim();
            if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
          }
          processSseEvent(eventName, dataLines.join('\n'));
        }
      }
    }).catch((error) => {
      eventStreamStarted = false;
      addMessage('system', `事件流断开：${error.message}`);
      setStatus('P2P 事件流断开', 'bad');
      state.ready = false;
      updateReady();
    });
  }

  async function loadHelperStatus() {
    if (!token) return;
    try {
      const response = await fetch(`/p2p/status?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) return;
      const helper = data.state || {};
      state.currentWorkdir = state.currentWorkdir || helper.targetOrigin || '';
      updateReady();
    } catch {
      // The WebRTC path is still the source of truth after connect.
    }
  }

  async function loadSessions() {
    const data = await p2pJson('GET', '/sessions');
    state.sessions = Array.isArray(data.sessions) ? data.sessions : [];
    state.currentPath = data.current || state.currentPath || '';
    state.currentWorkdir = data.workdir || state.currentWorkdir || '';
    renderSessions();
    updateReady();
    return data;
  }

  async function loadTranscript(path = '') {
    const serial = ++transcriptSerial;
    const endpoint = path ? `/session-messages?path=${encodeURIComponent(path)}` : '/session-messages';
    const data = await p2pJson('GET', endpoint);
    if (serial !== transcriptSerial) return;
    clearMessages();
    const messages = Array.isArray(data.messages) ? data.messages : [];
    messages.forEach((item) => {
      if (item.role === 'user') addMessage('user', item.text || '', { turnId: item.turnId || '', startedAt: item.startedAt || '', attachments: item.attachments || [] });
      else if (item.role === 'assistant') addMessage('agent', item.text || '', { turnId: item.turnId || '', completedAt: item.completedAt || '', durationMs: item.durationMs || 0, question: latestUserQuestionText });
      else addMessage('system', item.text || item.detail || item.title || item.kind || '');
    });
    if (!messages.length) addMessage('system', '这个会话没有可展示消息');
  }

  async function selectSession(session) {
    if (!session?.path) return;
    state.currentPath = session.path;
    state.currentWorkdir = session.cwd || state.currentWorkdir;
    els.threadTitle.textContent = sessionTitle(session);
    renderSessions();
    closeDrawer();
    try {
      await loadTranscript(session.path);
      const data = await p2pJson('POST', '/resume', { path: session.path, workdir: session.cwd || '' });
      state.currentPath = data.resume_path || session.path;
      state.currentWorkdir = data.workdir || state.currentWorkdir;
      renderSessions();
      updateReady();
    } catch (error) {
      addMessage('system', `恢复会话失败：${error.message}`);
      toast('恢复会话失败', true);
    }
  }

  async function loadInitialData() {
    try {
      await p2pJson('GET', '/health');
      const sessions = await loadSessions();
      const current = state.sessions.find((session) => samePath(session.path, sessions.current));
      if (current) {
        els.threadTitle.textContent = sessionTitle(current);
        await loadTranscript(current.path);
      }
      try {
        const queueData = await p2pJson('GET', '/queue');
        state.running = Boolean(queueData.running);
        renderQueue(queueData.queue || []);
      } catch {
        renderQueue([]);
      }
    } catch (error) {
      addMessage('system', `初始化失败：${error.message}`);
      toast('本机 WebUI 初始化失败', true);
    }
  }

  async function connect() {
    if (!token) {
      setStatus('链接缺少入口令牌', 'bad');
      addMessage('system', '连接链接无效。');
      return;
    }
    setStatus('正在建立 P2P', 'warn');
    state.ready = false;
    updateReady();
    await loadHelperStatus();

    pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
      ]
    });
    dc = pc.createDataChannel('codex-webui-p2p', { ordered: true });
    dc.addEventListener('open', async () => {
      state.ready = true;
      setStatus('P2P 已连接', 'ok');
      updateReady();
      startEvents();
      await loadInitialData();
      els.text.focus();
    });
    dc.addEventListener('close', () => {
      state.ready = false;
      setStatus('P2P 已断开', 'bad');
      rejectPending(new Error('P2P 已断开'));
      updateReady();
    });
    dc.addEventListener('message', (event) => {
      try { handlePacket(JSON.parse(event.data)); }
      catch (error) { addMessage('system', `P2P 消息解析失败：${error.message}`); }
    });
    pc.addEventListener('connectionstatechange', () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
        state.ready = false;
        setStatus(`P2P ${pc.connectionState}`, 'bad');
        updateReady();
      } else if (pc.connectionState === 'connected') {
        setStatus(state.running ? 'P2P 已连接 · Codex 运行中' : 'P2P 已连接', 'ok');
        updateReady();
      }
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitIceComplete(pc);
    const response = await fetch('/p2p/offer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, offer: pc.localDescription })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error || `HTTP ${response.status}`);
    await pc.setRemoteDescription(data.answer);
  }

  async function reconnect() {
    eventStreamStarted = false;
    rejectPending(new Error('正在重连'));
    try { dc?.close(); } catch {}
    try { pc?.close(); } catch {}
    dc = null;
    pc = null;
    state.ready = false;
    updateReady();
    clearMessages();
    await connect();
  }

  async function sendMessage() {
    const value = els.text.value.trim();
    const attachmentSnapshot = chatAttachments.slice();
    if ((!value && !attachmentSnapshot.length) || !state.ready) return;
    composerBusy = true;
    updateReady();
    try {
      const prepared = await prepareChatSubmission(value, attachmentSnapshot);
      els.text.value = '';
      chatAttachments = [];
      renderChatAttachments();
      autoSizeText();
      currentTurnStartedAt = Date.now();
      const node = addMessage('user', prepared.text, { pending: true, startedAt: currentTurnStartedAt, attachments: prepared.displayAttachments });
      lastLocalUser = { text: prepared.text, at: Date.now(), node };
      const data = await p2pJson('POST', '/message', {
        text: prepared.text,
        attachments: prepared.imageAttachments,
        collaborationPreset: 'default',
        serviceTier: null
      });
      state.running = Boolean(data.running || data.status === 'started' || data.status === 'steered' || data.status === 'queued');
      state.currentPath = data.resume_path || state.currentPath;
      state.currentWorkdir = data.workdir || state.currentWorkdir;
      renderQueue(data.queue || []);
      updateReady();
      if (data.status === 'queued') toast('已加入排队');
      loadSessions().catch(() => undefined);
    } catch (error) {
      if (lastLocalUser?.node) lastLocalUser.node.remove();
      lastLocalUser = null;
      els.text.value = value;
      chatAttachments = attachmentSnapshot;
      renderChatAttachments();
      autoSizeText();
      addMessage('system', `发送失败：${error.message}`);
      toast('发送失败', true);
    } finally {
      composerBusy = false;
      updateReady();
    }
  }

  async function stopTurn() {
    try {
      await p2pJson('POST', '/cancel', {});
      state.running = false;
      renderQueue([]);
      updateReady();
      toast('已请求停止');
    } catch (error) {
      addMessage('system', `停止失败：${error.message}`);
      toast('停止失败', true);
    }
  }

  async function startNewChat() {
    try {
      const data = await p2pJson('POST', '/new-chat', {});
      state.currentPath = '';
      state.currentWorkdir = data.workdir || state.currentWorkdir;
      state.running = false;
      renderQueue([]);
      clearMessages();
      els.threadTitle.textContent = projectName(state.currentWorkdir);
      addMessage('system', '已开始新会话。');
      await loadSessions();
      closeDrawer();
      els.text.focus();
    } catch (error) {
      addMessage('system', `新会话失败：${error.message}`);
      toast('新会话失败', true);
    }
  }

  function autoSizeText() {
    els.text.style.height = '0px';
    els.text.style.height = `${Math.min(180, Math.max(42, els.text.scrollHeight))}px`;
  }

  els.drawerToggle.addEventListener('click', openDrawer);
  els.closeDrawer.addEventListener('click', closeDrawer);
  els.sidebarBackdrop.addEventListener('click', closeDrawer);
  els.sessionSearch.addEventListener('input', () => {
    state.filter = els.sessionSearch.value || '';
    renderSessions();
  });
  els.reconnect.addEventListener('click', () => reconnect().catch((error) => {
    setStatus('连接失败', 'bad');
    addMessage('system', `重连失败：${error.message}`);
  }));
  els.newChat.addEventListener('click', startNewChat);
  els.send.addEventListener('click', () => {
    if (els.send.dataset.mode === 'stop') stopTurn();
    else sendMessage();
  });
  els.attachFiles?.addEventListener('click', () => els.chatFilePicker?.click());
  els.chatFilePicker?.addEventListener('change', (event) => {
    addChatFiles(event.currentTarget.files || []).catch((error) => {
      addMessage('system', `读取附件失败：${error.message || error}`);
      toast('读取附件失败', true);
    });
    event.currentTarget.value = '';
  });
  els.text.addEventListener('input', () => {
    autoSizeText();
    updateReady();
  });
  els.text.addEventListener('paste', (event) => {
    const files = [...(event.clipboardData?.files || [])];
    if (!files.length) return;
    event.preventDefault();
    addChatFiles(files).catch((error) => {
      addMessage('system', `读取附件失败：${error.message || error}`);
      toast('读取附件失败', true);
    });
  });
  els.text.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });
  ['dragenter', 'dragover'].forEach((name) => {
    els.composer?.addEventListener(name, (event) => {
      if (!dataTransferHasFiles(event.dataTransfer)) return;
      event.preventDefault();
      els.composer.classList.add('composer-drop-active');
    });
  });
  ['dragleave', 'drop'].forEach((name) => {
    els.composer?.addEventListener(name, (event) => {
      if (!dataTransferHasFiles(event.dataTransfer)) return;
      event.preventDefault();
      els.composer.classList.remove('composer-drop-active');
    });
  });
  els.composer?.addEventListener('drop', (event) => {
    addChatFiles(event.dataTransfer?.files || []).catch((error) => {
      addMessage('system', `读取附件失败：${error.message || error}`);
      toast('读取附件失败', true);
    });
  });
  els.queuePanel.addEventListener('click', (event) => {
    const button = event.target && event.target.closest ? event.target.closest('[data-queue-action]') : null;
    if (!button) return;
    const action = button.getAttribute('data-queue-action');
    const item = button.closest('.queue-item');
    queueAction(action, item?.getAttribute('data-id') || '').catch((error) => {
      addMessage('system', `队列操作失败：${error.message}`);
      toast('队列操作失败', true);
    });
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeDrawer();
  });
  window.addEventListener('resize', () => {
    if (window.innerWidth > 760) closeDrawer();
  });

  autoSizeText();
  connect().catch((error) => {
    state.ready = false;
    setStatus('连接失败', 'bad');
    addMessage('system', `连接失败：${error.message}`);
    updateReady();
  });
})();
