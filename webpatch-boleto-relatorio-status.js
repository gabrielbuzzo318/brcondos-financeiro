(function(){
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();

  function statusInfo(b){
    const s=norm(b?.sicrediStatus||'');
    if(/BAIXADO\s+POR\s+SOLICIT/.test(s))return {key:'baixado',label:'Baixado',css:'background:#eef1f3;color:#58656d;border:1px solid #d7dee3'};
    if(/LIQUIDAD|PAGO|PAGA/.test(s))return {key:'liquidado',label:'Liquidado',css:'background:#e8f7ec;color:#1b7a39;border:1px solid #b9e2c4'};
    if(/VENCID/.test(s))return {key:'vencido',label:'Vencido',css:'background:#fff0f0;color:#bd3030;border:1px solid #efb0b0'};
    if(/EM\s+CARTEIRA/.test(s))return {key:'em_carteira',label:/PIX/.test(s)?'Em carteira PIX':'Em carteira',css:'background:#eef7fb;color:#28789c;border:1px solid #b9ddec'};
    return null;
  }

  function applyReportStatuses(){
    document.querySelectorAll('#view-boletos tbody tr[data-id]').forEach(tr=>{
      const b=(boletos||[]).find(x=>Number(x.id)===Number(tr.dataset.id));
      if(!b)return;
      const st=statusInfo(b);
      if(!st)return;
      const cell=tr.querySelector('td:nth-child(6)');
      if(cell)cell.innerHTML=`<span style="display:inline-flex;align-items:center;justify-content:center;min-height:25px;padding:4px 9px;border-radius:999px;font-size:11px;font-weight:800;white-space:nowrap;${st.css}">${st.label}</span>`;
      tr.dataset.status=st.key;
    });
  }

  const previous=window.renderBoletos;
  if(typeof previous==='function'){
    window.renderBoletos=function(){
      const out=previous.apply(this,arguments);
      try{applyReportStatuses();}catch(err){console.error('BRCONDOS STATUS RELATORIO SICREDI:',err);}
      return out;
    };
  }

  setTimeout(()=>{try{applyReportStatuses();}catch(_){ }},0);
})();