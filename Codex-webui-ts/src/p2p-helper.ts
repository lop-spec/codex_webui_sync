import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';
import { fileURLToPath } from 'url';
import { RTCPeerConnection, RTCDataChannel } from 'werift';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

interface WireRequest {
  id: string;
  type: 'request';
  method: string;
  path: string;
  headers?: Record<string, string>;
  bodyBase64?: string;
  stream?: boolean;
}

interface RuntimeState {
  token: string;
  startedAt: string;
  localUrl: string;
  phoneUrl: string;
  publicUrl: string | null;
  publicPhoneUrl: string | null;
  targetOrigin: string;
  connected: boolean;
  connectionState: string;
  channelState: string;
  lastRequestAt: string | null;
  lastError: string | null;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const logsDir = path.join(rootDir, 'logs');
const statePath = path.join(logsDir, 'p2p-webui.json');

function existingToken(): string | null {
  if (process.env.CODEX_WEBUI_P2P_ROTATE_TOKEN === '1') return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8')) as { token?: unknown };
    const value = typeof parsed.token === 'string' ? parsed.token.trim() : '';
    return /^[A-Za-z0-9_-]{16,80}$/.test(value) ? value : null;
  } catch {
    return null;
  }
}

const port = Number(process.env.CODEX_WEBUI_P2P_PORT || '5127');
const host = process.env.CODEX_WEBUI_P2P_HOST || '127.0.0.1';
const targetOrigin = (process.env.CODEX_WEBUI_TARGET || 'http://127.0.0.1:5055').replace(/\/+$/, '');
const webuiToken = process.env.WEBUI_TOKEN || '';
const publicUrl = (process.env.CODEX_WEBUI_P2P_PUBLIC_URL || '').replace(/\/+$/, '') || null;
const token = process.env.CODEX_WEBUI_P2P_TOKEN || existingToken() || crypto.randomBytes(18).toString('base64url');
const localUrl = `http://${host}:${port}`;
const phonePath = `/p2p-phone.html?token=${encodeURIComponent(token)}`;

let peer: RTCPeerConnection | null = null;
let channel: RTCDataChannel | null = null;

const runtime: RuntimeState = {
  token,
  startedAt: new Date().toISOString(),
  localUrl,
  phoneUrl: `${localUrl}${phonePath}`,
  publicUrl,
  publicPhoneUrl: publicUrl ? `${publicUrl}${phonePath}` : null,
  targetOrigin,
  connected: false,
  connectionState: 'new',
  channelState: 'new',
  lastRequestAt: null,
  lastError: null
};

function writeState() {
  fs.mkdirSync(logsDir, { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(runtime, null, 2));
}

function sendJson(res: http.ServerResponse, status: number, body: JsonValue) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(payload)
  });
  res.end(payload);
}

function sendText(res: http.ServerResponse, status: number, text: string, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(text)
  });
  res.end(text);
}

function readBody(req: http.IncomingMessage, maxBytes = 8 * 1024 * 1024): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('error', reject);
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

function safePath(rawPath: string): string {
  if (!rawPath || typeof rawPath !== 'string') throw new Error('Missing path');
  if (!rawPath.startsWith('/')) throw new Error('Path must be absolute');
  if (rawPath.includes('://') || rawPath.includes('\\')) throw new Error('Invalid path');
  return rawPath;
}

function targetUrl(rawPath: string): string {
  return new URL(safePath(rawPath), `${targetOrigin}/`).toString();
}

function publicHeaders(headers: Headers): Record<string, string> {
  const allowed = new Set(['content-type', 'content-length', 'content-disposition', 'accept-ranges', 'content-range']);
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    if (allowed.has(key.toLowerCase())) out[key] = value;
  });
  return out;
}

function requestHeaders(input?: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input || {})) {
    const lower = key.toLowerCase();
    if (['content-type', 'accept', 'range'].includes(lower)) out[key] = String(value);
  }
  return out;
}

function authorizationHeader(): Record<string, string> {
  return webuiToken ? { Authorization: `Bearer ${webuiToken}` } : {};
}

function proxyRequestHeaders(req: http.IncomingMessage): http.OutgoingHttpHeaders {
  const out: http.OutgoingHttpHeaders = { ...authorizationHeader() };
  for (const key of ['accept', 'content-length', 'content-type', 'range']) {
    const value = req.headers[key];
    if (value == null) continue;
    out[key] = Array.isArray(value) ? value.join(', ') : String(value);
  }
  return out;
}

function proxyResponseHeaders(headers: http.IncomingHttpHeaders): http.OutgoingHttpHeaders {
  const allowed = new Set(['accept-ranges', 'cache-control', 'content-disposition', 'content-length', 'content-range', 'content-type']);
  const out: http.OutgoingHttpHeaders = { 'Cache-Control': 'no-store' };
  for (const [key, value] of Object.entries(headers)) {
    if (!allowed.has(key.toLowerCase()) || value == null) continue;
    out[key] = Array.isArray(value) ? value.join(', ') : String(value);
  }
  return out;
}

