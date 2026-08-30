(function(){
  const GROUP='Royalties BRCondos';
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const clean=v=>String(v||'').trim();

  function ensureRoyaltyAccounts(){
    if(typeof chartAccounts==='undefined'||!Array.isArray(chartAccounts))return;
    let changed=false;
    chartAccounts=chartAccounts.map(a=>{
      if(a?.type==='saida'&&norm(a?.name).includes('royalt')&&clean(a?.group)!==GROUP){
        changed=true;
        return {...a,group:GROUP};
      }
      return a;
    });
    if(changed){
      try{if(typeof saveData==='function')saveData('chartAccounts',chartAccounts);}catch(_){ }
    }
  }

  function addGroupOption(){
    const select=document.getElementById('pc_group');
    if(!select)return;
    if([...select.options].some(o=>clean(o.value)===GROUP))return;
    const current=select.value;
    const option=document.createElement('option');
    option.value=GROUP;
    option.textContent=GROUP;
    const target=[...select.options].find(o=>clean(o.value)==='Outras Despesas'||clean(o.value)==='Contas fora da DRE');
    if(target)select.insertBefore(option,target);else select.appendChild(option);
    if(current)select.value=current;
  }

  function reorderPlanGroups(){
    document.querySelectorAll('#view-plano .br-plan-groups').forEach(container=>{
      const blocks=[...container.querySelectorAll(':scope > .br-plan-group-block')];
      const royalties=blocks.find(b=>norm(b.querySelector('.br-plan-group-name')?.textContent)===norm(GROUP));
      if(!royalties)return;
      const target=blocks.find(b=>{
        const name=clean(b.querySelector('.br-plan-group-name')?.textContent);
        return name==='Outras Despesas'||name==='Contas fora da DRE'||name==='Sem grupo';
      });
      if(target&&target!==royalties)container.insertBefore(royalties,target);
    });
  }

  function reorderDreGroups(){
    const demo=document.querySelector('#view-dre .grid.two-cols > .card');
    if(!demo)return;
    const rows=[...demo.querySelectorAll(':scope > .dre-group-row')];
    const royalties=rows.find(r=>norm(r.querySelector('.dre-group-name')?.textContent)===norm(GROUP));
    if(!royalties)return;
    const target=rows.find(r=>{
      const name=clean(r.querySelector('.dre-group-name')?.textContent);
      return name==='Outras Despesas'||name==='Movimentações dos Sócios'||name==='Contas fora da DRE'||name==='Sem grupo';
    });
    if(target&&target!==royalties)demo.insertBefore(royalties,target);
  }

  const oldOpen=window.openChartAccount;
  if(typeof oldOpen==='function'){
    window.openChartAccount=function(){
      const out=oldOpen.apply(this,arguments);
      setTimeout(addGroupOption,0);
      return out;
    };
  }

  const oldPlan=window.renderChartAccounts;
  if(typeof oldPlan==='function'){
    window.renderChartAccounts=function(){
      ensureRoyaltyAccounts();
      const out=oldPlan.apply(this,arguments);
      setTimeout(reorderPlanGroups,0);
      return out;
    };
  }

  const oldDre=window.renderDRE;
  if(typeof oldDre==='function'){
    window.renderDRE=function(){
      ensureRoyaltyAccounts();
      const out=oldDre.apply(this,arguments);
      setTimeout(reorderDreGroups,80);
      return out;
    };
  }

  ensureRoyaltyAccounts();
  setTimeout(()=>{addGroupOption();reorderPlanGroups();reorderDreGroups();},300);
})();
