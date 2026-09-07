(function(){
  function num(v){const n=Number(v||0);return Number.isFinite(n)?n:0;}
  function same(a,b){return Math.abs(num(a)-num(b))<0.005;}
  function norm(v){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}

  function uniqueId(used,seed){
    let id=Math.max(Number(seed||Date.now()),Date.now());
    while(used.has(String(id)))id++;
    used.add(String(id));
    return id;
  }

  function payableTotal(p){
    const base=num(p?.value);
    const fine=Math.max(0,num(p?.paymentFine));
    const interest=Math.max(0,num(p?.paymentInterest));
    return {base,fine,interest,total:base+fine+interest};
  }

  function transactionMatchesPayable(t,p){
    if(!t||!p)return false;
    const {total}=payableTotal(p);
    const pDate=String(p.paymentDate||p.paidDate||p.due||'');
    const tDate=String(t.date||'');
    if(norm(t.party)!==norm(p.supplier))return false;
    if(pDate&&tDate&&pDate!==tDate)return false;
    if(!same(t.value,total))return false;
    return true;
  }

  function reconcilePaidPayables(){
    if(typeof payables==='undefined'||!Array.isArray(payables)||typeof transactions==='undefined'||!Array.isArray(transactions))return false;

    let flowChanged=false;
    let payableChanged=false;

    // IDs repetidos fazem uma baixa apontar para outra conta. Mantém a primeira
    // ocorrência e renumera apenas as duplicadas, preservando os demais dados.
    const usedPayableIds=new Set();
    payables.forEach(p=>{
      if(!p)return;
      let id=String(p.id??'');
      if(!id||usedPayableIds.has(id)){
        p.id=uniqueId(usedPayableIds,Date.now()+1000);
        payableChanged=true;
      }else{
        usedPayableIds.add(id);
      }
    });

    const usedTransactionIds=new Set(transactions.map(t=>String(t?.id??'')).filter(Boolean));
    const claimedTransactionIds=new Set();

    payables.forEach(p=>{
      if(!p||p.status!=='pago')return;

      const pid=String(p.id||'');
      const {base,fine,interest,total}=payableTotal(p);
      let t=null;

      // 1) Usa o flowId apenas se ele realmente pertencer a esta conta.
      if(p.flowId!==undefined&&p.flowId!==null&&String(p.flowId)!==''){
        const byFlow=transactions.find(x=>String(x?.id||'')===String(p.flowId));
        if(byFlow&&transactionMatchesPayable(byFlow,p)&&!claimedTransactionIds.has(String(byFlow.id)))t=byFlow;
      }

      // 2) Procura vínculo explícito, mas também valida conteúdo/valor/data.
      if(!t){
        t=transactions.find(x=>
          String(x?.sourcePayableId??x?.payableId??'')===pid&&
          transactionMatchesPayable(x,p)&&
          !claimedTransactionIds.has(String(x?.id||''))
        )||null;
      }

      // 3) Recupera lançamento antigo/desvinculado sem criar duplicidade.
      if(!t){
        t=transactions.find(x=>
          transactionMatchesPayable(x,p)&&
          !claimedTransactionIds.has(String(x?.id||''))
        )||null;
      }

      // 4) Se a conta está paga e não existe lançamento compatível, cria a saída.
      if(!t){
        t={
          id:uniqueId(usedTransactionIds,Date.now()+5000),
          type:'saida',
          date:p.paymentDate||p.paidDate||p.due||'',
          description:p.description||'Conta a pagar',
          category:p.category||'Contas a pagar',
          party:p.supplier||'',
          value:total,
          baseValue:base,
          fine,
          interest,
          status:'pago',
          sourceType:'payable',
          sourcePayableId:p.id
        };
        transactions.push(t);
        flowChanged=true;
      }

      claimedTransactionIds.add(String(t.id));

      const desired={
        type:'saida',
        date:p.paymentDate||p.paidDate||t.date||p.due||'',
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

      ['type','date','description','category','party','status','sourceType'].forEach(k=>{
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
