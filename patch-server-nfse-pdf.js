import fs from 'node:fs';

const file='server.js';
let src=fs.readFileSync(file,'utf8');

if(!src.includes("app.get('/api/nfse/pdf/:idInterno'")){
  const anchor="app.get('/api/boletos/health'";

  const route=`app.get('/api/nfse/pdf/:idInterno', async (req, res) => {\n  try {\n    const idInterno=String(req.params.idInterno||'').trim();\n    const numero=String(req.query.numero||'').trim();\n    const download=String(req.query.download||'')==='1';\n    if(!idInterno)return res.status(400).json({error:'ID interno da NFS-e não informado.'});\n\n    let buffer=null;\n\n    // Primeiro tenta o PDF oficial da Giss. Nem todos os ambientes liberam esta rota sem sessão web.\n    try {\n      const url=\`https://gissv2-3549805.giss.com.br/service-relatorio/api/relatorio/pdf/3549805/nota/\${encodeURIComponent(idInterno)}\`;\n      const r=await fetch(url,{headers:{'User-Agent':'BRCONDOS-Financeiro/1.0','Accept':'application/pdf'}});\n      const contentType=String(r.headers.get('content-type')||'').toLowerCase();\n      if(r.ok&&contentType.includes('application/pdf')){\n        const candidate=Buffer.from(await r.arrayBuffer());\n        if(candidate.length>4&&candidate.subarray(0,4).toString()==='%PDF')buffer=candidate;\n      }\n    } catch (_) {}\n\n    // Se a rota de relatório estiver bloqueada, monta um espelho em PDF usando os dados oficiais do WebService.\n    if(!buffer){\n      if(!numero)return res.status(502).json({error:'A Giss não liberou o PDF direto e o número da NFS-e não foi informado para gerar o espelho.'});\n      const consulta=await consultarNfsePorNumeroGiss({numero,pagina:1});\n      if(!consulta?.xmlRetorno)throw new Error('A Giss não retornou os dados da NFS-e para montar o PDF.');\n      const {gerarNfsePdf}=await import('./nfse-pdf.js');\n      buffer=await gerarNfsePdf({xmlRetorno:consulta.xmlRetorno,numero});\n    }\n\n    const arquivo=numero||idInterno;\n    res.set({\n      'Content-Type':'application/pdf',\n      'Content-Disposition':\`${'${download ? \'attachment\' : \'inline\'}'}; filename=\\\"nfse-\${arquivo}.pdf\\\"\`,\n      'Content-Length':String(buffer.length),\n      'Cache-Control':'private, no-store'\n    });\n    res.send(buffer);\n  } catch (err) {\n    res.status(Number(err?.status||500)).json({error:'Erro ao abrir o PDF da NFS-e.',details:err?.message||String(err)});\n  }\n});\n\n`;

  if(!src.includes(anchor))throw new Error('Ponto estável de inserção da rota NFS-e não encontrado.');
  src=src.replace(anchor,route+anchor);
}

fs.writeFileSync(file,src,'utf8');
console.log('Proxy do PDF da NFS-e com fallback aplicado.');