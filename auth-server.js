import crypto from 'node:crypto';

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
const SUPABASE_KEY = String(process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();
const APP_PUBLIC_URL = String(process.env.APP_PUBLIC_URL || '').trim().replace(/\/$/, '');
const AUTH_ENFORCED = Boolean(APP_PUBLIC_URL);
const SETUP_USER = Object.freeze({
  id: 'setup',
  email: 'configuracao@local',
  full_name: 'Configuração',
  access_level: 'admin',
  first_access_required: false,
  setup_mode: true
});

const ALLOWED_USERS = new Map([
  ['esterzsilva@hotmail.com', { full_name: 'Ester Zacchi', access_level: 'admin' }],
  ['bpobrcondos@gmail.com', { full_name: 'Bia Martines', access_level: 'admin' }],
  ['antonio@zacchi.com.br', { full_name: 'Antonio Zacchi', access_level: 'consulta' }],
  ['marco.dosualdo@brcondos.com', { full_name: 'Marco Dosualdo', access_level: 'consulta' }],
  ['contabil01@logucomarc.com.br', { full_name: 'Contabilidade', access_level: 'consulta' }]
]);

const profileCache = new Map();
const requestCooldown = new Map();

function ensureConfigured() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    const err = new Error('Autenticação do sistema ainda não está configurada.');
    err.status = 503;
    throw err;
  }
}

