import fs from 'node:fs';

const file=new URL('./server.js',import.meta.url);
let src=fs.readFileSync(file,'utf8');

if(!src.includes("from './payable-zip.js'")){
  const anchor="import { createPayableAttachment, getPayableAttachment } from './payable-attachments.js';";
  if(!src.includes(anchor))throw new Error('PATCH ZIP A PAGAR: import de anexos não encontrado.');
  src=src.replace(anchor,anchor+"\nimport { sendPayableAttachmentsZip } from './payable-zip.js';");
}

if(!src.includes("app.post('/api/payables/attachments/zip'")){
  const anchor="app.get('/api/payables/attachments/:id', async (req,res)=>{";
  if(!src.includes(anchor))throw new Error('PATCH ZIP A PAGAR: rota de anexos não encontrada.');
  const route=[
    "app.post('/api/payables/attachments/zip', async (req,res)=>{",
    "  try{",
    "    await sendPayableAttachmentsZip(req,res,req.body||{});",
    "  }catch(err){",
    "    if(!res.headersSent)res.status(Number(err?.status||500)).json({error:err?.message||'Erro ao gerar ZIP dos anexos.'});",
    "  }",
    "});"
  ].join('\n');
  src=src.replace(anchor,route+'\n'+anchor);
}

fs.writeFileSync(file,src,'utf8');
console.log('ZIP A PAGAR PATCH: download mensal de anexos ativado.');
