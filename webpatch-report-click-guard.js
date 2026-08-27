(function(){
  const allowedEmails=new Set([
    'antonio@zacchi.com.br',
    'marco.dosualdo@brcondos.com',
    'contabil01@logucomarc.com.br'
  ]);
  let allowed=false;

  async function loadPermission(){
    try{
      const r=await fetch('/api/auth/me',{cache:'no-store'});
      if(!r.ok)return;
      const p=await r.json().catch(()=>({}));
      allowed=allowedEmails.has(String(p.email||'').toLowerCase());
    }catch(_){ }
  }

  window.addEventListener('click',function(e){
    if(!allowed)return;
    const el=e.target.closest('button,a[onclick]');
    if(!el)return;
    if(!el.closest('#view-financeiro,#view-fluxo'))return;
    const oc=String(el.getAttribute('onclick')||'');
    const m=oc.match(/openReportModal\(['"](payables|cashflow)['"]\)/);
    if(!m)return;

    // O bloqueio de acesso somente consulta interpreta "payables" como ação de pagamento.
    // Interceptamos no window (antes do document) e executamos a ação de consulta manualmente.
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    if(typeof window.openReportModal==='function') window.openReportModal(m[1]);
  },true);

  setTimeout(loadPermission,0);
})();
