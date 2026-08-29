import archiver from 'archiver';
import { getPayableAttachment } from './payable-attachments.js';

function safeName(value, fallback='arquivo'){
  const raw=String(value||fallback).trim()||fallback;
  return raw
    .replace(/[\\/:*?"<>|\r\n\t]+/g,'-')
    .replace(/\s+/g,' ')
    .replace(/\.+$/g,'')
    .trim()
    .slice(0,180)||fallback;
}

function extensionOf(name){
  const m=String(name||'').match(/(\.[A-Za-z0-9]{1,8})$/);
  return m?m[1]:'';
}

function uniqueName(name,used){
  const clean=safeName(name);
  const ext=extensionOf(clean);
  const base=ext?clean.slice(0,-ext.length):clean;
  const key=clean.toLowerCase();
  const current=used.get(key)||0;
  used.set(key,current+1);
  if(current===0)return clean;
  return `${base} (${current+1})${ext}`;
}

function asciiFallback(name){
  return String(name||'arquivos.zip')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^\x20-\x7E]/g,'_')
    .replace(/["\\]/g,'_');
}

export async function sendPayableAttachmentsZip(req,res,body={}){
  const items=Array.isArray(body.items)?body.items:[];
  if(!items.length){const err=new Error('Nenhum anexo selecionado.');err.status=400;throw err;}
  if(items.length>300){const err=new Error('Selecione no máximo 300 anexos por vez.');err.status=400;throw err;}

  const files=[];
  const failures=[];
  const used=new Map();

  for(const item of items){
    try{
      const attachment=await getPayableAttachment(req,item?.id);
      let desired=safeName(item?.name||attachment.fileName||'anexo');
      if(!extensionOf(desired))desired+=extensionOf(attachment.fileName);
      desired=uniqueName(desired,used);
      files.push({name:desired,buffer:attachment.buffer});
    }catch(err){
      failures.push(`${safeName(item?.name||item?.id||'arquivo')}: ${err?.message||'não foi possível carregar'}`);
    }
  }

  if(!files.length){const err=new Error('Nenhum dos anexos pôde ser carregado.');err.status=404;throw err;}

  let zipName=safeName(body.zipName||'BRCONDOS - documentos.zip','BRCONDOS - documentos.zip');
  if(!/\.zip$/i.test(zipName))zipName+='.zip';
  const fallback=asciiFallback(zipName);

  res.status(200);
  res.set({
    'Content-Type':'application/zip',
    'Content-Disposition':`attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(zipName)}`,
    'Cache-Control':'private, no-store'
  });

  const archive=archiver('zip',{zlib:{level:9}});
  archive.on('warning',err=>console.warn('ZIP A PAGAR:',err?.message||err));
  archive.on('error',err=>{
    console.error('ZIP A PAGAR:',err);
    if(!res.headersSent)res.status(500).json({error:'Erro ao gerar ZIP.'});
    else res.destroy(err);
  });
  archive.pipe(res);

  files.forEach(file=>archive.append(file.buffer,{name:file.name}));
  if(failures.length){
    archive.append(`Alguns arquivos não puderam ser incluídos:\n\n${failures.join('\n')}`,{name:'_ARQUIVOS_NAO_INCLUIDOS.txt'});
  }

  await archive.finalize();
}
