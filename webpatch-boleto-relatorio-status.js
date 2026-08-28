(function(){
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();

  const STATUS_ORDER=[
    'liquidado','em_carteira','vencido','baixado','emitido','emitido_externo',
    'aguardando_integracao','pendente_vencimento','recebido'
  ];

  function statusInfo(b){
    const s=norm(b?.sicrediStatus||'');

    if(/BAIXADO\s+POR\s+SOLICIT/.test(s)){
      return {key:'baixado',label:'Baixado',css:'background:#eef1f3;color:#58656d;border:1px solid #d7dee3'};
    }
    if(/LIQUIDAD|PAGO|PAGA/.test(s)){
      return {key:'liquidado',label:'Liquidado',css:'background:#e8f7ec;color:#1b7a39;border:1px solid #b9e2c4'};
    }
    if(/VENCID/.test(s)){
      return {key:'vencido',label:'Vencido',css:'background:#fff0f0;color:#bd3030;border:1px solid #efb0b0'};
    }
    if(/EM\s+CARTEIRA/.test(s)){
      return {key:'em_carteira',label:/PIX/.test(s)?'Em carteira PIX':'Em carteira',css:'background:#eef7fb;color:#28789c;border:1px solid #b9ddec'};
    }

    const raw=String(b?.status||'');
    if(raw==='recebido')return {key:'recebido',label:'Recebido',css:'background:#e8f7ec;color:#1b7a39;border:1px solid #b9e2c4'};
    if(raw==='vencido'||(b?.due&&String(b.due)<today()))return {key:'vencido',label:'Vencido',css:'background:#fff0f0;color:#bd3030;border:1px solid #efb0b0'};
    if(raw==='emitido')return {key:'emitido',label:'Emitido',css:'background:#eef7fb;color:#28789c;border:1px solid #b9ddec'};
    if(raw==='emitido_externo')return {key:'emitido_externo',label:'Emitido no banco',css:'background:#eef7fb;color:#28789c;border:1px solid #b9ddec'};
    if(raw==='aguardando_integracao')return {key:'aguardando_integracao',label:'Aguardando emissão',css:'background:#fff7df;color:#8a6814;border:1px solid #ead79a'};
    if(raw==='pendente_vencimento'||!b?.due)return {key:'pendente_vencimento',label:'Sem vencimento',css:'background:#fff0f0;color:#bd3030;border:1px solid #efb0b0'};

    const label=raw?raw.replaceAll('_',' '):'Sem status';
    return {key:raw||'sem_status',label,css:'background:#eef1f3;color:#58656d;border:1px solid #d7dee3'};
  }

  function statusList(){
    const map=new Map();
    (Array.isArray(boletos)?boletos:[]).forEach(b=>{
      const st=statusInfo(b);
      if(st?.key&&!map.has(st.key))map.set(st.key,st.label);
    });
    return [...map.entries()]
      .map(([key,label])=>({key,label}))
      .sort((a,b)=>{
        const ai=STATUS_ORDER.indexOf(a.key), bi=STATUS_ORDER.indexOf(b.key);
        if(ai>=0||bi>=0)return (ai<0?999:ai)-(bi<0?999:bi);
        return a.label.localeCompare(b.label,'pt-BR');
      });
  }

  function statusOptionsHtml(){
    return '<option value="">Todos</option>'+statusList().map(x=>`<option value="${x.key}">${x.label}</option>`).join('');
  }

  function syncMainStatusFilter(){
    const select=document.getElementById('boleto_status');
    if(!select)return;
    const current=select.value;
    select.innerHTML=statusOptionsHtml();
    if([...select.options].some(o=>o.value===current))select.value=current;
    else select.value='';
  }

  function applyReportStatuses(){
    document.querySelectorAll('#view-boletos tbody tr[data-id]').forEach(tr=>{
      const b=(boletos||[]).find(x=>Number(x.id)===Number(tr.dataset.id));
      if(!b)return;
      const st=statusInfo(b);
      const cell=tr.querySelector('td:nth-child(6)');
      if(cell)cell.innerHTML=`<span style="display:inline-flex;align-items:center;justify-content:center;min-height:25px;padding:4px 9px;border-radius:999px;font-size:11px;font-weight:800;white-space:nowrap;${st.css}">${st.label}</span>`;
      tr.dataset.status=st.key;
      tr.dataset.search=`${tr.dataset.search||''} ${String(st.label||'').toLowerCase()} ${String(b.sicrediStatus||'').toLowerCase()}`.trim();
    });
    syncMainStatusFilter();
  }

  const previousRenderBoletos=window.renderBoletos;
  if(typeof previousRenderBoletos==='function'){
    window.renderBoletos=function(){
      const out=previousRenderBoletos.apply(this,arguments);
      try{applyReportStatuses();}catch(err){console.error('BRCONDOS STATUS RELATORIO SICREDI:',err);}
      return out;
    };
  }

  const previousReportStatusOptions=window.reportStatusOptions;
  if(typeof previousReportStatusOptions==='function'){
    window.reportStatusOptions=function(type){
      if(type==='boletos')return statusOptionsHtml();
      return previousReportStatusOptions.apply(this,arguments);
    };
  }

  const previousGenerateReport=window.generateReport;
  if(typeof previousGenerateReport==='function'){
    window.generateReport=function(type){
      if(type!=='boletos')return previousGenerateReport.apply(this,arguments);

      const from=document.getElementById('rep_from')?.value||'';
      const to=document.getElementById('rep_to')?.value||'';
      const status=document.getElementById('rep_status')?.value||'';
      const q=document.getElementById('rep_search')?.value||'';

      const data=(Array.isArray(boletos)?boletos:[]).filter(x=>{
        const st=statusInfo(x);
        return reportDateOk(x.due,from,to) &&
          (!status || st.key===status) &&
          reportMatchesSearch([
            x.client,x.docNumber,x.description,x.details,x.bank,x.value,money(x.value),
            x.sicrediNossoNumero,x.sicrediStatus,st.label,x.receiptDate
          ],q);
      }).sort((a,b)=>(a.due||'9999-99-99').localeCompare(b.due||'9999-99-99')||String(a.client||'').localeCompare(String(b.client||''),'pt-BR'));

      const total=data.reduce((a,b)=>a+Number(b.value||0),0);
      const liquidado=data.filter(x=>statusInfo(x).key==='liquidado').reduce((a,b)=>a+Number(b.value||0),0);
      const aberto=data.filter(x=>['em_carteira','vencido','emitido','emitido_externo','aguardando_integracao','pendente_vencimento'].includes(statusInfo(x).key)).reduce((a,b)=>a+Number(b.value||0),0);

      const title='Relatório de Boletos';
      const summary=`
        <div class="sum"><small>VALOR DOS BOLETOS</small><b>${money(total)}</b></div>
        <div class="sum"><small>LIQUIDADO</small><b>${money(liquidado)}</b></div>
        <div class="sum"><small>EM ABERTO</small><b>${money(aberto)}</b></div>
        <div class="sum"><small>BOLETOS</small><b>${data.length}</b></div>`;

      const headers=['Boleto','Cliente','Vencimento','Descrição','Detalhes','Status','Data recebimento','Valor'];
      const rows=data.map(x=>{
        const st=statusInfo(x);
        return [
          `${esc(x.docNumber||'-')}${x.sicrediNossoNumero?`<br><small>Nosso Nº: ${esc(x.sicrediNossoNumero)}</small>`:''}`,
          esc(x.client||'-'),
          x.due?formatDate(x.due):'Sem vencimento',
          esc(x.description||'-'),
          esc(x.details||'-'),
          esc(st.label),
          x.receiptDate?formatDate(x.receiptDate):'-',
          money(x.value)
        ];
      });

      const periodText=from||to?`${from?formatDate(from):'início'} até ${to?formatDate(to):'hoje'}`:'Todos os períodos';
      const selectedLabel=status
        ? (statusList().find(x=>x.key===status)?.label||status.replaceAll('_',' '))
        : '';
      const statusText=selectedLabel?` • Status: ${esc(selectedLabel)}`:'';
      const searchText=q?` • Pesquisa: ${esc(q)}`:'';

      closeModal();
      printableReport(title,`${periodText}${statusText}${searchText}`,summary,headers,rows);
    };
  }

  setTimeout(()=>{try{applyReportStatuses();}catch(_){ }},0);
})();