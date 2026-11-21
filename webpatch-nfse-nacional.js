(function(){
  window.brcondosNationalMode=true;
  // Emissões novas: Sefin Nacional. Documentos GISS: somente consulta histórica.
  const apiRoot='/api/nfse/nacional';
  const locked=new Set(['emitida_nfse','cancelada_nfse']);
  const rowById=id=>(nfse||[]).find(x=>String(x.id)===String(id));
  const legacy=x=>!!((String(x?.competence||'')&&String(x.competence)<='2026-10')||x?.gissOrigin||x?.gissProtocol||x?.gissInternalId||(locked.has(x?.status)&&!x?.nationalKey));
  const errText=data=>{
    const list=Array.isArray(data?.erros)?data.erros:[];
    return [data?.error,data?.mensagem,...list.map(x=>[x.codigo,x.mensagem,x.correcao].filter(Boolean).join(' - '))].filter(Boolean).join('\n')||'Retorno não conclusivo';
  };
  async function api(path,method='GET',payload){
    const r=await fetch(apiRoot+path,{method,cache:'no-store',
      headers:payload?{'Content-Type':'application/json'}:{},
      ...(payload?{body:JSON.stringify(payload)}:{})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok){const e=new Error(errText(d)+(d.details?'\n'+JSON.stringify(d.details):''));e.status=r.status;throw e;}
    return d;
  }
  async function readiness(){
    const h=await api('/health');
    if(!h.ready)throw new Error('Portal Nacional ainda bloqueado para emissão.\n'+
      (h.blockingMessage||'')+(h.missing?.length?'\nPendências: '+h.missing.join(', '):''));
    return h;
  }
  function guard(row){
    if(!row||legacy(row)||locked.has(row.status))throw new Error('Nota do histórico GISS ou já emitida.');
    if(row.status!=='rascunho')throw new Error('Esta DPS exige consulta antes de qualquer reenvio.');
    const reason=nfseCanEmit(row);
    if(reason)throw new Error(reason);
    return nfsePayload(row);
  }
  async function emit(row){
    const input=guard(row);
    const preview=await api('/preview','POST',input);
    row.nationalIdDps=preview.idDps;row.status='enviando_nfse';row.lastError='';
    saveData('nfse',nfse);
    try{
      const d=await api('/emitir','POST',input);
      row.nationalIdDps=d.idDps||row.nationalIdDps;
      if(d.sucesso&&d.chaveAcesso){
        row.status='emitida_nfse';row.nationalKey=d.chaveAcesso;
        row.nationalXml=d.xml||'';row.nfseNumber=d.numero||row.nfseNumber||'';
        row.lastError='';
      }else if(d.precisaConferir||d.jaExistente){
        row.status='enviando_nfse';row.nationalKey=d.chaveAcesso||'';
        row.lastError='REVISAR: '+errText(d);
      }else{
        row.status='erro_nfse';row.lastError=errText(d);
      }
      saveData('nfse',nfse);
      return {ok:row.status==='emitida_nfse',ambiguous:row.status==='enviando_nfse'};
    }catch(e){
      if(e.status===401){row.status='rascunho';row.lastError='Confirme novamente sua senha antes da emissão.';}
      else{row.status='enviando_nfse';row.lastError='REVISAR ANTES DE REENVIAR: '+e.message;}
      saveData('nfse',nfse);
      return {ok:false,ambiguous:e.status!==401};
    }
  }
  window.testNationalConnection=async function(){
    try{
      const h=await api('/health');
      let t={connected:false};
      if(h.certificadoEncontrado)try{t=await api('/test');}catch(e){t.error=e.message;}
      const labels={
        NFSE_NACIONAL_CTRIBNAC:'Código de Tributação Nacional do serviço (cTribNac)',
        NFSE_NACIONAL_OP_SIMP_NAC:'Situação da COMARC no Simples Nacional (opSimpNac)',
        NFSE_NACIONAL_REG_AP_TRIB_SN:'Regime de apuração do Simples Nacional (regApTribSN)'
      };
      const pending=(h.missing||[]).map(k=>labels[k]||k);
      alert('PORTAL NACIONAL — TESTE SEM EMISSÃO\nAmbiente: '+String(h.environment||'').toUpperCase()+
        '\nCertificado A1: '+(h.certificadoEncontrado?'arquivo localizado':'ausente')+
        '\nConexão: '+(t.connected?'API respondeu corretamente':t.reachable?'Servidor respondeu HTTP '+t.httpStatus:'não confirmada')+
        '\nEmissão: '+(h.ready?'habilitada':'BLOQUEADA até homologação')+
        (pending.length?'\n\nParâmetros fiscais pendentes:\n'+pending.join('\n'):'')+
        (t.error?'\n\nFalha de conectividade: '+t.error:'')+
        '\n\nEsta consulta não envia DPS nem emite NFS-e.');
    }catch(e){alert('Falha ao testar Portal Nacional:\n'+e.message);}
  };
  window.previewNfseXml=async function(id){
    const row=rowById(id);if(!row)return;
    if(legacy(row))return alert('NFS-e histórica da GISS. Nenhum XML nacional será produzido.');
    try{
      const d=await api('/preview','POST',nfsePayload(row));
      openModal('Prévia DPS nacional • '+row.rpsNumber,
        '<div class="notice"><b>Não transmitida.</b> DPS assinada digitalmente: '+esc(d.idDps)+'</div>'+
        '<div class="field"><textarea readonly rows="19" style="width:100%;font:11px monospace">'+esc(d.xml||'')+'</textarea></div>'+
        '<button class="btn primary" onclick="closeModal()">Fechar</button>');
    }catch(e){alert('Prévia DPS não gerada:\n'+e.message);}
  };
  async function authorizeNationalEmission(){
    // Reautenticação do usuário antes de qualquer transmissão fiscal.
    const password=window.prompt('Confirme sua senha de login para emitir NFS-e no Portal Nacional:');
    if(password===null||password==='')return false;
    const r=await fetch('/api/auth/verify-nfse-password',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({password})
    });
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||'Não foi possível validar a senha.');
    return true;
  }
  window.emitNfseOne=async function(id){
    const row=rowById(id);if(!row)return;
    try{
      await readiness();guard(row);
      if(!confirm('EMITIR PELO PORTAL NACIONAL?\n\nCliente: '+row.client+
        '\nValor: '+money(row.value)+'\nDPS: '+row.rpsNumber+
        '\n\nO sistema transmitirá apenas uma vez. Confirmar?'))return;
      if(!(await authorizeNationalEmission()))return;
      const result=await emit(row);renderAll();
      alert(result.ok?'NFS-e confirmada na Sefin Nacional.\nChave: '+row.nationalKey:
        'Emissão não confirmada. NÃO reenviar sem consultar a DPS.\n'+row.lastError);
    }catch(e){alert(e.message);}
  };
  window.emitAllNfse=async function(){
    try{await readiness();}catch(e){return alert(e.message);}
    const ids=new Set([...document.querySelectorAll('#view-nfse tbody tr[data-id]')].filter(tr=>tr.style.display!=='none').map(tr=>String(tr.dataset.id)));
    const visible=(nfse||[]).filter(x=>ids.has(String(x.id))),eligible=[],skipped=[];
    visible.forEach(row=>{try{guard(row);eligible.push(row);}catch{skipped.push(row);}});
    if(!eligible.length)return alert('Nenhum rascunho nacional apto no filtro atual.');
    const total=eligible.reduce((s,x)=>s+Number(x.value||0),0);
    if(!confirm('EMITIR TODAS • PORTAL NACIONAL\n\nNotas: '+eligible.length+
      '\nValor: '+money(total)+'\nIgnoradas/históricas: '+skipped.length+
      '\n\nEnvio sequencial, sem repetição automática. Confirmar?'))return;
    try{if(!(await authorizeNationalEmission()))return;}catch(e){return alert(e.message);}
    openModal('Emissão Nacional',
      '<div class="notice">Enviando individualmente. Falha de comunicação interrompe o lote.</div>'+
      '<div id="nac-progress">Preparando...</div>'+
      '<div class="bulk-progress-track"><div id="nac-bar" class="bulk-progress-bar"></div></div>'+
      '<div id="nac-log" class="bulk-log"></div>');
    let done=0,ok=0,errors=0;
    for(const row of eligible){
      const result=await emit(row);
      done++;if(result.ok)ok++;else errors++;
      const p=document.getElementById('nac-progress');
      const b=document.getElementById('nac-bar');
      const log=document.getElementById('nac-log');
      if(p)p.textContent=done+' de '+eligible.length+' • Confirmadas '+ok+' • Pendentes/falhas '+errors;
      if(b)b.style.width=Math.round(done/eligible.length*100)+'%';
      if(log)log.textContent=(result.ok?'✓ ':'⚠ ')+row.client+' — DPS '+row.rpsNumber+' '+(row.lastError||'');
      if(result.ambiguous)break;
    }
    saveData('nfse',nfse);renderAll();
    alert('Processamento nacional encerrado.\nConfirmadas: '+ok+
      '\nNão confirmadas: '+errors+'\nNão enviadas: '+(eligible.length-done)+
      '\n\nConfira pendências antes de retomar.');
  };
  window.consultarNfseNacional=async function(id){
    const row=rowById(id);if(!row||legacy(row))return;
    try{
      if(!row.nationalKey&&!row.nationalIdDps)return alert('Sem identificador nacional.');
      const d=row.nationalKey?await api('/nfse/'+encodeURIComponent(row.nationalKey)):
        await api('/dps/'+encodeURIComponent(row.nationalIdDps));
      if(d.found===false)return alert('DPS não encontrada no Portal Nacional.');
      const key=d.chaveAcesso||row.nationalKey;
      if(!key)return alert('Chave de acesso não retornada. Não reenviar sem verificar no portal.');
      const full=d.xml?d:await api('/nfse/'+encodeURIComponent(key));
      if(!full.xml||!full.chaveAcesso)return alert('Retorno inconclusivo: confira pelo portal.');
      row.nationalKey=full.chaveAcesso;row.nationalXml=full.xml;
      row.nfseNumber=full.numero||row.nfseNumber;row.status='emitida_nfse';row.lastError='';
      saveData('nfse',nfse);renderAll();alert('NFS-e nacional localizada ✅\n'+row.nationalKey);
    }catch(e){alert('Não foi possível consultar NFS-e:\n'+e.message);}
  };
  window.downloadNationalXml=function(id){
    const row=rowById(id);if(!row?.nationalXml)return alert('XML oficial indisponível. Consulte a nota.');
    const url=URL.createObjectURL(new Blob([row.nationalXml],{type:'application/xml'}));
    const a=document.createElement('a');a.href=url;a.download='NFSE-'+(row.nfseNumber||row.nationalKey||row.id)+'.xml';
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  };
  const oldCancel=window.openCancelNfse;
  if(typeof oldCancel==='function')window.openCancelNfse=function(id){
    if(rowById(id)?.nationalKey)return alert('Cancelamento nacional ainda não homologado. Utilize o Portal Nacional.');
    return oldCancel.apply(this,arguments);
  };
  const oldRender=window.renderNfse;
  if(typeof oldRender==='function')window.renderNfse=function(){
    const r=oldRender.apply(this,arguments);
    const view=document.getElementById('view-nfse');if(!view)return r;
    const subtitle=view.querySelector('.section-title span');
    if(subtitle)subtitle.textContent='Novas emissões: Portal Nacional • Histórico: GISS';
    const notice=view.querySelector('.notice');
    if(notice)notice.innerHTML='<b>Portal Nacional:</b> confira os parâmetros fiscais em Testar Portal Nacional. Novas DPS são assinadas com o certificado A1. O histórico GISS foi preservado. Nenhuma emissão acontece sem confirmação.';
    const buttons=[...view.querySelectorAll('.section-title button')];
    const test=buttons.find(b=>/Testar Giss/i.test(b.textContent||''));
    if(test){test.textContent='✓ Testar Portal Nacional';test.onclick=()=>window.testNationalConnection();}
    const history=buttons.find(b=>/Atualizar Giss de todas/i.test(b.textContent||''));
    if(history)history.textContent='↻ Consultar histórico GISS';
    const bulk=buttons.find(b=>/Emitir todas/i.test(b.textContent||''));
    if(bulk){bulk.textContent='⚡ Emitir todas • Nacional';bulk.onclick=()=>window.emitAllNfse();}
    [...view.querySelectorAll('tbody tr[data-id]')].forEach(tr=>{
      const row=rowById(tr.dataset.id),actions=tr.querySelector('td:last-child .actions');
      if(!row||!actions)return;
      if(row.nationalKey||row.nationalIdDps){
        [...actions.querySelectorAll('button')].forEach(b=>{if(/Giss|Cancelar NF|PDF/i.test(b.textContent||''))b.remove();});
        if(!actions.querySelector('.national-consult')){
          const b=document.createElement('button');b.className='btn small national-consult';b.textContent='Consultar Nacional';
          b.onclick=()=>window.consultarNfseNacional(row.id);actions.appendChild(b);
        }
        if(row.nationalXml&&!actions.querySelector('.national-xml')){
          const b=document.createElement('button');b.className='btn small primary national-xml';b.textContent='XML oficial';
          b.onclick=()=>window.downloadNationalXml(row.id);actions.appendChild(b);
        }
      }else if(legacy(row)){
        [...actions.querySelectorAll('button')].forEach(b=>{if(/Emitir NF|Prévia XML/i.test(b.textContent||''))b.remove();});
      }
    });
    return r;
  };
})();