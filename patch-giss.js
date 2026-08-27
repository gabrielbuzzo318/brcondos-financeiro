import fs from 'node:fs';

const file = new URL('./giss.js', import.meta.url);
let src = fs.readFileSync(file, 'utf8');

// Repõe o formato do XML que foi efetivamente aceito pela GISS em 26/08/2026:
// ds:Signature, namespaces explícitos no RPS, tributos federais e Código NBS.
const rpsWithoutLocalNs = '<tipos:Rps><tipos:InfDeclaracaoPrestacaoServico';
const rpsWithLocalNs = '<tipos:Rps xmlns:tipos="${NS.tipos}" xmlns:ds="${NS.ds}" xmlns:giss="${NS.envio}"><tipos:InfDeclaracaoPrestacaoServico';
if (src.includes(rpsWithoutLocalNs)) src = src.replace(rpsWithoutLocalNs, rpsWithLocalNs);
else if (!src.includes(rpsWithLocalNs)) throw new Error('GISS PATCH: não encontrei abertura do RPS esperada.');

const oldValores = '<tipos:Aliquota>${a}</tipos:Aliquota>${ibs}</tipos:Valores>';
const tributosAceitos = '<tipos:Aliquota>${a}</tipos:Aliquota><tipos:trib><tipos:tribFed><tipos:piscofins><tipos:CST>00</tipos:CST><tipos:vBCPisCofins>0.00</tipos:vBCPisCofins><tipos:pAliqPis>0.00</tipos:pAliqPis><tipos:pAliqCofins>0.00</tipos:pAliqCofins><tipos:vPis>0.00</tipos:vPis><tipos:vCofins>0.00</tipos:vCofins><tipos:tpRetPisCofins>2</tipos:tpRetPisCofins></tipos:piscofins></tipos:tribFed><tipos:totTrib><tipos:pTotTribSN>0.00</tipos:pTotTribSN></tipos:totTrib></tipos:trib>${ibs}</tipos:Valores>';
if (src.includes(oldValores)) src = src.replace(oldValores, tributosAceitos);
else if (!src.includes('<tipos:tpRetPisCofins>2</tipos:tpRetPisCofins>')) throw new Error('GISS PATCH: não encontrei bloco Valores esperado.');

const discriminacao = '<tipos:Discriminacao>${x(item.discriminacao||item.descricao||config.giss.discriminacaoPadrao)}</tipos:Discriminacao>';
const nbsEDiscriminacao = '${config.giss.codigoNbs?`<tipos:CodigoNbs>${x(config.giss.codigoNbs)}</tipos:CodigoNbs>`:\'\'}' + discriminacao;
if (src.includes(discriminacao) && !src.includes('<tipos:CodigoNbs>${x(config.giss.codigoNbs)}</tipos:CodigoNbs>')) src = src.replace(discriminacao, nbsEDiscriminacao);
else if (!src.includes('<tipos:CodigoNbs>${x(config.giss.codigoNbs)}</tipos:CodigoNbs>')) throw new Error('GISS PATCH: não encontrei ponto de inclusão do Código NBS.');

