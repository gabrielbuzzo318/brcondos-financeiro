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

function num(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}

function sameNumber(a, b) {
  return Math.abs(num(a) - num(b)) < 0.005;
}

function norm(v) {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseArrayValue(storage, key) {
  const raw = storage?.[key];
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function hash32(value) {
  const s = String(value ?? '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function deterministicId(seed, used, base) {
  let id = base + hash32(seed);
  while (used.has(String(id))) id++;
  used.add(String(id));
  return id;
}

function payableTotal(p) {
  const base = num(p?.value);
  const fine = Math.max(0, num(p?.paymentFine));
  const interest = Math.max(0, num(p?.paymentInterest));
  return { base, fine, interest, total: base + fine + interest };
}

function transactionMatchesPayable(t, p) {
  if (!t || !p) return false;
  const { total } = payableTotal(p);
  const pDate = String(p.paymentDate || p.paidDate || p.due || '');
  const tDate = String(t.date || '');
  if (norm(t.party) !== norm(p.supplier)) return false;
  if (pDate && tDate && pDate !== tDate) return false;
  if (!sameNumber(t.value, total)) return false;
  return true;
}

// Protege A Pagar x Fluxo no próprio servidor. Isso evita que uma aba antiga
// regrave IDs duplicados ou associe a baixa de uma conta ao fluxo de outra.
function repairFinancialState(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
  const storage = data.storage;
  if (!storage || typeof storage !== 'object' || Array.isArray(storage)) return data;

  const payables = parseArrayValue(storage, 'brcondos_payables');
  const transactions = parseArrayValue(storage, 'brcondos_transactions');
  if (!payables || !transactions) return data;

  let changed = false;
  const usedPayableIds = new Set();

  // Mantém a primeira ocorrência de um ID e gera um ID estável para duplicadas.
  payables.forEach((p, index) => {
    if (!p || typeof p !== 'object') return;
    const current = String(p.id ?? '');
    if (current && !usedPayableIds.has(current)) {
      usedPayableIds.add(current);
      return;
    }
    const seed = `payable:${p.sourceKey || ''}:${p.supplier || ''}:${p.description || ''}:${p.due || ''}:${p.value || ''}:${index}`;
    p.id = deterministicId(seed, usedPayableIds, 3000000000000);
    changed = true;
  });

  const usedTransactionIds = new Set(transactions.map(t => String(t?.id ?? '')).filter(Boolean));
  const claimed = new Set();

  payables.forEach((p, index) => {
    if (!p || String(p.status || '').toLowerCase() !== 'pago') return;

    const pid = String(p.id || '');
    const { base, fine, interest, total } = payableTotal(p);
    let t = null;

    if (p.flowId !== undefined && p.flowId !== null && String(p.flowId) !== '') {
      const byFlow = transactions.find(x => String(x?.id || '') === String(p.flowId));
      if (byFlow && transactionMatchesPayable(byFlow, p) && !claimed.has(String(byFlow.id))) t = byFlow;
    }

    if (!t) {
      t = transactions.find(x =>
        String(x?.sourcePayableId ?? x?.payableId ?? '') === pid &&
        transactionMatchesPayable(x, p) &&
        !claimed.has(String(x?.id || ''))
      ) || null;
    }

    // Recupera lançamentos antigos que existem no fluxo mas perderam o vínculo.
    if (!t) {
      t = transactions.find(x =>
        transactionMatchesPayable(x, p) &&
        !claimed.has(String(x?.id || ''))
      ) || null;
    }

    // Conta paga obrigatoriamente precisa existir no Fluxo de Caixa.
    if (!t) {
      const txSeed = `flow:${p.sourceKey || pid}:${p.paymentDate || p.paidDate || p.due || ''}:${p.supplier || ''}:${p.description || ''}:${total}:${index}`;
      t = {
        id: deterministicId(txSeed, usedTransactionIds, 4000000000000),
        type: 'saida',
        date: p.paymentDate || p.paidDate || p.due || '',
        description: p.description || 'Conta a pagar',
        category: p.category || 'Contas a pagar',
        party: p.supplier || '',
        value: total,
        baseValue: base,
        fine,
        interest,
        status: 'pago',
        sourceType: 'payable',
        sourcePayableId: p.id
      };
      transactions.push(t);
      changed = true;
    }

    claimed.add(String(t.id));

    const desired = {
      type: 'saida',
      date: p.paymentDate || p.paidDate || t.date || p.due || '',
      description: p.description || t.description || 'Conta a pagar',
      category: p.category || t.category || 'Contas a pagar',
      party: p.supplier || t.party || '',
      value: total,
      baseValue: base,
      fine,
      interest,
      status: 'pago',
      sourceType: 'payable',
      sourcePayableId: p.id
    };

    for (const k of ['type', 'date', 'description', 'category', 'party', 'status', 'sourceType']) {
      if (String(t[k] ?? '') !== String(desired[k] ?? '')) {
        t[k] = desired[k];
        changed = true;
      }
    }
    for (const k of ['value', 'baseValue', 'fine', 'interest']) {
      if (!sameNumber(t[k], desired[k])) {
        t[k] = desired[k];
        changed = true;
      }
    }
    if (String(t.sourcePayableId ?? '') !== String(p.id)) {
      t.sourcePayableId = p.id;
      changed = true;
    }
    if (String(p.flowId ?? '') !== String(t.id)) {
      p.flowId = t.id;
      changed = true;
    }
    if (!sameNumber(p.paidTotal, total)) {
      p.paidTotal = total;
      changed = true;
    }
  });

  if (changed) {
    storage.brcondos_payables = JSON.stringify(payables);
    storage.brcondos_transactions = JSON.stringify(transactions);
  }
  return data;
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

  repairFinancialState(data);

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