function transferProxyTarget(parsed: URL): URL | null {
  if (!parsed.pathname.startsWith('/p2p-transfer/')) return null;
  const suffix = parsed.pathname.slice('/p2p-transfer'.length);
  if (!/^\/files\/[A-Za-z0-9_-]{8,80}(?:\/(?:content|download))?$/.test(suffix)) return null;
  const target = new URL(`/transfer${suffix}`, `${targetOrigin}/`);
  parsed.searchParams.forEach((value, key) => {
    if (key === 'p2pToken') return;
    if (key === 'token' && value === token) return;
    target.searchParams.append(key, value);
  });
  return target;
}

async function handleTransferProxy(req: http.IncomingMessage, res: http.ServerResponse, parsed: URL) {
  const requestToken = parsed.searchParams.get('p2pToken') || parsed.searchParams.get('token') || '';
  if (requestToken !== token) return sendJson(res, 403, { ok: false, error: 'Invalid token' });
  const method = String(req.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'PUT'].includes(method)) return sendJson(res, 405, { ok: false, error: 'Unsupported transfer method' });
  const target = transferProxyTarget(parsed);
  if (!target) return sendJson(res, 404, { ok: false, error: 'Unsupported transfer path' });

  runtime.lastRequestAt = new Date().toISOString();
  runtime.lastError = null;
  writeState();

  await new Promise<void>((resolve) => {
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const transport = target.protocol === 'https:' ? https : http;
    const proxyReq = transport.request(target, { method, headers: proxyRequestHeaders(req) }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyResponseHeaders(proxyRes.headers));
      pipeline(proxyRes, res)
        .then(settle)
        .catch((error) => {
          runtime.lastError = error instanceof Error ? error.message : String(error);
          writeState();
          if (!res.destroyed) res.destroy(error instanceof Error ? error : undefined);
          settle();
        });
    });
    proxyReq.on('error', (error) => {
      runtime.lastError = error instanceof Error ? error.message : String(error);
      writeState();
      if (!res.headersSent) sendJson(res, 502, { ok: false, error: runtime.lastError });
      else if (!res.destroyed) res.destroy(error instanceof Error ? error : undefined);
      settle();
    });
    if (method === 'GET' || method === 'HEAD') {
      proxyReq.end();
    } else {
      pipeline(req, proxyReq).catch((error) => {
        runtime.lastError = error instanceof Error ? error.message : String(error);
        writeState();
        proxyReq.destroy(error instanceof Error ? error : undefined);
      });
    }
  });
}

async function waitIceComplete(pc: RTCPeerConnection, ms = 2500) {
  if (pc.iceGatheringState === 'complete') return;
  await Promise.race([
    pc.iceGatheringStateChange.watch((state) => state === 'complete', ms).catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, ms))
  ]);
}

async function resetPeer() {
  channel = null;
  runtime.connected = false;
  runtime.channelState = 'closed';
  if (peer) {
    try { await peer.close(); } catch {}
  }
  peer = null;
}

function sendPacket(dc: RTCDataChannel, packet: Record<string, JsonValue>) {
  if (dc.readyState !== 'open') return;
  dc.send(JSON.stringify(packet));
}

function sendChunked(dc: RTCDataChannel, id: string, bytes: Uint8Array) {
  const chunkSize = 24 * 1024;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    sendPacket(dc, { type: 'response-chunk', id, dataBase64: Buffer.from(chunk).toString('base64') });
  }
}

async function handleProxyRequest(dc: RTCDataChannel, request: WireRequest) {
  runtime.lastRequestAt = new Date().toISOString();
  runtime.lastError = null;
  writeState();
  const method = String(request.method || 'GET').toUpperCase();
  if (!['GET', 'POST', 'PUT', 'DELETE', 'HEAD'].includes(method)) throw new Error('Unsupported method');
  const body = request.bodyBase64 ? Buffer.from(request.bodyBase64, 'base64') : undefined;
  const response = await fetch(targetUrl(request.path), {
    method,
    headers: requestHeaders(request.headers),
    body: method === 'GET' || method === 'HEAD' ? undefined : body
  });
  sendPacket(dc, {
    type: 'response-start',
    id: request.id,
    status: response.status,
    headers: publicHeaders(response.headers) as JsonValue
  });
  if (response.body) {
    const reader = response.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.length) sendChunked(dc, request.id, value);
    }
  } else {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length) sendChunked(dc, request.id, bytes);
  }
  sendPacket(dc, { type: 'response-end', id: request.id });
  runtime.lastError = null;
  writeState();
}

