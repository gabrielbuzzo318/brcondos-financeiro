(function(){
  function num(v){const n=Number(v||0);return Number.isFinite(n)?n:0;}
  function same(a,b){return Math.abs(num(a)-num(b))<0.005;}

  function reconcilePaidPayables(){
    if(typeof payables==='undefined'||!Array.isArray(payables)||typeof transactions==='undefined'||!Array.isArray(transactions))return false;
    let flowChanged=false;
    let payableChanged=false;

    payables.forEach(p=>{
      if(!p||p.status!=='pago')return;
      const pid=String(p.id||'');
      let t=null;
      if(p.flowId!==undefined&&p.flowId!==null&&String(p.flowId)!==''){
        t=transactions.find(x=>String(x?.id||'')===String(p.flowId));
      }
      if(!t){
        t=transactions.find(x=>String(x?.sourcePayableId||x?.payableId||'')===pid);
      }
      if(!t)return;

      const fine=Math.max(0,num(p.paymentFine));
      const interest=Math.max(0,num(p.paymentInterest));
      const base=num(p.value);
      const total=base+fine+interest;
      const desired={
        type:'saida',
        date:p.paymentDate||t.date||p.due||'',
        description:p.description||t.description||'Conta a pagar',
        category:p.category||t.category||'Contas a pagar',
        party:p.supplier||t.party||'',
        value:total,
        baseValue:base,
        fine,
        interest,
        status:'pago',
        sourceType:'payable',
        sourcePayableId:p.id
      };

      const textKeys=['type','date','description','category','party','status','sourceType'];
      textKeys.forEach(k=>{
        if(String(t[k]??'')!==String(desired[k]??'')){t[k]=desired[k];flowChanged=true;}
      });
      ['value','baseValue','fine','interest'].forEach(k=>{
        if(!same(t[k],desired[k])){t[k]=desired[k];flowChanged=true;}
      });
      if(String(t.sourcePayableId??'')!==String(p.id)){t.sourcePayableId=p.id;flowChanged=true;}

      if(String(p.flowId??'')!==String(t.id)){p.flowId=t.id;payableChanged=true;}
      if(!same(p.paidTotal,total)){p.paidTotal=total;payableChanged=true;}
    });

    if(flowChanged){try{saveData('transactions',transactions);}catch(e){console.error('SYNC PAGOS FLUXO',e);}}
    if(payableChanged){try{saveData('payables',payables);}catch(e){console.error('SYNC PAGOS A PAGAR',e);}}
    return flowChanged||payableChanged;
  }

  window.brReconcilePaidPayables=reconcilePaidPayables;

  const prevRenderAll=window.renderAll;
  if(typeof prevRenderAll==='function'){
    window.renderAll=function(){
      reconcilePaidPayables();
      return prevRenderAll.apply(this,arguments);
    };
  }

  const prevShowView=window.showView;
  if(typeof prevShowView==='function'){
    window.showView=function(view,button){
      if(view==='fluxo'||view==='dre'||view==='financeiro')reconcilePaidPayables();
      return prevShowView.apply(this,arguments);
    };
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{reconcilePaidPayables();try{renderAll();}catch(_){ }},900),{once:true});
  }else{
    setTimeout(()=>{reconcilePaidPayables();try{renderAll();}catch(_){ }},900);
  }
})();
