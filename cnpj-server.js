function cleanCnpj(v) {
  return String(v || '').replace(/[^0-9A-Z]/gi, '').toUpperCase();
}

async function fetchJson(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'BRCONDOS-Financeiro/1.0'
      },
      signal: controller.signal
    });
    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    if (!res.ok) {
      const err = new Error(data?.message || data?.error || data?.status || `HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeReceitaWs(data = {}) {
  const principal = Array.isArray(data.atividade_principal) ? data.atividade_principal[0] : null;
  return {
    razao_social: data.nome || '',
    nome_fantasia: data.fantasia || '',
    descricao_situacao_cadastral: data.situacao || '',
    situacao_cadastral: data.situacao || '',
    email: data.email || '',
    ddd_telefone_1: data.telefone || '',
    cep: data.cep || '',
    descricao_tipo_de_logradouro: '',
    logradouro: data.logradouro || '',
    numero: data.numero || '',
    complemento: data.complemento || '',
    bairro: data.bairro || '',
    municipio: data.municipio || '',
    uf: data.uf || '',
    cnae_fiscal: principal?.code || '',
    cnae_fiscal_descricao: principal?.text || '',
    _fonte: 'receitaws'
  };
}

export async function consultarCnpjPublico(rawCnpj) {
  const cnpj = cleanCnpj(rawCnpj);
  if (!/^[0-9A-Z]{14}$/.test(cnpj)) {
    const err = new Error('CNPJ inválido. Informe 14 caracteres.');
    err.status = 400;
    throw err;
  }

  const tentativas = [
    async () => ({ ...(await fetchJson(`https://brasilapi.com.br/api/cnpj/v1/${encodeURIComponent(cnpj)}`)), _fonte: 'brasilapi' }),
    async () => ({ ...(await fetchJson(`https://brasilapi.com.br/cnpj/v1/${encodeURIComponent(cnpj)}`)), _fonte: 'brasilapi' })
  ];

  // ReceitaWS ainda trabalha com CNPJ numérico; usamos como fallback quando aplicável.
  if (/^\d{14}$/.test(cnpj)) {
    tentativas.push(async () => normalizeReceitaWs(await fetchJson(`https://www.receitaws.com.br/v1/cnpj/${cnpj}`, 18000)));
  }

  const erros = [];
  for (const tentar of tentativas) {
    try {
      const data = await tentar();
      if (data && (data.razao_social || data.nome_fantasia || data.municipio || data.logradouro)) return data;
      erros.push('Resposta sem dados cadastrais.');
    } catch (err) {
      erros.push(err?.message || 'Falha na consulta.');
    }
  }

  const err = new Error('Não foi possível consultar este CNPJ nas fontes disponíveis.');
  err.status = 502;
  err.details = erros;
  throw err;
}
