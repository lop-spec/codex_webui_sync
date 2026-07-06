import { spawn } from 'child_process';
import fs from 'fs';
import net from 'net';
import path from 'path';
import { EventEmitter } from 'events';
import { resolveCodexLaunch } from './codex-launch.js';

export const DEFAULT_APP_SERVER_URL = 'ws://127.0.0.1:5056';
export const APP_SERVER_ENDPOINT_STATE = 'app-server-endpoint.json';

interface PendingRequest {
  method: string;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

interface InboundServerRequest {
  id: string | number;
  method: string;
  params: any;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function endpointHealthUrl(url: string): string {
  return url.replace(/^ws:/i, 'http:').replace(/^wss:/i, 'https:') + '/healthz';
}

function parseEndpoint(url: string): { host: string; port: number; secure: boolean } {
  const parsed = new URL(url);
  return {
    host: parsed.hostname || '127.0.0.1',
    port: Number(parsed.port || (parsed.protocol === 'wss:' ? 443 : 80)),
    secure: parsed.protocol === 'wss:'
  };
}

function formatEndpoint(host: string, port: number, secure = false): string {
  return `${secure ? 'wss' : 'ws'}://${host}:${port}`;
}

function canListen(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    let endpoint: { host: string; port: number; secure: boolean } | null = null;
    try {
      endpoint = parseEndpoint(url);
    } catch {
      resolve(false);
      return;
    }
    const server = net.createServer();
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      try { server.close(); } catch {}
      resolve(ok);
    };
    server.once('error', () => finish(false));
    server.listen(endpoint.port, endpoint.host, () => finish(true));
  });
}

function allocateEndpointLike(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let endpoint: { host: string; port: number; secure: boolean } | null = null;
    try {
      endpoint = parseEndpoint(url);
    } catch (error) {
      reject(error);
      return;
    }
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, endpoint.host, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolve(formatEndpoint(endpoint.host, port, endpoint.secure)));
    });
  });
}

export class AppServerClient extends EventEmitter {
  private socket: any = null;
  private startPromise: Promise<void> | null = null;
  private buffer = '';
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();
  private serverRequests = new Map<string, InboundServerRequest>();
  private rpcLog: fs.WriteStream | null = null;

  constructor(
    private readonly logDir: string,
    private readonly cwd: string,
    private url: string = process.env.CODEX_APP_SERVER_URL || DEFAULT_APP_SERVER_URL
  ) {
    super();
  }

  public endpoint(): string {
    return this.url;
  }

  public isRunning(): boolean {
    return !!this.socket && this.socket.readyState === 1;
  }

  public async start(): Promise<void> {
    if (this.isRunning()) return;
    if (this.startPromise) return this.startPromise;
    this.startPromise = this.startFreshConnection().finally(() => {
      this.startPromise = null;
    });
    return this.startPromise;
  }

  private async startFreshConnection(): Promise<void> {
    fs.mkdirSync(this.logDir, { recursive: true });
    const header = `\n\n===== ${new Date().toISOString()} =====\n`;
    this.rpcLog = fs.createWriteStream(path.join(this.logDir, 'app-server.ws.jsonl'), { flags: 'a' });
    this.rpcLog.write(header);

    const preferredUrl = this.url || DEFAULT_APP_SERVER_URL;
    try {
      await this.connectWithRetry(1500);
    } catch {
      const stateUrl = this.readEndpointState();
      if (stateUrl && stateUrl !== preferredUrl) {
        this.url = stateUrl;
        try {
          await this.connectWithRetry(1500);
        } catch {
          this.url = preferredUrl;
          await this.launchWithFallback();
        }
      } else {
        await this.launchWithFallback();
      }
    }
    this.writeEndpointState('connected');

    await this.request('initialize', {
      clientInfo: { name: 'codex-webui-ts', title: 'Codex WebUI TS', version: '0.1.0' },
      capabilities: { experimentalApi: true, requestAttestation: false }
    }, 15000);
    this.notify('initialized');
  }

  private launchExternalServer(): void {
    const launch = resolveCodexLaunch();
    const suffix = this.logSuffix();
    const stdoutFd = fs.openSync(path.join(this.logDir, `app-server-${suffix}.out.log`), 'a');
    const stderrFd = fs.openSync(path.join(this.logDir, `app-server-${suffix}.err.log`), 'a');
    const child = spawn(launch.command, [...launch.argsPrefix, 'app-server', '--listen', this.url], {
      cwd: this.cwd,
      detached: true,
      windowsHide: true,
      stdio: ['ignore', stdoutFd, stderrFd],
      env: { ...process.env }
    });
    child.once('error', (error) => this.emit('error', error));
    child.unref();
    try { fs.closeSync(stdoutFd); } catch {}
    try { fs.closeSync(stderrFd); } catch {}
  }

