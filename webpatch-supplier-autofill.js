(function(){
  function normName(v){
    if(typeof looseName==='function')return looseName(v);
    return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  }

  function supplierByName(name){
    const key=normName(name);
    if(!key)return null;
    return (suppliers||[]).find(s=>normName(s.name)===key||normName(s.tradeName)===key)||null;
  }

  function dateRank(v,id){
    const d=String(v||'').replace(/\D/g,'').slice(0,8);
    return Number(d||0)*1000000000+Number(id||0);
  }

  function supplierDefaults(name){
    const supplier=supplierByName(name);
    if(!supplier)return null;
    if(supplier.defaultDescription||supplier.defaultCategory){
      return {description:supplier.defaultDescription||'',category:supplier.defaultCategory||''};
    }

    const key=normName(supplier.name);
    const groups=new Map();
    const add=(description,category,rank)=>{
      description=String(description||'').trim();
      category=String(category||'').trim();
      if(!description&&!category)return;
      const gkey=`${description.toLocaleLowerCase('pt-BR')}\u0001${category.toLocaleLowerCase('pt-BR')}`;
      const old=groups.get(gkey)||{description,category,count:0,rank:0};
      old.count++;
      old.rank=Math.max(old.rank,rank||0);
      groups.set(gkey,old);
    };

    (payables||[]).forEach(p=>{
      if(normName(p.supplier)===key)add(p.description,p.category,dateRank(p.due,p.id));
    });
    (transactions||[]).forEach(t=>{
      if(t.type==='saida'&&normName(t.party)===key)add(t.description,t.category,dateRank(t.date,t.id));
    });

    const ranked=[...groups.values()].sort((a,b)=>b.count-a.count||b.rank-a.rank);
    return ranked[0]||null;
  }

  function setCategory(selectId,category){
    if(!category)return;
    const el=document.getElementById(selectId);
    if(!el)return;
    const wanted=String(category).trim();
    const found=[...el.options].find(o=>String(o.value).trim()===wanted||String(o.textContent).trim()===wanted);
    if(found){el.value=found.value;return;}
    const opt=document.createElement('option');
    opt.value=wanted;
    opt.textContent=wanted;
    el.appendChild(opt);
    el.value=wanted;
  }

  function sortSupplierPicker(){
    const el=document.getElementById('ap_supplier');
    if(!el)return;
    const compare=(a,b)=>String(a||'').localeCompare(String(b||''),'pt-BR',{sensitivity:'base',numeric:true});

    if(el.tagName==='SELECT'){
      const selected=el.value;
      const options=[...el.options];
      const fixed=options.filter(o=>!String(o.value||'').trim());
      const sortable=options
        .filter(o=>String(o.value||'').trim())
        .sort((a,b)=>compare(a.textContent||a.value,b.textContent||b.value));
      el.replaceChildren(...fixed,...sortable);
      el.value=selected;
      return;
    }

    let list=null;
    const listId=el.getAttribute('list');
    if(listId)list=document.getElementById(listId);
    if(!list){
      list=document.createElement('datalist');
      list.id='br_supplier_options_payable';
      el.insertAdjacentElement('afterend',list);
      el.setAttribute('list',list.id);
    }

    const existing=[...list.querySelectorAll('option')]
      .map(o=>String(o.value||o.textContent||'').trim())
      .filter(Boolean);
    const registered=(suppliers||[])
      .map(s=>String(s.name||'').trim())
      .filter(Boolean);
    const names=[...new Set([...existing,...registered])].sort(compare);
    list.replaceChildren(...names.map(name=>{
      const opt=document.createElement('option');
      opt.value=name;
      return opt;
    }));
  }

  window.brApplySupplierDefaults=function(name,descId,catId){
    const d=supplierDefaults(name);
    if(!d)return false;
    const desc=document.getElementById(descId);
    if(desc&&d.description)desc.value=d.description;
    setCategory(catId,d.category);
    return true;
  };

  const originalOpenPayable=window.openPayable;
  if(typeof originalOpenPayable==='function'){
    window.openPayable=function(id=null){
      const out=originalOpenPayable.apply(this,arguments);
      setTimeout(()=>{
        const supplier=document.getElementById('ap_supplier');
        if(!supplier)return;
        sortSupplierPicker();
        supplier.addEventListener('change',()=>brApplySupplierDefaults(supplier.value,'ap_desc','ap_cat'));
      },0);
      return out;
    };
  }

  function fillPartyDatalist(){
    const input=document.getElementById('m_party');
    const type=document.getElementById('m_type')?.value||'saida';
    if(!input)return;
    let list=document.getElementById('br_party_options');
    if(!list){
      list=document.createElement('datalist');
      list.id='br_party_options';
      input.insertAdjacentElement('afterend',list);
    }
    const parties=type==='saida'?(suppliers||[]):(clients||[]);
    const names=[...new Set(parties.map(x=>String(x.name||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    list.innerHTML=names.map(n=>`<option value="${typeof esc==='function'?esc(n):n.replace(/&/g,'&amp;').replace(/"/g,'&quot;')}"></option>`).join('');
    input.setAttribute('list','br_party_options');
    input.placeholder=type==='saida'?'Selecione ou digite o fornecedor':'Selecione ou digite o cliente';
  }

  function maybeApplyFlowSupplier(){
    const input=document.getElementById('m_party');
    const type=document.getElementById('m_type')?.value;
    if(!input||type!=='saida')return;
    const s=supplierByName(input.value);
    if(s)brApplySupplierDefaults(s.name,'m_desc','m_cat');
  }

  const originalOpenTransaction=window.openTransaction;
  if(typeof originalOpenTransaction==='function'){
    window.openTransaction=function(id=null){
      const out=originalOpenTransaction.apply(this,arguments);
      setTimeout(()=>{
        const input=document.getElementById('m_party');
        const type=document.getElementById('m_type');
        if(!input||!type)return;
        fillPartyDatalist();
        input.addEventListener('change',maybeApplyFlowSupplier);
        input.addEventListener('input',()=>{
          if(supplierByName(input.value))maybeApplyFlowSupplier();
        });
        type.addEventListener('change',()=>{
          setTimeout(()=>{
            fillPartyDatalist();
            maybeApplyFlowSupplier();
          },0);
        });
      },0);
      return out;
    };
  }
})();
