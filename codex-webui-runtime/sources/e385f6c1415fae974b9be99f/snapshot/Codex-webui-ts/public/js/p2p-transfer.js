(() => {
  const api = window.CodexP2PPhone;
  if (!api) return;

  const $ = (id) => document.getElementById(id);
  const els = {
    toggle: $('transferToggle'),
    panel: $('transferPanel'),
    close: $('transferClose'),
    refresh: $('transferRefresh'),
    status: $('transferStatus'),
    autoDownload: $('transferAutoDownload'),
    conversation: $('transferConversation'),
    filePicker: $('transferFilePicker'),
    dropZone: $('transferDropZone'),
    queue: $('transferQueue'),
    textInput: $('transferTextInput'),
    sendText: $('transferSendText'),
    uploadFiles: $('transferUploadFiles')
  };

  let pollTimer = null;
  let firstLoad = true;
  let selectedFiles = [];
  let providers = [];
  const knownReady = new Set(JSON.parse(localStorage.getItem('p2pTransferKnownReady') || '[]'));
  const clientId = (() => {
    const existing = localStorage.getItem('p2pTransferClientId');
    if (existing) return existing;
    const id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`).replace(/[^A-Za-z0-9_-]+/g, '');
    localStorage.setItem('p2pTransferClientId', id);
    return id;
  })();
  const clientName = (() => {
    const existing = localStorage.getItem('p2pTransferClientName');
    if (existing) return existing;
    const ua = navigator.userAgent || '';
    const name = /Android/i.test(ua) ? 'Android 手机' : /iPhone|iPad/i.test(ua) ? 'iOS 手机' : /Windows/i.test(ua) ? 'Windows' : '手机';
    localStorage.setItem('p2pTransferClientName', name);
    return name;
  })();

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function textHtml(value) {
    return escapeHtml(value).replace(/\r?\n/g, '<br>');
  }

  function formatBytes(bytes) {
    const value = Number(bytes || 0);
    if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)} GB`;
    if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(2)} MB`;
    if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${value} B`;
  }

  function formatRate(bytesPerSecond) {
    const value = Number(bytesPerSecond || 0);
    if (!value) return '0 MB/s';
    return `${(value / 1024 / 1024).toFixed(2)} MB/s`;
  }

  function formatTime(ms) {
    if (!ms) return '';
    try {
      return new Date(ms).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  function transferClientId() {
    return clientId;
  }

  function persistKnownReady() {
    localStorage.setItem('p2pTransferKnownReady', JSON.stringify([...knownReady].slice(-500)));
  }

  function setStatus(message, error = false) {
    if (!els.status) return;
    els.status.textContent = message || '';
    els.status.classList.toggle('bad', Boolean(error));
  }

  function setControls() {
    const ready = api.ready();
    const hasFiles = selectedFiles.length > 0;
    if (els.toggle) els.toggle.disabled = !ready;
    if (els.sendText) els.sendText.disabled = !ready;
    if (els.uploadFiles) els.uploadFiles.disabled = !ready || !hasFiles;
    if (els.dropZone) els.dropZone.disabled = !ready;
    if (els.textInput) els.textInput.disabled = !ready;
  }

  function transferProxyUrl(suffix, extra = {}) {
    const url = new URL(`/p2p-transfer${suffix}`, location.origin);
    url.searchParams.set('p2pToken', api.token);
    Object.entries(extra).forEach(([key, value]) => {
      if (value != null && value !== '') url.searchParams.set(key, String(value));
    });
    return url.toString();
  }

  function transferDownloadUrl(file) {
    if (file.rawDownloadUrl || file.downloadUrl) return file.rawDownloadUrl || file.downloadUrl;
    return transferProxyUrl(`/files/${encodeURIComponent(file.id)}/download`, { token: file.downloadToken || '' });
  }

  async function p2pJson(method, path, body) {
    if (!api.ready()) throw new Error('P2P 未连接');
    return api.json(method, path, body);
  }

  async function loadProviders() {
    try {
      const data = await p2pJson('GET', '/transfer/providers');
      providers = Array.isArray(data.providers) ? data.providers : [];
    } catch {
      providers = [
        { id: 'storage-to', label: 'storage.to', available: true },
        { id: 'local', label: '本机链路', available: true }
      ];
    }
    return providers;
  }

  function providerInfo(id) {
    return providers.find((provider) => provider.id === id) || { id, label: id, available: false };
  }

  function providerLabel(file) {
    if (file.providerLabel) return file.providerLabel;
    if (file.provider === 'storage-to') return 'storage.to';
    return '本机链路';
  }

  function providerAttempts(item) {
    return Array.isArray(item.providerAttempts) ? item.providerAttempts : [];
  }

  function transferAttempt(provider, status, error = '', url = '') {
    const info = providerInfo(provider);
    const now = Date.now();
    return {
      provider,
      label: info.label || provider,
      status,
      startedAt: now,
      completedAt: now,
      error: error ? String(error).slice(0, 500) : '',
      url
    };
  }

  function pushAttempt(item, provider, status, error = '', url = '') {
    item.providerAttempts = [...providerAttempts(item), transferAttempt(provider, status, error, url)].slice(-12);
  }

  function attemptsText(item) {
    const attempts = providerAttempts(item);
    if (!attempts.length) return '';
    return attempts.map((attempt) => {
      const status = attempt.status === 'ready' ? '成功' : attempt.status === 'skipped' ? '跳过' : '失败';
      return `${attempt.label || attempt.provider}:${status}`;
    }).join(' / ');
  }

  function safeStorageHeaders(headers = {}) {
    const out = {};
    Object.entries(headers || {}).forEach(([key, value]) => {
      const name = String(key || '').toLowerCase();
      if (!name || ['host', 'content-length', 'connection'].includes(name)) return;
      const first = Array.isArray(value) ? value[0] : value;
      if (first != null) out[key] = String(first);
    });
    return out;
  }

  function xhrUploadBlob(url, blob, mime, onProgress, headers = {}) {
    return new Promise((resolveUpload, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url);
      const finalHeaders = safeStorageHeaders(headers);
      if (mime && !Object.keys(finalHeaders).some((key) => key.toLowerCase() === 'content-type')) {
        xhr.setRequestHeader('Content-Type', mime);
      }
      Object.entries(finalHeaders).forEach(([key, value]) => xhr.setRequestHeader(key, value));
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) onProgress(event.loaded, event.total);
      };
      xhr.onload = () => {
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error(`HTTP ${xhr.status}`));
          return;
        }
        resolveUpload({ etag: (xhr.getResponseHeader('ETag') || '').replace(/^"|"$/g, '') });
      };
      xhr.onerror = () => reject(new Error('upload network error'));
      xhr.onabort = () => reject(new Error('upload aborted'));
      xhr.send(blob);
    });
  }

  function renderQueue() {
    if (!els.queue) return;
    els.queue.innerHTML = '';
    selectedFiles.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'transfer-file-row';
      row.dataset.index = String(index);
      row.innerHTML = `
        <div class="transfer-file-main">
          <div class="transfer-file-name">${escapeHtml(item.file.name || 'download.bin')}</div>
          <div class="transfer-file-meta">
            <span>${formatBytes(item.file.size)}</span>
            <span>${escapeHtml(item.status || '待发送')}</span>
            <span>${formatRate(item.rate || 0)}</span>
            ${attemptsText(item) ? `<span>${escapeHtml(attemptsText(item))}</span>` : ''}
          </div>
          <div class="transfer-progress"><span style="width:${Math.max(0, Math.min(100, item.progress || 0))}%"></span></div>
        </div>
        <div class="transfer-file-actions">
          <button type="button" data-action="remove">移除</button>
        </div>`;
      row.querySelector('[data-action="remove"]').addEventListener('click', () => {
        selectedFiles.splice(index, 1);
        renderQueue();
      });
      els.queue.appendChild(row);
    });
    setControls();
  }

  function addFiles(files) {
    const incoming = [...(files || [])].filter(Boolean);
    incoming.forEach((file) => {
      selectedFiles.push({ file, progress: 0, rate: 0, status: '待发送', providerAttempts: [] });
    });
    if (incoming.length) setStatus(`已选择 ${incoming.length} 个文件`);
    renderQueue();
  }

  function triggerDownload(file) {
    const link = document.createElement('a');
    link.href = transferDownloadUrl(file);
    link.download = file.name || 'download.bin';
    link.rel = 'noopener';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    knownReady.add(file.id);
    persistKnownReady();
  }

  async function copyLink(file) {
    const value = transferDownloadUrl(file);
    try {
      await navigator.clipboard.writeText(value);
      setStatus('下载链接已复制');
    } catch {
      setStatus(value);
    }
  }

  async function shareFile(file) {
    const url = transferDownloadUrl(file);
    if (navigator.share) {
      await navigator.share({ title: file.name || '文件传输', text: file.name || '文件传输', url });
      return;
    }
    await copyLink(file);
  }

  function actionHtml(file) {
    const ready = file.status === 'ready';
    return `
      ${ready ? `<a href="${escapeHtml(transferDownloadUrl(file))}" download="${escapeHtml(file.name || 'download.bin')}">下载</a>` : ''}
      ${ready ? '<button type="button" data-action="copy">复制</button>' : ''}
      ${ready ? '<button type="button" data-action="share">分享</button>' : ''}
      <button type="button" data-action="delete">删除</button>`;
  }

  function wireFileActions(container, file) {
    const ready = file.status === 'ready';
    container.draggable = ready;
    container.addEventListener('dragstart', (event) => {
      if (!ready) return;
      event.dataTransfer?.setData('text/uri-list', transferDownloadUrl(file));
      event.dataTransfer?.setData('text/plain', transferDownloadUrl(file));
    });
    container.querySelector('[data-action="copy"]')?.addEventListener('click', () => {
      copyLink(file).catch((error) => setStatus(`复制失败：${error.message || error}`, true));
    });
    container.querySelector('[data-action="share"]')?.addEventListener('click', () => {
      shareFile(file).catch((error) => setStatus(`分享失败：${error.message || error}`, true));
    });
    container.querySelector('[data-action="delete"]')?.addEventListener('click', async () => {
      try {
        await p2pJson('DELETE', `/transfer/files/${encodeURIComponent(file.id)}`);
        knownReady.delete(file.id);
        persistKnownReady();
        await loadEvents();
      } catch (error) {
        setStatus(`删除失败：${error.message || error}`, true);
      }
    });
  }

  function renderFileBubble(event) {
    const file = event.file || {};
    const mine = file.uploaderId === transferClientId();
    const bubble = document.createElement('article');
    bubble.className = `transfer-bubble ${mine ? 'transfer-bubble-mine' : 'transfer-bubble-peer'}`;
    bubble.innerHTML = `
      <div class="transfer-bubble-meta">
        <span>${mine ? '我' : '对方'}</span>
        <time>${formatTime(file.completedAt || event.createdAt)}</time>
      </div>
      <div class="transfer-file-main">
        <div class="transfer-file-name">${escapeHtml(file.name || 'download.bin')}</div>
        <div class="transfer-file-meta">
          <span>${escapeHtml(providerLabel(file))}</span>
          <span>${escapeHtml(file.status || 'unknown')}</span>
          <span>${formatBytes(file.size || file.expectedSize || 0)}</span>
          <span>${formatRate(file.uploadRateBytesPerSec || 0)}</span>
        </div>
        ${file.status !== 'ready' ? '<div class="transfer-progress"><span style="width:20%"></span></div>' : ''}
      </div>
      <div class="transfer-file-actions">${actionHtml(file)}</div>`;
    wireFileActions(bubble, file);
    return bubble;
  }

  function renderTextBubble(event) {
    const mine = event.senderId === transferClientId();
    const bubble = document.createElement('article');
    bubble.className = `transfer-bubble ${mine ? 'transfer-bubble-mine' : 'transfer-bubble-peer'}`;
    bubble.innerHTML = `
      <div class="transfer-bubble-meta">
        <span>${mine ? '我' : escapeHtml(event.senderName || '对方')}</span>
        <time>${formatTime(event.createdAt)}</time>
      </div>
      <div class="transfer-text-content">${textHtml(event.text)}</div>`;
    return bubble;
  }

  function renderEvents(events = []) {
    if (!els.conversation) return;
    const stick = els.conversation.scrollTop + els.conversation.clientHeight >= els.conversation.scrollHeight - 80;
    els.conversation.innerHTML = '';
    if (!events.length) {
      const empty = document.createElement('div');
      empty.className = 'transfer-empty';
      empty.textContent = '暂无传输';
      els.conversation.appendChild(empty);
      return;
    }
    events.forEach((event) => {
      if (event.kind === 'text') els.conversation.appendChild(renderTextBubble(event));
      if (event.kind === 'file') els.conversation.appendChild(renderFileBubble(event));
    });
    if (stick) requestAnimationFrame(() => { els.conversation.scrollTop = els.conversation.scrollHeight; });
  }

  function maybeAutoDownload(files) {
    if (!els.autoDownload?.checked) {
      files.forEach((file) => { if (file.status === 'ready') knownReady.add(file.id); });
      persistKnownReady();
      return;
    }
    for (const file of files) {
      if (file.status !== 'ready') continue;
      if (file.uploaderId === transferClientId()) {
        knownReady.add(file.id);
        continue;
      }
      if (knownReady.has(file.id)) continue;
      setStatus(`自动下载：${file.name}`);
      triggerDownload(file);
    }
    persistKnownReady();
  }

  async function loadEvents() {
    const data = await p2pJson('GET', '/transfer/events');
    const events = Array.isArray(data.events) ? data.events : [];
    const files = Array.isArray(data.files) ? data.files : [];
    renderEvents(events);
    if (firstLoad) {
      files.forEach((file) => { if (file.status === 'ready') knownReady.add(file.id); });
      firstLoad = false;
      persistKnownReady();
    } else {
      maybeAutoDownload(files);
    }
    setStatus(events.length ? `${events.length} 条传输，${files.length} 个文件` : '暂无传输');
  }

  async function uploadStorageSingle(item, upload) {
    const startedAt = performance.now();
    await xhrUploadBlob(upload.uploadUrl, item.file, item.file.type || 'application/octet-stream', (loaded, total) => {
      const elapsed = Math.max(1, performance.now() - startedAt);
      item.progress = total ? (loaded / total) * 100 : item.progress;
      item.rate = (loaded * 1000) / elapsed;
      item.status = 'storage.to 上传中';
      renderQueue();
    }, upload.headers);
  }

  async function storagePartUrl(upload, partNumber) {
    const key = String(partNumber);
    if (upload.initialUrls && upload.initialUrls[key]) return upload.initialUrls[key];
    const data = await p2pJson('POST', '/transfer/providers/storage-to/parts', {
      uploadId: upload.uploadId,
      partNumbers: [partNumber]
    });
    upload.initialUrls = { ...(upload.initialUrls || {}), ...(data.urls || {}) };
    return upload.initialUrls[key];
  }

  async function uploadStorageMultipart(item, upload) {
    if (!upload.uploadId || !upload.partSize || !upload.totalParts) throw new Error('storage.to multipart init is incomplete');
    const parts = [];
    const partProgress = new Map();
    let nextPart = 1;
    const startedAt = performance.now();
    const workerCount = Math.min(4, Number(upload.totalParts || 1));
    const worker = async () => {
      while (nextPart <= upload.totalParts) {
        const partNumber = nextPart;
        nextPart += 1;
        const start = (partNumber - 1) * upload.partSize;
        const end = Math.min(item.file.size, start + upload.partSize);
        const partUrl = await storagePartUrl(upload, partNumber);
        if (!partUrl) throw new Error(`storage.to part ${partNumber} URL missing`);
        const result = await xhrUploadBlob(partUrl, item.file.slice(start, end), '', (loaded) => {
          partProgress.set(partNumber, loaded);
          const uploaded = [...partProgress.values()].reduce((sum, value) => sum + value, 0);
          const elapsed = Math.max(1, performance.now() - startedAt);
          item.progress = item.file.size ? (uploaded / item.file.size) * 100 : item.progress;
          item.rate = (uploaded * 1000) / elapsed;
          item.status = `storage.to 分片 ${partNumber}/${upload.totalParts}`;
          renderQueue();
        });
        if (!result.etag) throw new Error(`storage.to part ${partNumber} missing ETag`);
        parts.push({ partNumber, etag: result.etag });
      }
    };
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    parts.sort((a, b) => a.partNumber - b.partNumber);
    await p2pJson('POST', '/transfer/providers/storage-to/complete-multipart', {
      uploadId: upload.uploadId,
      parts
    });
  }

  async function uploadViaStorage(item) {
    const info = providerInfo('storage-to');
    if (info.available === false) throw new Error(info.reason || 'storage.to unavailable');
    item.status = 'storage.to 初始化';
    renderQueue();
    const init = await p2pJson('POST', '/transfer/providers/storage-to/init', {
      name: item.file.name || 'download.bin',
      mime: item.file.type || 'application/octet-stream',
      size: item.file.size
    });
    const upload = init.upload || {};
    if (upload.type === 'multipart') await uploadStorageMultipart(item, upload);
    else await uploadStorageSingle(item, upload);
    item.status = 'storage.to 确认';
    renderQueue();
    const confirmed = await p2pJson('POST', '/transfer/providers/storage-to/confirm', {
      name: item.file.name || 'download.bin',
      mime: item.file.type || 'application/octet-stream',
      size: item.file.size,
      r2Key: upload.r2Key,
      uploaderId: transferClientId(),
      attempts: [...providerAttempts(item), transferAttempt('storage-to', 'ready')]
    });
    pushAttempt(item, 'storage-to', 'ready', '', confirmed.file?.rawDownloadUrl || confirmed.file?.downloadUrl || '');
    item.progress = 100;
    item.rate = Number(confirmed.file?.uploadRateBytesPerSec || item.rate || 0);
    item.status = 'storage.to 已发送';
    renderQueue();
    return confirmed.file;
  }

  function uploadLocalContent(fileId, item) {
    return new Promise((resolveUpload, reject) => {
      const xhr = new XMLHttpRequest();
      let lastLoaded = 0;
      let lastAt = performance.now();
      xhr.open('PUT', transferProxyUrl(`/files/${encodeURIComponent(fileId)}/content`));
      xhr.setRequestHeader('Content-Type', item.file.type || 'application/octet-stream');
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const now = performance.now();
        const deltaBytes = event.loaded - lastLoaded;
        const deltaMs = Math.max(1, now - lastAt);
        item.progress = (event.loaded / event.total) * 100;
        item.rate = (deltaBytes * 1000) / deltaMs;
        item.status = '本机链路发送中';
        lastLoaded = event.loaded;
        lastAt = now;
        renderQueue();
      };
      xhr.onload = () => {
        let data = {};
        try { data = JSON.parse(xhr.responseText || '{}'); } catch {}
        if (xhr.status < 200 || xhr.status >= 300 || data.ok === false) {
          reject(new Error(data.error || `HTTP ${xhr.status}`));
          return;
        }
        item.progress = 100;
        item.status = '本机链路已发送';
        item.rate = Number(data.file?.uploadRateBytesPerSec || item.rate || 0);
        renderQueue();
        resolveUpload(data.file);
      };
      xhr.onerror = () => reject(new Error('upload network error'));
      xhr.onabort = () => reject(new Error('upload aborted'));
      xhr.send(item.file);
    });
  }

  async function uploadViaLocal(item) {
    item.status = '本机链路创建记录';
    renderQueue();
    const created = await p2pJson('POST', '/transfer/files', {
      name: item.file.name || 'download.bin',
      mime: item.file.type || 'application/octet-stream',
      size: item.file.size,
      uploaderId: transferClientId()
    });
    const file = await uploadLocalContent(created.file.id, item);
    pushAttempt(item, 'local', 'ready', '', transferDownloadUrl(file));
    return file;
  }

  async function uploadItem(item) {
    item.providerAttempts = [];
    try {
      return await uploadViaStorage(item);
    } catch (error) {
      pushAttempt(item, 'storage-to', 'failed', error.message || error);
      item.status = `storage.to 失败，改走本机链路`;
      setStatus(`storage.to 失败：${error.message || error}`, true);
      renderQueue();
    }
    try {
      return await uploadViaLocal(item);
    } catch (error) {
      pushAttempt(item, 'local', 'failed', error.message || error);
      throw error;
    }
  }

  async function uploadSelected() {
    if (!selectedFiles.length) {
      setStatus('请选择文件', true);
      return;
    }
    await loadProviders();
    setControls();
    for (const item of selectedFiles) {
      try {
        await uploadItem(item);
      } catch (error) {
        item.status = `失败：${error.message || error}`;
        setStatus(item.status, true);
        renderQueue();
        return;
      }
    }
    selectedFiles = [];
    renderQueue();
    await loadEvents();
    setStatus('文件已发送');
  }

  async function sendText() {
    const text = String(els.textInput?.value || '').trim();
    if (!text) {
      setStatus('请输入文字', true);
      return;
    }
    try {
      els.sendText.disabled = true;
      await p2pJson('POST', '/transfer/messages', {
        text,
        senderId: transferClientId(),
        senderName: clientName
      });
      els.textInput.value = '';
      await loadEvents();
      setStatus('文字已发送');
    } catch (error) {
      setStatus(`发送失败：${error.message || error}`, true);
    } finally {
      setControls();
      els.textInput?.focus();
    }
  }

  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(() => {
      if (els.panel?.hidden || !api.ready()) return;
      loadEvents().catch(() => {});
    }, 4000);
  }

  function openPanel() {
    if (!api.ready()) {
      setStatus('P2P 未连接', true);
      api.toast('P2P 未连接', true);
      return;
    }
    els.panel.hidden = false;
    firstLoad = true;
    setControls();
    loadProviders().catch(() => {});
    loadEvents().catch((error) => setStatus(`读取失败：${error.message || error}`, true));
    startPolling();
  }

  function closePanel() {
    els.panel.hidden = true;
  }

  function togglePanel() {
    if (els.panel.hidden) openPanel();
    else closePanel();
  }

  function wireDrop(target) {
    ['dragenter', 'dragover'].forEach((name) => {
      target?.addEventListener(name, (event) => {
        event.preventDefault();
        els.dropZone?.classList.add('transfer-drop-active');
      });
    });
    ['dragleave', 'drop'].forEach((name) => {
      target?.addEventListener(name, (event) => {
        event.preventDefault();
        els.dropZone?.classList.remove('transfer-drop-active');
      });
    });
    target?.addEventListener('drop', (event) => addFiles(event.dataTransfer?.files || []));
  }

  if (els.autoDownload) els.autoDownload.checked = localStorage.getItem('p2pTransferAutoDownload') === 'true';
  els.autoDownload?.addEventListener('change', () => {
    localStorage.setItem('p2pTransferAutoDownload', String(els.autoDownload.checked));
    setStatus(els.autoDownload.checked ? '自动下载已开启' : '自动下载已关闭');
  });
  els.toggle?.addEventListener('click', togglePanel);
  els.close?.addEventListener('click', closePanel);
  els.refresh?.addEventListener('click', () => loadEvents().catch((error) => setStatus(`刷新失败：${error.message || error}`, true)));
  els.dropZone?.addEventListener('click', () => els.filePicker?.click());
  els.filePicker?.addEventListener('change', (event) => {
    addFiles(event.currentTarget.files || []);
    event.currentTarget.value = '';
  });
  els.uploadFiles?.addEventListener('click', () => uploadSelected().catch((error) => setStatus(`发送失败：${error.message || error}`, true)));
  els.sendText?.addEventListener('click', () => sendText());
  els.textInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendText();
    }
  });
  wireDrop(els.dropZone);
  wireDrop(els.conversation);
  window.addEventListener('codex-p2p-state', () => {
    setControls();
    if (!api.ready() && !els.panel.hidden) setStatus('P2P 已断开', true);
  });
  window.addEventListener('beforeunload', () => {
    if (pollTimer) clearInterval(pollTimer);
  });
  if (new URLSearchParams(location.search).has('transfer')) setTimeout(openPanel, 0);
  setControls();
})();
