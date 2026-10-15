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
      if(p){
        let changed=false;
        if(String(p.category||'')!==String(obj.category||'')){
          p.category=obj.category;
          changed=true;
        }
        if(obj.date!==String(old?.date||'') && obj.date!==String(p.paymentDate||p.paidDate||p.due||'')){
          p.paymentDate=obj.date;
          if(p.paidDate!=null && p.paidDate!=='')p.paidDate=obj.date;
          changed=true;
        }
        if(changed){
          try{saveData('payables',payables);}catch(e){console.error('BRCONDOS FLUXO -> A PAGAR:',e);return alert('Falha ao sincronizar conta a pagar.');}
        }
      }
    }

    // Recebimentos bancários também possuem uma data de crédito no boleto.
    // Sem sincronizar esta origem, a consulta Sicredi pode desfazer a edição.
    if(id!=null && old && obj.date!==String(old.date||'') &&
       typeof boletos!=='undefined' && Array.isArray(boletos)){
      const boletoId=old.sourceBoletoId??old.boletoId;
      const doc=String(old.description||'').match(/Recebimento de boleto\\s+(FAT-\\S+)/i)?.[1]||'';
      const boleto=boletos.find(b=>
        (boletoId!=null&&String(b.id)===String(boletoId)) ||
        (b.flowId!=null&&String(b.flowId)===String(id)) ||
        (doc&&String(b.docNumber||'')===doc)
      );
      if(boleto){
        boleto.cashFlowDate=obj.date;
        try{saveData('boletos',boletos);}
        catch(e){console.error('BRCONDOS FLUXO -> BOLETOS:',e);return alert('Falha ao atualizar data do boleto.');}
      }
    }

    saveData('transactions',transactions);
    closeModal();
    renderAll();
  };
})();