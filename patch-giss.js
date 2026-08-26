import fs from 'node:fs';

const file = new URL('./giss.js', import.meta.url);
let src = fs.readFileSync(file, 'utf8');

const old = "export async function consultarNfsePorRpsGiss({numero,serie='RPS',tipo=1}){assertCfg();const n=String(numero||'').trim();if(!n)throw err('Informe o número do RPS.');const d=`<giss:ConsultarNfseRpsEnvio xmlns:giss=\"http://www.giss.com.br/consultar-nfse-rps-envio-v2_04.xsd\" xmlns:tipos=\"${NS.tipos}\"><giss:IdentificacaoRps><tipos:Numero>${x(n)}</tipos:Numero><tipos:Serie>${x(serie)}</tipos:Serie><tipos:Tipo>${x(tipo)}</tipos:Tipo></giss:IdentificacaoRps>${prestador()}</giss:ConsultarNfseRpsEnvio>`;return{...(await post('ConsultarNfsePorRps',d)),consulta:{numero:n,serie,tipo:String(tipo)}};}";

const replacement = "export async function consultarNfsePorRpsGiss({numero,serie='RPS',tipo=1}){assertCfg();const n=String(numero||'').trim();if(!n)throw err('Informe o número do RPS.');let d=`<giss:ConsultarNfseRpsEnvio xmlns:giss=\"http://www.giss.com.br/consultar-nfse-rps-envio-v2_04.xsd\" xmlns:tipos=\"${NS.tipos}\"><giss:IdentificacaoRps><tipos:Numero>${x(n)}</tipos:Numero><tipos:Serie>${x(serie)}</tipos:Serie><tipos:Tipo>${x(tipo)}</tipos:Tipo></giss:IdentificacaoRps>${prestador()}</giss:ConsultarNfseRpsEnvio>`;d=sign(d,'/*',true);return{...(await post('ConsultarNfsePorRps',d)),consulta:{numero:n,serie,tipo:String(tipo)}};}";

if (src.includes(old)) {
  src = src.replace(old, replacement);
  fs.writeFileSync(file, src, 'utf8');
  console.log('GISS PATCH: consulta por RPS assinada.');
} else if (src.includes("d=sign(d,'/*',true);return{...(await post('ConsultarNfsePorRps',d))")) {
  console.log('GISS PATCH: assinatura da consulta por RPS já aplicada.');
} else {
  throw new Error('GISS PATCH: não encontrei a função consultarNfsePorRpsGiss esperada.');
}
