import fs from 'node:fs';

const file=new URL('./server.js',import.meta.url);
let src=fs.readFileSync(file,'utf8');

if(!src.includes("from './dre-pdf.js'")){
  const anchor="import { gerarBoletoPdf } from './boleto-pdf.js';";
  if(!src.includes(anchor))throw new Error('PATCH DRE PDF: import anchor não encontrado.');
  src=src.replace(anchor,`${anchor}\nimport { gerarDrePdf } from './dre-pdf.js';`);
}

if(!src.includes("app.post('/api/dre/pdf'")){
  const anchor="app.get('/api/boletos/:nossoNumero', route(req => consultarBoletoSicredi(req.params.nossoNumero)));";
  if(!src.includes(anchor))throw new Error('PATCH DRE PDF: route anchor não encontrado.');
  const routeCode=`\n\napp.post('/api/dre/pdf', requireAuth, async (req, res) => {\n  try {\n    const pdf = await gerarDrePdf(req.body || {});\n    const period = String(req.body?.period || 'periodo').replace(/[^0-9-]/g, '') || 'periodo';\n    res.set({\n      'Content-Type': 'application/pdf',\n      'Content-Disposition': \`inline; filename="DRE-BRCONDOS-\${period}.pdf"\`,\n      'Content-Length': String(pdf.length),\n      'Cache-Control': 'no-store'\n    });\n    res.send(pdf);\n  } catch (err) {\n    const status = Number(err?.status || 500);\n    res.status(status).json({ error: err?.message || 'Erro ao gerar PDF da DRE.', details: err?.details ?? null });\n  }\n});`;
  src=src.replace(anchor,`${anchor}${routeCode}`);
}

fs.writeFileSync(file,src,'utf8');
console.log('DRE PDF PATCH: rota /api/dre/pdf ativada.');
