import { DOMParser } from '@xmldom/xmldom';
import { SignedXml } from 'xml-crypto';
import { buildGissPreview } from './giss.js';

function localName(node){return String(node?.localName||node?.nodeName||'').split(':').pop();}
function certPemFromSignature(sig){
  const all=sig.getElementsByTagName('*');
  for(let i=0;i<all.length;i++){
    if(localName(all[i])==='X509Certificate'){
      const b64=String(all[i].textContent||'').replace(/\s+/g,'');
      const lines=b64.match(/.{1,64}/g)||[];
      return `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----\n`;
    }
  }
  return '';
}
function refUri(sig){
  const all=sig.getElementsByTagName('*');
  for(let i=0;i<all.length;i++) if(localName(all[i])==='Reference') return all[i].getAttribute('URI')||'';
  return '';
}

const payload={
  numeroRps:'999991', numeroLote:'999991', competencia:'2026-08-26', dataEmissao:'2026-08-26',
  valor:1, aliquotaPct:2, discriminacao:'Diagnostico local de assinatura - nao transmitir',
  tomador:{documento:'12345678000199',nome:'DIAGNOSTICO',endereco:'RUA TESTE',numero:'1',bairro:'CENTRO',codigoMunicipio:'3549805',uf:'SP',cep:'15000000'}
};

try{
  const out=buildGissPreview(payload,{sign:true});
  const doc=new DOMParser().parseFromString(out.dataXml,'text/xml');
  const sigs=[];
  const all=doc.getElementsByTagName('*');
  for(let i=0;i<all.length;i++) if(localName(all[i])==='Signature') sigs.push(all[i]);
  const results=[];
  for(const sigNode of sigs){
    const pem=certPemFromSignature(sigNode);
    const checker=new SignedXml({publicCert:pem});
    checker.loadSignature(sigNode);
    let ok=false,err='';
    try{ok=checker.checkSignature(out.dataXml);}catch(e){err=e?.message||String(e);}
    results.push({uri:refUri(sigNode),ok,err:err.slice(0,180)});
  }
  console.log('GISS SIGNATURE SELF-CHECK:',JSON.stringify({count:sigs.length,results}));
}catch(e){
  console.log('GISS SIGNATURE SELF-CHECK ERROR:',String(e?.message||e).slice(0,300));
}
