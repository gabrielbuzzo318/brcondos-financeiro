(function(){
  function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();}

  function applySidebarScroll(){
    const sidebar=document.getElementById('sidebar')||document.querySelector('#app .sidebar,#app [class*="sidebar"]');
    if(!sidebar)return;
    sidebar.style.overflowY='auto';
    sidebar.style.overflowX='hidden';
    sidebar.style.maxHeight='100vh';
    sidebar.style.scrollbarGutter='stable';
  }

  function restoreLogout(){
    document.querySelectorAll('#app button,#app a,[role="button"]').forEach(el=>{
      const t=norm(el.textContent);
      const oc=String(el.getAttribute?.('onclick')||'');
      if(t.includes('sair do sistema')||/logout\s*\(/i.test(oc)){
        el.style.display='';
        el.style.visibility='';
        el.disabled=false;
        el.removeAttribute('disabled');
        el.removeAttribute('aria-disabled');
        el.style.pointerEvents='';
        el.style.opacity='';
        el.style.cursor='';
        delete el.dataset.brHiddenContabilidade;
        delete el.dataset.brReadOnly;
      }
    });
  }

  function fix(){
    applySidebarScroll();
    restoreLogout();
  }

  fix();
  window.addEventListener('resize',fix);
  const obs=new MutationObserver(fix);
  obs.observe(document.documentElement,{childList:true,subtree:true});
})();