  private async launchWithFallback(): Promise<void> {
    const preferredUrl = this.url || DEFAULT_APP_SERVER_URL;
    const candidates: string[] = [];
    if (await canListen(preferredUrl)) candidates.push(preferredUrl);
    candidates.push(await allocateEndpointLike(preferredUrl));
    let lastError: Error | null = null;
    for (const candidate of candidates) {
      this.url = candidate;
      this.launchExternalServer();
      try {
        await this.connectWithRetry(15000);
        this.writeEndpointState('launched');
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.emit('stderr', `app-server launch failed on ${candidate}: ${lastError.message}`);
      }
    }
    throw lastError || new Error(`failed to launch app-server from ${preferredUrl}`);
  }

  private logSuffix(): string {
    try {
      const parsed = new URL(this.url);
      return parsed.port || parsed.hostname.replace(/[^A-Za-z0-9.-]+/g, '-');
    } catch {
      return 'ws';
    }
  }

  private writeEndpointState(source: string): void {
    try {
      fs.mkdirSync(this.logDir, { recursive: true });
      fs.writeFileSync(path.join(this.logDir, APP_SERVER_ENDPOINT_STATE), JSON.stringify({
        url: this.url,
        healthUrl: endpointHealthUrl(this.url),
        source,
        updatedAt: new Date().toISOString()
      }, null, 2), 'utf8');
    } catch {}
  }

