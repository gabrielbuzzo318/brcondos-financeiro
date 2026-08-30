(function(){
  const collator=new Intl.Collator('pt-BR',{sensitivity:'base',numeric:true});

  function optionsFor(type){
    try{
      return (Array.isArray(chartAccounts)?chartAccounts:[])
        .filter(x=>!type||x.type===type)
        .slice()
        .sort((a,b)=>collator.compare(String(a?.name||''),String(b?.name||'')));
    }catch(_){return[];}
  }

  function ensureStyle(){
    if(document.getElementById('br-flux-cat-input-style'))return;
    const s=document.createElement('style');
    s.id='br-flux-cat-input-style';
    s.textContent=`
      #m_cat{width:100%}
      .br-flux-cat-hint{margin-top:4px;font-size:10px;color:#83909a}
    `;
    document.head.appendChild(s);
  }

  function enhanceCategory(transactionId=null){
    ensureStyle();
    const old=document.getElementById('m_cat');
    const type=document.getElementById('m_type')?.value||'';
    if(!old)return;

    let current='';
    if(transactionId!=null){
      try{current=(transactions||[]).find(x=>String(x.id)===String(transactionId))?.category||'';}catch(_){ }
    }
    if(!current)current=String(old.value||'');

    let list=document.getElementById('m_cat_list');
    if(!list){
      list=document.createElement('datalist');
      list.id='m_cat_list';
      document.body.appendChild(list);
    }
    list.innerHTML=optionsFor(type).map(x=>`<option value="${String(x.name||'').replace(/"/g,'&quot;')}"></option>`).join('');

    if(old.tagName==='INPUT'){
      old.setAttribute('list','m_cat_list');
      if(current)old.value=current;
      return;
    }

    const input=document.createElement('input');
    input.id='m_cat';
    input.setAttribute('list','m_cat_list');
    input.value=current;
    input.placeholder='Digite ou selecione uma conta';
    input.autocomplete='off';
    input.className=old.className||'';
    input.style.cssText=old.style.cssText||'';
    old.replaceWith(input);

    const holder=input.parentElement;
    if(holder&&!holder.querySelector('.br-flux-cat-hint')){
      const hint=document.createElement('div');
      hint.className='br-flux-cat-hint';
      hint.textContent='Você pode selecionar uma conta existente ou digitar outra.';
      holder.appendChild(hint);
    }
  }

  const originalOpen=window.openTransaction;
  if(typeof originalOpen==='function'){
    window.openTransaction=function(id){
      const out=originalOpen.apply(this,arguments);
      setTimeout(()=>enhanceCategory(id),0);
      return out;
    };
  }

  window.refreshTransactionAccountOptions=function(){
    const type=document.getElementById('m_type')?.value||'';
    const input=document.getElementById('m_cat');
    const current=String(input?.value||'');
    let list=document.getElementById('m_cat_list');
    if(!list){list=document.createElement('datalist');list.id='m_cat_list';document.body.appendChild(list);}
    list.innerHTML=optionsFor(type).map(x=>`<option value="${String(x.name||'').replace(/"/g,'&quot;')}"></option>`).join('');
    if(input&&current)input.value=current;
  };
})();