import { consultarNfsePorRpsEndpointGiss } from './giss.js';

const endpoint='https://ws-sjrp.giss.com.br/service-ws/nf/nfse-ws';
const numeros=['220','227','252','257'];

for (const numero of numeros) {
  const sucessos=[];
  const erros=[];
  for (let tentativa=1; tentativa<=8; tentativa++) {
    try {
      const d=await consultarNfsePorRpsEndpointGiss({numero,serie:'RPS',tipo:1,serviceUrl:endpoint});
      const item=Array.isArray(d?.nfse)?d.nfse.find(x=>String(x?.numero||'').trim()):null;
      if(item){
        sucessos.push({tentativa,nfse:item.numero,rps:item.rpsNumero||'',codigoVerificacao:item.codigoVerificacao||'',dataEmissao:item.dataEmissao||''});
        break;
      }
      erros.push({tentativa,erros:Array.isArray(d?.erros)?d.erros.map(e=>`${e?.codigo||''}:${e?.mensagem||''}`):[]});
    } catch(e) {
      erros.push({tentativa,erro:e?.message||String(e)});
    }
    await new Promise(r=>setTimeout(r,450));
  }
  console.log('GISS MISSING RPS CHECK:',JSON.stringify({numero,sucessos,ultimosErros:erros.slice(-3)}));
}
