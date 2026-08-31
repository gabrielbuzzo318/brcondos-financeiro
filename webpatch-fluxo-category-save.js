(function(){
  function getValue(id){
    const el=document.getElementById(id);
    return el?String(el.value??'').trim():'';
  }
  function parseAmount(v){
    try{return typeof parseMoneyBR==='function'?parseMoneyBR(v):Number(v||0);}catch(_){return Number(v||0);}
  }
  function linkedPayable(transactionId,old){
    if(typeof payables==='undefined'||!Array.isArray(payables))return null;
    const sourceId=old?.sourcePayableId??old?.payableId??null;
    return payables.find(p=>
      (sourceId!=null&&String(p?.id)===String(sourceId)) ||
      (p?.flowId!=null&&String(p.flowId)===String(transactionId))
    )||null;
  }

  window.saveTransaction=function(id){
    const old=id!=null&&typeof transactions!=='undefined'&&Array.isArray(transactions)
      ?transactions.find(t=>String(t?.id)===String(id))
      :null;

    const obj={
      ...(old||{}),
      id:id||Date.now(),
      date:getValue('m_date'),
      type:getValue('m_type'),
      description:getValue('m_desc'),
      category:getValue('m_cat'),
      party:getValue('m_party'),
      value:parseAmount(getValue('m_value')),
      status:getValue('m_status')
    };

    if(!obj.date||!obj.description||!obj.value){
      return alert('Preencha data, descrição e valor.');
    }

    if(id!=null){
      transactions=transactions.map(x=>String(x?.id)===String(id)?obj:x);
    }else{
      transactions.push(obj);
    }

    // Se o lançamento veio de uma conta a pagar, atualiza também a origem.
    // Assim a rotina de conciliação não devolve a categoria antiga depois do render.
    if(id!=null){
      const p=linkedPayable(id,old);
      if(p&&String(p.category||'')!==String(obj.category||'')){
        p.category=obj.category;
        try{saveData('payables',payables);}catch(e){console.error('BRCONDOS FLUXO CATEGORIA -> A PAGAR:',e);}
      }
    }

    saveData('transactions',transactions);
    closeModal();
    renderAll();
  };
})();