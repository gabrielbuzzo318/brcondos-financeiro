(function(){
  function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();}

  function fixAPagarNav(){
    const roots=[...document.querySelectorAll('#app nav,#app aside,#app .sidebar,#app [class*="sidebar"],#app [class*="menu"]')];
    roots.forEach(root=>{
      root.querySelectorAll('button,a,[role="button"]').forEach(el=>{
        const t=norm(el.textContent);
        if(!t.includes('a pagar'))return;

        if(!el.querySelector('[data-br-nav-consulta="1"]')){
          const marker=document.createElement('span');
          marker.dataset.brNavConsulta='1';
          marker.textContent=' consultar';
          marker.style.cssText='position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;';
          el.appendChild(marker);
        }

        el.disabled=false;
        el.removeAttribute('disabled');
        el.removeAttribute('aria-disabled');
        el.style.pointerEvents='';
        el.style.opacity='';
        el.style.cursor='';
        el.title='';
        delete el.dataset.brReadOnly;
      });
    });
  }

  function removeReimbursementsTab(){
    const roots=[...document.querySelectorAll('#app nav,#app aside,#app .sidebar,#app [class*="sidebar"],#app [class*="menu"],#app')];
    roots.forEach(root=>{
      root.querySelectorAll('button,a,[role="button"],.nav-item,.menu-item,.sidebar-item').forEach(el=>{
        const text=norm(el.textContent);
        const onclick=norm(el.getAttribute?.('onclick'));
        const dataView=norm(el.getAttribute?.('data-view'));
        const href=norm(el.getAttribute?.('href'));
        if(text==='reembolsos'||onclick.includes('reembols')||dataView.includes('reembols')||href.includes('reembols')){
          el.style.display='none';
          el.setAttribute('aria-hidden','true');
        }
      });
    });

    const view=document.getElementById('view-reembolsos');
    if(view){
      const isVisible=getComputedStyle(view).display!=='none' && !view.hidden;
      view.style.display='none';
      view.hidden=true;
      view.setAttribute('aria-hidden','true');
      if(isVisible && typeof showView==='function'){
        try{showView('dashboard')}catch(_){ }
      }
    }
  }

  function apply(){
    fixAPagarNav();
    removeReimbursementsTab();
  }

  apply();
  const obs=new MutationObserver(apply);
  obs.observe(document.documentElement,{childList:true,subtree:true});
})();
