export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: init?.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json', ...(init.headers || {}) } : init?.headers,
    ...init
  });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.error || JSON.stringify(payload);
    throw new Error(message || `${response.status} ${response.statusText}`);
  }
  return payload as T;
}

export function postJson<T>(url: string, body: unknown = {}): Promise<T> {
  return api<T>(url, { method: 'POST', body: JSON.stringify(body) });
}

export function putJson<T>(url: string, body: unknown = {}): Promise<T> {
  return api<T>(url, { method: 'PUT', body: JSON.stringify(body) });
}

export function deleteJson<T>(url: string, body: unknown = {}): Promise<T> {
  return api<T>(url, { method: 'DELETE', body: JSON.stringify(body) });
}
