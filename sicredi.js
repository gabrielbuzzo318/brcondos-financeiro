const text=(name,fallback='')=>String(process.env[name]??fallback).trim();
const digits=v=>String(v??'').replace(/\D/g,'');

const env=text('SICREDI_ENV','sandbox').toLowerCase();
const isProd=env==='producao'||env==='production'||env==='prod';
const defaultAuth=isProd
  ? 'https://api-parceiro.sicredi.com.br/auth/openapi/token'
  : 'https://api-parceiro.sicredi.com.br/sb/auth/openapi/token';
const defaultBase=isProd
  ? 'https://api-parceiro.sicredi.com.br/cobranca/boleto/v1'
  : 'https://api-parceiro.sicredi.com.br/sb/cobranca/boleto/v1';

const cfg={
  env:isProd?'producao':'sandbox',
  apiKey:text('SICREDI_API_KEY'),
  codigoBeneficiario:digits(text('SICREDI_CODIGO_BENEFICIARIO')),
  cooperativa:digits(text('SICREDI_COOPERATIVA')),
  posto:digits(text('SICREDI_POSTO')),
  codigoAcesso:text('SICREDI_CODIGO_ACESSO'),
  authUrl:text('SICREDI_AUTH_URL',defaultAuth),
  baseUrl:text('SICREDI_BASE_URL',defaultBase).replace(/\/$/,''),
  especieDocumento:text('SICREDI_ESPECIE_DOCUMENTO','DUPLICATA_MERCANTIL_INDICACAO'),
  tipoCobranca:text('SICREDI_TIPO_COBRANCA','HIBRIDO').toUpperCase()
};

let tokenCache={accessToken:'',refreshToken:'',expiresAt:0,refreshExpiresAt:0};

function sicrediError(message,status=502,details=null){const e=new Error(message);e.status=status;e.details=details;return e;}

export function getSicrediConfigStatus(){
  const missing=[];
  if(!cfg.apiKey)missing.push('SICREDI_API_KEY');
  if(cfg.codigoBeneficiario.length!==5)missing.push('SICREDI_CODIGO_BENEFICIARIO');
  if(cfg.cooperativa.length!==4)missing.push('SICREDI_COOPERATIVA');
  if(cfg.posto.length!==2)missing.push('SICREDI_POSTO');
  if(!cfg.codigoAcesso)missing.push('SICREDI_CODIGO_ACESSO');
  return {
    configured:missing.length===0,
    ambiente:cfg.env,
    tipoCobranca:cfg.tipoCobranca,
    authUrl:cfg.authUrl,
    baseUrl:cfg.baseUrl,
    missing
  };
}

function assertConfig(){
  const s=getSicrediConfigStatus();
  if(!s.configured)throw sicrediError('Integração Sicredi ainda não está configurada.',503,s.missing);
}

async function parseResponse(r){
  const raw=await r.text();
  let data=null;
  try{data=raw?JSON.parse(raw):{};}catch{data={raw:raw.slice(0,3000)};}
  if(!r.ok){
    const msg=data?.message||data?.mensagem||data?.error_description||data?.error||`Sicredi respondeu HTTP ${r.status}.`;
    throw sicrediError(String(msg),r.status>=400&&r.status<500?r.status:502,data);
  }
  return data||{};
}

async function authPassword(){
  assertConfig();
  const body=new URLSearchParams({
    grant_type:'password',
    username:`${cfg.codigoBeneficiario}${cfg.cooperativa}`,
    password:cfg.codigoAcesso,
    scope:'cobranca'
  });
  const r=await fetch(cfg.authUrl,{method:'POST',headers:{
    'Content-Type':'application/x-www-form-urlencoded',
    'x-api-key':cfg.apiKey,
    'context':'COBRANCA'
  },body});
  const data=await parseResponse(r);
  if(!data.access_token)throw sicrediError('Sicredi autenticou, mas não retornou access_token.',502,data);
  const now=Date.now();
  tokenCache={
    accessToken:String(data.access_token),
    refreshToken:String(data.refresh_token||''),
    expiresAt:now+Math.max(30,Number(data.expires_in||300)-15)*1000,
    refreshExpiresAt:now+Math.max(60,Number(data.refresh_expires_in||1800)-30)*1000
  };
  return tokenCache.accessToken;
}

async function authRefresh(){
  if(!tokenCache.refreshToken||Date.now()>=tokenCache.refreshExpiresAt)return authPassword();
  const body=new URLSearchParams({grant_type:'refresh_token',refresh_token:tokenCache.refreshToken});
  const r=await fetch(cfg.authUrl,{method:'POST',headers:{
    'Content-Type':'application/x-www-form-urlencoded',
    'x-api-key':cfg.apiKey,
    'context':'COBRANCA'
  },body});
  if(!r.ok){tokenCache={accessToken:'',refreshToken:'',expiresAt:0,refreshExpiresAt:0};return authPassword();}
  const data=await parseResponse(r);
  const now=Date.now();
  tokenCache={
    accessToken:String(data.access_token||''),
    refreshToken:String(data.refresh_token||tokenCache.refreshToken),
    expiresAt:now+Math.max(30,Number(data.expires_in||300)-15)*1000,
    refreshExpiresAt:now+Math.max(60,Number(data.refresh_expires_in||1800)-30)*1000
  };
  return tokenCache.accessToken;
}

async function getToken(force=false){
  assertConfig();
  if(!force&&tokenCache.accessToken&&Date.now()<tokenCache.expiresAt)return tokenCache.accessToken;
  return tokenCache.refreshToken?authRefresh():authPassword();
}

