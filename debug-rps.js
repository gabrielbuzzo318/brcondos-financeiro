import { consultarNfsePorRpsGiss } from './giss.js';
import { config } from './config.js';

const numeros = ['220','227','252','257'];
const original = config.giss.serviceUrl;
config.giss.serviceUrl = 'https://ws-sjrp.giss.com.br/service-ws/nf/nfse-ws';

for (const numero of numeros) {
  try {
    const d = await consultarNfsePorRpsGiss({ numero, serie: 'RPS', tipo: 1 });
    const resumo = {
      rps: numero,
      nfse: Array.isArray(d.nfse) ? d.nfse : [],
      cancelamentos: Array.isArray(d.cancelamentos) ? d.cancelamentos : [],
      erros: Array.isArray(d.erros) ? d.erros : [],
      xmlPreview: String(d.xmlRetorno || '').replace(/\s+/g,' ').slice(0,1200)
    };
    console.log('GISS DEBUG PENDENTE:', JSON.stringify(resumo));
  } catch (e) {
    console.error('GISS DEBUG PENDENTE FALHOU:', numero, e?.message || String(e), String(e?.details || '').slice(0,500));
  }
}

config.giss.serviceUrl = original;
