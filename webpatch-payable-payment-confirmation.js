(function(){
  function findPayable(id){
    try{return Array.isArray(payables)?payables.find(p=>String(p?.id)===String(id)):null;}catch(_){return null;}
  }

  const prevConfirm=window.confirmPayablePaid;
  if(typeof prevConfirm==='function'){
    window.confirmPayablePaid=function(id){
      const p=findPayable(id);
      if(p) p.paymentConfirmedAt=new Date().toISOString();
      return prevConfirm.apply(this,arguments);
    };
  }

  const prevReverse=window.reversePayablePayment;
  if(typeof prevReverse==='function'){
    window.reversePayablePayment=function(id){
      const result=prevReverse.apply(this,arguments);
      const p=findPayable(id);
      if(p&&p.status!=='pago'&&p.paymentConfirmedAt){
        delete p.paymentConfirmedAt;
        try{saveData('payables',payables);}catch(_){ }
      }
      return result;
    };
  }

  const prevOpen=window.openPayable;
  if(typeof prevOpen==='function'){
    window.openPayable=function(id){
      const result=prevOpen.apply(this,arguments);
      try{
        const p=id!=null?findPayable(id):null;
        if(!p||p.status!=='pago'){
          const sel=document.getElementById('ap_status');
          const opt=sel?.querySelector('option[value="pago"]');
          if(opt)opt.remove();
        }
      }catch(_){ }
      return result;
    };
  }
})();
