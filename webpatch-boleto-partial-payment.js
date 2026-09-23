(function(){
  const EPS=0.005;
  const n=v=>{const x=Number(v||0);return Number.isFinite(x)?x:0;};
  const br=v=>n(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const input=v=>n(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});

  function alreadyReceived(b){
    if(Number.isFinite(Number(b?.receivedAmount)))return Math.max(0,n(b.receivedAmount));
    if(b?.status==='recebido')return n(b.value);
    const hist=Array.isArray(b?.partialPaymentHistory)?b.partialPaymentHistory:[];
    return hist.reduce((s,x)=>s+n(x.received),0);
  }

  function remaining(b){
    return Math.max(0,n(b?.value)-alreadyReceived(b));
  }

  function nextTxId(){
    let id=Date.now()+37;
    while((transactions||[]).some(t=>Number(t.id)===Number(id)))id++;
    return id;
  }

  function paymentHistoryHtml(b){
    const hist=Array.isArray(b?.partialPaymentHistory)?b.partialPaymentHistory:[];
    if(!hist.length)return '';
    return `
      <div class="card" style="box-shadow:none;margin-top:14px">
        <div class="panel-title">Histórico de recebimentos</div>
        ${hist.slice().reverse().map(x=>`
          <div class="subtle" style="margin:6px 0">
            <b>${typeof formatDate==='function'?formatDate(x.date):x.date}</b> • recebido ${br(x.received)} • saldo ${br(x.remaining)}
          </div>
        `).join('')}
      </div>`;
  }

  window.updatePartialBoletoPreview=function(id){
    const b=(boletos||[]).find(x=>Number(x.id)===Number(id));
    if(!b)return;
    const value=typeof parseMoneyBR==='function'?parseMoneyBR(document.getElementById('boleto_received_value')?.value||''):0;
    const rem=Math.max(0,remaining(b)-Math.max(0,n(value)));
    const el=document.getElementById('boleto_partial_balance_after');
    if(el)el.value=br(rem);
  };

  window.payBoleto=function(id){
    const b=(boletos||[]).find(x=>Number(x.id)===Number(id));
    if(!b)return;
    const total=n(b.value);
    const received=alreadyReceived(b);
    const open=remaining(b);

    if(open<=EPS)return alert('Este boleto já está totalmente recebido.');

    openModal('Baixa do boleto',`
      <div class="modal-grid">
        ${field('Cliente',`<input value="${esc(b.client||'')}" disabled>`)}
        ${field('Boleto',`<input value="${esc(b.docNumber||'')}" disabled>`)}
        ${field('Valor original',`<input value="${br(total)}" disabled>`)}
        ${field('Já recebido',`<input value="${br(received)}" disabled>`)}
        ${field('Saldo em aberto',`<input value="${br(open)}" disabled>`)}
        ${field('Valor recebido agora',`<input id="boleto_received_value" type="text" inputmode="decimal" value="${input(open)}" oninput="updatePartialBoletoPreview(${Number(b.id)})">`)}
        ${field('Saldo após esta baixa',`<input id="boleto_partial_balance_after" value="${br(0)}" disabled>`)}
        ${field('Data da baixa / recebimento',`<input id="boleto_receipt_date" type="date" value="${b.receiptDate||today()}">`)}
      </div>
      <div class="notice" style="margin-top:14px">
        Se o valor recebido for menor que o saldo, o boleto ficará como <b>Recebido parcial</b>.
        Somente o valor efetivamente recebido entra no Fluxo de Caixa e a diferença vai para <b>Inadimplências</b>.
      </div>
      ${paymentHistoryHtml(b)}
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px">
        <button class="btn" onclick="closeModal()">Cancelar</button>
        <button class="btn green" onclick="confirmBoletoReceived(${Number(b.id)})">Confirmar recebimento</button>
      </div>`);
    setTimeout(()=>window.updatePartialBoletoPreview(Number(b.id)),0);
  };

  window.confirmBoletoReceived=function(id){
    const b=(boletos||[]).find(x=>Number(x.id)===Number(id));
    if(!b)return;

    const d=String(document.getElementById('boleto_receipt_date')?.value||'').trim();
    const raw=String(document.getElementById('boleto_received_value')?.value||'').trim();
    const amount=typeof parseMoneyBR==='function'?parseMoneyBR(raw):Number(raw.replace(/\./g,'').replace(',','.'));
    const before=remaining(b);

    if(!d)return alert('Informe a data da baixa.');
    if(!(amount>0))return alert('Informe um valor recebido maior que zero.');
    if(amount>before+EPS)return alert('O valor recebido não pode ser maior que o saldo em aberto.');

    const paidBefore=alreadyReceived(b);
    const paidNow=Math.min(amount,before);
    const cumulative=Math.min(n(b.value),paidBefore+paidNow);
    const rem=Math.max(0,n(b.value)-cumulative);
    const paymentId=Date.now();

    const txId=nextTxId();
    transactions.push({
      id:txId,
      date:d,
      type:'entrada',
      description:`${rem>EPS?'Recebimento parcial de boleto':'Recebimento de boleto'}${b.docNumber?' '+b.docNumber:''}`,
      category:'Receitas de serviços',
      party:b.client||'',
      value:paidNow,
      status:'pago',
      sourceType:'boleto',
      sourceBoletoId:b.id,
      partialPayment:rem>EPS||paidBefore>0,
      partialPaymentId:paymentId
    });

    const hist=Array.isArray(b.partialPaymentHistory)?b.partialPaymentHistory.slice():[];
    hist.push({
      id:paymentId,
      date:d,
      originalValue:n(b.value),
      received:paidNow,
      receivedCumulative:cumulative,
      remaining:rem,
      transactionId:txId
    });

    b.receivedAmount=cumulative;
    b.remainingBalance=rem;
    b.receiptDate=d;
    b.partialPaymentHistory=hist;
    b.partialFlowIds=[...(Array.isArray(b.partialFlowIds)?b.partialFlowIds:[]),txId];

    if(rem>EPS){
      b.status='recebido_parcial';
      b.flowId=null;
    }else{
      b.status='recebido';
      b.remainingBalance=0;
      if(paidBefore<=EPS)b.flowId=txId;
    }

    if(typeof window.brUpsertPartialBoletoDelinquency==='function'){
      window.brUpsertPartialBoletoDelinquency(b,{
        remaining:rem,
        received:paidNow,
        cumulative,
        date:d,
        history:hist
      });
    }

    if(typeof saveData==='function'){
      saveData('transactions',transactions);
      saveData('boletos',boletos);
    }
    closeModal();
    if(typeof renderAll==='function')renderAll();

    if(rem>EPS){
      alert(
        'Recebimento parcial registrado ✅\n\n'+
        'Recebido: '+br(paidNow)+'\n'+
        'Saldo remanescente: '+br(rem)+'\n\n'+
        'A diferença foi enviada para Inadimplências.'
      );
    }else{
      alert('Boleto recebido integralmente ✅\n\nValor recebido: '+br(paidNow));
    }
  };

  function ensurePartialAction(){
    document.querySelectorAll('#view-boletos tbody tr[data-id]').forEach(tr=>{
      const b=(boletos||[]).find(x=>Number(x.id)===Number(tr.dataset.id));
      if(!b||b.status!=='recebido_parcial')return;
      const actions=tr.querySelector('.actions');
      if(!actions)return;
      let btn=[...actions.querySelectorAll('button')].find(x=>String(x.getAttribute('onclick')||'').includes('payBoleto('));
      if(btn){
        btn.textContent='Receber restante';
        return;
      }
      btn=document.createElement('button');
      btn.className='btn small green';
      btn.textContent='Receber restante';
      btn.onclick=()=>window.payBoleto(b.id);
      const danger=actions.querySelector('.danger');
      danger?actions.insertBefore(btn,danger):actions.appendChild(btn);
    });
  }

  const oldRender=window.renderBoletos;
  if(typeof oldRender==='function'){
    window.renderBoletos=function(){
      const out=oldRender.apply(this,arguments);
      setTimeout(ensurePartialAction,0);
      return out;
    };
  }
  setTimeout(ensurePartialAction,100);
})();