import fs from 'node:fs';

const file=new URL('./server.js',import.meta.url);
let src=fs.readFileSync(file,'utf8');

if(!src.includes("from './payable-attachments.js'")){
  const anchor="import { gerarBoletoPdf } from './boleto-pdf.js';";
  if(!src.includes(anchor))throw new Error('PATCH ANEXOS: import anchor não encontrado.');
  src=src.replace(anchor,anchor+"\nimport { createPayableAttachment, getPayableAttachment } from './payable-attachments.js';");
}

if(!src.includes("app.post('/api/payables/attachments'")){
  const anchor="app.use('/api/boletos', requireAuth);";
  if(!src.includes(anchor))throw new Error('PATCH ANEXOS: auth anchor não encontrado.');
  const routes=[
    "app.use('/api/payables', requireAuth);",
    "app.post('/api/payables/attachments', requireWriteAccess, route(req => createPayableAttachment(req, req.body||{})));",
    "app.get('/api/payables/attachments/:id', async (req,res)=>{",
    "  try{",
    "    const attachment=await getPayableAttachment(req,req.params.id);",
    "    const safeName=String(attachment.fileName||'anexo').replace(/[\\\"\\r\\n]/g,'_');",
    "    res.set({",
    "      'Content-Type':attachment.contentType||'application/octet-stream',",
    "      'Content-Disposition':'attachment; filename=\"'+safeName+'\"',",
    "      'Content-Length':String(attachment.buffer.length),",
    "      'Cache-Control':'private, no-store'",
    "    });",
    "    res.send(attachment.buffer);",
    "  }catch(err){",
    "    res.status(Number(err?.status||500)).json({error:err?.message||'Erro ao abrir anexo.'});",
    "  }",
    "});"
  ].join('\n');
  src=src.replace(anchor,anchor+'\n'+routes);
}

fs.writeFileSync(file,src,'utf8');
console.log('ANEXOS PATCH: rotas de anexos de contas a pagar ativadas.');
