import archiver from 'archiver';
import { gerarBoletoPdf } from './boleto-pdf.js';
import { consultarNfsePorNumeroGiss, consultarNfsePorRpsGiss } from './giss.js';
import { gerarNfsePdf } from './nfse-pdf.js';

function safeName(value,fallback='arquivo.pdf'){
  return String(value||fallback)
    .replace(/[\\/:*?"<>|\r\n\t]+/g,'-')
    .replace(/\s+/g,' ')
    .trim()
    .replace(/\.+$/g,'')
    .slice(0,190)||fallback;
}

function uniqueName(name,used){
  const clean=safeName(name);
  const m=clean.match(/(\.[A-Za-z0-9]{1,8})$/);
  const ext=m?m[1]:'';
  const base=ext?clean.slice(0,-ext.length):clean;
  const key=clean.toLowerCase();
  const count=used.get(key)||0;
  used.set(key,count+1);
  return count?`${base} (${count+1})${ext}`:clean;
}

function asciiFallback(name){
  return String(name||'documentos.zip')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^\x20-\x7E]/g,'_')
    .replace(/["\\]/g,'_');
}

async function officialNfsePdf(item){
  const idInterno=String(item?.idInterno||'').trim();
  const numero=String(item?.numero||'').trim();
  const rps=String(item?.rps||'').trim();
  const verificacao=String(item?.verificacao||'').trim();
  let buffer=null;

  if(idInterno&&idInterno!=='0'&&verificacao){
    try{
      const url=`https://3549805.giss.com.br/service-declaracao/api/nota-autenticacao/3549805/download/${encodeURIComponent(idInterno)}/codigo-verificacao/${encodeURIComponent(verificacao)}`;
      const resp=await fetch(url,{redirect:'follow',headers:{'User-Agent':'Mozilla/5.0 BRCONDOS-Financeiro/1.0','Accept':'application/pdf,application/octet-stream;q=0.9,*/*;q=0.8'}});
      if(resp.ok){
        const candidate=Buffer.from(await resp.arrayBuffer());
        if(candidate.length>4&&candidate.subarray(0,4).toString()==='%PDF')buffer=candidate;
      }
    }catch(_){ }
  }

  if(buffer)return buffer;

  let consulta=null;
  let ultimoErro='';
  if(rps){
    try{
      consulta=await consultarNfsePorRpsGiss({numero:rps,serie:'RPS',tipo:1});
      const itens=Array.isArray(consulta?.nfse)?consulta.nfse:[];
      const achou=itens.find(x=>String(x.rpsNumero||'')===rps&&(!numero||String(x.numero||'')===numero))||itens.find(x=>String(x.rpsNumero||'')===rps)||itens[0];
      if(!achou?.numero)throw new Error((consulta?.erros||[]).map(e=>[e.codigo,e.mensagem,e.correcao].filter(Boolean).join(' - ')).join('; ')||'NFS-e não localizada pelo RPS.');
      if(numero&&String(achou.numero)!==numero)throw new Error(`RPS ${rps} retornou NFS-e ${achou.numero}, esperada ${numero}.`);
    }catch(err){
      ultimoErro=err?.message||String(err);
      consulta=null;
    }
  }

  if(!consulta?.xmlRetorno&&numero){
    try{consulta=await consultarNfsePorNumeroGiss({numero,pagina:1});}
    catch(err){ultimoErro=[ultimoErro,err?.message||String(err)].filter(Boolean).join(' | ');consulta=null;}
  }
  if(!consulta?.xmlRetorno)throw new Error(ultimoErro||'A Giss não retornou os dados oficiais da NFS-e.');
  return await gerarNfsePdf({xmlRetorno:consulta.xmlRetorno,numero});
}

export async function sendBillingDocumentsZip(req,res,body={}){
  const type=String(body.type||'').trim();
  const items=Array.isArray(body.items)?body.items:[];
  if(!['boletos','nfse'].includes(type)){const err=new Error('Tipo de documento inválido.');err.status=400;throw err;}
  if(!items.length){const err=new Error('Nenhum documento selecionado.');err.status=400;throw err;}
  if(items.length>250){const err=new Error('Selecione no máximo 250 documentos por vez.');err.status=400;throw err;}

  const files=[];
  const failures=[];
  const used=new Map();

  for(const item of items){
    try{
      let buffer;
      if(type==='boletos')buffer=await gerarBoletoPdf(item?.payload||{});
      else buffer=await officialNfsePdf(item);
      const fileName=uniqueName(item?.name||`${type==='boletos'?'Boleto':'NF'}.pdf`,used);
      files.push({name:/\.pdf$/i.test(fileName)?fileName:`${fileName}.pdf`,buffer});
    }catch(err){
      failures.push(`${safeName(item?.name||'documento')}: ${err?.message||'não foi possível gerar'}`);
    }
  }

  if(!files.length){const err=new Error('Nenhum documento pôde ser gerado.');err.status=404;throw err;}

  let zipName=safeName(body.zipName||'BRCONDOS - documentos.zip','BRCONDOS - documentos.zip');
  if(!/\.zip$/i.test(zipName))zipName+='.zip';
  res.status(200);
  res.set({
    'Content-Type':'application/zip',
    'Content-Disposition':`attachment; filename="${asciiFallback(zipName)}"; filename*=UTF-8''${encodeURIComponent(zipName)}`,
    'Cache-Control':'private, no-store'
  });

  const archive=archiver('zip',{zlib:{level:9}});
  archive.on('warning',err=>console.warn('ZIP FATURAMENTO:',err?.message||err));
  archive.on('error',err=>{
    console.error('ZIP FATURAMENTO:',err);
    if(!res.headersSent)res.status(500).json({error:'Erro ao gerar ZIP.'});
    else res.destroy(err);
  });
  archive.pipe(res);
  files.forEach(file=>archive.append(file.buffer,{name:file.name}));
  if(failures.length)archive.append(`Alguns documentos não puderam ser incluídos:\n\n${failures.join('\n')}`,{name:'_DOCUMENTOS_NAO_INCLUIDOS.txt'});
  await archive.finalize();
}
