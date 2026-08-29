import fs from 'node:fs';

const file=new URL('./server.js',import.meta.url);
let src=fs.readFileSync(file,'utf8');

if(!src.includes("from './billing-documents-zip.js'")){
  const anchor="import { gerarBoletoPdf } from './boleto-pdf.js';";
  if(!src.includes(anchor))throw new Error('PATCH ZIP FATURAMENTO: import de boleto não encontrado.');
  src=src.replace(anchor,anchor+"\nimport { sendBillingDocumentsZip } from './billing-documents-zip.js';");
}

if(!src.includes("app.post('/api/documents/zip'")){
  const anchor="app.use('/api/boletos', requireAuth);";
  if(!src.includes(anchor))throw new Error('PATCH ZIP FATURAMENTO: ponto de autenticação não encontrado.');
  src=src.replace(anchor,anchor+"\napp.use('/api/documents', requireAuth);");

  const route=[
    "app.post('/api/documents/zip', async (req,res)=>{",
    "  try{",
    "    await sendBillingDocumentsZip(req,res,req.body||{});",
    "  }catch(err){",
    "    if(!res.headersSent)res.status(Number(err?.status||500)).json({error:err?.message||'Erro ao gerar ZIP dos documentos.'});",
    "  }",
    "});"
  ].join('\n');
  const routeAnchor="app.get('/api/boletos/health'";
  if(!src.includes(routeAnchor))throw new Error('PATCH ZIP FATURAMENTO: rota de boletos não encontrada.');
  src=src.replace(routeAnchor,route+'\n\n'+routeAnchor);
}

fs.writeFileSync(file,src,'utf8');
console.log('ZIP FATURAMENTO PATCH: boletos e NFS-e em lote ativados.');
