// Blindagem final da recuperação histórica: sem cache, execução única e deduplicada.
(function(){
  const V3_KEY='brcondos_giss_hist_218_258_finalizado_v3';
  const OLD_DONE='brcondos_giss_hist_218_258_recuperado_v1';
  const OLD_FINAL='brcondos_giss_hist_218_258_finalizado_v2';

  if(!window.__brcondosHistFetchNoCacheV3){
    const nativeFetch=window.fetch.bind(window);
    window.fetch=function(input,init={}){
      if(typeof input==='string' && input.includes('/api/nfse/consultar-rps-historico')){
        const sep=input.includes('?')?'&':'?';
        input=`${input}${sep}_nocache=${Date.now()}_${Math.random().toString(36).slice(2)}`;
        init={...init,cache:'no-store'};
      }
      return nativeFetch(input,init);
    };
    window.__brcondosHistFetchNoCacheV3=true;
  }

  if(localStorage.getItem(V3_KEY)!=='ok'){
    localStorage.removeItem(OLD_DONE);
    localStorage.removeItem(OLD_FINAL);
  }

  const current=window.brcondosRecuperarHistoricoGiss;
  if(typeof current!=='function')return;
  let inflight=null;

  window.brcondosRecuperarHistoricoGiss=async function(opts={}){
    if(localStorage.getItem(V3_KEY)==='ok'){
      return {ok:true,alreadyDone:true,historicoFechado:true};
    }
    if(inflight)return inflight;

    inflight=(async()=>{
      try{
        localStorage.removeItem(OLD_DONE);
        localStorage.removeItem(OLD_FINAL);
        const result=await current(opts);
        if(result?.historicoFechado){
          localStorage.setItem(V3_KEY,'ok');
        }
        return result;
      }finally{
        inflight=null;
      }
    })();
    return inflight;
  };

  if(localStorage.getItem('brcondos_session') && localStorage.getItem(V3_KEY)!=='ok'){
    setTimeout(()=>window.brcondosRecuperarHistoricoGiss({silent:false}),900);
  }
})();
