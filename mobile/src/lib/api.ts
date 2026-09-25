import * as SecureStore from 'expo-secure-store';

const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://comarc.app.br').replace(/\/$/, '');
const ACCESS_KEY = 'brcondos_access_token';
const REFRESH_KEY = 'brcondos_refresh_token';

export type BrUser = {
  id: string;
  email: string;
  full_name: string;
  access_level: 'admin' | 'consulta' | string;
  first_access_required?: boolean;
};

type AuthConfig = {
  configured: boolean;
  supabaseUrl: string;
  publishableKey: string;
};

async function json<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error || (data as any)?.msg || 'Erro de comunicação.');
  return data as T;
}

async function authConfig(): Promise<AuthConfig> {
  return json<AuthConfig>(await fetch(`${API_URL}/api/auth/config`));
}

export async function login(email: string, password: string): Promise<BrUser> {
  const cfg = await authConfig();
  if (!cfg.configured || !cfg.supabaseUrl || !cfg.publishableKey) {
    throw new Error('Autenticação da BRCondos não está configurada.');
  }

  const tokenRes = await fetch(`${cfg.supabaseUrl.replace(/\/$/, '')}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: cfg.publishableKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });
  const token = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !token?.access_token) throw new Error('E-mail ou senha inválidos.');

  await SecureStore.setItemAsync(ACCESS_KEY, token.access_token);
  if (token.refresh_token) await SecureStore.setItemAsync(REFRESH_KEY, token.refresh_token);

  return getCurrentUser();
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
  if (!refreshToken) return null;
  const cfg = await authConfig();
  const res = await fetch(`${cfg.supabaseUrl.replace(/\/$/, '')}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: cfg.publishableKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access_token) return null;
  await SecureStore.setItemAsync(ACCESS_KEY, data.access_token);
  if (data.refresh_token) await SecureStore.setItemAsync(REFRESH_KEY, data.refresh_token);
  return data.access_token;
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  let token = await SecureStore.getItemAsync(ACCESS_KEY);
  const run = (access: string | null) => fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(access ? { Authorization: `Bearer ${access}` } : {}),
      ...(init.headers || {}),
    },
  });

  let res = await run(token);
  if (res.status === 401) {
    token = await refreshAccessToken();
    if (token) res = await run(token);
  }
  return res;
}

export async function getCurrentUser(): Promise<BrUser> {
  return json<BrUser>(await apiFetch('/api/auth/me'));
}

export async function getSharedState(): Promise<any> {
  return json<any>(await apiFetch('/api/state', { cache: 'no-store' }));
}

export async function logout() {
  try { await apiFetch('/api/auth/logout', { method: 'POST', body: '{}' }); } catch {}
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

export async function hasSession() {
  return Boolean(await SecureStore.getItemAsync(ACCESS_KEY));
}

export { API_URL };
