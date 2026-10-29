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
    if(!item?.numero || String(item.rpsNumero||'')!==rps)return false;
    const digits=v=>String(v||'').replace(/\D/g,'');
    const client=(clients||[]).find(c=>Number(c.id)===Number(row.clientId));
    const doc=digits(client?.doc||row.tomadorDocumento||row.tomadorDoc||'');
    if(!doc||!item.tomadorDoc||doc!==digits(item.tomadorDoc))return false;
    if(item.valorServicos && Math.abs(Number(item.valorServicos)-Number(row.value||0))>0.02)return false;
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

  // Recuperação pontual baseada no espelho oficial GISS de outubro/2026.
  // Somente quatro pares RPS / CNPJ / valor / NFS-e conferidos; nenhum envio fiscal.
  const officialOctober = {
    '366':{nf:'3773',doc:'05895468000105',value:785.00,name:'Monte Santo'},
    '370':{nf:'3776',doc:'46600362000114',value:3664.50,name:'Nova Residence'},
    '378':{nf:'3783',doc:'37381644000187',value:2362.50,name:'Reserva dos Guyras'},
    '379':{nf:'3784',doc:'57155439000100',value:2273.00,name:'Sense Residence'}
  };
  const officialDigits=v=>String(v??'').replace(/\D/g,'');
  async function recoverOfficialOctober(row, spec) {
    if(String(row.competence||'')!=='2026-10') throw new Error('Competência diferente de 10/2026.');
    if(String(row.rpsNumber||row.gissRpsNumber||'')!==Object.keys(officialOctober).find(k=>officialOctober[k]===spec)) throw new Error('RPS divergente.');
    if(Math.abs(Number(row.value||0)-spec.value)>0.01) throw new Error('Valor divergente do registro oficial.');
    const client=(clients||[]).find(c=>Number(c.id)===Number(row.clientId));
    const doc=officialDigits(client?.doc||client?.documento||row.tomadorDocumento||row.tomadorDoc||'');
    if(!doc||doc!==spec.doc) throw new Error('CNPJ do cadastro não confere com o documento oficial GISS: '+(doc||'ausente')+'.');
    const duplicate=(nfse||[]).find(x=>x!==row&&String(x.nfseNumber||'')===spec.nf&&String(x.competence||'')==='2026-10');
    if(duplicate) throw new Error('A NFS-e '+spec.nf+' já está vinculada a outro registro. Não houve alteração.');
    if(!confirm('Vincular '+spec.name+' ao documento oficial GISS NFS-e '+spec.nf+' / RPS '+row.rpsNumber+' / R$ '+spec.value.toFixed(2)+'? Nenhuma nota será emitida.')) return;
    Object.assign(row,{
      nfseNumber:spec.nf, gissRpsNumber:String(row.rpsNumber),
      status:'emitida_nfse',lastError:'',
      gissOrigin:'conferencia_oficial_giss_20261029',
      gissResponse:{fonte:'conferencia_visual_portal_giss',nfse:spec.nf,rps:String(row.rpsNumber),tomadorDoc:spec.doc,valor:spec.value}
    });
    saveData('nfse',nfse);
    if(typeof window.brcondosFlushSharedState==='function') await window.brcondosFlushSharedState();
    if(typeof renderAll==='function') renderAll();
    alert('NFS-e '+spec.nf+' vinculada e salva. Nenhuma nota nova foi emitida.');
  }

  // Acesso ao PDF das notas recuperadas: utiliza número oficial e RPS da linha,
  // sem procurar por ID interno potencialmente duplicado.
  const recoveredPdfRows={366:'3773',370:'3776',378:'3783',379:'3784'};
  const previousRenderNfse=renderNfse;
  renderNfse=function(){
    previousRenderNfse();
    document.querySelectorAll('#view-nfse tbody tr').forEach(tr=>{
      const rps=String(tr.querySelector('td')?.textContent||'').trim().match(/^\d+/)?.[0];
      if(!recoveredPdfRows[rps])return;
      const row=(nfse||[]).find(x=>String(x.competence||'')==='2026-10'&&String(x.rpsNumber||'')===rps&&String(x.nfseNumber||'')===recoveredPdfRows[rps]&&x.status==='emitida_nfse');
      if(!row)return;
      const actions=tr.querySelector('.actions')||tr.lastElementChild;
      if(!actions||actions.querySelector('[data-official-pdf]'))return;
      const button=document.createElement('button');
      button.type='button';button.className='btn small';button.textContent='Visualizar NF';button.dataset.officialPdf='1';
      button.onclick=e=>{
        e.preventDefault();e.stopPropagation();
        const params=new URLSearchParams({numero:recoveredPdfRows[rps],rps});
        const url='/api/nfse/pdf/0?'+params.toString();
        window.open(url,'_blank','noopener');
      };
      actions.appendChild(button);
    });
  };

  function visibleRowIdentity(el){
    const tr=el.closest('tr');
    if(!tr)return null;
    const rps=String(tr.querySelector('td')?.textContent||'').trim().match(/^\d+/)?.[0];
    const name=String(tr.children?.[1]?.textContent||'').trim().toUpperCase();
    return {rps,name};
  }
  // Intercepta a ação no elemento visível, evitando ID interno duplicado.
  document.addEventListener('click',async function(event){
    const btn=event.target.closest('button');
    if(!btn||!btn.closest('#view-nfse'))return;
    if(!/^(Atualizar|Consultar) Giss$/i.test(String(btn.textContent||'').trim()))return;
    const ident=visibleRowIdentity(btn);
    if(!ident?.rps)return;
    event.preventDefault();event.stopImmediatePropagation();
    const rows=(nfse||[]).filter(x=>String(x.competence||'')==='2026-10'&&String(x.rpsNumber||x.gissRpsNumber||'')===ident.rps);
    if(rows.length!==1){alert('Consulta bloqueada: RPS '+ident.rps+' não identifica um único registro de outubro.');return;}
    const row=rows[0];
    if(!ident.name.includes(String(row.client||'').trim().toUpperCase()) && !String(row.client||'').trim().toUpperCase().includes(ident.name.split('DESCRIÇÃO')[0].trim())){
      alert('Consulta bloqueada: cliente visível não confere com registro do RPS '+ident.rps+'.');return;
    }
    const spec=officialOctober[ident.rps];
    if(spec){try{await recoverOfficialOctober(row,spec);}catch(e){alert('Recuperação bloqueada: '+e.message);}return;}
    alert('Consulta protegida: este RPS ainda não possui vinculação oficial validada. Nenhuma NFS-e foi alterada.');
  },true);

  window.atualizarGissNfse=async function(id){
    const row=(nfse||[]).find(x=>Number(x.id)===Number(id));
    if(!row)return;
    const spec=officialOctober[String(row.rpsNumber||row.gissRpsNumber||'')];
    if(spec&&String(row.competence||'')==='2026-10'&&row.status==='rascunho'){
      try{await recoverOfficialOctober(row,spec);}catch(e){alert('Não foi possível recuperar a nota: '+e.message);}
      return;
    }

    // Mantém a rotina específica do histórico oficial intacta.
    if((row.gissOrigin==='producao_historico'||row.status==='rascunho')&&typeof oldAtualizar==='function'){
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