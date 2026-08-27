import crypto from 'node:crypto';
import fs from 'node:fs';
import https from 'node:https';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import {
  buildGissPreview,
  consultarLoteRpsGiss,
  consultarNfsePorNumeroGiss,
  consultarNfsePorRpsGiss,
  consultarNfsePorRpsEndpointGiss,
  emitirNfseGiss,
  getGissConfigStatus,
  testGissWsdl
} from './giss.js';
import {
  consultarBoletoSicredi,
  getSicrediConfigStatus,
  registrarBoletoSicredi,
  testSicredi
} from './sicredi.js';
import { gerarBoletoPdf } from './boleto-pdf.js';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const GISS_HISTORY_SERVICE_URL = 'https://ws-sjrp.giss.com.br/service-ws/nf/nfse-ws';

app.disable('x-powered-by');
app.use(express.json({ limit: '4mb' }));

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
    res.status(status).json({ error: err?.message || 'Erro interno.', details: err?.details ?? null });
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
app.get('/api/nfse/consultar-rps-historico', route(req => consultarNfsePorRpsEndpointGiss({
  numero: req.query.numero,
  serie: req.query.serie || 'RPS',
  tipo: req.query.tipo || 1,
  serviceUrl: GISS_HISTORY_SERVICE_URL
})));

app.get('/api/boletos/health', route(() => getSicrediConfigStatus()));
app.get('/api/boletos/test', route(() => testSicredi()));
app.post('/api/boletos', route(req => registrarBoletoSicredi(req.body)));
app.post('/api/boletos/pdf', async (req, res) => {
  try {
    const pdf = await gerarBoletoPdf(req.body || {});
    const nossoNumero = String(req.body?.nossoNumero || '').replace(/\D/g, '') || 'sicredi';
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="boleto-sicredi-${nossoNumero}.pdf"`,
      'Content-Length': String(pdf.length),
      'Cache-Control': 'no-store'
    });
    res.send(pdf);
  } catch (err) {
    const status = Number(err?.status || 500);
    res.status(status).json({ error: err?.message || 'Erro ao gerar PDF do boleto.', details: err?.details ?? null });
  }
});
app.get('/api/boletos/:nossoNumero', route(req => consultarBoletoSicredi(req.params.nossoNumero)));

app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html' }));
app.get(/.*/, (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

async function rawWsdlDiagnostic() {
  const pfx = fs.readFileSync(config.giss.certPfxPath);
  const url = new URL(config.giss.wsdlUrl);
  return await new Promise((resolve, reject) => {
    const req = https.request({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || 443,
      path: `${url.pathname}${url.search}`,
      method: 'GET',
      pfx,
      passphrase: config.giss.certPassword,
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true,
      headers: { 'User-Agent': 'BRCONDOS-Financeiro/1.0' }
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({
          status: res.statusCode || 0,
          contentType: String(res.headers['content-type'] || ''),
          preview: text.slice(0, 500).replace(/\s+/g, ' ')
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`BRCONDOS online na porta ${PORT}`);

  if (String(process.env.GISS_STARTUP_TEST || '') === '1') {
    const status = getGissConfigStatus();
    console.log(`GISS config: ${status.configured ? 'OK' : 'INCOMPLETA'}`);

    if (status.configured) {
      try {
        const raw = await rawWsdlDiagnostic();
        console.log(`GISS RAW WSDL: HTTP ${raw.status} | ${raw.contentType} | ${raw.preview}`);
      } catch (err) {
        console.error(`GISS RAW WSDL: FALHOU - ${err?.message || 'erro desconhecido'}`);
      }

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