function commonHeaders(token){return{
  'Authorization':`Bearer ${token}`,
  'x-api-key':cfg.apiKey,
  'cooperativa':cfg.cooperativa,
  'posto':cfg.posto
};}

function mapPagador(p){
  const documento=digits(p?.documento);
  const cep=digits(p?.cep);
  const nome=String(p?.nome||'').trim();
  const endereco=String(p?.endereco||'').trim();
  const cidade=String(p?.cidade||'').trim();
  const uf=String(p?.uf||'').trim().toUpperCase();
  const missing=[];
  if(![11,14].includes(documento.length))missing.push('CPF/CNPJ');
  if(!nome)missing.push('nome');
  if(!endereco)missing.push('endereço');
  if(!cidade)missing.push('cidade');
  if(uf.length!==2)missing.push('UF');
  if(cep.length!==8)missing.push('CEP');
  if(missing.length)throw sicrediError(`Complete o cadastro do pagador: ${missing.join(', ')}.`,400);
  return {documento,nome,tipoPessoa:documento.length===14?'PESSOA_JURIDICA':'PESSOA_FISICA',endereco,cidade,uf,cep};
}

function buildBoletoBody(input){
  const dataVencimento=String(input?.dataVencimento||'').trim();
  const valor=Number(input?.valor);
  const seuNumero=String(input?.seuNumero||'').replace(/[^A-Za-z0-9]/g,'').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(dataVencimento))throw sicrediError('Data de vencimento inválida.',400);
  if(!Number.isFinite(valor)||valor<=0)throw sicrediError('Valor do boleto inválido.',400);
  if(!seuNumero)throw sicrediError('Seu Número não informado.',400);
  const body={
    codigoBeneficiario:cfg.codigoBeneficiario,
    dataVencimento,
    especieDocumento:cfg.especieDocumento,
    tipoCobranca:cfg.tipoCobranca,
    seuNumero,
    valor:Number(valor.toFixed(2)),
    pagador:mapPagador(input?.pagador)
  };
  const idTitulo=String(input?.idTituloEmpresa||'').trim().slice(0,25);
  if(idTitulo)body.idTituloEmpresa=idTitulo;

  // Observacoes do boleto: o frontend envia as linhas em `detalhes`.
  // A API Sicredi aceita ate 5 informativos e 4 mensagens. Quebramos em blocos
  // curtos para preservar inclusive listas grandes de codigos de RPA.
  const rawNotes=Array.isArray(input?.informativos)
    ? input.informativos.map(x=>String(x||'').trim()).filter(Boolean)
    : String(input?.detalhes||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const noteChunks=[];
  rawNotes.forEach(line=>{
    let remaining=line;
    while(remaining.length>80){
      let cut=remaining.lastIndexOf(' ',80);
      if(cut<35)cut=80;
      noteChunks.push(remaining.slice(0,cut).trim());
      remaining=remaining.slice(cut).trim();
    }
    if(remaining)noteChunks.push(remaining);
  });
  if(noteChunks.length>9)throw sicrediError('Observacao do boleto ficou longa demais para o limite do Sicredi.',400);
  if(noteChunks.length)body.informativos=noteChunks.slice(0,5);
  if(noteChunks.length>5)body.mensagens=noteChunks.slice(5,9);
  return body;
}

async function sicrediFetch(url,options={},retry401=true){
  let token=await getToken();
  let r=await fetch(url,{...options,headers:{...commonHeaders(token),...(options.headers||{})}});
  if(r.status===401&&retry401){
    token=await getToken(true);
    r=await fetch(url,{...options,headers:{...commonHeaders(token),...(options.headers||{})}});
  }
  return parseResponse(r);
}

export async function testSicredi(){
  assertConfig();
  await getToken(true);
  return {ok:true,ambiente:cfg.env,autenticacao:'OK',tipoCobranca:cfg.tipoCobranca};
}

export async function registrarBoletoSicredi(input){
  assertConfig();
  const body=buildBoletoBody(input);
  return sicrediFetch(`${cfg.baseUrl}/boletos`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
}

export async function consultarBoletoSicredi(nossoNumero){
  assertConfig();
  const n=digits(nossoNumero);
  if(n.length!==9)throw sicrediError('Nosso Número deve ter 9 dígitos.',400);
  const q=new URLSearchParams({codigoBeneficiario:cfg.codigoBeneficiario,nossoNumero:n});
  return sicrediFetch(`${cfg.baseUrl}/boletos?${q.toString()}`,{method:'GET'});
}


export async function consultarBoletosLiquidadosDiaSicredi(dia,pagina=null){
  assertConfig();
  const raw=String(dia||'').trim();
  let d=raw;
  if(/^\d{4}-\d{2}-\d{2}$/.test(raw)){
    const [y,m,day]=raw.split('-');
    d=`${day}/${m}/${y}`;
  }
  if(!/^\d{2}\/\d{2}\/\d{4}$/.test(d))throw sicrediError('Dia inválido para consulta de liquidados.',400);
  const q=new URLSearchParams({
    codigoBeneficiario:cfg.codigoBeneficiario,
    dia:d
  });
  if(pagina!==null&&pagina!==undefined&&String(pagina)!=='')q.set('pagina',String(Math.max(0,Number(pagina)||0)));
  return sicrediFetch(`${cfg.baseUrl}/boletos/liquidados/dia?${q.toString()}`,{
    method:'GET',
    headers:{'Content-Type':'application/x-www-form-urlencoded'}
  });
}