async function readJson(res) {
  const text = await res.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

async function supabaseFetch(path, options = {}) {
  ensureConfigured();
  const headers = {
    apikey: SUPABASE_KEY,
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  return await fetch(`${SUPABASE_URL}${path}`, { ...options, headers });
}

function parseCookies(req) {
  const out = {};
  const raw = String(req.headers.cookie || '');
  raw.split(';').forEach(part => {
    const idx = part.indexOf('=');
    if (idx < 0) return;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) return;
    try { out[key] = decodeURIComponent(value); } catch { out[key] = value; }
  });
  return out;
}

function bearer(req) {
  const auth = String(req.headers.authorization || '');
  if (!auth.startsWith('Bearer ')) return '';
  return auth.slice(7).trim();
}

function requestAccessToken(req) {
  return bearer(req) || parseCookies(req).br_access || '';
}
function requestRefreshToken(req) {
  return parseCookies(req).br_refresh || '';
}

function cookieBase() {
  return { httpOnly: true, secure: true, sameSite: 'lax', path: '/' };
}
function setAuthCookies(res, data = {}) {
  if (data.access_token) res.cookie('br_access', data.access_token, { ...cookieBase(), maxAge: Math.max(300, Number(data.expires_in || 3600) - 30) * 1000 });
  if (data.refresh_token) res.cookie('br_refresh', data.refresh_token, { ...cookieBase(), maxAge: 30 * 24 * 60 * 60 * 1000 });
}
function clearAuthCookies(res) {
  res.clearCookie('br_access', cookieBase());
  res.clearCookie('br_refresh', cookieBase());
}

async function resolveUser(accessToken) {
  ensureConfigured();
  if (!accessToken) {
    const err = new Error('Sessão não informada.');
    err.status = 401;
    throw err;
  }

  const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');
  const cached = profileCache.get(tokenHash);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const userRes = await supabaseFetch('/auth/v1/user', {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const user = await readJson(userRes);
  if (!userRes.ok || !user?.email) {
    const err = new Error('Sessão inválida ou expirada.');
    err.status = 401;
    throw err;
  }

  const email = String(user.email).trim().toLowerCase();
  const profileRes = await supabaseFetch(`/rest/v1/app_users?select=full_name,email,access_level,active,first_access_required&email=eq.${encodeURIComponent(email)}&limit=1`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const profiles = await readJson(profileRes);
  const profile = Array.isArray(profiles) ? profiles[0] : null;
  if (!profileRes.ok || !profile || profile.active !== true) {
    const err = new Error('Usuário sem permissão para acessar o BRCONDOS Financeiro.');
    err.status = 403;
    throw err;
  }

  const value = {
    id: user.id,
    email,
    full_name: profile.full_name,
    access_level: profile.access_level,
    first_access_required: profile.first_access_required === true
  };
  profileCache.set(tokenHash, { value, expiresAt: Date.now() + 30_000 });
  return value;
}

async function refreshSession(refreshToken) {
  if (!refreshToken) return null;
  const res = await supabaseFetch('/auth/v1/token?grant_type=refresh_token', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken })
  });
  const data = await readJson(res);
  if (!res.ok || !data?.access_token) return null;
  return data;
}

async function resolveRequestUser(req, res) {
  let accessToken = requestAccessToken(req);
  try {
    const user = await resolveUser(accessToken);
    req.brAccessToken = accessToken;
    return user;
  } catch (err) {
    if (Number(err?.status) !== 401) throw err;
    const refreshed = await refreshSession(requestRefreshToken(req));
    if (!refreshed?.access_token) throw err;
    setAuthCookies(res, refreshed);
    accessToken = refreshed.access_token;
    const user = await resolveUser(accessToken);
    req.brAccessToken = accessToken;
    return user;
  }
}

export function authConfig() {
  return {
    configured: Boolean(SUPABASE_URL && SUPABASE_KEY),
    supabaseUrl: SUPABASE_URL,
    publishableKey: SUPABASE_KEY,
    publicUrlConfigured: AUTH_ENFORCED,
    setupMode: !AUTH_ENFORCED
  };
}

export async function loginWithPassword(body = {}, res) {
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!email || !password) {
    const err = new Error('Informe e-mail e senha.');
    err.status = 400;
    throw err;
  }
  checkAllowed(email);
  const tokenRes = await supabaseFetch('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  const data = await readJson(tokenRes);
  if (!tokenRes.ok || !data?.access_token) {
    const err = new Error('E-mail ou senha inválidos.');
    err.status = 401;
    throw err;
  }
  const user = await resolveUser(data.access_token);
  setAuthCookies(res, data);
  return { ok: true, user };
}

export async function adoptSession(body = {}, res) {
  const accessToken = String(body.access_token || '').trim();
  const refreshToken = String(body.refresh_token || '').trim();
  const user = await resolveUser(accessToken);
  setAuthCookies(res, { access_token: accessToken, refresh_token: refreshToken, expires_in: Number(body.expires_in || 3600) });
  return { ok: true, user };
}

export async function logoutSession(req, res) {
  const token = requestAccessToken(req);
  if (token) {
    try {
      await supabaseFetch('/auth/v1/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: '{}' });
    } catch {}
  }
  clearAuthCookies(res);
  return { ok: true };
}

export async function requireAuth(req, res, next) {
  if (!AUTH_ENFORCED) {
    req.appUser = SETUP_USER;
    return next();
  }
  try {
    req.appUser = await resolveRequestUser(req, res);
    next();
  } catch (err) {
    clearAuthCookies(res);
    res.status(Number(err?.status || 401)).json({ error: err?.message || 'Autenticação necessária.' });
  }
}

export async function requirePageAuth(req, res, next) {
  if (!AUTH_ENFORCED) {
    req.appUser = SETUP_USER;
    return next();
  }
  try {
    req.appUser = await resolveRequestUser(req, res);
    next();
  } catch {
    clearAuthCookies(res);
    res.status(401).sendFile('login.html', { root: process.cwd() + '/public' });
  }
}

export function requireWriteAccess(req, res, next) {
  if (req.appUser?.access_level !== 'admin') {
    return res.status(403).json({ error: 'Acesso somente para consulta. Esta operação não é permitida.' });
  }
  next();
}

export async function getCurrentUser(req, res) {
  if (req.appUser) return req.appUser;
  if (!AUTH_ENFORCED) return SETUP_USER;
  return await resolveRequestUser(req, res);
}

function normalizeEmail(v) {
  return String(v || '').trim().toLowerCase();
}

function checkAllowed(email) {
  const profile = ALLOWED_USERS.get(email);
  if (!profile) {
    const err = new Error('E-mail não autorizado para este sistema.');
    err.status = 403;
    throw err;
  }
  return profile;
}

function checkCooldown(email, kind) {
  const key = `${kind}:${email}`;
  const last = requestCooldown.get(key) || 0;
  if (Date.now() - last < 120_000) {
    const err = new Error('Aguarde alguns minutos antes de solicitar outro e-mail.');
    err.status = 429;
    throw err;
  }
  requestCooldown.set(key, Date.now());
}

function redirectUrl() {
  if (!APP_PUBLIC_URL) {
    const err = new Error('Primeiro acesso será liberado assim que o domínio definitivo estiver conectado.');
    err.status = 503;
    throw err;
  }
  return `${APP_PUBLIC_URL}/?auth=callback`;
}

async function sendRecovery(email) {
  const res = await supabaseFetch(`/auth/v1/recover?redirect_to=${encodeURIComponent(redirectUrl())}`, {
    method: 'POST',
    body: JSON.stringify({ email })
  });
  const data = await readJson(res);
  if (!res.ok) {
    const err = new Error(data?.msg || data?.message || data?.error_description || 'Não foi possível enviar o e-mail de recuperação.');
    err.status = res.status;
    throw err;
  }
  return true;
}

export async function requestPasswordRecovery(body = {}) {
  const email = normalizeEmail(body.email);
  checkAllowed(email);
  checkCooldown(email, 'recovery');
  await sendRecovery(email);
  return { ok: true, message: 'Se o e-mail estiver cadastrado, você receberá as instruções para criar uma nova senha.' };
}

export async function requestFirstAccess(body = {}) {
  const email = normalizeEmail(body.email);
  const profile = checkAllowed(email);
  checkCooldown(email, 'first-access');
  const redirect = redirectUrl();

  const tempPassword = `${crypto.randomBytes(24).toString('base64url')}Aa1!`;
  const signupRes = await supabaseFetch(`/auth/v1/signup?redirect_to=${encodeURIComponent(redirect)}`, {
    method: 'POST',
    body: JSON.stringify({ email, password: tempPassword, data: { full_name: profile.full_name } })
  });
  const signupData = await readJson(signupRes);

  const identities = Array.isArray(signupData?.user?.identities) ? signupData.user.identities : [];
  const newlyCreatedAndAwaitingConfirmation = signupRes.ok && signupData?.user && identities.length > 0 && !signupData?.session;

  if (!newlyCreatedAndAwaitingConfirmation) await sendRecovery(email);
  return { ok: true, message: 'Enviamos as instruções de primeiro acesso para o e-mail informado.' };
}

export async function markFirstAccessDone(req, res) {
  if (!AUTH_ENFORCED) return { ok: true, setupMode: true };
  const user = await getCurrentUser(req, res);
  const token = req.brAccessToken || requestAccessToken(req);
  const patchRes = await supabaseFetch(`/rest/v1/app_users?email=eq.${encodeURIComponent(user.email)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, Prefer: 'return=minimal' },
    body: JSON.stringify({ first_access_required: false })
  });
  if (!patchRes.ok) {
    const data = await readJson(patchRes);
    const err = new Error(data?.message || 'Não foi possível concluir o primeiro acesso.');
    err.status = patchRes.status;
    throw err;
  }
  return { ok: true };
}
