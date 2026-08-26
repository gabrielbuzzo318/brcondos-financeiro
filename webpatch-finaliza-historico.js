// Finaliza a recuperação histórica quando a GISS confirma as NFS-e existentes
// e responde E89 para números de RPS que não chegaram a gerar NFS-e.
(function(){
  const original=window.brcondosRecuperarHistoricoGiss;
  if(typeof original!=='function')return;

  const FINAL_KEY='brcondos_giss_hist_218_258_finalizado_v2';
  const DONE_KEY='brcondos_giss_hist_218_258_recuperado_v1';
  const locked=new Set(['emitida_nfse','cancelada_nfse']);

  window.brcondosRecuperarHistoricoGiss=async function(opts={}){
    if(localStorage.getItem(FINAL_KEY)==='ok')return original(opts);

    const result=await original(opts);
    const confirmed=Array.isArray(result?.confirmed)?result.confirmed:[];
    const failures=Array.isArray(result?.failures)?result.failures:[];
    const gaps=failures.filter(x=>/\bE89\b/i.test(String(x?.error||'')));
    const totalEsperado=41;

    // Só fecha se todos os 41 números estiverem explicados pela própria GISS:
    // ou existe NFS-e, ou a GISS respondeu E89 (RPS sem NFS-e).
    if(confirmed.length+gaps.length!==totalEsperado || failures.length!==gaps.length){
      return result;
    }

    const gapNums=new Set(gaps.map(x=>Number(x.rps)).filter(Number.isFinite));
    const afetadas=nfse
      .filter(x=>!locked.has(x.status)&&gapNums.has(Number(x.rpsNumber||x.gissRpsNumber||0)))
      .map(x=>({rps:String(x.rpsNumber||x.gissRpsNumber||''),client:x.client||''}));

    // Esses números já ficaram para trás na sequência. Nenhuma pendência pode
    // tentar reutilizá-los; toda pendência passa a 259 em diante.
    nfse=nfse.map(x=>{
      const nr=Number(x.rpsNumber||x.gissRpsNumber||0);
      if(!locked.has(x.status)&&nr>=218&&nr<=258){
        return {...x,rpsNumber:'',gissRpsNumber:'',lastError:''};
      }
      return x;
    });

    localStorage.setItem('brcondos_giss_last_rps','258');
    if(typeof brcondosRenumerarRpsPendentes==='function')brcondosRenumerarRpsPendentes();
    saveData('nfse',nfse);
    localStorage.setItem(DONE_KEY,'ok');
    localStorage.setItem(FINAL_KEY,'ok');
    renderAll();

    const pendentes=nfse
      .filter(x=>!locked.has(x.status)&&Number(x.rpsNumber||0)>=259)
      .sort((a,b)=>Number(a.rpsNumber||0)-Number(b.rpsNumber||0));
    const faixa=pendentes.length?`${pendentes[0].rpsNumber}${pendentes.length>1?` até ${pendentes[pendentes.length-1].rpsNumber}`:''}`:'nenhuma';
    const gapList=[...gapNums].sort((a,b)=>a-b).join(', ');
    const clientes=afetadas.length?`<div class="notice" style="margin-top:12px"><b>Linhas que ficaram sem NFS-e na GISS:</b><br>${afetadas.map(x=>`RPS ${esc(x.rps)} • ${esc(x.client||'Cliente não identificado')}`).join('<br>')}</div>`:'';

    if(opts.silent!==true){
      openModal('Histórico GISS fechado',`
        <div class="cards grid" style="grid-template-columns:repeat(3,1fr)">
          <div class="card accent-green"><div class="kpi-label">NFS-E CONFIRMADAS</div><div class="kpi-value">${confirmed.length}</div></div>
          <div class="card accent-slate"><div class="kpi-label">RPS SEM NFS-E</div><div class="kpi-value">${gaps.length}</div></div>
          <div class="card"><div class="kpi-label">PRÓXIMO RPS</div><div class="kpi-value">259</div></div>
        </div>
        <div class="notice" style="margin-top:12px"><b>Conferência concluída diretamente na GISS de produção.</b><br>Os RPS ${esc(gapList)} não possuem NFS-e na GISS. Eles não serão marcados como emitidos nem reutilizados.</div>
        ${clientes}
        <div class="notice" style="margin-top:12px">Pendências locais foram renumeradas para <b>${esc(faixa)}</b>.</div>
        <div style="display:flex;justify-content:flex-end;margin-top:18px"><button class="btn primary" onclick="closeModal()">Fechar</button></div>
      `);
    }

    return {...result,ok:true,historicoFechado:true,rpsSemNfse:[...gapNums]};
  };
})();
