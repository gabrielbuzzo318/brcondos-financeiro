// Corrige a consulta assíncrona da GISS: situação 2 significa processamento, não rejeição.
// Também recupera NFS-e existente quando a GISS retorna E10 (RPS já informado).
(function(){
  const oldApply=window.applyGissResultToRows;
  const oldAtualizar=window.atualizarGissNfse;
  const processingTimers=new Map();

  const textErrors=data=>(Array.isArray(data?.erros)?data.erros:[])
    .map(e=>[e.codigo,e.mensagem,e.correcao].filter(Boolean).join(' - ')).join('; ');

  function isProcessing(data){
    const msg=textErrors(data).toUpperCase();
    return String(data?.situacao||'')==='2' || /REMESSA AINDA NAO FOI PROCESSADA/.test(msg.normalize('NFD').replace(/[\u0300-\u036f]/g,''));
  }

  function isDuplicateRps(data,row){
    const msg=(textErrors(data)+' '+String(row?.lastError||'')).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    return /(^|\s)E10(\s|-|$)/.test(msg) || /RPS JA INFORMADO/.test(msg);
  }

  function persist(){
    try{if(typeof saveData==='function')saveData('nfse',nfse);}catch(_){ }
    try{if(typeof renderAll==='function')renderAll();}catch(_){ }
  }

  function markProcessing(rows,data){
    (rows||[]).forEach(row=>{
      if(!row)return;
      row.status='enviando_nfse';
      row.lastError='';
      row.gissResponse=data||row.gissResponse||null;
      if(data?.protocolo&&!row.gissProtocol)row.gissProtocol=String(data.protocolo);
    });
    persist();
  }

  function applyNfseFound(row,data){
    const rps=String(row?.gissRpsNumber||row?.rpsNumber||'').trim();
    const items=Array.isArray(data?.nfse)?data.nfse:[];
    const item=items.find(x=>String(x.rpsNumero||'')===rps)||items[0];
    if(!item?.numero)return false;
    Object.assign(row,{
      rpsNumber:String(item.rpsNumero||rps),
      gissRpsNumber:String(item.rpsNumero||rps),
      nfseNumber:String(item.numero||''),
      verificationCode:item.codigoVerificacao||row.verificationCode||'',
      gissInternalId:item.idInterno||row.gissInternalId||'',
      status:item.cancelada?'cancelada_nfse':'emitida_nfse',
      lastError:'',
      gissResponse:data
    });
    persist();
    return true;
  }

  async function fetchRps(row){
    const rps=String(row?.gissRpsNumber||row?.rpsNumber||'').trim();
    if(!rps)throw new Error('RPS não informado.');
    const r=await fetch(`/api/nfse/consultar-rps?numero=${encodeURIComponent(rps)}&serie=RPS&tipo=1&_=${Date.now()}`,{cache:'no-store'});
    const data=await r.json();
    if(!r.ok)throw new Error(data.error||'Falha ao consultar o RPS na GISS.');
    return data;
  }

  async function silentPoll(row,attempt=1){
    if(!row||!String(row.gissProtocol||'').trim())return;
    const key=String(row.id);
    if(processingTimers.has(key))clearTimeout(processingTimers.get(key));
    const timer=setTimeout(async()=>{
      processingTimers.delete(key);
      try{
        const r=await fetch(`/api/nfse/consultar-lote?protocolo=${encodeURIComponent(row.gissProtocol)}&_=${Date.now()}`,{cache:'no-store'});
        const data=await r.json();
        if(!r.ok)throw new Error(data.error||'Falha ao consultar a GISS.');
        if(isProcessing(data)){
          markProcessing([row],data);
          if(attempt<8)silentPoll(row,attempt+1);
          return;
        }
        if(applyNfseFound(row,data))return;
        if(isDuplicateRps(data,row)){
          const byRps=await fetchRps(row);
          if(applyNfseFound(row,byRps))return;
        }
        if(typeof oldApply==='function')oldApply([row],data);
      }catch(_){
        if(attempt<8)silentPoll(row,attempt+1);
      }
    },attempt===1?3000:4000);
    processingTimers.set(key,timer);
  }

  if(typeof oldApply==='function'){
    window.applyGissResultToRows=function(rows,data){
      if(isProcessing(data)){
        markProcessing(rows,data);
        (rows||[]).forEach(row=>silentPoll(row,1));
        return rows;
      }
      const result=oldApply.apply(this,arguments);
      (rows||[]).forEach(async row=>{
        if(isDuplicateRps(data,row)){
          try{
            const byRps=await fetchRps(row);
            applyNfseFound(row,byRps);
          }catch(_){ }
        }
      });
      return result;
    };
  }

  window.atualizarGissNfse=async function(id){
    const row=(nfse||[]).find(x=>Number(x.id)===Number(id));
    if(!row)return;

    // Mantém a rotina específica do histórico oficial intacta.
    if(row.gissOrigin==='producao_historico'&&typeof oldAtualizar==='function'){
      return oldAtualizar(id);
    }

    try{
      // E10 geralmente significa que o primeiro envio entrou e só a consulta foi precoce.
      // Nessa situação consultamos diretamente o RPS e recuperamos a NFS-e já criada.
      if(isDuplicateRps(row.gissResponse,row)){
        const byRps=await fetchRps(row);
        if(applyNfseFound(row,byRps)){
          alert(`NFS-e localizada na GISS ✅\n\nRPS: ${row.rpsNumber||''}\nNFS-e: ${row.nfseNumber||''}${row.verificationCode?`\nCódigo de verificação: ${row.verificationCode}`:''}`);
          return;
        }
      }

      if(String(row.gissProtocol||'').trim()){
        const r=await fetch(`/api/nfse/consultar-lote?protocolo=${encodeURIComponent(row.gissProtocol)}&_=${Date.now()}`,{cache:'no-store'});
        const data=await r.json();
        if(!r.ok)throw new Error(data.error||'Falha ao consultar a GISS.');

        if(isProcessing(data)){
          markProcessing([row],data);
          silentPoll(row,1);
          alert(`RPS ${row.rpsNumber||''} recebido pela GISS.\n\nA remessa ainda está sendo processada. O sistema vai consultar novamente automaticamente.`);
          return;
        }
        if(applyNfseFound(row,data)){
          alert(`NFS-e atualizada na GISS ✅\n\nRPS: ${row.rpsNumber||''}\nNFS-e: ${row.nfseNumber||''}${row.verificationCode?`\nCódigo de verificação: ${row.verificationCode}`:''}`);
          return;
        }
        if(isDuplicateRps(data,row)){
          const byRps=await fetchRps(row);
          if(applyNfseFound(row,byRps)){
            alert(`NFS-e localizada na GISS ✅\n\nRPS: ${row.rpsNumber||''}\nNFS-e: ${row.nfseNumber||''}${row.verificationCode?`\nCódigo de verificação: ${row.verificationCode}`:''}`);
            return;
          }
        }
        if(typeof oldApply==='function')oldApply([row],data);
      }else{
        const byRps=await fetchRps(row);
        if(applyNfseFound(row,byRps)){
          alert(`NFS-e localizada na GISS ✅\n\nRPS: ${row.rpsNumber||''}\nNFS-e: ${row.nfseNumber||''}${row.verificationCode?`\nCódigo de verificação: ${row.verificationCode}`:''}`);
          return;
        }
        if(typeof oldApply==='function')oldApply([row],byRps);
      }

      if(row.status==='erro_nfse'||String(row.lastError||'').trim()){
        alert(`GISS rejeitou o RPS ${row.rpsNumber||''} ❌\n\n${row.lastError||'Confira o retorno da GISS.'}`);
      }
    }catch(e){
      alert(`Erro ao atualizar GISS:\n${e.message}`);
    }
  };
})();