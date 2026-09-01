(function(){
  let isAccounting=false;

  const norm=v=>String(v||'')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/\s+/g,' ')
    .trim();

  window.brContabDownloadAllDocs=function(){
    if(typeof window.brDownloadAllPayablesDocs==='function'){
      return window.brDownloadAllPayablesDocs();
    }
  };

  function unlock(){
    if(!isAccounting)return;
    const btn=document.getElementById('ap_download_all_btn');
    if(!btn)return;

    const alreadyReady=
      btn.disabled===false &&
      btn.getAttribute('onclick')==='brContabDownloadAllDocs()' &&
      !btn.hasAttribute('data-br-read-only') &&
      !btn.dataset.brReadOnly;

    if(alreadyReady)return;

    btn.disabled=false;
    btn.removeAttribute('disabled');
    btn.style.opacity='';
    btn.style.cursor='';
    btn.title='Baixar documentos do mês';
    btn.removeAttribute('data-br-read-only');
    delete btn.dataset.brReadOnly;
    btn.setAttribute('onclick','brContabDownloadAllDocs()');
  }

  function revealAuthorizedTabs(){
    if(!isAccounting)return;

    document.querySelectorAll('#app button,#app a,#app [role="button"]').forEach(el=>{
      const text=norm(el.textContent);
      if(!text)return;

      const allowed=
        text==='reembolsos' ||
        text.includes('reembols') ||
        text==='inadimplencias' ||
        text.includes('inadimpl');

      if(!allowed)return;

      el.style.display='';
      el.dataset.brContabilidadeAllowed='1';
    });
  }

  function refreshAccountingAccess(){
    unlock();
    revealAuthorizedTabs();
  }

  function scheduleUnlocks(){
    [0,80,250,700,1500].forEach(ms=>setTimeout(refreshAccountingAccess,ms));
  }

  async function boot(){
    try{
      const r=await fetch('/api/auth/me',{cache:'no-store'});
      const d=await r.json().catch(()=>({}));
      isAccounting=r.ok && String(d?.email||'').toLowerCase()==='contabil01@logucomarc.com.br';
    }catch(_){
      isAccounting=false;
    }
    if(!isAccounting)return;

    scheduleUnlocks();

    document.addEventListener('click',()=>{
      setTimeout(refreshAccountingAccess,0);
      setTimeout(refreshAccountingAccess,120);
    },true);
    document.addEventListener('change',()=>setTimeout(refreshAccountingAccess,0),true);

    const observer=new MutationObserver(()=>setTimeout(revealAuthorizedTabs,0));
    observer.observe(document.getElementById('app')||document.documentElement,{childList:true,subtree:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
