import fs from 'node:fs';

const file = new URL('./server.js', import.meta.url);
let src = fs.readFileSync(file, 'utf8');

const jsonLine = "app.use(express.json({ limit: '4mb' }));";
if (!src.includes("app.set('etag', false);")) {
  if (!src.includes(jsonLine)) throw new Error('PATCH HISTORY: ponto do Express não encontrado.');
  src = src.replace(
    jsonLine,
    `${jsonLine}\napp.set('etag', false);\napp.use('/api', (_req, res, next) => {\n  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');\n  res.set('Pragma', 'no-cache');\n  res.set('Expires', '0');\n  next();\n});`
  );
}

const authImport = "} from './auth-server.js';";
if (!src.includes("from './state-server.js';")) {
  if (!src.includes(authImport)) throw new Error('PATCH STATE: import de auth não encontrado.');
  src = src.replace(authImport, `${authImport}\nimport { getSharedState, putSharedState } from './state-server.js';`);
}

const authRoute = "app.post('/api/auth/first-access-complete', requireAuth, route((req, res) => markFirstAccessDone(req, res)));";
if (!src.includes("app.use('/api/state', requireAuth);")) {
  if (!src.includes(authRoute)) throw new Error('PATCH STATE: rota de autenticação não encontrada.');
  src = src.replace(authRoute, `${authRoute}\n\n// Estado central compartilhado por todos os logins.\napp.use('/api/state', requireAuth);\napp.get('/api/state', route(req => getSharedState(req)));\napp.put('/api/state', requireWriteAccess, route(req => putSharedState(req, req.body)));`);
}

const oldRoute = `app.get('/api/nfse/consultar-rps-historico', route(req => consultarNfsePorRpsEndpointGiss({
  numero: req.query.numero,
  serie: req.query.serie || 'RPS',
  tipo: req.query.tipo || 1,
  serviceUrl: GISS_HISTORY_SERVICE_URL
})));`;

const newRoute = `async function consultarHistoricoComRetry({numero, serie='RPS', tipo=1}) {
  const maxTentativas = 4;
  let ultimo = null;
  let ultimoErro = null;

  for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
    try {
      const data = await consultarNfsePorRpsEndpointGiss({
        numero,
        serie,
        tipo,
        serviceUrl: GISS_HISTORY_SERVICE_URL
      });

      const encontrou = Array.isArray(data?.nfse) && data.nfse.some(x => String(x?.numero || '').trim());
      const erros = Array.isArray(data?.erros) ? data.erros : [];
      const somenteE89 = !encontrou && erros.length > 0 && erros.every(e => /\\bE89\\b/i.test(\`${'${e?.codigo || \'\'} ${e?.mensagem || \'\'}'}\`));

      ultimo = { ...data, historicoTentativas: tentativa };
      if (encontrou || !somenteE89) return ultimo;
    } catch (err) {
      ultimoErro = err;
      if (tentativa === maxTentativas) throw err;
    }

    if (tentativa < maxTentativas) {
      await new Promise(resolve => setTimeout(resolve, 350 * tentativa));
    }
  }

  if (ultimo) return { ...ultimo, historicoE89Confirmado: true };
  throw ultimoErro || new Error('Falha ao consultar histórico GISS.');
}

app.get('/api/nfse/consultar-rps-historico', route(req => consultarHistoricoComRetry({
  numero: req.query.numero,
  serie: req.query.serie || 'RPS',
  tipo: req.query.tipo || 1
})));`;

if (src.includes(oldRoute)) {
  src = src.replace(oldRoute, newRoute);
} else if (!src.includes('async function consultarHistoricoComRetry(')) {
  throw new Error('PATCH HISTORY: rota histórica esperada não encontrada.');
}

fs.writeFileSync(file, src, 'utf8');
console.log('GISS HISTORY PATCH: sem cache + retry de E89 + estado compartilhado ativado.');
