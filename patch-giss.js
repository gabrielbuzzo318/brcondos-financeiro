import fs from 'node:fs';

const file = new URL('./giss.js', import.meta.url);
let src = fs.readFileSync(file, 'utf8');

// Compatibilidade GISSONLINE: exemplos aceitos usam Signature sem prefixo.
const prefixedSignature = "s.computeSignature(xmlText,{prefix:'ds',location:{reference:target,action:target==='/*'?'append':'after'},existingPrefixes:{giss:NS.envio,tipos:NS.tipos,ds:NS.ds}});";
const unprefixedSignature = "s.computeSignature(xmlText,{location:{reference:target,action:target==='/*'?'append':'after'},existingPrefixes:{giss:NS.envio,tipos:NS.tipos}});";
if (src.includes(prefixedSignature)) src = src.replace(prefixedSignature, unprefixedSignature);
else if (!src.includes(unprefixedSignature)) throw new Error('GISS PATCH: não encontrei a serialização da assinatura esperada.');

// O validador GISS 2.04 é sensível aos namespaces no RPS assinado.
// Mantemos os mesmos namespaces, mas os declaramos explicitamente no elemento Rps
// para que a canonicalização continue idêntica mesmo se o provedor isolar o RPS.
const rpsWithoutLocalNs = '<tipos:Rps><tipos:InfDeclaracaoPrestacaoServico';
const rpsWithLocalNs = '<tipos:Rps xmlns:tipos="${NS.tipos}" xmlns:giss="${NS.envio}" xmlns:ds="${NS.ds}"><tipos:InfDeclaracaoPrestacaoServico';
if (src.includes(rpsWithoutLocalNs)) src = src.replace(rpsWithoutLocalNs, rpsWithLocalNs);
else if (!src.includes(rpsWithLocalNs)) throw new Error('GISS PATCH: não encontrei abertura do RPS esperada.');

const oldRps = "export async function consultarNfsePorRpsGiss({numero,serie='RPS',tipo=1}){assertCfg();const n=String(numero||'').trim();if(!n)throw err('Informe o número do RPS.');const d=`<giss:ConsultarNfseRpsEnvio xmlns:giss=\"http://www.giss.com.br/consultar-nfse-rps-envio-v2_04.xsd\" xmlns:tipos=\"${NS.tipos}\"><giss:IdentificacaoRps><tipos:Numero>${x(n)}</tipos:Numero><tipos:Serie>${x(serie)}</tipos:Serie><tipos:Tipo>${x(tipo)}</tipos:Tipo></giss:IdentificacaoRps>${prestador()}</giss:ConsultarNfseRpsEnvio>`;return{...(await post('ConsultarNfsePorRps',d)),consulta:{numero:n,serie,tipo:String(tipo)}};}";
const signedRps = "export async function consultarNfsePorRpsGiss({numero,serie='RPS',tipo=1}){assertCfg();const n=String(numero||'').trim();if(!n)throw err('Informe o número do RPS.');let d=`<giss:ConsultarNfseRpsEnvio xmlns:giss=\"http://www.giss.com.br/consultar-nfse-rps-envio-v2_04.xsd\" xmlns:tipos=\"${NS.tipos}\"><giss:IdentificacaoRps><tipos:Numero>${x(n)}</tipos:Numero><tipos:Serie>${x(serie)}</tipos:Serie><tipos:Tipo>${x(tipo)}</tipos:Tipo></giss:IdentificacaoRps>${prestador()}</giss:ConsultarNfseRpsEnvio>`;d=sign(d,'/*',true);return{...(await post('ConsultarNfsePorRps',d)),consulta:{numero:n,serie,tipo:String(tipo)}};}";

if (src.includes(oldRps)) src = src.replace(oldRps, signedRps);
else if (!src.includes("d=sign(d,'/*',true);return{...(await post('ConsultarNfsePorRps',d))")) {
  throw new Error('GISS PATCH: não encontrei a função consultarNfsePorRpsGiss esperada.');
}

const oldPost = "async function post(operation,dataXml){const envelope=soap(operation,dataXml);const r=await request(config.giss.serviceUrl,{method:'POST',headers:{'Content-Type':'text/xml; charset=utf-8','SOAPAction':`\"http://nfse.abrasf.org.br/${operation}\"`,'Content-Length':Buffer.byteLength(envelope)},body:envelope});if(r.status<200||r.status>=300)throw err(`Giss respondeu HTTP ${r.status}.`,502,r.text.slice(0,1500));const out=extract(r.text);return{...parse(out),ambiente:config.giss.env,xmlRetorno:out};}";
const newPost = "async function postAt(operation,dataXml,serviceUrl=config.giss.serviceUrl){const envelope=soap(operation,dataXml);const r=await request(serviceUrl,{method:'POST',headers:{'Content-Type':'text/xml; charset=utf-8','SOAPAction':`\"http://nfse.abrasf.org.br/${operation}\"`,'Content-Length':Buffer.byteLength(envelope)},body:envelope});if(r.status<200||r.status>=300)throw err(`Giss respondeu HTTP ${r.status}.`,502,r.text.slice(0,1500));const out=extract(r.text);return{...parse(out),ambiente:config.giss.env,xmlRetorno:out};}async function post(operation,dataXml){return postAt(operation,dataXml,config.giss.serviceUrl);}";

if (src.includes(oldPost)) src = src.replace(oldPost, newPost);
else if (!src.includes('async function postAt(')) throw new Error('GISS PATCH: não encontrei a função post esperada.');

if (!src.includes('export async function consultarNfsePorRpsEndpointGiss')) {
  src += `\nexport async function consultarNfsePorRpsEndpointGiss({numero,serie='RPS',tipo=1,serviceUrl}){assertCfg();const n=String(numero||'').trim();const endpoint=String(serviceUrl||'').trim();if(!n)throw err('Informe o número do RPS.');if(!endpoint)throw err('Informe o endpoint GISS de consulta.');let d=\`<giss:ConsultarNfseRpsEnvio xmlns:giss=\"http://www.giss.com.br/consultar-nfse-rps-envio-v2_04.xsd\" xmlns:tipos=\"\${NS.tipos}\"><giss:IdentificacaoRps><tipos:Numero>\${x(n)}</tipos:Numero><tipos:Serie>\${x(serie)}</tipos:Serie><tipos:Tipo>\${x(tipo)}</tipos:Tipo></giss:IdentificacaoRps>\${prestador()}</giss:ConsultarNfseRpsEnvio>\`;d=sign(d,'/*',true);return{...(await postAt('ConsultarNfsePorRps',d,endpoint)),consulta:{numero:n,serie,tipo:String(tipo),historico:true}};}\n`;
}

fs.writeFileSync(file, src, 'utf8');
console.log('GISS PATCH: assinatura sem prefixo + namespaces explícitos no RPS + consulta histórica isolada.');
