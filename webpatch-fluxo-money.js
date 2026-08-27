(function(){
  window.openTransaction=function(id=null){
    const x=id?transactions.find(t=>t.id===id):{date:today(),type:'saida',description:'',category:'',party:'',value:'',status:'aberto'};
    openModal('Lançamento financeiro',`
      <div class="modal-grid">
        ${field('Data',`<input id="m_date" type="date" value="${x.date}">`)}
        ${field('Tipo',`<select id="m_type" onchange="refreshTransactionAccountOptions()"><option value="entrada" ${x.type==='entrada'?'selected':''}>Entrada</option><option value="saida" ${x.type==='saida'?'selected':''}>Saída</option></select>`)}
        ${field('Descrição',`<input id="m_desc" value="${esc(x.description)}">`)}
        ${field('Plano de contas',`<div style="display:flex;gap:7px"><select id="m_cat" style="flex:1">${accountOptions(x.type,x.category||'')}</select><button class="btn" type="button" onclick="quickCreateAccount(document.getElementById('m_type').value,'m_cat')">+</button></div>`)}
        ${field('Cliente / Fornecedor',`<input id="m_party" value="${esc(x.party||'')}">`)}
        ${field('Valor',`<input id="m_value" type="text" inputmode="decimal" autocomplete="off" value="${moneyInputBR(x.value)}" placeholder="0,00">`)}
        ${field('Status',`<select id="m_status"><option value="pago" ${x.status==='pago'?'selected':''}>Pago</option><option value="agendado" ${x.status==='agendado'?'selected':''}>Agendado</option><option value="aberto" ${x.status==='aberto'?'selected':''}>A pagar</option><option value="vencido" ${x.status==='vencido'?'selected':''}>Vencido</option></select>`)}
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="saveTransaction(${id||'null'})">Salvar</button></div>`);
  };

  window.saveTransaction=function(id){
    const obj={
      id:id||Date.now(),
      date:val('m_date'),
      type:val('m_type'),
      description:val('m_desc'),
      category:val('m_cat'),
      party:val('m_party'),
      value:parseMoneyBR(val('m_value')),
      status:val('m_status')
    };
    if(!obj.date||!obj.description||!obj.value)return alert('Preencha data, descrição e valor.');
    if(id)transactions=transactions.map(x=>x.id===id?obj:x);else transactions.push(obj);
    saveData('transactions',transactions);closeModal();renderAll();
  };
})();
