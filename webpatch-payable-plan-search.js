(function(){
  const collator=new Intl.Collator('pt-BR',{sensitivity:'base',numeric:true});

  function accounts(){
    try{
      return (Array.isArray(chartAccounts)?chartAccounts:[])
        .filter(a=>a?.type==='saida')
        .slice()
        .sort((a,b)=>collator.compare(String(a?.name||''),String(b?.name||'')));
    }catch(_){return[];}
  }

  function ensureStyle(){
    if(document.getElementById('br-payable-plan-search-style'))return;
    const s=document.createElement('style');
    s.id='br-payable-plan-search-style';
    s.textContent=`#ap_cat{width:100%;min-width:0}`;
    document.head.appendChild(s);
  }

  function refreshList(){
    let list=document.getElementById('br_ap_cat_list');
    if(!list){
      list=document.createElement('datalist');
      list.id='br_ap_cat_list';
      document.body.appendChild(list);
    }
    list.innerHTML=accounts().map(a=>{
      const name=String(a?.name||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
      const group=String(a?.group||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
      return `<option value="${name}"${group?` label="${group}"`:''}></option>`;
    }).join('');
    return list;
  }

  function enhance(id){
    ensureStyle();
    const old=document.getElementById('ap_cat');
    if(!old)return;

    let current=String(old.value||'');
    if(id!=null){
      try{current=(payables||[]).find(p=>String(p.id)===String(id))?.category||current;}catch(_){ }
    }
    refreshList();

    if(old.tagName==='INPUT'){
      old.setAttribute('list','br_ap_cat_list');
      old.placeholder='Digite para pesquisar uma conta';
      old.autocomplete='off';
      if(current)old.value=current;
      return;
    }

    const input=document.createElement('input');
    input.id='ap_cat';
    input.setAttribute('list','br_ap_cat_list');
    input.placeholder='Digite para pesquisar uma conta';
    input.autocomplete='off';
    input.value=current;
    input.className=old.className||'';
    input.style.cssText=old.style.cssText||'';
    old.replaceWith(input);
  }

  window.refreshPayableAccountOptions=function(){
    refreshList();
    const input=document.getElementById('ap_cat');
    if(input)input.setAttribute('list','br_ap_cat_list');
  };

  const previousOpen=window.openPayable;
  if(typeof previousOpen==='function'){
    window.openPayable=function(id){
      const out=previousOpen.apply(this,arguments);
      setTimeout(()=>enhance(id),0);
      return out;
    };
  }
})();
