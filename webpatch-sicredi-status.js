// Botão de diagnóstico da API de Cobrança Sicredi.
(function(){
  window.testarSicrediOnline=async function(){
    try{
      const hr=await fetch('/api/boletos/health',{cache:'no-store'});
      const h=await hr.json();
      if(!hr.ok)throw new Error(h.error||'Falha ao verificar configuração Sicredi.');
      if(!h.configured){
        const faltam=Array.isArray(h.missing)?h.missing.join('\n• '):'credenciais';
        return alert(`SICREDI AINDA NÃO CONFIGURADO ⚠️\n\nAmbiente: ${(h.ambiente||'').toUpperCase()}\n\nFalta preencher no Railway:\n• ${faltam}\n\nAs credenciais devem ser colocadas diretamente no Railway, não no chat.`);
      }
      const tr=await fetch('/api/boletos/test',{cache:'no-store'});
      const t=await tr.json();
      if(!tr.ok)throw new Error(t.error||JSON.stringify(t.details||t));
      alert(`SICREDI CONECTADO ✅\n\nAmbiente: ${(t.ambiente||'').toUpperCase()}\nAutenticação OAuth2: ${t.autenticacao||'OK'}\nCobrança: ${t.tipoCobranca||'HIBRIDO'}`);
    }catch(e){
      alert(`ERRO SICREDI ❌\n\n${e.message}`);
    }
  };

  const original=renderBoletos;
  renderBoletos=function(){
    original();
    const actions=document.querySelector('#view-boletos .section-title > div:last-child');
    if(!actions||document.getElementById('btnTestarSicredi'))return;
    const btn=document.createElement('button');
    btn.id='btnTestarSicredi';
    btn.className='btn';
    btn.textContent='✓ Testar Sicredi';
    btn.onclick=window.testarSicrediOnline;
    actions.insertBefore(btn,actions.firstChild);
  };

  if(typeof renderBoletos==='function')renderBoletos();
})();
