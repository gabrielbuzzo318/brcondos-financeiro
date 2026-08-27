(function(){
  function brNumber(id){
    return parseMoneyBR(document.getElementById(id)?.value||'0');
  }

  function brTotal(baseId,fineId,interestId){
    return brNumber(baseId)+brNumber(fineId)+brNumber(interestId);
  }

  window.brUpdateTransactionTotal=function(){
    const el=document.getElementById('m_total');
    if(el)el.value=money(brTotal('m_value','m_fine','m_interest'));
  };

  window.brUpdatePayableTotal=function(){
    const el=document.getElementById('payable_total');
    if(el)el.value=money(brTotal('payable_base_value','payable_fine','payable_interest'));
  };

  window.openTransaction=function(id=null){
    const x=id?transactions.find(t=>t.id===id):{
      date:today(),type:'saida',description:'',category:'',party:'',value:'',status:'aberto',baseValue:'',fine:0,interest:0
    };
    if(!x)return;
    const baseValue=x.baseValue!==undefined&&x.baseValue!==null&&x.baseValue!==''?Number(x.baseValue):Number(x.value||0);
    const fine=Number(x.fine||0);
    const interest=Number(x.interest||0);
    const total=baseValue+fine+interest;

    openModal('Lançamento financeiro',`
      <div class="modal-grid">
        ${field('Data',`<input id="m_date" type="date" value="${x.date}">`)}
        ${field('Tipo',`<select id="m_type" onchange="refreshTransactionAccountOptions()"><option value="entrada" ${x.type==='entrada'?'selected':''}>Entrada</option><option value="saida" ${x.type==='saida'?'selected':''}>Saída</option></select>`)}
        ${field('Descrição',`<input id="m_desc" value="${esc(x.description||'')}">`)}
        ${field('Plano de contas',`<div style="display:flex;gap:7px"><select id="m_cat" style="flex:1">${accountOptions(x.type,x.category||'')}</select><button class="btn" type="button" onclick="quickCreateAccount(document.getElementById('m_type').value,'m_cat')">+</button></div>`)}
        ${field('Cliente / Fornecedor',`<input id="m_party" value="${esc(x.party||'')}">`)}
        ${field('Valor',`<input id="m_value" type="text" inputmode="decimal" autocomplete="off" value="${moneyInputBR(baseValue)}" placeholder="0,00" oninput="brUpdateTransactionTotal()">`)}
        ${field('Multa',`<input id="m_fine" type="text" inputmode="decimal" autocomplete="off" value="${moneyInputBR(fine)}" placeholder="0,00" oninput="brUpdateTransactionTotal()">`)}
        ${field('Juros',`<input id="m_interest" type="text" inputmode="decimal" autocomplete="off" value="${moneyInputBR(interest)}" placeholder="0,00" oninput="brUpdateTransactionTotal()">`)}
        ${field('Valor total',`<input id="m_total" value="${money(total)}" disabled style="font-weight:800">`)}
        ${field('Status',`<select id="m_status"><option value="pago" ${x.status==='pago'?'selected':''}>Pago</option><option value="agendado" ${x.status==='agendado'?'selected':''}>Agendado</option><option value="aberto" ${x.status==='aberto'?'selected':''}>A pagar</option><option value="vencido" ${x.status==='vencido'?'selected':''}>Vencido</option></select>`)}
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="saveTransaction(${id||'null'})">Salvar</button></div>`);
  };

  window.saveTransaction=function(id){
    const baseValue=brNumber('m_value');
    const fine=brNumber('m_fine');
    const interest=brNumber('m_interest');
    const total=baseValue+fine+interest;
    const obj={
      id:id||Date.now(),
      date:val('m_date'),
      type:val('m_type'),
      description:val('m_desc'),
      category:val('m_cat'),
      party:val('m_party'),
      baseValue,
      fine,
      interest,
      value:total,
      status:val('m_status')
    };
    if(!obj.date||!obj.description||!baseValue)return alert('Preencha data, descrição e valor.');
    if(id)transactions=transactions.map(x=>x.id===id?obj:x);else transactions.push(obj);
    saveData('transactions',transactions);closeModal();renderAll();
  };

  window.markPayablePaid=function(id){
    const p=payables.find(x=>x.id===id);
    if(!p)return;
    const fine=Number(p.paymentFine||0);
    const interest=Number(p.paymentInterest||0);
    const total=Number(p.value||0)+fine+interest;
    openModal('Dar baixa na conta',`
      <div class="modal-grid">
        ${field('Conta',`<input value="${esc(p.description)}" disabled>`)}
        ${field('Fornecedor',`<input value="${esc(p.supplier||'-')}" disabled>`)}
        ${field('Valor',`<input id="payable_base_value" value="${moneyInputBR(p.value)}" disabled>`)}
        ${field('Data da baixa / pagamento',`<input id="payable_payment_date" type="date" value="${p.paymentDate||today()}">`)}
        ${field('Multa',`<input id="payable_fine" type="text" inputmode="decimal" autocomplete="off" value="${moneyInputBR(fine)}" placeholder="0,00" oninput="brUpdatePayableTotal()">`)}
        ${field('Juros',`<input id="payable_interest" type="text" inputmode="decimal" autocomplete="off" value="${moneyInputBR(interest)}" placeholder="0,00" oninput="brUpdatePayableTotal()">`)}
        ${field('Valor total',`<input id="payable_total" value="${money(total)}" disabled style="font-weight:800">`)}
      </div>
      <div class="notice" style="margin-top:14px">O valor total pago será lançado no Fluxo de Caixa: <b>valor + multa + juros</b>.</div>
      <div style="display:flex;justify-content:flex-end;gap:8px">
        <button class="btn" onclick="closeModal()">Cancelar</button>
        <button class="btn primary" onclick="confirmPayablePaid(${id})">Confirmar baixa</button>
      </div>`);
  };

  window.confirmPayablePaid=function(id){
    const d=val('payable_payment_date');
    if(!d)return alert('Informe a data da baixa.');
    const fine=brNumber('payable_fine');
    const interest=brNumber('payable_interest');
    const p=payables.find(x=>x.id===id);
    if(!p)return;
    const paidTotal=Number(p.value||0)+fine+interest;
    payables=payables.map(x=>x.id===id?{
      ...x,
      status:'pago',
      paymentDate:d,
      paymentFine:fine,
      paymentInterest:interest,
      paidTotal
    }:x);
    saveData('payables',payables);
    syncPayableToFlow(id);
    closeModal();
    renderAll();
  };

  window.syncPayableToFlow=function(id){
    const p=payables.find(x=>x.id===id);
    if(!p || p.flowId)return;
    const baseValue=Number(p.value||0);
    const fine=Number(p.paymentFine||0);
    const interest=Number(p.paymentInterest||0);
    const total=Number(p.paidTotal||baseValue+fine+interest);
    const flowId=Date.now()+1;
    transactions.push({
      id:flowId,
      date:p.paymentDate||today(),
      type:'saida',
      description:p.description,
      category:p.category||'Contas a pagar',
      party:p.supplier||'',
      baseValue,
      fine,
      interest,
      value:total,
      status:'pago'
    });
    payables=payables.map(x=>x.id===id?{...x,flowId}:x);
    saveData('transactions',transactions);
    saveData('payables',payables);
  };

  window.reversePayablePayment=function(id){
    const p=payables.find(x=>x.id===id);
    if(!p)return;
    if(!confirm('Estornar a baixa desta conta? Ela voltará para A pagar e a saída correspondente será removida do Fluxo de Caixa.'))return;
    if(p.flowId){
      transactions=transactions.filter(t=>t.id!==p.flowId);
      saveData('transactions',transactions);
    }
    payables=payables.map(x=>x.id===id?{
      ...x,
      status:'aberto',
      paymentDate:'',
      paymentFine:0,
      paymentInterest:0,
      paidTotal:null,
      flowId:null
    }:x);
    saveData('payables',payables);
    renderAll();
  };
})();
