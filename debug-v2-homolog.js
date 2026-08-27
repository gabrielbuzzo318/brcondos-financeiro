import { consultarNfsePorRpsEndpointGiss } from './giss.js';

const endpoint='https://v2-ws-homologacao.giss.com.br/service-ws/nf/nfse-ws';
try {
  const d=await consultarNfsePorRpsEndpointGiss({numero:'999999',serie:'RPS',tipo:1,serviceUrl:endpoint});
  console.log('GISS V2 HOMOLOG CHECK:', JSON.stringify({
    ok:true,
    nfse:Array.isArray(d?.nfse)?d.nfse.length:0,
    erros:Array.isArray(d?.erros)?d.erros.map(e=>({codigo:e?.codigo||'',mensagem:e?.mensagem||''})):[],
    situacao:d?.situacao||''
  }));
} catch(e) {
  console.log('GISS V2 HOMOLOG CHECK:', JSON.stringify({ok:false,error:e?.message||String(e)}));
}
