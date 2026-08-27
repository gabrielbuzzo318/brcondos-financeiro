(function(){
  function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();}

  function fixAPagarNav(){
    const roots=[...document.querySelectorAll('#app nav,#app aside,#app .sidebar,#app [class*="sidebar"],#app [class*="menu"]')];
    roots.forEach(root=>{
      root.querySelectorAll('button,a,[role="button"]').forEach(el=>{
        const t=norm(el.textContent);
        if(!t.includes('a pagar'))return;

        // Marca a navegação como consulta para o bloqueio geral não tratá-la como mutação.
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

  fixAPagarNav();
  const obs=new MutationObserver(fixAPagarNav);
  obs.observe(document.documentElement,{childList:true,subtree:true});
})();
