import { consultarNfsePorRpsGiss } from './giss.js';

const numero = String(process.env.GISS_DEBUG_RPS || '').trim();
if (numero) {
  try {
    const d = await consultarNfsePorRpsGiss({ numero, serie: 'RPS', tipo: 1 });
    const resumo = {
      consulta: d.consulta || null,
      situacao: d.situacao || '',
      protocolo: d.protocolo || '',
      nfse: Array.isArray(d.nfse) ? d.nfse : [],
      erros: Array.isArray(d.erros) ? d.erros : [],
      xmlPreview: String(d.xmlRetorno || '').replace(/\s+/g,' ').slice(0,1800)
    };
    console.log('GISS DEBUG RPS:', JSON.stringify(resumo));
  } catch (e) {
    console.error('GISS DEBUG RPS FALHOU:', e?.message || String(e), e?.details || '');
  }
}
