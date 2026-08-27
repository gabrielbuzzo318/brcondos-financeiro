// Restaura as 5 NFS-e pendentes do HTML final e reativa Atualizar GISS nas emitidas.
(function(){
  const VERSION='brcondos_nfse_pendentes_264_268_v1';
  const LOCKED=new Set(['emitida_nfse','cancelada_nfse']);
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
  const sameMoney=(a,b)=>Math.abs(Number(a||0)-Number(b||0))<0.01;
  const PENDING=[
    {rps:'264',name:'ASSOCIAÇÃO RECANTO DOS CUMBRIATAS',value:1921.70},
    {rps:'265',name:'ASSOCIAÇÃO RESIDENCIAL LAS VEGAS II',value:2768.00},
    {rps:'266',name:'ASSOCIAÇÃO RESIDENCIAL MONTE CARLO',value:4042.00},
    {rps:'267',name:'RAIZES IMPERIAL',value:6383.80},
    {rps:'268',name:'VILLE DES ALPES',value:2810.00}
  ];

  function findClient(name){
    return (clients||[]).find(c=>norm(c.name)===norm(name)) || (typeof findClientByLooseName==='function'?findClientByLooseName(name):null) || null;
  }
  function findBoleto(spec,c){
    let list=(boletos||[]).filter(b=>b.section!=='CONTABIL'&&!/CONTABIL/i.test(String(b.description||''))&&String(b.competence||'')==='2026-08');
    const byClient=list.filter(b=>(c&&Number(b.clientId)===Number(c.id))||norm(b.client)===norm(spec.name));
    if(byClient.length)list=byClient;
    return list.find(b=>sameMoney(b.value,spec.value))||list[0]||null;
  }

  function restorePending(){
    if(!Array.isArray(nfse))nfse=[];
    const protectedIds=new Set();
    for(const spec of PENDING){
      const c=findClient(spec.name);
      const b=findBoleto(spec,c);
      let row=nfse.find(x=>!LOCKED.has(x.status)&&norm(x.client)===norm(spec.name)&&sameMoney(x.value,spec.value));
      if(!row){
        row={id:Date.now()+Number(spec.rps)+Math.floor(Math.random()*1000)};
        nfse.push(row);
      }
      protectedIds.add(row.id);
      Object.assign(row,{
        sourceBoletoId:row.sourceBoletoId||b?.id||'',
        clientId:c?.id||b?.clientId||row.clientId||0,
        client:c?.name||spec.name,
        competence:'2026-08',
        value:spec.value,
        description:'Administração de Condomínios.',
        rpsNumber:spec.rps,
        gissRpsNumber:'',
        issueDate:'2026-08-26',
        serviceDate:'2026-08-26',
        aliquotaPct:4.48,
        status:'rascunho',
        nfseNumber:'',verificationCode:'',gissInternalId:'',gissProtocol:'',lastError:'',gissResponse:null
      });
    }
    let next=269;
    const occupied=new Set(nfse.filter(x=>protectedIds.has(x.id)||LOCKED.has(x.status)).map(x=>Number(x.rpsNumber||x.gissRpsNumber||0)).filter(Boolean));
    for(const row of nfse){
      if(protectedIds.has(row.id)||LOCKED.has(row.status))continue;
      const nr=Number(row.rpsNumber||0);
      if(nr>=264&&nr<=268){
        while(occupied.has(next))next++;
        row.rpsNumber=String(next);row.gissRpsNumber='';occupied.add(next);next++;
      }
    }
    localStorage.setItem('brcondos_giss_last_rps','263');
    saveData('nfse',nfse);
    localStorage.setItem(VERSION,'ok');
  }

  // Marca o histórico oficial para sempre consultar produção pelo RPS.
  (nfse||[]).forEach(row=>{
    const r=Number(row.rpsNumber||row.gissRpsNumber||0);
    if(LOCKED.has(row.status)&&r>=218&&r<=263&&row.issueDate==='2026-08-26')row.gissOrigin='producao_historico';
  });
  if(localStorage.getItem(VERSION)!=='ok')restorePending();
  else saveData('nfse',nfse);

  async function atualizarHistorica(row){
    const rps=String(row.gissRpsNumber||row.rpsNumber||'').trim();
    if(!rps)throw new Error('RPS não informado.');
    const r=await fetch(`/api/nfse/consultar-rps-historico?numero=${encodeURIComponent(rps)}&serie=RPS&tipo=1&_=${Date.now()}`,{cache:'no-store'});
    const data=await r.json();
    if(!r.ok)throw new Error(data.error||'Falha ao consultar a GISS de produção.');
    const item=(Array.isArray(data.nfse)?data.nfse:[]).find(x=>String(x.rpsNumero||'')===rps)||(Array.isArray(data.nfse)?data.nfse[0]:null);
    if(!item?.numero){
      const msg=(data.erros||[]).map(e=>[e.codigo,e.mensagem,e.correcao].filter(Boolean).join(' - ')).join('; ')||'A GISS não retornou a NFS-e para este RPS.';
      row.lastError=msg;saveData('nfse',nfse);renderAll();throw new Error(msg);
    }
    const cancels=Array.isArray(data.cancelamentos)?data.cancelamentos:[];
    const cancel=cancels.find(c=>String(c.numero||'')===String(item.numero||''));
    const canceled=!!(item.cancelada||cancel);
    Object.assign(row,{
      rpsNumber:String(item.rpsNumero||rps),gissRpsNumber:String(item.rpsNumero||rps),
      nfseNumber:String(item.numero||row.nfseNumber||''),verificationCode:item.codigoVerificacao||row.verificationCode||'',
      gissInternalId:item.idInterno||row.gissInternalId||'',status:canceled?'cancelada_nfse':'emitida_nfse',
      cancelDate:item.dataCancelamento||cancel?.dataCancelamento||row.cancelDate||'',
      cancelCode:item.codigoCancelamento||cancel?.codigoCancelamento||row.cancelCode||'',
      lastError:'',gissResponse:data,gissOrigin:'producao_historico'
    });
    saveData('nfse',nfse);renderAll();
    return row;
  }

  window.atualizarGissNfse=async function(id){
    const row=nfse.find(x=>Number(x.id)===Number(id));if(!row)return;
    try{
      if(row.gissOrigin==='producao_historico'){
        await atualizarHistorica(row);
      }else if(String(row.gissProtocol||'').trim()){
        const r=await fetch(`/api/nfse/consultar-lote?protocolo=${encodeURIComponent(row.gissProtocol)}`,{cache:'no-store'});
        const data=await r.json();if(!r.ok)throw new Error(data.error||'Falha ao consultar a GISS.');
        applyGissResultToRows([row],data);
      }else{
        const rps=String(row.gissRpsNumber||row.rpsNumber||'').trim();
        if(!rps)throw new Error('Essa NFS-e não possui RPS para consulta.');
        const r=await fetch(`/api/nfse/consultar-rps?numero=${encodeURIComponent(rps)}&serie=RPS&tipo=1&_=${Date.now()}`,{cache:'no-store'});
        const data=await r.json();if(!r.ok)throw new Error(data.error||'Falha ao consultar a GISS.');
        applyGissResultToRows([row],data);
      }
      if(row.status==='erro_nfse'||String(row.lastError||'').trim()){
        alert(`GISS rejeitou o RPS ${row.rpsNumber||''} ❌\n\n${row.lastError||'Confira o retorno da GISS.'}`);
        return;
      }
      alert(`${row.status==='cancelada_nfse'?'NFS-e CANCELADA na GISS ⛔':'NFS-e atualizada na GISS ✅'}\n\nRPS: ${row.rpsNumber||''}\nNFS-e: ${row.nfseNumber||''}${row.verificationCode?`\nCódigo de verificação: ${row.verificationCode}`:''}`);
    }catch(e){alert(`Erro ao atualizar GISS:\n${e.message}`);}
  };

  const renderNfseOriginal=renderNfse;
  renderNfse=function(){
    renderNfseOriginal();
    document.querySelectorAll('#view-nfse tbody tr[data-id]').forEach(tr=>{
      const row=nfse.find(x=>Number(x.id)===Number(tr.dataset.id));
      if(!row||!LOCKED.has(row.status))return;
      const actions=tr.querySelector('.actions');if(!actions)return;
      const already=[...actions.querySelectorAll('button')].some(b=>/ATUALIZAR\s+GISS/i.test(b.textContent||''));
      if(!already){
        const btn=document.createElement('button');btn.className='btn small';btn.textContent='Atualizar Giss';btn.onclick=()=>window.atualizarGissNfse(row.id);
        const pdf=[...actions.querySelectorAll('button')].find(b=>/^PDF$/i.test((b.textContent||'').trim()));
        if(pdf)actions.insertBefore(btn,pdf);else actions.appendChild(btn);
      }
    });
  };

  if(typeof renderAll==='function')renderAll();
})();
