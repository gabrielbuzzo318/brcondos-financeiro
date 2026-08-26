import crypto from 'node:crypto';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildGissPreview,
  consultarLoteRpsGiss,
  consultarNfsePorNumeroGiss,
  consultarNfsePorRpsGiss,
  emitirNfseGiss,
  getGissConfigStatus,
  testGissWsdl
} from './giss.js';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);

app.disable('x-powered-by');
app.use(express.json({ limit: '4mb' }));

// Proteção real no servidor. A tela interna do HTML é mantida sem alteração.
const APP_USER = String(process.env.APP_USER || '').trim();
const APP_PASSWORD = String(process.env.APP_PASSWORD || '').trim();
function safeEqual(a, b) {
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}
function basicAuth(req, res, next) {
  if (!APP_USER || !APP_PASSWORD || req.path === '/health') return next();
  const auth = String(req.headers.authorization || '');
  if (auth.startsWith('Basic ')) {
    try {
      const [user, ...rest] = Buffer.from(auth.slice(6), 'base64').toString('utf8').split(':');
      const pass = rest.join(':');
      if (safeEqual(user, APP_USER) && safeEqual(pass, APP_PASSWORD)) return next();
    } catch {}
  }
  res.set('WWW-Authenticate', 'Basic realm="BRCONDOS Financeiro"');
  return res.status(401).send('Autenticação necessária.');
}
app.use(basicAuth);

const route = fn => async (req, res) => {
  try {
    const data = await fn(req, res);
    if (!res.headersSent) res.json(data);
  } catch (err) {
    const status = Number(err?.status || 500);
    res.status(status).json({
      error: err?.message || 'Erro interno.',
      details: err?.details ?? null
    });
  }
};

app.get('/health', (_req, res) => res.json({ ok: true, service: 'brcondos-financeiro' }));
app.get('/api/nfse/health', route(() => getGissConfigStatus()));
app.get('/api/nfse/wsdl-test', route(() => testGissWsdl()));
app.post('/api/nfse/preview', route(req => buildGissPreview(req.body, { sign: String(req.query.assinar || '') === '1' })));
app.post('/api/nfse/emitir', route(req => emitirNfseGiss(req.body)));
app.get('/api/nfse/consultar-lote', route(req => consultarLoteRpsGiss(req.query.protocolo)));
app.get('/api/nfse/consultar-numero', route(req => consultarNfsePorNumeroGiss({ numero: req.query.numero, pagina: req.query.pagina })));
app.get('/api/nfse/consultar-rps', route(req => consultarNfsePorRpsGiss({ numero: req.query.numero, serie: req.query.serie, tipo: req.query.tipo })));

// O front já possui os botões Sicredi. Sem credenciais configuradas no servidor,
// devolvemos um erro explícito em vez de expor qualquer segredo no navegador.
app.post('/api/boletos', (_req, res) => res.status(503).json({ error: 'Integração Sicredi ainda não configurada neste servidor.' }));
app.get('/api/boletos/:nossoNumero', (_req, res) => res.status(503).json({ error: 'Integração Sicredi ainda não configurada neste servidor.' }));

app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html' }));
app.get(/.*/, (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`BRCONDOS online na porta ${PORT}`);

  if (String(process.env.GISS_STARTUP_TEST || '') === '1') {
    const status = getGissConfigStatus();
    console.log(`GISS config: ${status.configured ? 'OK' : 'INCOMPLETA'}`);

    const splitB64 = [1,2,3,4]
      .map(i => String(process.env[`GISS_CERT_PFX_BASE64_${i}`] || '').trim())
      .filter(Boolean)
      .join('');
    const certB64 = splitB64 || String(process.env.GISS_CERT_PFX_BASE64 || '').trim();
    if (certB64) {
      const certBytes = Buffer.from(certB64, 'base64');
      const certHash = crypto.createHash('sha256').update(certBytes).digest('hex').slice(0, 16);
      console.log(`GISS cert: ${certBytes.length} bytes, sha256=${certHash}`);
    }

    if (status.configured) {
      try {
        const result = await testGissWsdl();
        console.log(`GISS WSDL: OK (${(result.metodos || []).length} método(s) detectado(s))`);
      } catch (err) {
        const detail = err?.details ? ` | ${String(err.details).slice(0, 300)}` : '';
        console.error(`GISS WSDL: FALHOU - ${err?.message || 'erro desconhecido'}${detail}`);
      }
    }
  }
});
