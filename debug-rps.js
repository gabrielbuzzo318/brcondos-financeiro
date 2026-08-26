import { consultarNfsePorRpsGiss } from './giss.js';
import { config } from './config.js';

const numero = String(process.env.GISS_DEBUG_RPS || '').trim();
if (numero) {
  const original = config.giss.serviceUrl;
  const endpoints = [
    original,
    'https://v2-ws-homologacao.giss.com.br/service-ws/nf/nfse-ws',
    'https://ws-homologacao.giss.com.br/service-ws/nf/nfse-ws',
    'https://ws-sjrp.giss.com.br/service-ws/nf/nfse-ws'
  ].filter((v,i,a)=>v && a.indexOf(v)===i);

  for (const endpoint of endpoints) {
    config.giss.serviceUrl = endpoint;
    let host='';
    try{ host=new URL(endpoint).hostname; }catch{ host=endpoint; }
    try {
      const d = await consultarNfsePorRpsGiss({ numero, serie: 'RPS', tipo: 1 });
      const resumo = {
        endpoint: host,
        consulta: d.consulta || null,
        nfse: Array.isArray(d.nfse) ? d.nfse : [],
        erros: Array.isArray(d.erros) ? d.erros : [],
        xmlPreview: String(d.xmlRetorno || '').replace(/\s+/g,' ').slice(0,800)
      };
      console.log('GISS DEBUG RPS:', JSON.stringify(resumo));
    } catch (e) {
      console.error('GISS DEBUG RPS FALHOU:', host, e?.message || String(e), String(e?.details || '').slice(0,500));
    }
  }
  config.giss.serviceUrl = original;
}
