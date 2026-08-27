import fs from 'node:fs';

const file=new URL('./server.js',import.meta.url);
let src=fs.readFileSync(file,'utf8');

if(!src.includes("from './payable-attachments.js'")){
  const anchor="import { gerarBoletoPdf } from './boleto-pdf.js';";
  if(!src.includes(anchor))throw new Error('PATCH ANEXOS: import anchor não encontrado.');
  src=src.replace(anchor,`${anchor}\nimport { createPayableAttachment, getPayableAttachment } from './payable-attachments.js';`);
}

if(!src.includes("app.post('/api/payables/attachments'")){
  const anchor="app.use('/api/boletos', requireAuth);";
  if(!src.includes(anchor))throw new Error('PATCH ANEXOS: auth anchor não encontrado.');
  src=src.replace(anchor,`${anchor}\napp.use('/api/payables', requireAuth);\napp.post('/api/payables/attachments', requireWriteAccess, route(req => createPayableAttachment(req, req.body||{})));\napp.get('/api/payables/attachments/:id', async (req,res)=>{\n  try{\n    const file=await getPayableAttachment(req,req.params.id);\n    const safeName=String(file.fileName||'anexo').replace(/[\\\"\\r\\n]/g,'_');\n    res.set({\n      'Content-Type':file.contentType||'application/octet-stream',\n      'Content-Disposition':`attachment; filename=\"${safeName}\"`,\n      'Content-Length':String(file.buffer.length),\n      'Cache-Control':'private, no-store'\n    });\n    res.send(file.buffer);\n  }catch(err){\n    res.status(Number(err?.status||500)).json({error:err?.message||'Erro ao abrir anexo.'});\n  }\n});`);
}

fs.writeFileSync(file,src,'utf8');
console.log('ANEXOS PATCH: rotas de anexos de contas a pagar ativadas.');
