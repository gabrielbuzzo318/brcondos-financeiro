const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
const SUPABASE_KEY = String(process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();

function ensureConfigured() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    const err = new Error('Supabase não configurado para sincronização.');
    err.status = 503;
    throw err;
  }
}

async function readJson(res) {
  const text = await res.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

async function supabaseFetch(path, token, options = {}) {
  ensureConfigured();
  const headers = {
    apikey: SUPABASE_KEY,
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };
  return await fetch(`${SUPABASE_URL}${path}`, { ...options, headers });
}

function tokenFrom(req) {
  const token = String(req?.brAccessToken || '').trim();
  if (!token) {
    const err = new Error('Sessão não disponível para sincronização.');
    err.status = 401;
    throw err;
  }
  return token;
}

export async function getSharedState(req) {
  const token = tokenFrom(req);
  const res = await supabaseFetch('/rest/v1/app_state?select=state_key,data,updated_at,updated_by&state_key=eq.main&limit=1', token, {
    method: 'GET',
    headers: { Accept: 'application/json' }
  });
  const rows = await readJson(res);
  if (!res.ok) {
    const err = new Error(rows?.message || 'Não foi possível carregar a base compartilhada.');
    err.status = res.status;
    throw err;
  }
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return { ok: true, exists: false };
  return { ok: true, exists: true, ...row };
}

export async function putSharedState(req, body = {}) {
  const token = tokenFrom(req);
  const user = req?.appUser;
  if (!user?.id) {
    const err = new Error('Usuário não identificado para sincronização.');
    err.status = 401;
    throw err;
  }
  const data = body?.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    const err = new Error('Estado compartilhado inválido.');
    err.status = 400;
    throw err;
  }

  const res = await supabaseFetch('/rest/v1/app_state?on_conflict=state_key', token, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      state_key: 'main',
      data,
      updated_at: new Date().toISOString(),
      updated_by: user.id
    })
  });
  const rows = await readJson(res);
  if (!res.ok) {
    const err = new Error(rows?.message || 'Não foi possível salvar a base compartilhada.');
    err.status = res.status;
    throw err;
  }
  const row = Array.isArray(rows) ? rows[0] : rows;
  return { ok: true, exists: true, ...(row || {}) };
}
