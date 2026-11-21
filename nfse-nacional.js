import fs from 'node:fs';
import https from 'node:https';
import { gzipSync, gunzipSync } from 'node:zlib';
import forge from 'node-forge';
import { SignedXml } from 'xml-crypto';
import { DOMParser } from '@xmldom/xmldom';
import { config } from './config.js';

// Sefin Nacional: a integração GISS histórica permanece inalterada.
// Nenhuma emissão nacional é liberada enquanto os campos fiscais não forem configurados.
const trim=(v)=>String(v??'').trim();
const digits=(v)=>trim(v).replace(/\D/g,'');
const env=(name,def='')=>trim(process.env[name]??def);
const xml=(v)=>trim(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const tag=(name,value)=>trim(value)?'<'+name+'>'+xml(value)+'</'+name+'>':'';
const urlBase=()=>env('NFSE_NACIONAL_ENV','homologacao')==='producao'?'https://sefin.nfse.gov.br/SefinNacional':'https://sefin.producaorestrita.nfse.gov.br/API/SefinNacional';
const docNamespace='http://www.sped.fazenda.gov.br/nfse';
const dsNamespace='http://www.w3.org/2000/09/xmldsig#';
const cryptoAlgo={
 canonical:'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
 signature:'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
 digest:'http://www.w3.org/2001/04/xmlenc#sha256',
 enveloped:dsNamespace+'enveloped-signature'
};
function fail(message,status=400,details){const e=new Error(message);e.status=status;if(details)e.details=details;throw e;}
function settings(){
 return {
  environment:env('NFSE_NACIONAL_ENV','homologacao'),
  enabled:env('NFSE_NACIONAL_ENABLED','0')==='1',
  serie:env('NFSE_NACIONAL_SERIE','00001'),
  cLocEmi:digits(env('GISS_CODIGO_MUNICIPIO')),
  cnpj:digits(env('GISS_CNPJ')),
  im:env('GISS_INSCRICAO_MUNICIPAL'),
  cTribNac:digits(env('NFSE_NACIONAL_CTRIBNAC')),
  cTribMun:digits(env('NFSE_NACIONAL_CTRIBMUN')),
  cNBS:digits(env('NFSE_NACIONAL_NBS')||env('GISS_CODIGO_NBS')),
  opSimpNac:env('NFSE_NACIONAL_OP_SIMP_NAC'),
  regApTribSN:env('NFSE_NACIONAL_REG_AP_TRIB_SN'),
  regEspTrib:env('NFSE_NACIONAL_REG_ESP_TRIB','0'),
  tribISSQN:env('NFSE_NACIONAL_TRIB_ISSQN','1'),
  tpRetISSQN:env('NFSE_NACIONAL_TP_RET_ISSQN','1'),
  indTotTrib:env('NFSE_NACIONAL_IND_TOT_TRIB','0'),
  cIndOp:digits(env('NFSE_NACIONAL_CINDOP')||env('GISS_INDOP')),
  cst:digits(env('NFSE_NACIONAL_CST')||env('GISS_CST_IBSCBS')),
  cClassTrib:digits(env('NFSE_NACIONAL_CCLASSTRIB')||env('GISS_CLASS_TRIB_IBSCBS')),
  indDest:env('NFSE_NACIONAL_IND_DEST','0'),
  finNFSe:env('NFSE_NACIONAL_FIN_NFSE','0')
 };
}
function omissions(s){
 const missing=[];
 if(!['homologacao','producao'].includes(s.environment))missing.push('NFSE_NACIONAL_ENV: homologacao/producao');
 if(!/^\d{5}$/.test(s.serie)||Number(s.serie)<1||Number(s.serie)>49999)missing.push('NFSE_NACIONAL_SERIE (00001 a 49999)');
 if(!/^\d{7}$/.test(s.cLocEmi))missing.push('GISS_CODIGO_MUNICIPIO');
 if(!/^\d{14}$/.test(s.cnpj))missing.push('GISS_CNPJ');
 if(!s.im)missing.push('GISS_INSCRICAO_MUNICIPAL');
 if(!/^\d{6}$/.test(s.cTribNac))missing.push('NFSE_NACIONAL_CTRIBNAC');
 if(!/^\d{9}$/.test(s.cNBS))missing.push('NFSE_NACIONAL_NBS');
 if(!['1','2','3','4'].includes(s.opSimpNac))missing.push('NFSE_NACIONAL_OP_SIMP_NAC');
 if(s.opSimpNac==='3'&&!['1','2','3'].includes(s.regApTribSN))missing.push('NFSE_NACIONAL_REG_AP_TRIB_SN');
 if(!/^[0-9]$/.test(s.regEspTrib))missing.push('NFSE_NACIONAL_REG_ESP_TRIB');
 if(!/^[12]$/.test(s.tribISSQN))missing.push('NFSE_NACIONAL_TRIB_ISSQN');
 if(!/^[123]$/.test(s.tpRetISSQN))missing.push('NFSE_NACIONAL_TP_RET_ISSQN');
 if(!config.giss.certPfxPath||!fs.existsSync(config.giss.certPfxPath))missing.push('certificado A1 do prestador');
 if(!config.giss.certPassword)missing.push('senha do certificado A1');
 return missing;
}
export function nationalHealth(){
 const s=settings(),missing=omissions(s);
 return {
  provider:'Sefin Nacional',environment:s.environment,
  url:urlBase(),configured:missing.length===0,enabled:s.enabled,
  ready:s.enabled&&missing.length===0,
  certificadoEncontrado:!!config.giss.certPfxPath&&fs.existsSync(config.giss.certPfxPath),
  missing,
  blockingMessage:!s.enabled?'Transmissão nacional ainda não habilitada: aguardando validação fiscal e homologação.':missing.length?'Faltam parâmetros para emissão nacional.':''
 };
}
function certificate(){
 const p=config.giss.certPfxPath;
 if(!p||!fs.existsSync(p))fail('Certificado digital A1 não encontrado.',400);
 let p12;
 try{
  const raw=fs.readFileSync(p);
  p12=forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(forge.util.createBuffer(raw.toString('binary'))),false,config.giss.certPassword);
 }catch(e){fail('Certificado digital não pôde ser aberto.',400);}
 const keyBags=[
  ...(p12.getBags({bagType:forge.pki.oids.pkcs8ShroudedKeyBag})[forge.pki.oids.pkcs8ShroudedKeyBag]||[]),
  ...(p12.getBags({bagType:forge.pki.oids.keyBag})[forge.pki.oids.keyBag]||[])
 ];
 const certBags=p12.getBags({bagType:forge.pki.oids.certBag})[forge.pki.oids.certBag]||[];
 if(!keyBags[0]?.key||!certBags[0]?.cert)fail('Certificado A1 sem chave privada e certificado utilizáveis.',400);
 return {pfx:fs.readFileSync(p),key:forge.pki.privateKeyToPem(keyBags[0].key),cert:forge.pki.certificateToPem(certBags[0].cert)};
}
function http(method,path,body,options={}){
 if(options.anonymous&&(method!=='GET'||path!=='/docs/index'))fail('Diagnóstico anônimo limitado a GET /docs/index');
 const pfx=options.anonymous?null:certificate().pfx;
 const u=new URL((options.baseUrl||urlBase())+path);
 const timeoutMs=Number(options.timeoutMs||20000);
 return new Promise((resolve,reject)=>{
  let phase='inicio';const events=[];
  const mark=p=>{phase=p;events.push(p)};
  const req=https.request({
   protocol:u.protocol,hostname:u.hostname,port:443,path:u.pathname+u.search,method,
   family:4,...(pfx?{pfx,passphrase:config.giss.certPassword}:{}),
   minVersion:'TLSv1.2',rejectUnauthorized:true,timeout:timeoutMs,
   signal:AbortSignal.timeout(timeoutMs+2000),
   headers:{Accept:'application/json','User-Agent':'BRCONDOS-Financeiro/2.0',
    ...(body?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}:{})}
  },response=>{
   mark('http-respondeu');
   const chunks=[];let size=0;
   response.on('data',b=>{size+=b.length;if(size<5_000_000)chunks.push(b);else req.destroy(new Error('Resposta muito grande'));});
   response.on('end',()=>{
    const content=Buffer.concat(chunks).toString('utf8');
    let data;try{data=JSON.parse(content);}catch{data={mensagem:content.slice(0,600)};}
    resolve({status:response.statusCode||0,data});
   });
  });
  req.on('socket',socket=>{
   mark('socket');
   socket.on('lookup',err=>mark(err?'dns-erro':'dns-ok'));
   socket.on('connect',()=>mark('tcp-ok'));
   socket.on('secureConnect',()=>mark('tls-ok'));
  });
  req.on('timeout',()=>req.destroy(Object.assign(new Error(method==='POST'?'Timeout na transmissão: conferir DPS antes de reenviar':'Timeout em consulta somente leitura; nenhuma DPS transmitida'),{status:504,ambiguous:method==='POST'})));
  req.on('error',e=>{e.networkPhase=phase;e.networkEvents=events.slice(0,12);reject(e)});
  if(body)req.write(body);
  req.end();
 });
}
export async function testNationalConnection(){
 const status=nationalHealth();
 if(!status.certificadoEncontrado)fail('Certificado A1 não disponível.',400);
 const adnBase=status.environment==='producao'?'https://adn.nfse.gov.br/parametrizacao':'https://adn.producaorestrita.nfse.gov.br/parametrizacao';
 const altSefin=status.environment==='producao'?'https://sefin.nfse.gov.br/SefinNacional':'https://sefin.producaorestrita.nfse.gov.br/SefinNacional';
 // GET de páginas/parametros exclusivamente: jamais cria DPS ou NFS-e
 const probes=await Promise.allSettled([
  http('GET','/docs/index',null,{timeoutMs:16000}),
  http('GET','/docs/index',null,{timeoutMs:16000,anonymous:true}),
  http('GET','/docs/index',null,{baseUrl:altSefin,timeoutMs:16000}),
  http('GET','/'+settings().cLocEmi+'/convenio',null,{baseUrl:adnBase,timeoutMs:16000})
 ]);
 const decode=(result,system)=>{
  if(result.status==='rejected'){
   const e=result.reason;
   return {system,connected:false,reachable:false,code:String(e?.code||''),phase:String(e?.networkPhase||''),events:e?.networkEvents||[],error:String(e?.message||'Falha').slice(0,260)};
  }
  const r=result.value,code=Number(r.status||0);
  return {system,reachable:code>0,connected:code>=200&&code<300,httpStatus:code};
 };
 const docsSefin=decode(probes[0],'Sefin com A1');
 const anonymousDocs=decode(probes[1],'Sefin sem A1');
 const oldSefin=decode(probes[2],'Sefin rota alternativa');
 const parametros=decode(probes[3],'ADN Parametros Municipais');
 const options=[docsSefin,anonymousDocs,oldSefin];
 const sefin=options.find(p=>p.connected)||options.find(p=>p.reachable)||docsSefin;
 return {provider:'Sefin Nacional',environment:status.environment,configured:status.configured,
  enabled:status.enabled,missing:status.missing,connected:sefin.connected,reachable:sefin.reachable,
  httpStatus:sefin.httpStatus||0,testOnly:true,transmitted:false,
  sefin,parametros,sefinProbes:{docsSefin,anonymousDocs,oldSefin},
  message:'Diagnóstico apenas leitura: nenhuma DPS enviada.'};
}
function localTime(){
 const d=new Date();
 const p=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(d);
 return p.replace(' ','T')+'-03:00';
}
function dpsIdentity(s,nDPS){
 return 'DPS'+s.cLocEmi+(s.cnpj.length===11?'1':'2')+s.cnpj.padStart(14,'0')+s.serie+nDPS.padStart(15,'0');
}
function tomadorXml(t){
 if(!t||typeof t!=='object')fail('Dados do tomador ausentes.');
 const doc=digits(t.documento);
 if(![11,14].includes(doc.length)||!trim(t.nome))fail('Tomador sem CPF/CNPJ ou nome válido.');
 const cMun=digits(t.codigoMunicipio),cep=digits(t.cep);
 if(!/^\d{7}$/.test(cMun)||!/^\d{8}$/.test(cep)||!trim(t.endereco)||!trim(t.numero)||!trim(t.bairro)){
  fail('Complete endereço, número, bairro, CEP e município IBGE do tomador.');
 }
 return '<toma>'+tag(doc.length===14?'CNPJ':'CPF',doc)+tag('xNome',t.nome)+
 '<end><endNac>'+tag('cMun',cMun)+tag('CEP',cep)+'</endNac>'+
 tag('xLgr',t.endereco)+tag('nro',t.numero)+tag('xCpl',t.complemento)+tag('xBairro',t.bairro)+'</end>'+
 (trim(t.email)?'<email>'+xml(t.email)+'</email>':'')+'</toma>';
}
function buildXml(payload,s){
 const nDPS=digits(payload.numeroRps),competencia=trim(payload.competencia);
 const valor=Number(payload.valor),aliquota=Number(payload.aliquotaPct);
 if(!nDPS||nDPS.length>15)fail('Número da DPS deve ser numérico, entre 1 e 15 dígitos.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(competencia))fail('Data da competência da DPS inválida.');
 if(competencia<'2026-11-01')fail('Competências até outubro/2026 devem permanecer no histórico GISS. Emissão nacional somente a partir de novembro/2026.',409);
 const now=localTime();
 if(competencia>now.slice(0,10))fail('Competência futura não permitida.');
 if(!Number.isFinite(valor)||valor<=0||!Number.isFinite(aliquota)||aliquota<0||aliquota>100)fail('Valor ou alíquota inválidos.');
 if(!trim(payload.discriminacao))fail('Descrição do serviço obrigatória.');
 const id=dpsIdentity(s,nDPS);
 const reg='<regTrib>'+tag('opSimpNac',s.opSimpNac)+(s.opSimpNac==='3'?tag('regApTribSN',s.regApTribSN):'')+tag('regEspTrib',s.regEspTrib)+'</regTrib>';
 const prest='<prest>'+tag('CNPJ',s.cnpj)+tag('IM',s.im)+reg+'</prest>';
 const serv='<serv><locPrest>'+tag('cLocPrestacao',s.cLocEmi)+'</locPrest><cServ>'+tag('cTribNac',s.cTribNac)+tag('cTribMun',s.cTribMun)+tag('xDescServ',payload.discriminacao)+tag('cNBS',s.cNBS)+'</cServ></serv>';
 const ibs=(s.cIndOp&&s.cst&&s.cClassTrib)?'<IBSCBS>'+tag('finNFSe',s.finNFSe)+tag('cIndOp',s.cIndOp)+tag('indDest',s.indDest)+
 '<valores><trib><gIBSCBS>'+tag('CST',s.cst)+tag('cClassTrib',s.cClassTrib)+'</gIBSCBS></trib></valores></IBSCBS>':'';
 const trib='<trib><tribMun>'+tag('tribISSQN',s.tribISSQN)+tag('tpRetISSQN',s.tpRetISSQN)+((s.tribISSQN==='1'&&aliquota>0&&!(s.opSimpNac==='3'&&s.regApTribSN==='1'))?tag('pAliq',aliquota.toFixed(2)):'')+'</tribMun><totTrib>'+tag('indTotTrib',s.indTotTrib)+'</totTrib></trib>';
 const xmlText='<?xml version="1.0" encoding="UTF-8"?>'+
 '<DPS xmlns="'+docNamespace+'" versao="1.01"><infDPS Id="'+id+'">'+
 tag('tpAmb',s.environment==='producao'?'1':'2')+tag('dhEmi',now)+tag('verAplic','BRCONDOS-Financeiro-2.0')+
 tag('serie',s.serie)+tag('nDPS',nDPS)+tag('dCompet',competencia)+tag('tpEmit','1')+
 tag('cLocEmi',s.cLocEmi)+prest+tomadorXml(payload.tomador)+serv+
 '<valores><vServPrest>'+tag('vServ',valor.toFixed(2))+'</vServPrest>'+trib+'</valores>'+ibs+
 '</infDPS></DPS>';
 return {id,xmlText};
}
function signedDps(xmlText,id){
 const c=certificate();
 const s=new SignedXml({
  privateKey:c.key,publicCert:c.cert,
  signatureAlgorithm:cryptoAlgo.signature,canonicalizationAlgorithm:cryptoAlgo.canonical,
  getKeyInfoContent:SignedXml.getKeyInfoContent
 });
 const xpath='//*[@Id="'+id+'"]';
 s.addReference({xpath,transforms:[cryptoAlgo.enveloped,cryptoAlgo.canonical],digestAlgorithm:cryptoAlgo.digest});
 s.computeSignature(xmlText,{prefix:'ds',location:{reference:xpath,action:'after'}});
 const output=s.getSignedXml();
 if(!output.includes('Signature')||!output.includes(id))fail('Assinatura da DPS não foi gerada.');
 return output;
}
export function nationalPreview(payload){
 const s=settings(),missing=omissions(s);
 if(missing.length)fail('Configuração nacional incompleta.',400,missing);
 const {id,xmlText}=buildXml(payload,s);
 return {provider:'Sefin Nacional',environment:s.environment,idDps:id,xml:signedDps(xmlText,id),transmitted:false};
}
function extractValue(xmlText,name){
 const doc=new DOMParser().parseFromString(xmlText,'application/xml');
 const nodes=doc.getElementsByTagNameNS('*',name);
 return nodes[0]?.textContent?.trim()||'';
}
function expandXml(base64){
 if(!base64)return '';
 try{return gunzipSync(Buffer.from(base64,'base64')).toString('utf8');}
 catch{fail('XML retornado não pôde ser descompactado.',502);}
}
export async function consultNationalDps(id){
 if(!/^DPS[A-Za-z0-9]{30,60}$/.test(trim(id)))fail('Identificador de DPS inválido.');
 const res=await http('GET','/dps/'+encodeURIComponent(id));
 if(res.status===404)return {found:false,idDps:id};
 if(res.status<200||res.status>=300)fail('Falha ao consultar a DPS nacional (HTTP '+res.status+').',502,res.data);
 return {found:true,idDps:id,...res.data};
}
export async function consultNationalNfse(chave){
 if(!/^\d{50}$/.test(digits(chave)))fail('Chave de acesso da NFS-e inválida.');
 const res=await http('GET','/nfse/'+encodeURIComponent(chave));
 if(res.status<200||res.status>=300)fail('Falha ao consultar a NFS-e nacional (HTTP '+res.status+').',502,res.data);
 const xmlContent=expandXml(res.data.nfseXmlGZipB64);
 return {...res.data,xml:xmlContent,numero:extractValue(xmlContent,'nNFSe'),chaveAcesso:res.data.chaveAcesso||chave};
}
export async function emitNational(payload){
 const h=nationalHealth();
 if(!h.ready)fail('Emissão nacional bloqueada: parâmetros fiscais e homologação pendentes.',409,h.missing);
 const preview=nationalPreview(payload);
 // Consulta obrigatória da DPS antes de transmitir; retornos inconclusivos não são reenviados.
 const prior=await consultNationalDps(preview.idDps);
 if(prior.found){
  return {sucesso:false,precisaConferir:true,jaExistente:true,idDps:preview.idDps,
    chaveAcesso:prior.chaveAcesso||'',mensagem:'DPS já cadastrada no Portal Nacional. Consulte a nota antes de qualquer reenvio.'};
 }
 let res;
 try{
  res=await http('POST','/nfse',JSON.stringify({dpsXmlGZipB64:gzipSync(Buffer.from(preview.xml,'utf8')).toString('base64')}));
 }catch(e){
  // Em perda de conexão é impossível afirmar se a Sefin concluiu a emissão.
  fail('Envio sem confirmação conclusiva. Consulte a DPS antes de qualquer nova tentativa.',409,{idDps:preview.idDps,causa:e?.message});
 }
 const data=res.data||{};
 if(res.status<200||res.status>=300){
  return {sucesso:false,provider:'Sefin Nacional',httpStatus:res.status,idDps:preview.idDps,
    erros:data.erros||[],mensagem:data.mensagem||data.message||'DPS rejeitada.',response:data};
 }
 if(!data.chaveAcesso&&!data.nfseXmlGZipB64){
  return {sucesso:false,precisaConferir:true,idDps:preview.idDps,
    mensagem:'Retorno sem documento fiscal: consulte a DPS antes de reenviar.',response:data};
 }
 const signedXml=expandXml(data.nfseXmlGZipB64);
 return {sucesso:true,provider:'Sefin Nacional',idDps:preview.idDps,
  chaveAcesso:data.chaveAcesso||extractValue(signedXml,'Id').replace(/^NFS/,''),
  numero:extractValue(signedXml,'nNFSe'),xml:signedXml,response:{ambiente:h.environment}};
}