  private readEndpointState(): string | null {
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(this.logDir, APP_SERVER_ENDPOINT_STATE), 'utf8'));
      if (typeof parsed.url === 'string' && /^wss?:\/\//i.test(parsed.url)) return parsed.url;
    } catch {}
    return null;
  }

  private async connectWithRetry(timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    let lastError: Error | null = null;
    while (Date.now() <= deadline) {
      try {
        await this.connectWebSocket(Math.min(1200, Math.max(250, deadline - Date.now())));
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        await sleep(250);
      }
    }
    throw new Error(`failed to connect app-server ${this.url}: ${lastError?.message || 'timeout'}`);
  }

  private connectWebSocket(timeoutMs: number): Promise<void> {
    const WebSocketCtor = (globalThis as any).WebSocket;
    if (!WebSocketCtor) throw new Error('Node.js WebSocket runtime is unavailable');

    return new Promise((resolve, reject) => {
      const socket = new WebSocketCtor(this.url);
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error) {
          try { socket.close(); } catch {}
          reject(error);
          return;
        }
        this.attachSocket(socket);
        resolve();
      };
      const timer = setTimeout(() => finish(new Error(`connect timeout after ${timeoutMs}ms`)), timeoutMs);
      socket.addEventListener('open', () => finish());
      socket.addEventListener('error', () => finish(new Error(`websocket error while connecting ${this.url}`)));
      socket.addEventListener('close', () => finish(new Error(`websocket closed while connecting ${this.url}`)));
    });
  }

  private attachSocket(socket: any): void {
    if (this.socket && this.socket !== socket) {
      try { this.socket.close(); } catch {}
    }
    this.buffer = '';
    this.socket = socket;
    socket.addEventListener('message', (event: any) => {
      this.handleSocketData(event.data).catch((error) => this.emit('stderr', `app-server message failed: ${error.message || error}`));
    });
    socket.addEventListener('error', () => {
      if (this.socket === socket) this.emit('error', new Error(`app-server websocket error: ${this.url}`));
    });
    socket.addEventListener('close', (event: any) => {
      if (this.socket !== socket) return;
      this.rejectAll(new Error(`app-server websocket closed: ${event?.code || 'unknown'}`));
      this.cleanupSocket();
      this.emit('exit', event?.code ?? null);
    });
  }

  public async request(method: string, params?: any, timeoutMs = 120000): Promise<any> {
    await this.ensureConnected();
    const id = this.nextId++;
    const message = { jsonrpc: '2.0', id, method, params };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`app-server request timed out: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { method, resolve, reject, timer });
      try {
        this.write(message);
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  public notify(method: string, params?: any): void {
    if (!this.isRunning()) return;
    this.write({ jsonrpc: '2.0', method, params });
  }

  public getServerRequests(): InboundServerRequest[] {
    return [...this.serverRequests.values()].map((request) => ({ ...request }));
  }

  public resolveServerRequest(requestId: string | number, result: any): boolean {
    const key = String(requestId);
    const request = this.serverRequests.get(key);
    if (!request) return false;
    this.write({ jsonrpc: '2.0', id: request.id, result });
    this.serverRequests.delete(key);
    return true;
  }

  public shutdown(): void {
    const socket = this.socket;
    this.rejectAll(new Error('app-server websocket disconnected'));
    this.cleanupSocket();
    try { socket?.close(); } catch {}
  }

  private async ensureConnected(): Promise<void> {
    if (!this.isRunning()) await this.start();
  }

  private write(message: any): void {
    if (!this.isRunning()) throw new Error(`app-server websocket is not connected: ${this.url}`);
    this.logRpc('send', message);
    this.socket.send(JSON.stringify(message));
  }

  private async handleSocketData(data: any): Promise<void> {
    let text = '';
    if (typeof data === 'string') text = data;
    else if (Buffer.isBuffer(data)) text = data.toString('utf8');
    else if (data instanceof ArrayBuffer) text = Buffer.from(data).toString('utf8');
    else if (typeof data?.text === 'function') text = await data.text();
    else text = String(data || '');
    this.handleWireText(text);
  }

  private handleWireText(chunk: string): void {
    const trimmed = chunk.trim();
    if (!trimmed) return;
    if (!trimmed.includes('\n')) {
      this.handleJsonLine(trimmed);
      return;
    }
    this.buffer += chunk;
    const lines = this.buffer.split(/\r?\n/);
    this.buffer = lines.pop() || '';
    for (const raw of lines) {
      const line = raw.trim();
      if (line) this.handleJsonLine(line);
    }
  }

  private handleJsonLine(line: string): void {
    let message: any;
    try { message = JSON.parse(line); } catch {
      this.emit('stderr', `app-server JSON parse failed: ${line}`);
      return;
    }
    this.logRpc('recv', message);
    this.handleMessage(message);
  }

  private handleMessage(message: any): void {
    if (message.id && this.pending.has(Number(message.id))) {
      const pending = this.pending.get(Number(message.id));
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(Number(message.id));
      if (message.error) {
        pending.reject(new Error(`${pending.method}: ${message.error.message || JSON.stringify(message.error)}`));
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    if (message.id && message.method) {
      this.handleServerRequest(message);
      return;
    }

    if (message.method) this.emit('notification', message);
  }

  private handleServerRequest(message: any): void {
    if (message.method === 'currentTime/read') {
      this.write({ jsonrpc: '2.0', id: message.id, result: { currentTimeAt: Math.floor(Date.now() / 1000) } });
      return;
    }
    if (message.method === 'item/tool/requestUserInput') {
      this.forwardServerRequest(message);
      return;
    }
    if (message.method === 'item/commandExecution/requestApproval') {
      this.write({ jsonrpc: '2.0', id: message.id, result: { decision: 'accept' } });
      return;
    }
    if (message.method === 'item/fileChange/requestApproval') {
      this.write({ jsonrpc: '2.0', id: message.id, result: { decision: 'accept' } });
      return;
    }
    if (message.method === 'applyPatchApproval') {
      this.write({ jsonrpc: '2.0', id: message.id, result: { decision: 'approved' } });
      return;
    }
    if (message.method === 'execCommandApproval') {
      this.write({ jsonrpc: '2.0', id: message.id, result: { decision: 'approved' } });
      return;
    }
    this.write({
      jsonrpc: '2.0',
      id: message.id,
      error: { code: -32601, message: `Unsupported server request: ${message.method}` }
    });
    this.emit('stderr', `Unsupported app-server request: ${message.method}`);
  }

  private forwardServerRequest(message: any): void {
    const request: InboundServerRequest = {
      id: message.id,
      method: String(message.method || ''),
      params: message.params || {}
    };
    this.serverRequests.set(String(message.id), request);
    this.emit('server_request', { requestId: String(message.id), rpcId: message.id, method: request.method, params: request.params });
  }

  private rejectAll(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  private logRpc(direction: 'send' | 'recv', message: any): void {
    try {
      this.rpcLog?.write(JSON.stringify({ ts: new Date().toISOString(), direction, message }) + '\n');
    } catch {}
  }

  private cleanupSocket(): void {
    this.socket = null;
    this.buffer = '';
    this.serverRequests.clear();
    this.rpcLog?.end();
    this.rpcLog = null;
  }
}
