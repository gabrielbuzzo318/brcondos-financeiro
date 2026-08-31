(function(){
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();

  function canonicalName(type,name){
    const n=norm(name);
    if(!n)return String(name||'');
    try{
      const account=(Array.isArray(chartAccounts)?chartAccounts:[]).find(a=>(!type||a?.type===type)&&norm(a?.name)===n);
      return String(account?.name||name||'').trim();
    }catch(_){return String(name||'').trim();}
  }

  function canonicalizeAll(){
    let txChanged=false,payChanged=false,reimChanged=false;

    if(typeof transactions!=='undefined'&&Array.isArray(transactions)){
      transactions=transactions.map(t=>{
        const next=canonicalName(t?.type,t?.category);
        if(next&&next!==String(t?.category||'')){
          txChanged=true;
          return {...t,category:next};
        }
        return t;
      });
    }

    if(typeof payables!=='undefined'&&Array.isArray(payables)){
      payables=payables.map(p=>{
        const next=canonicalName('saida',p?.category);
        if(next&&next!==String(p?.category||'')){
          payChanged=true;
          return {...p,category:next};
        }
        return p;
      });
    }

    if(typeof reimbursements!=='undefined'&&Array.isArray(reimbursements)){
      reimbursements=reimbursements.map(r=>{
        const next=canonicalName('saida',r?.category);
        if(next&&next!==String(r?.category||'')){
          reimChanged=true;
          return {...r,category:next};
        }
        return r;
      });
    }

    try{if(txChanged&&typeof saveData==='function')saveData('transactions',transactions);}catch(e){console.error('DRE canonical transactions',e);}
    try{if(payChanged&&typeof saveData==='function')saveData('payables',payables);}catch(e){console.error('DRE canonical payables',e);}
    try{if(reimChanged&&typeof saveData==='function')saveData('reimbursements',reimbursements);}catch(e){console.error('DRE canonical reimbursements',e);}
    return txChanged||payChanged||reimChanged;
  }

  window.brCanonicalizeFinancialCategories=canonicalizeAll;

  const oldRenderDRE=window.renderDRE;
  if(typeof oldRenderDRE==='function'){
    window.renderDRE=function(){
      canonicalizeAll();
      return oldRenderDRE.apply(this,arguments);
    };
  }

  const oldRenderAll=window.renderAll;
  if(typeof oldRenderAll==='function'){
    window.renderAll=function(){
      canonicalizeAll();
      return oldRenderAll.apply(this,arguments);
    };
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{if(canonicalizeAll()){try{renderAll();}catch(_){}}},450),{once:true});
  }else{
    setTimeout(()=>{if(canonicalizeAll()){try{renderAll();}catch(_){}}},450);
  }
})();