function attachChannel(dc: RTCDataChannel) {
  channel = dc;
  runtime.channelState = dc.readyState;
  dc.onopen = () => {
    runtime.connected = true;
    runtime.channelState = 'open';
    writeState();
  };
  dc.onclose = () => {
    runtime.connected = false;
    runtime.channelState = 'closed';
    writeState();
  };
  dc.onMessage.subscribe((message) => {
    Promise.resolve()
      .then(async () => {
        const text = Buffer.isBuffer(message) ? message.toString('utf8') : String(message);
        const parsed = JSON.parse(text) as WireRequest;
        if (parsed.type !== 'request' || !parsed.id) throw new Error('Bad P2P request');
        await handleProxyRequest(dc, parsed);
      })
      .catch((error) => {
        runtime.lastError = error instanceof Error ? error.message : String(error);
        writeState();
        try {
          const id = (() => {
            try { return JSON.parse(Buffer.isBuffer(message) ? message.toString('utf8') : String(message)).id || ''; } catch { return ''; }
          })();
          if (id) sendPacket(dc, { type: 'response-error', id, error: runtime.lastError });
        } catch {}
      });
  });
}

async function handleOffer(req: http.IncomingMessage, res: http.ServerResponse) {
  try {
    const body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
    if (body.token !== token) return sendJson(res, 403, { ok: false, error: 'Invalid token' });
    if (!body.offer || body.offer.type !== 'offer' || typeof body.offer.sdp !== 'string') {
      return sendJson(res, 400, { ok: false, error: 'Invalid offer' });
    }
    await resetPeer();
    runtime.lastError = null;
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
      ]
    });
    peer = pc;
    runtime.connectionState = pc.connectionState;
    pc.connectionStateChange.subscribe((state) => {
      runtime.connectionState = state;
      runtime.connected = state === 'connected' && channel?.readyState === 'open';
      writeState();
    });
    pc.onDataChannel.subscribe((dc) => attachChannel(dc));
    await pc.setRemoteDescription(body.offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await waitIceComplete(pc);
    const local = pc.localDescription || answer;
    writeState();
    return sendJson(res, 200, { ok: true, answer: { type: local.type, sdp: local.sdp } });
  } catch (error) {
    runtime.lastError = error instanceof Error ? error.message : String(error);
    writeState();
    return sendJson(res, 500, { ok: false, error: runtime.lastError });
  }
}

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse, pathname: string) {
  const map: Record<string, string> = {
    '/p2p-phone.html': path.join(publicDir, 'p2p-phone.html'),
    '/css/p2p-phone.css': path.join(publicDir, 'css', 'p2p-phone.css'),
    '/js/p2p-phone.js': path.join(publicDir, 'js', 'p2p-phone.js'),
    '/js/p2p-transfer.js': path.join(publicDir, 'js', 'p2p-transfer.js')
  };
  const filePath = map[pathname];
  if (!filePath) return false;
  if (!fs.existsSync(filePath)) {
    sendText(res, 404, 'Not found');
    return true;
  }
  const type = filePath.endsWith('.js')
    ? 'application/javascript; charset=utf-8'
    : (filePath.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/html; charset=utf-8');
  sendText(res, 200, fs.readFileSync(filePath, 'utf8'), type);
  return true;
}

const server = http.createServer(async (req, res) => {
  const parsed = new URL(req.url || '/', localUrl);
  if (req.method === 'GET' && parsed.pathname === '/health') return sendJson(res, 200, { ok: true, connected: runtime.connected });
  if (req.method === 'GET' && parsed.pathname === '/p2p/status') {
    if (parsed.searchParams.get('token') !== token) return sendJson(res, 403, { ok: false, error: 'Invalid token' });
    return sendJson(res, 200, { ok: true, state: { ...runtime, token: '<link-token>' } as unknown as JsonValue });
  }
  if (req.method === 'POST' && parsed.pathname === '/p2p/offer') return handleOffer(req, res);
  if (parsed.pathname.startsWith('/p2p-transfer/')) return handleTransferProxy(req, res, parsed);
  if (req.method === 'GET' && parsed.pathname === '/') {
    res.writeHead(302, { Location: phonePath, 'Cache-Control': 'no-store' });
    return res.end();
  }
  if (req.method === 'GET' && serveStatic(req, res, parsed.pathname)) return;
  sendText(res, 404, 'Not found');
});

server.listen(port, host, () => {
  writeState();
  console.log(`P2P helper: ${localUrl}`);
  console.log(`Phone link: ${runtime.publicPhoneUrl || runtime.phoneUrl}`);
  console.log(`Target WebUI: ${targetOrigin}`);
  console.log(`State file: ${statePath}`);
});

process.on('SIGINT', async () => {
  await resetPeer();
  server.close(() => process.exit(0));
});
