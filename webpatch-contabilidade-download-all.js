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

  function scheduleUnlocks(){
    [0,80,250,700,1500].forEach(ms=>setTimeout(unlock,ms));
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

    // Sem MutationObserver permanente: reaplica apenas após interação do usuário,
    // quando a tela de Contas a Pagar pode ter sido redesenhada.
    document.addEventListener('click',()=>{
      setTimeout(unlock,0);
      setTimeout(unlock,120);
    },true);
    document.addEventListener('change',()=>setTimeout(unlock,0),true);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
