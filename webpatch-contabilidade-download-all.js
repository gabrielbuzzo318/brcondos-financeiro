(function(){
  let isAccounting=false;

  window.brContabDownloadAllDocs=function(){
    if(typeof window.brDownloadAllPayablesDocs==='function'){
      return window.brDownloadAllPayablesDocs();
    }
  };

  function unlock(){
    if(!isAccounting)return;
    const btn=document.getElementById('ap_download_all_btn');
    if(!btn)return;
    btn.disabled=false;
    btn.removeAttribute('disabled');
    btn.style.opacity='';
    btn.style.cursor='';
    btn.title='Baixar documentos do mês';
    btn.removeAttribute('data-br-read-only');
    delete btn.dataset.brReadOnly;
    btn.setAttribute('onclick','brContabDownloadAllDocs()');
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
    unlock();
    setTimeout(unlock,100);
    setTimeout(unlock,500);
    const obs=new MutationObserver(unlock);
    obs.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','onclick','style']});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
