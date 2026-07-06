const transferEls = {
  modal: document.getElementById('transferModal'),
  openBtn: document.getElementById('openTransferBtn'),
  openStore: document.getElementById('transferOpenStore'),
  autoDownload: document.getElementById('transferAutoDownload'),
  mode: document.getElementById('transferMode'),
  lanInfo: document.getElementById('transferLanInfo'),
  status: document.getElementById('transferStatus'),
  filePicker: document.getElementById('transferFilePicker'),
  pickFiles: document.getElementById('transferPickFiles'),
  uploadFiles: document.getElementById('transferUploadFiles'),
  refresh: document.getElementById('transferRefresh'),
  dropZone: document.getElementById('transferDropZone'),
  queue: document.getElementById('transferQueue'),
  fileList: document.getElementById('transferFileList'),
  fileCount: document.getElementById('transferFileCount'),
  eventCount: document.getElementById('transferEventCount'),
  conversation: document.getElementById('transferConversation'),
  textInput: document.getElementById('transferTextInput'),
  sendText: document.getElementById('transferSendText'),
  composer: document.getElementById('transferComposer')
};

let transferSelectedFiles = [];
let transferPollTimer = null;
let transferFirstLoad = true;
let transferEventsCache = [];
let transferFilesCache = [];
let transferProviders = [];
const transferKnownReady = new Set(JSON.parse(localStorage.getItem('plusTransferKnownReady') || '[]'));
const transferClientId = (() => {
  const existing = localStorage.getItem('plusTransferClientId');
  if (existing) return existing;
  const id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`).replace(/[^A-Za-z0-9_-]+/g, '');
  localStorage.setItem('plusTransferClientId', id);
  return id;
})();
const transferClientName = (() => {
  const existing = localStorage.getItem('plusTransferClientName');
  if (existing) return existing;
  const ua = navigator.userAgent || '';
  const name = /Android/i.test(ua) ? 'Android' : /Windows/i.test(ua) ? 'Windows' : /iPhone|iPad/i.test(ua) ? 'iOS' : '设备';
  localStorage.setItem('plusTransferClientName', name);
  return name;
})();
const transferModeValues = new Set(['local', 'auto', 'storage-to']);

function transferMode() {
  const selected = transferEls.mode?.value || localStorage.getItem('plusTransferMode') || 'auto';
  return transferModeValues.has(selected) ? selected : 'auto';
}

function transferEscape(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function transferTextHtml(value) {
  return transferEscape(value).replace(/\r?\n/g, '<br>');
}

function transferFormatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(2)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
}

function transferFormatRate(bytesPerSecond) {
  const value = Number(bytesPerSecond || 0);
  if (!value) return '0 MB/s';
  return `${(value / 1024 / 1024).toFixed(2)} MB/s`;
}

function transferFormatTime(ms) {
  if (!ms) return '';
  try { return new Date(ms).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
}

function transferSetStatus(message, error = false) {
  if (!transferEls.status) return;
  transferEls.status.textContent = message || '';
  transferEls.status.classList.toggle('transfer-status-error', Boolean(error));
}

function transferDownloadUrl(file) {
  if (file.rawDownloadUrl || file.downloadUrl) return file.rawDownloadUrl || file.downloadUrl;
  const url = new URL(`/transfer/files/${encodeURIComponent(file.id)}/download`, location.origin);
  if (file.downloadToken) url.searchParams.set('token', file.downloadToken);
  return url.toString();
}

function transferPersistKnownReady() {
  localStorage.setItem('plusTransferKnownReady', JSON.stringify([...transferKnownReady].slice(-500)));
}

async function transferApiJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

async function loadTransferProviders() {
  try {
    const data = await transferApiJson('/transfer/providers', { cache: 'no-store' });
    transferProviders = Array.isArray(data.providers) ? data.providers : [];
  } catch {
    transferProviders = [
      { id: 'storage-to', label: 'storage.to', available: true },
      { id: 'local', label: '本地公网', available: true }
    ];
  }
  return transferProviders;
}

function transferProviderInfo(id) {
  return transferProviders.find((provider) => provider.id === id) || { id, label: id, available: false };
}

function transferProviderLabel(file) {
  if (file.providerLabel) return file.providerLabel;
  if (file.provider === 'storage-to') return 'storage.to';
  return '本地公网';
}

function providerAttempts(item) {
  return Array.isArray(item.providerAttempts) ? item.providerAttempts : [];
}

function transferAttempt(provider, status, error = '', url = '') {
  const info = transferProviderInfo(provider);
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

function pushProviderAttempt(item, provider, status, error = '', url = '') {
  item.providerAttempts = [...providerAttempts(item), transferAttempt(provider, status, error, url)].slice(-12);
}

function transferAttemptsText(item) {
  const attempts = providerAttempts(item);
  if (!attempts.length) return '';
  return attempts.map((attempt) => {
    const status = attempt.status === 'ready' ? '成功' : attempt.status === 'skipped' ? '跳过' : '失败';
    return `${attempt.label || attempt.provider}:${status}`;
  }).join(' / ');
}

function triggerNativeDownload(file) {
  const link = document.createElement('a');
  link.href = transferDownloadUrl(file);
  link.download = file.name || 'download.bin';
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  transferKnownReady.add(file.id);
  transferPersistKnownReady();
}

async function streamSaveTransferFile(file) {
  if (!window.showSaveFilePicker || typeof ReadableStream === 'undefined') {
    triggerNativeDownload(file);
    return;
  }
  const handle = await window.showSaveFilePicker({ suggestedName: file.name || 'download.bin' });
  const writable = await handle.createWritable();
  const response = await fetch(transferDownloadUrl(file));
  if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
  await response.body.pipeTo(writable);
  transferKnownReady.add(file.id);
  transferPersistKnownReady();
  transferSetStatus(`已保存：${file.name}`);
}

async function copyTransferLink(file) {
  const value = transferDownloadUrl(file);
  try {
    await navigator.clipboard.writeText(value);
    transferSetStatus('下载链接已复制');
  } catch {
    transferSetStatus(value);
  }
}

async function shareTransferFile(file) {
  const url = transferDownloadUrl(file);
  if (navigator.share) {
    await navigator.share({ title: file.name || '文件传输', text: file.name || '文件传输', url });
    return;
  }
  await copyTransferLink(file);
}

function transferFileActionHtml(file) {
  const ready = file.status === 'ready';
  return `
    ${ready ? `<a href="${transferEscape(transferDownloadUrl(file))}" download="${transferEscape(file.name || 'download.bin')}" draggable="true">高速下载</a>` : ''}
    ${ready ? '<button type="button" data-action="save">流式保存</button>' : ''}
    ${ready && (file.provider === 'local' || file.androidInbox?.status === 'received') ? `<button type="button" data-action="open-folder" data-file-id="${transferEscape(file.id)}" data-inbox-path="${transferEscape(file.androidInbox?.path || '')}">打开目录</button>` : ''}
    ${ready ? '<button type="button" data-action="copy">复制链接</button>' : ''}
    ${ready ? '<button type="button" data-action="share">分享</button>' : ''}
    <button type="button" data-action="delete">删除</button>`;
}

function wireTransferFileActions(container, file) {
  const ready = file.status === 'ready';
  container.draggable = ready;
  container.addEventListener('dragstart', (event) => {
    if (!ready) return;
    event.dataTransfer?.setData('text/uri-list', transferDownloadUrl(file));
    event.dataTransfer?.setData('text/plain', transferDownloadUrl(file));
  });
  container.querySelector('[data-action="save"]')?.addEventListener('click', () => {
    streamSaveTransferFile(file).catch((error) => transferSetStatus(`保存失败：${error.message || error}`, true));
  });
  container.querySelector('[data-action="copy"]')?.addEventListener('click', () => {
    copyTransferLink(file).catch((error) => transferSetStatus(`复制失败：${error.message || error}`, true));
  });
  container.querySelector('[data-action="share"]')?.addEventListener('click', () => {
    shareTransferFile(file).catch((error) => transferSetStatus(`分享失败：${error.message || error}`, true));
  });
  container.querySelector('[data-action="delete"]')?.addEventListener('click', async () => {
    try {
      await transferApiJson(`/transfer/files/${encodeURIComponent(file.id)}`, { method: 'DELETE' });
      transferKnownReady.delete(file.id);
      transferPersistKnownReady();
      await loadTransferEvents();
    } catch (error) {
      transferSetStatus(`删除失败：${error.message || error}`, true);
    }
  });
}

function renderTransferQueue() {
  if (!transferEls.queue) return;
  transferEls.queue.innerHTML = '';
  transferSelectedFiles.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'transfer-file-row transfer-queue-row';
    row.dataset.index = String(index);
    row.innerHTML = `
      <div class="transfer-file-main">
        <div class="transfer-file-name">${transferEscape(item.file.name || 'download.bin')}</div>
        <div class="transfer-file-meta">
          <span>${transferFormatBytes(item.file.size)}</span>
          <span>${transferEscape(item.status || '待发送')}</span>
          <span>${transferFormatRate(item.rate || 0)}</span>
          ${transferAttemptsText(item) ? `<span>${transferEscape(transferAttemptsText(item))}</span>` : ''}
        </div>
        <div class="transfer-progress"><span style="width:${Math.max(0, Math.min(100, item.progress || 0))}%"></span></div>
      </div>
      <div class="transfer-file-actions">
        <button type="button" data-action="remove">移除</button>
      </div>`;
    row.querySelector('[data-action="remove"]').addEventListener('click', () => {
      transferSelectedFiles.splice(index, 1);
      renderTransferQueue();
    });
    transferEls.queue.appendChild(row);
  });
}

function addTransferFiles(files) {
  const incoming = [...(files || [])].filter(Boolean);
  incoming.forEach((file) => {
    transferSelectedFiles.push({ file, progress: 0, rate: 0, status: '待发送' });
  });
  renderTransferQueue();
  if (incoming.length) transferSetStatus(`已选择 ${incoming.length} 个文件`);
}

function maybeAutoDownload(files) {
  const autoEnabled = Boolean(transferEls.autoDownload?.checked);
  if (!autoEnabled) {
    files.forEach((file) => { if (file.status === 'ready') transferKnownReady.add(file.id); });
    transferPersistKnownReady();
    return;
  }
  for (const file of files) {
    if (file.status !== 'ready') continue;
    if (file.uploaderId === transferClientId) {
      transferKnownReady.add(file.id);
      continue;
    }
    if (transferKnownReady.has(file.id)) continue;
    transferSetStatus(`自动下载：${file.name}`);
    triggerNativeDownload(file);
  }
  transferPersistKnownReady();
}

function renderTransferFileRow(file) {
  const row = document.createElement('div');
  row.className = 'transfer-file-row';
  row.innerHTML = `
    <div class="transfer-file-main">
      <div class="transfer-file-name">${transferEscape(file.name || 'download.bin')}</div>
      <div class="transfer-file-meta">
        <span>${transferEscape(transferProviderLabel(file))}</span>
        <span>${transferEscape(file.status || 'unknown')}</span>
        <span>${transferFormatBytes(file.size || file.expectedSize || 0)}</span>
        <span>${transferFormatRate(file.uploadRateBytesPerSec || 0)}</span>
        <span>${transferFormatTime(file.completedAt || file.createdAt)}</span>
      </div>
    </div>
    <div class="transfer-file-actions">${transferFileActionHtml(file)}</div>`;
  wireTransferFileActions(row, file);
  return row;
}

function renderTransferFiles(files = []) {
  if (!transferEls.fileList) return;
  transferEls.fileList.innerHTML = '';
  if (transferEls.fileCount) transferEls.fileCount.textContent = String(files.length);
  files.forEach((file) => transferEls.fileList.appendChild(renderTransferFileRow(file)));
}

function renderTransferTextBubble(event) {
  const mine = event.senderId === transferClientId;
  const bubble = document.createElement('article');
  bubble.className = `transfer-bubble transfer-bubble-text ${mine ? 'transfer-bubble-mine' : 'transfer-bubble-peer'}`;
  bubble.innerHTML = `
    <div class="transfer-bubble-meta">
      <span>${mine ? '我' : transferEscape(event.senderName || '对方')}</span>
      <time>${transferFormatTime(event.createdAt)}</time>
    </div>
    <div class="transfer-text-content">${transferTextHtml(event.text)}</div>`;
  return bubble;
}

function renderTransferFileBubble(event) {
  const file = event.file || {};
  const mine = file.uploaderId === transferClientId;
  const bubble = document.createElement('article');
  bubble.className = `transfer-bubble transfer-bubble-file ${mine ? 'transfer-bubble-mine' : 'transfer-bubble-peer'}`;
  bubble.innerHTML = `
    <div class="transfer-bubble-meta">
      <span>${mine ? '我' : '对方'}</span>
      <time>${transferFormatTime(file.completedAt || event.createdAt)}</time>
    </div>
    <div class="transfer-file-main">
      <div class="transfer-file-name">${transferEscape(file.name || 'download.bin')}</div>
      <div class="transfer-file-meta">
        <span>${transferEscape(transferProviderLabel(file))}</span>
        <span>${transferEscape(file.status || 'unknown')}</span>
        <span>${transferFormatBytes(file.size || file.expectedSize || 0)}</span>
        <span>${transferFormatRate(file.uploadRateBytesPerSec || 0)}</span>
      </div>
      ${file.status !== 'ready' ? '<div class="transfer-progress"><span style="width:20%"></span></div>' : ''}
    </div>
    <div class="transfer-file-actions">${transferFileActionHtml(file)}</div>`;
  wireTransferFileActions(bubble, file);
  return bubble;
}

function renderTransferConversation(events = []) {
  if (!transferEls.conversation) return;
  const shouldStickToBottom = transferEls.conversation.scrollTop + transferEls.conversation.clientHeight >= transferEls.conversation.scrollHeight - 80;
  transferEls.conversation.innerHTML = '';
  if (transferEls.eventCount) transferEls.eventCount.textContent = String(events.length);
  if (!events.length) {
    const empty = document.createElement('div');
    empty.className = 'transfer-empty';
    empty.textContent = '暂无传输';
    transferEls.conversation.appendChild(empty);
    return;
  }
  events.forEach((event) => {
    if (event.kind === 'text') transferEls.conversation.appendChild(renderTransferTextBubble(event));
    if (event.kind === 'file') transferEls.conversation.appendChild(renderTransferFileBubble(event));
  });
  if (shouldStickToBottom) transferEls.conversation.scrollTop = transferEls.conversation.scrollHeight;
}

async function loadTransferEvents() {
  const data = await transferApiJson('/transfer/events', { cache: 'no-store' });
  const events = Array.isArray(data.events) ? data.events : [];
  const files = Array.isArray(data.files) ? data.files : [];
  transferEventsCache = events;
  transferFilesCache = files;
  renderTransferConversation(events);
  renderTransferFiles(files);
  if (transferFirstLoad) {
    files.forEach((file) => { if (file.status === 'ready') transferKnownReady.add(file.id); });
    transferFirstLoad = false;
    transferPersistKnownReady();
  } else {
    maybeAutoDownload(files);
  }
  transferSetStatus(events.length ? `${events.length} 条上下文，${files.length} 个文件` : '暂无传输');
}

async function loadTransferFiles() {
  await loadTransferEvents();
}

async function loadTransferNetworkInfo() {
  if (!transferEls.lanInfo) return;
  try {
    const data = await transferApiJson('/health', { cache: 'no-store' });
    transferEls.lanInfo.textContent = data.lanUrl ? `局域网入口：${data.lanUrl}` : '未检测到局域网 IPv4';
  } catch (error) {
    transferEls.lanInfo.textContent = `局域网状态读取失败：${error.message || error}`;
  }
}

function safeStorageToHeaders(headers = {}) {
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
    const finalHeaders = safeStorageToHeaders(headers);
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

async function uploadStorageToSingle(item, upload) {
  const startedAt = performance.now();
  await xhrUploadBlob(upload.uploadUrl, item.file, item.file.type || 'application/octet-stream', (loaded, total) => {
    const elapsed = Math.max(1, performance.now() - startedAt);
    item.progress = total ? (loaded / total) * 100 : item.progress;
    item.rate = (loaded * 1000) / elapsed;
    item.status = 'storage.to 上传中';
    renderTransferQueue();
  }, upload.headers);
}

async function storageToPartUrl(upload, partNumber) {
  const key = String(partNumber);
  if (upload.initialUrls && upload.initialUrls[key]) return upload.initialUrls[key];
  const data = await transferApiJson('/transfer/providers/storage-to/parts', {
    method: 'POST',
    body: JSON.stringify({ uploadId: upload.uploadId, partNumbers: [partNumber] })
  });
  upload.initialUrls = { ...(upload.initialUrls || {}), ...(data.urls || {}) };
  return upload.initialUrls[key];
}

async function uploadStorageToMultipart(item, upload) {
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
      const partUrl = await storageToPartUrl(upload, partNumber);
      if (!partUrl) throw new Error(`storage.to part ${partNumber} URL missing`);
      const result = await xhrUploadBlob(partUrl, item.file.slice(start, end), '', (loaded) => {
        partProgress.set(partNumber, loaded);
        const uploaded = [...partProgress.values()].reduce((sum, value) => sum + value, 0);
        const elapsed = Math.max(1, performance.now() - startedAt);
        item.progress = item.file.size ? (uploaded / item.file.size) * 100 : item.progress;
        item.rate = (uploaded * 1000) / elapsed;
        item.status = `storage.to 分片 ${partNumber}/${upload.totalParts}`;
        renderTransferQueue();
      });
      if (!result.etag) throw new Error(`storage.to part ${partNumber} missing ETag`);
      parts.push({ partNumber, etag: result.etag });
    }
  };
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  parts.sort((a, b) => a.partNumber - b.partNumber);
  await transferApiJson('/transfer/providers/storage-to/complete-multipart', {
    method: 'POST',
    body: JSON.stringify({ uploadId: upload.uploadId, parts })
  });
}

async function uploadViaStorageTo(item) {
  const info = transferProviderInfo('storage-to');
  if (info.available === false) throw new Error(info.reason || 'storage.to unavailable');
  item.status = 'storage.to 初始化';
  renderTransferQueue();
  const init = await transferApiJson('/transfer/providers/storage-to/init', {
    method: 'POST',
    body: JSON.stringify({
      name: item.file.name || 'download.bin',
      mime: item.file.type || 'application/octet-stream',
      size: item.file.size
    })
  });
  const upload = init.upload || {};
  if (upload.type === 'multipart') await uploadStorageToMultipart(item, upload);
  else await uploadStorageToSingle(item, upload);
  item.status = 'storage.to 确认';
  renderTransferQueue();
  const confirmed = await transferApiJson('/transfer/providers/storage-to/confirm', {
    method: 'POST',
    body: JSON.stringify({
      name: item.file.name || 'download.bin',
      mime: item.file.type || 'application/octet-stream',
      size: item.file.size,
      r2Key: upload.r2Key,
      uploaderId: transferClientId,
      attempts: [...providerAttempts(item), transferAttempt('storage-to', 'ready')]
    })
  });
  pushProviderAttempt(item, 'storage-to', 'ready', '', confirmed.file?.rawDownloadUrl || confirmed.file?.downloadUrl || '');
  item.progress = 100;
  item.rate = Number(confirmed.file?.uploadRateBytesPerSec || item.rate || 0);
  item.status = 'storage.to 已发送';
  renderTransferQueue();
  return confirmed.file;
}

function uploadTransferContent(fileId, item) {
  return new Promise((resolveUpload, reject) => {
    const xhr = new XMLHttpRequest();
    let lastLoaded = 0;
    let lastAt = performance.now();
    xhr.open('PUT', `/transfer/files/${encodeURIComponent(fileId)}/content`);
    xhr.setRequestHeader('Content-Type', item.file.type || 'application/octet-stream');
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const now = performance.now();
      const deltaBytes = event.loaded - lastLoaded;
      const deltaMs = Math.max(1, now - lastAt);
      item.progress = (event.loaded / event.total) * 100;
      item.rate = (deltaBytes * 1000) / deltaMs;
      item.status = '发送中';
      lastLoaded = event.loaded;
      lastAt = now;
      renderTransferQueue();
    };
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText || '{}'); } catch {}
      if (xhr.status < 200 || xhr.status >= 300 || data.ok === false) {
        reject(new Error(data.error || `HTTP ${xhr.status}`));
        return;
      }
      item.progress = 100;
      item.status = '已发送';
      item.rate = Number(data.file?.uploadRateBytesPerSec || item.rate || 0);
      renderTransferQueue();
      resolveUpload(data.file);
    };
    xhr.onerror = () => reject(new Error('upload network error'));
    xhr.onabort = () => reject(new Error('upload aborted'));
    xhr.send(item.file);
  });
}

async function uploadViaLocal(item) {
  item.status = '本地公网创建记录';
  renderTransferQueue();
  const created = await transferApiJson('/transfer/files', {
    method: 'POST',
    body: JSON.stringify({
      name: item.file.name || 'download.bin',
      mime: item.file.type || 'application/octet-stream',
      size: item.file.size,
      uploaderId: transferClientId
    })
  });
  const file = await uploadTransferContent(created.file.id, item);
  pushProviderAttempt(item, 'local', 'ready', '', transferDownloadUrl(file));
  item.status = '本地公网已发送';
  renderTransferQueue();
  return file;
}

async function uploadTransferItem(item) {
  item.providerAttempts = [];
  const mode = transferMode();
  if (mode === 'local') return await uploadViaLocal(item);
  if (mode === 'storage-to') return await uploadViaStorageTo(item);
  try {
    return await uploadViaStorageTo(item);
  } catch (error) {
    pushProviderAttempt(item, 'storage-to', 'failed', error.message || error);
    item.status = `storage.to 失败，改走本地公网：${error.message || error}`;
    transferSetStatus(item.status, true);
    renderTransferQueue();
  }
  try {
    return await uploadViaLocal(item);
  } catch (error) {
    pushProviderAttempt(item, 'local', 'failed', error.message || error);
    throw error;
  }
}

async function uploadTransferFiles() {
  if (!transferSelectedFiles.length) {
    transferSetStatus('请选择文件', true);
    return;
  }
  await loadTransferProviders();
  for (const item of transferSelectedFiles) {
    try {
      await uploadTransferItem(item);
    } catch (error) {
      item.status = `失败：${error.message || error}`;
      transferSetStatus(item.status, true);
      renderTransferQueue();
      return;
    }
  }
  transferSelectedFiles = [];
  renderTransferQueue();
  await loadTransferEvents();
  transferSetStatus('文件已发送');
}

async function sendTransferText() {
  const text = String(transferEls.textInput?.value || '').trim();
  if (!text) {
    transferSetStatus('请输入文字', true);
    return;
  }
  try {
    transferEls.sendText.disabled = true;
    await transferApiJson('/transfer/messages', {
      method: 'POST',
      body: JSON.stringify({ text, senderId: transferClientId, senderName: transferClientName })
    });
    transferEls.textInput.value = '';
    await loadTransferEvents();
    transferSetStatus('文字已发送');
  } catch (error) {
    transferSetStatus(`发送失败：${error.message || error}`, true);
  } finally {
    transferEls.sendText.disabled = false;
    transferEls.textInput?.focus();
  }
}

async function openTransferStore() {
  try {
    const data = await transferApiJson('/transfer/store/open', { method: 'POST', body: JSON.stringify({}) });
    transferSetStatus(`已请求打开服务端目录：${data.path || ''}`);
  } catch (error) {
    transferSetStatus(`远程设备请在系统下载器或文件管理器查看下载文件；服务端目录打开失败：${error.message || error}`, true);
  }
}

function openTransferModal() {
  transferEls.modal?.classList.add('open');
  transferFirstLoad = true;
  loadTransferNetworkInfo().catch(() => {});
  loadTransferProviders().catch(() => {});
  loadTransferEvents().catch((error) => transferSetStatus(`传输上下文读取失败：${error.message || error}`, true));
  if (!transferPollTimer) {
    transferPollTimer = setInterval(() => {
      if (!transferEls.modal?.classList.contains('open')) return;
      loadTransferEvents().catch(() => {});
    }, 3500);
  }
}

function wireTransferDropTarget(target) {
  ['dragenter', 'dragover'].forEach((name) => {
    target?.addEventListener(name, (event) => {
      event.preventDefault();
      transferEls.dropZone?.classList.add('transfer-drop-active');
    });
  });
  ['dragleave', 'drop'].forEach((name) => {
    target?.addEventListener(name, (event) => {
      event.preventDefault();
      transferEls.dropZone?.classList.remove('transfer-drop-active');
    });
  });
  target?.addEventListener('drop', (event) => addTransferFiles(event.dataTransfer?.files || []));
}

function transferParentPath(value) {
  const text = String(value || '').trim();
  const slash = Math.max(text.lastIndexOf('\\'), text.lastIndexOf('/'));
  return slash > 0 ? text.slice(0, slash) : text;
}

async function openTransferFolderFallback(inboxPath) {
  const folderPath = transferParentPath(inboxPath);
  if (folderPath) {
    await transferApiJson('/path/open', {
      method: 'POST',
      body: JSON.stringify({ path: folderPath, type: 'directory', kind: 'directory' })
    });
    transferSetStatus(`已打开目录：${folderPath}`);
    return;
  }
  const data = await transferApiJson('/transfer/store/open', { method: 'POST' });
  transferSetStatus(data.path ? `已打开目录：${data.path}` : '已打开服务端传输目录');
}

async function openTransferFileFolder(fileId, inboxPath = '') {
  if (!fileId) return;
  try {
    const data = await transferApiJson(`/transfer/files/${encodeURIComponent(fileId)}/open-folder`, { method: 'POST' });
    transferSetStatus(data.path ? `已打开目录：${data.path}` : '已打开目录');
  } catch (error) {
    try {
      await openTransferFolderFallback(inboxPath);
    } catch {
      transferSetStatus(`打开目录失败：${error.message || error}`, true);
    }
  }
}

document.addEventListener('click', (event) => {
  const button = event.target?.closest?.('[data-action="open-folder"][data-file-id]');
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  openTransferFileFolder(button.dataset.fileId, button.dataset.inboxPath || '').catch((error) => {
    transferSetStatus(`打开目录失败：${error.message || error}`, true);
  });
}, true);

if (transferEls.autoDownload) transferEls.autoDownload.checked = localStorage.getItem('plusTransferAutoDownload') === 'true';
if (transferEls.mode) transferEls.mode.value = transferMode();
transferEls.openBtn?.addEventListener('click', openTransferModal);
transferEls.openStore?.addEventListener('click', openTransferStore);
transferEls.mode?.addEventListener('change', () => {
  localStorage.setItem('plusTransferMode', transferMode());
  const label = transferEls.mode?.selectedOptions?.[0]?.textContent || transferMode();
  transferSetStatus(`传输方式：${label}`);
});
transferEls.autoDownload?.addEventListener('change', () => {
  localStorage.setItem('plusTransferAutoDownload', String(transferEls.autoDownload.checked));
  transferSetStatus(transferEls.autoDownload.checked ? '自动下载已开启' : '自动下载已关闭');
});
transferEls.pickFiles?.addEventListener('click', () => transferEls.filePicker?.click());
transferEls.dropZone?.addEventListener('click', () => transferEls.filePicker?.click());
transferEls.filePicker?.addEventListener('change', (event) => {
  addTransferFiles(event.currentTarget.files || []);
  event.currentTarget.value = '';
});
transferEls.uploadFiles?.addEventListener('click', () => uploadTransferFiles().catch((error) => transferSetStatus(`发送失败：${error.message || error}`, true)));
transferEls.refresh?.addEventListener('click', () => loadTransferEvents().catch((error) => transferSetStatus(`刷新失败：${error.message || error}`, true)));
transferEls.sendText?.addEventListener('click', () => sendTransferText());
transferEls.textInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendTransferText();
  }
});
wireTransferDropTarget(transferEls.dropZone);
wireTransferDropTarget(transferEls.conversation);

if (new URLSearchParams(location.search).has('transfer')) setTimeout(openTransferModal, 0);