// Consulta por RPS precisa ser assinada neste ambiente GISS.
const oldRps = "export async function consultarNfsePorRpsGiss({numero,serie='RPS',tipo=1}){assertCfg();const n=String(numero||'').trim();if(!n)throw err('Informe o número do RPS.');const d=`<giss:ConsultarNfseRpsEnvio xmlns:giss=\"http://www.giss.com.br/consultar-nfse-rps-envio-v2_04.xsd\" xmlns:tipos=\"${NS.tipos}\"><giss:IdentificacaoRps><tipos:Numero>${x(n)}</tipos:Numero><tipos:Serie>${x(serie)}</tipos:Serie><tipos:Tipo>${x(tipo)}</tipos:Tipo></giss:IdentificacaoRps>${prestador()}</giss:ConsultarNfseRpsEnvio>`;return{...(await post('ConsultarNfsePorRps',d)),consulta:{numero:n,serie,tipo:String(tipo)}};}";
const signedRps = "export async function consultarNfsePorRpsGiss({numero,serie='RPS',tipo=1}){assertCfg();const n=String(numero||'').trim();if(!n)throw err('Informe o número do RPS.');let d=`<giss:ConsultarNfseRpsEnvio xmlns:giss=\"http://www.giss.com.br/consultar-nfse-rps-envio-v2_04.xsd\" xmlns:tipos=\"${NS.tipos}\"><giss:IdentificacaoRps><tipos:Numero>${x(n)}</tipos:Numero><tipos:Serie>${x(serie)}</tipos:Serie><tipos:Tipo>${x(tipo)}</tipos:Tipo></giss:IdentificacaoRps>${prestador()}</giss:ConsultarNfseRpsEnvio>`;d=sign(d,'/*',true);return{...(await post('ConsultarNfsePorRps',d)),consulta:{numero:n,serie,tipo:String(tipo)}};}";
if (src.includes(oldRps)) src = src.replace(oldRps, signedRps);
else if (!src.includes("d=sign(d,'/*',true);return{...(await post('ConsultarNfsePorRps',d))")) throw new Error('GISS PATCH: não encontrei consulta por RPS esperada.');

// Permite consulta histórica em produção sem alterar o endpoint configurado para emissão.
const oldPost = "async function post(operation,dataXml){const envelope=soap(operation,dataXml);const r=await request(config.giss.serviceUrl,{method:'POST',headers:{'Content-Type':'text/xml; charset=utf-8','SOAPAction':`\"http://nfse.abrasf.org.br/${operation}\"`,'Content-Length':Buffer.byteLength(envelope)},body:envelope});if(r.status<200||r.status>=300)throw err(`Giss respondeu HTTP ${r.status}.`,502,r.text.slice(0,1500));const out=extract(r.text);return{...parse(out),ambiente:config.giss.env,xmlRetorno:out};}";
const newPost = "async function postAt(operation,dataXml,serviceUrl=config.giss.serviceUrl){const envelope=soap(operation,dataXml);const r=await request(serviceUrl,{method:'POST',headers:{'Content-Type':'text/xml; charset=utf-8','SOAPAction':`\"http://nfse.abrasf.org.br/${operation}\"`,'Content-Length':Buffer.byteLength(envelope)},body:envelope});if(r.status<200||r.status>=300)throw err(`Giss respondeu HTTP ${r.status}.`,502,r.text.slice(0,1500));const out=extract(r.text);return{...parse(out),ambiente:config.giss.env,xmlRetorno:out};}async function post(operation,dataXml){return postAt(operation,dataXml,config.giss.serviceUrl);}";
if (src.includes(oldPost)) src = src.replace(oldPost, newPost);
else if (!src.includes('async function postAt(')) throw new Error('GISS PATCH: não encontrei função post esperada.');

if (!src.includes('export async function consultarNfsePorRpsEndpointGiss')) {
  src += `\nexport async function consultarNfsePorRpsEndpointGiss({numero,serie='RPS',tipo=1,serviceUrl}){assertCfg();const n=String(numero||'').trim();const endpoint=String(serviceUrl||'').trim();if(!n)throw err('Informe o número do RPS.');if(!endpoint)throw err('Informe o endpoint GISS de consulta.');let d=\`<giss:ConsultarNfseRpsEnvio xmlns:giss=\"http://www.giss.com.br/consultar-nfse-rps-envio-v2_04.xsd\" xmlns:tipos=\"\${NS.tipos}\"><giss:IdentificacaoRps><tipos:Numero>\${x(n)}</tipos:Numero><tipos:Serie>\${x(serie)}</tipos:Serie><tipos:Tipo>\${x(tipo)}</tipos:Tipo></giss:IdentificacaoRps>\${prestador()}</giss:ConsultarNfseRpsEnvio>\`;d=sign(d,'/*',true);return{...(await postAt('ConsultarNfsePorRps',d,endpoint)),consulta:{numero:n,serie,tipo:String(tipo),historico:true}};}\n`;
}

fs.writeFileSync(file, src, 'utf8');
console.log('GISS PATCH: emissão restaurada ao XML aceito (ds + tributos + NBS) e consulta histórica isolada.');
