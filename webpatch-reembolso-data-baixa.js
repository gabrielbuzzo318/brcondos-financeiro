(function(){
  function escHtml(v){
    return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }

  window.receiveReimbursement=function(id){
    const r=reimbursements.find(x=>Number(x.id)===Number(id));
    if(!r)return;

    openModal('Dar baixa no reembolso',`
      <div class="modal-grid">
        ${field('Descrição',`<input value="${escHtml(r.description||'')}" disabled>`)}
        ${field('Reembolsado por',`<input value="${escHtml(r.reimbursedBy||'-')}" disabled>`)}
        ${field('Valor',`<input value="${money(r.value)}" disabled>`)}
        ${field('Data da baixa / recebimento',`<input id="rb_received_date" type="date" value="${r.receivedDate||today()}">`)}
      </div>
      <div class="notice" style="margin-top:14px">A data escolhida será gravada no reembolso e será a data da entrada no Fluxo de Caixa.</div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px">
        <button class="btn" onclick="closeModal()">Cancelar</button>
        <button class="btn primary" onclick="confirmReimbursementReceived(${Number(id)})">Confirmar baixa</button>
      </div>`);
  };

  window.confirmReimbursementReceived=function(id){
    const d=val('rb_received_date');
    if(!d)return alert('Informe a data da baixa / recebimento.');

    let r=reimbursements.find(x=>Number(x.id)===Number(id));
    if(!r)return;

    reimbursements=reimbursements.map(x=>Number(x.id)===Number(id)?{
      ...x,
      status:'recebido',
      receivedDate:d
    }:x);
    saveData('reimbursements',reimbursements);

    r=reimbursements.find(x=>Number(x.id)===Number(id));
    if(r?.flowId && transactions.some(t=>Number(t.id)===Number(r.flowId))){
      transactions=transactions.map(t=>Number(t.id)===Number(r.flowId)?{
        ...t,
        date:d,
        type:'entrada',
        status:'pago',
        description:`Reembolso recebido - ${r.description}`,
        category:r.category||'Reembolsos',
        party:r.reimbursedBy||'',
        value:Number(r.value||0)
      }:t);
      saveData('transactions',transactions);
    }else{
      syncReimbursementToFlow(id);
    }

    closeModal();
    renderAll();
  };

  const oldRender=window.renderReimbursements;
  if(typeof oldRender==='function'){
    window.renderReimbursements=function(){
      oldRender.apply(this,arguments);
      const rows=document.querySelectorAll('#view-reembolsos tbody tr');
      rows.forEach(tr=>{
        const editBtn=[...tr.querySelectorAll('button')].find(b=>String(b.getAttribute('onclick')||'').includes('openReimbursement('));
        if(!editBtn)return;
        const m=String(editBtn.getAttribute('onclick')||'').match(/openReimbursement\((\d+)\)/);
        if(!m)return;
        const id=Number(m[1]);
        const r=reimbursements.find(x=>Number(x.id)===id);
        if(!r||r.status!=='recebido')return;

        const cells=tr.querySelectorAll('td');
        const statusCell=cells[5];
        if(statusCell && !statusCell.querySelector('.br-reembolso-baixa-data')){
          const info=document.createElement('div');
          info.className='subtle br-reembolso-baixa-data';
          info.style.marginTop='4px';
          info.textContent=r.receivedDate?`Baixa: ${formatDate(r.receivedDate)}`:'Baixa sem data informada';
          statusCell.appendChild(info);
        }

        const actions=tr.querySelector('.actions');
        if(actions && !actions.querySelector('.br-ajustar-baixa')){
          const btn=document.createElement('button');
          btn.type='button';
          btn.className='btn small br-ajustar-baixa';
          btn.textContent='Data da baixa';
          btn.onclick=()=>window.receiveReimbursement(id);
          actions.insertBefore(btn,actions.firstChild);
        }
      });
    };
  }
})();
