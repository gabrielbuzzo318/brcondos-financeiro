import fs from 'node:fs';

const file='server.js';
let src=fs.readFileSync(file,'utf8');

if(!src.includes("app.get('/api/nfse/pdf/:idInterno'")){
  const anchor="app.get('/api/boletos/health'";

  const route=`app.get('/api/nfse/pdf/:idInterno', async (req, res) => {\n  try {\n    const idInterno=String(req.params.idInterno||'').trim();\n    if(!idInterno)return res.status(400).json({error:'ID interno da NFS-e não informado.'});\n\n    const url=\`https://gissv2-3549805.giss.com.br/service-relatorio/api/relatorio/pdf/3549805/nota/\${encodeURIComponent(idInterno)}\`;\n    const r=await fetch(url,{headers:{'User-Agent':'BRCONDOS-Financeiro/1.0'}});\n    if(!r.ok){\n      const text=await r.text().catch(()=> '');\n      return res.status(r.status).json({error:'Não foi possível carregar o PDF da NFS-e na Giss.',details:text.slice(0,300)});\n    }\n\n    const buffer=Buffer.from(await r.arrayBuffer());\n    const download=String(req.query.download||'')==='1';\n    res.set({\n      'Content-Type':'application/pdf',\n      'Content-Disposition':\`${'${download ? \'attachment\' : \'inline\'}'}; filename=\\\"nfse-\${idInterno}.pdf\\\"\`,\n      'Content-Length':String(buffer.length),\n      'Cache-Control':'private, no-store'\n    });\n    res.send(buffer);\n  } catch (err) {\n    res.status(500).json({error:'Erro ao abrir o PDF da NFS-e.',details:err?.message||String(err)});\n  }\n});\n\n`;

  if(!src.includes(anchor))throw new Error('Ponto estável de inserção da rota NFS-e não encontrado.');
  src=src.replace(anchor,route+anchor);
}

fs.writeFileSync(file,src,'utf8');
console.log('Proxy do PDF da NFS-e aplicado.');