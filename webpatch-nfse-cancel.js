(function(){
  function escCancel(v){
    return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  }

  window.openCancelNfse=function(id){
    const row=(nfse||[]).find(x=>Number(x.id)===Number(id));
    if(!row)return;
    if(row.status!=='emitida_nfse'||!row.nfseNumber)return alert('Somente NFS-e emitida e ativa pode ser cancelada.');

    openModal('Cancelar NFS-e',`
      <div class="notice" style="border-left-color:var(--danger);background:#fff5f5">
        <b>Atenção:</b> esta ação envia o cancelamento diretamente para a GISS e não pode ser desfeita pelo sistema.
      </div>
      <div class="modal-grid" style="margin-top:14px">
        ${field('NFS-e',`<input value="${escCancel(row.nfseNumber)}" disabled>`)}
        ${field('Cliente',`<input value="${escCancel(row.client||'')}" disabled>`)}
        ${field('Valor',`<input value="${money(row.value)}" disabled>`)}
        ${field('Motivo do cancelamento',`
          <select id="nfse_cancel_reason">
            <option value="1">1 - Erro na emissão</option>
            <option value="2">2 - Serviço não prestado</option>
            <option value="4">4 - Duplicidade da nota</option>
          </select>
        `)}
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px">
        <button class="btn" onclick="closeModal()">Voltar</button>
        <button id="nfse_cancel_confirm_btn" class="btn danger" onclick="confirmCancelNfse(${Number(row.id)})">Cancelar NFS-e na GISS</button>
      </div>
    `);
  };

  window.confirmCancelNfse=async function(id){
    const row=(nfse||[]).find(x=>Number(x.id)===Number(id));
    if(!row||row.status!=='emitida_nfse'||!row.nfseNumber)return;
    const codigo=String(document.getElementById('nfse_cancel_reason')?.value||'');
    if(!['1','2','4'].includes(codigo))return alert('Selecione um motivo válido.');

    if(!confirm(`CONFIRMAR CANCELAMENTO DA NFS-e ${row.nfseNumber}?\n\nCliente: ${row.client||''}\nValor: ${money(row.value)}\n\nA solicitação será enviada agora para a GISS.`))return;

    const btn=document.getElementById('nfse_cancel_confirm_btn');
    const old=btn?.textContent||'Cancelar NFS-e na GISS';
    try{
      if(btn){btn.disabled=true;btn.textContent='Cancelando...';}
      const response=await fetch('/api/nfse/cancelar',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({numero:String(row.nfseNumber),codigo})
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data?.error||data?.details||'A GISS não confirmou o cancelamento.');

      const cancel=data?.cancelamento||(Array.isArray(data?.cancelamentos)?data.cancelamentos[0]:null)||{};
      row.status='cancelada_nfse';
      row.cancelDate=cancel.dataCancelamento||new Date().toISOString();
      row.cancelCode=cancel.codigoCancelamento||codigo;
      row.gissResponse=data;
      row.lastError='';
      saveData('nfse',nfse);
      closeModal();
      renderAll();
      alert(`NFS-e ${row.nfseNumber} CANCELADA na GISS ✅`);
    }catch(e){
      alert('Erro ao cancelar NFS-e na GISS:\n'+(e?.message||e));
    }finally{
      if(btn){btn.disabled=false;btn.textContent=old;}
    }
  };

  function injectCancelButtons(){
    document.querySelectorAll('#view-nfse tbody tr[data-id]').forEach(tr=>{
      const row=(nfse||[]).find(x=>Number(x.id)===Number(tr.dataset.id));
      if(!row)return;
      const actions=tr.querySelector('.actions');
      if(!actions)return;
      actions.querySelector('.br-cancel-nfse')?.remove();
      if(row.status!=='emitida_nfse'||!row.nfseNumber)return;
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='btn small danger br-cancel-nfse';
      btn.textContent='Cancelar NF';
      btn.onclick=()=>window.openCancelNfse(row.id);
      actions.appendChild(btn);
    });
  }

  const oldRender=window.renderNfse;
  if(typeof oldRender==='function'){
    window.renderNfse=function(){
      const out=oldRender.apply(this,arguments);
      setTimeout(injectCancelButtons,0);
      return out;
    };
  }
  setTimeout(injectCancelButtons,200);
})();