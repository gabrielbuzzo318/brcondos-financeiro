(function(){
  function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()}
  function removeTab(){
    const all=[...document.querySelectorAll('button,a,[role="button"],.nav-item,.menu-item,.sidebar-item')];
    all.forEach(el=>{
      const txt=norm(el.textContent);
      const onclick=norm(el.getAttribute?.('onclick'));
      const dv=norm(el.getAttribute?.('data-view'));
      const href=norm(el.getAttribute?.('href'));
      if(txt==='reembolsos'||onclick.includes('reembols')||dv.includes('reembols')||href.includes('reembols')){
        el.style.display='none';
        el.setAttribute('aria-hidden','true');
      }
    });
    const view=document.getElementById('view-reembolsos');
    if(view){view.style.display='none';view.setAttribute('aria-hidden','true')}
  }
  removeTab();
  const obs=new MutationObserver(removeTab);
  obs.observe(document.documentElement,{childList:true,subtree:true});
})();