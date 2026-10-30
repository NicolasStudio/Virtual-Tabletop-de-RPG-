// Client HTTP mínimo com access token em memória e refresh automático via cookie.
// O refresh token NUNCA toca o JS (cookie httpOnly) — só o access fica em memória.
import type { PublicUser } from '@tabletop/shared';

// Vazio = mesma origem do app: em dev o Vite repassa /api para o servidor (vite.config.ts),
// o que permite publicar tudo num endereço só (ex.: túnel do Cloudflare).
const API = import.meta.env.VITE_API_URL ?? '';
export const API_BASE = API;

let accessToken: string | null = null;
export function setAccessToken(t: string | null) {
  accessToken = t;
}
export function getAccessToken() {
  return accessToken;
}

interface ApiError {
  status: number;
  message: string;
}

async function parse(res: Response) {
  const text = await res.text();
  const body = text ? JSON.parse(text) : null; // corpo vazio = null (não {} truthy)
  if (!res.ok) {
    const message = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
    throw { status: res.status, message: message ?? res.statusText } as ApiError;
  }
  return body;
}

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch(`${API}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
      .then(async (r) => {
        if (!r.ok) return false;
        const data = await r.json();
        accessToken = data.accessToken;
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

export async function api(path: string, init: RequestInit = {}, retry = true): Promise<any> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  const res = await fetch(`${API}/api${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (res.status === 401 && retry && path !== '/auth/refresh') {
    const ok = await tryRefresh();
    if (ok) return api(path, init, false);
  }
  return parse(res);
}

// Endpoints tipados de auth
export const authApi = {
  register: (email: string, displayName: string, password: string) =>
    api('/auth/register', { method: 'POST', body: JSON.stringify({ email, displayName, password }) }) as Promise<{
      accessToken: string;
      user: PublicUser;
    }>,
  login: (email: string, password: string) =>
    api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }) as Promise<{
      accessToken: string;
      user: PublicUser;
    }>,
  logout: () => api('/auth/logout', { method: 'POST' }),
  me: () => api('/auth/me') as Promise<PublicUser>,
  refresh: () =>
    api('/auth/refresh', { method: 'POST' }, false) as Promise<{ accessToken: string; user: PublicUser }>,
  forgot: (email: string) =>
    api('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }) as Promise<{
      devToken?: string;
    }>,
  reset: (token: string, password: string) =>
    api('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
};
