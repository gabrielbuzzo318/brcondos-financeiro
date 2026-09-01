(function(){
  const STORAGE_KEY='brcondos_reimbursementsV2';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  let mountTimer=null;

  function list(){
    try{
      const raw=localStorage.getItem(STORAGE_KEY);
      const parsed=raw?JSON.parse(raw):[];
      return Array.isArray(parsed)?parsed:[];
    }catch(_){return []}
  }

  function fmtMoney(v){
    const n=Number(v||0);
    try{if(typeof money==='function')return money(n)}catch(_){ }
    return n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  }

  function fmtDate(v){
    const s=String(v||'');
    const m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m?`${m[3]}/${m[2]}/${m[1]}`:s;
  }

  function statusValue(item){
    const s=norm(item?.status);
    if(s==='recebido')return'recebido';
    if(s.includes('nao recebido')||s==='nao_recebido')return'nao_recebido';
    return'analise';
  }

  function statusText(item){
    const s=statusValue(item);
    if(s==='recebido')return item?.receivedDate?fmtDate(item.receivedDate):'Recebido';
    if(s==='nao_recebido')return'Não recebido';
    return'Em análise';
  }

  function calc(items){
    const out={pending:0,received:0,analysis:0,pendingCount:0,receivedCount:0,analysisCount:0,total:0};
    items.forEach(item=>{
      const v=Number(item?.value||0);
      out.total+=v;
      const s=statusValue(item);
      if(s==='recebido'){out.received+=v;out.receivedCount++}
      else if(s==='nao_recebido'){out.pending+=v;out.pendingCount++}
      else{out.analysis+=v;out.analysisCount++}
    });
    return out;
  }

  function screenFilteredItems(){
    const q=norm(document.getElementById('br_r2_filter_q')?.value||'');
    const from=String(document.getElementById('br_r2_filter_from')?.value||'');
    const to=String(document.getElementById('br_r2_filter_to')?.value||'');
    const status=String(document.getElementById('br_r2_filter_status')?.value||'');
    const reimb=norm(document.getElementById('br_r2_filter_reimb')?.value||'');
    return list().filter(item=>{
      const date=String(item?.date||'');
      const hay=norm([item?.date,fmtDate(item?.date),item?.description,statusText(item),item?.reimbursableBy,item?.supplier,item?.value,fmtMoney(item?.value)].join(' '));
      return (!q||hay.includes(q))&&(!from||date>=from)&&(!to||date<=to)&&(!status||statusValue(item)===status)&&(!reimb||norm(item?.reimbursableBy)===reimb);
    });
  }

  function ensureCss(){
    if(document.getElementById('br-r2-extra-style'))return;
    const s=document.createElement('style');
    s.id='br-r2-extra-style';
    s.textContent=`
      #view-reembolsos .br-r2-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:0 0 14px}
      #view-reembolsos .br-r2-kpi{background:#fff;border:1px solid #e1e7ea;border-radius:12px;padding:14px 16px;box-shadow:0 2px 8px rgba(28,46,57,.04)}
      #view-reembolsos .br-r2-kpi-label{font-size:10px;text-transform:uppercase;letter-spacing:.035em;font-weight:800;color:#718089}
      #view-reembolsos .br-r2-kpi-value{display:block;margin-top:6px;font-size:20px;line-height:1.1;font-weight:800;color:#26363f}
      #view-reembolsos .br-r2-kpi-sub{display:block;margin-top:5px;font-size:10px;color:#8a969d}
      #view-reembolsos .br-r2-kpi.pending{border-left:4px solid #d9534f}
      #view-reembolsos .br-r2-kpi.pending .br-r2-kpi-value{color:#b52f2a}
      #view-reembolsos .br-r2-kpi.received{border-left:4px solid #3d9b50}
      #view-reembolsos .br-r2-kpi.received .br-r2-kpi-value{color:#2f7d40}
      #view-reembolsos .br-r2-kpi.analysis{border-left:4px solid #e0a533}
      #view-reembolsos .br-r2-kpi.analysis .br-r2-kpi-value{color:#9a6500}
      .br-r2-report-filters{display:grid;grid-template-columns:1.25fr 1.6fr 1fr 1fr auto;gap:10px;align-items:end;margin:4px 0 14px;padding:12px;border:1px solid #e1e7ea;border-radius:10px;background:#fafcfc}
      .br-r2-report-filter label{display:block;font-size:10px;text-transform:uppercase;font-weight:800;color:#6d7b84;margin-bottom:5px}
      .br-r2-report-filter select,.br-r2-report-filter input{width:100%;height:38px;border:1px solid #d6dfe3;border-radius:7px;background:#fff;padding:0 9px;color:#26363f}
      .br-r2-report-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin:0 0 16px}
      .br-r2-report-kpi{border:1px solid #e1e7ea;border-radius:9px;padding:9px 10px;background:#fff}
      .br-r2-report-kpi span{display:block;font-size:9px;text-transform:uppercase;font-weight:800;color:#76848c}
      .br-r2-report-kpi strong{display:block;margin-top:5px;font-size:13px;color:#26363f}
      @media(max-width:900px){#view-reembolsos .br-r2-cards{grid-template-columns:1fr}.br-r2-report-filters{grid-template-columns:1fr 1fr}.br-r2-report-kpis{grid-template-columns:1fr 1fr}}
    `;
    document.head.appendChild(s);
  }

  function mountCards(){
    ensureCss();
    const view=document.getElementById('view-reembolsos');
    if(!view)return;
    const filters=view.querySelector('.br-r2-filters');
    const head=view.querySelector('.br-r2-head');
    if(!filters||!head)return;
    let cards=view.querySelector('.br-r2-cards');
    if(!cards){
      cards=document.createElement('div');
      cards.className='br-r2-cards';
      cards.innerHTML=`
        <div class="br-r2-kpi pending"><span class="br-r2-kpi-label">A receber</span><strong id="br_r2_card_pending" class="br-r2-kpi-value">R$ 0,00</strong><span id="br_r2_card_pending_count" class="br-r2-kpi-sub"></span></div>
        <div class="br-r2-kpi received"><span class="br-r2-kpi-label">Recebido</span><strong id="br_r2_card_received" class="br-r2-kpi-value">R$ 0,00</strong><span id="br_r2_card_received_count" class="br-r2-kpi-sub"></span></div>
        <div class="br-r2-kpi analysis"><span class="br-r2-kpi-label">Em análise</span><strong id="br_r2_card_analysis" class="br-r2-kpi-value">R$ 0,00</strong><span id="br_r2_card_analysis_count" class="br-r2-kpi-sub"></span></div>`;
      filters.parentNode.insertBefore(cards,filters);
    }
    updateCards();
  }

  function updateCards(){
    const s=calc(screenFilteredItems());
    const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value};
    set('br_r2_card_pending',fmtMoney(s.pending));
    set('br_r2_card_received',fmtMoney(s.received));
    set('br_r2_card_analysis',fmtMoney(s.analysis));
    set('br_r2_card_pending_count',`${s.pendingCount} lançamento(s)`);
    set('br_r2_card_received_count',`${s.receivedCount} lançamento(s)`);
    set('br_r2_card_analysis_count',`${s.analysisCount} lançamento(s)`);
  }

  function reportClientOptions(){
    return [...new Set(list().map(x=>String(x?.reimbursableBy||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')).map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
  }

  function reportItems(){
    const status=String(document.getElementById('br_r2_rep_status')?.value||'');
    const client=norm(document.getElementById('br_r2_rep_client')?.value||'');
    const from=String(document.getElementById('br_r2_rep_from')?.value||'');
    const to=String(document.getElementById('br_r2_rep_to')?.value||'');
    return list().filter(item=>{
      const d=String(item?.date||'');
      return (!status||statusValue(item)===status)&&(!client||norm(item?.reimbursableBy)===client)&&(!from||d>=from)&&(!to||d<=to);
    }).sort((a,b)=>String(a?.date||'').localeCompare(String(b?.date||''))||Number(a?.id||0)-Number(b?.id||0));
  }

  function reportFilterDescription(){
    const st=String(document.getElementById('br_r2_rep_status')?.value||'');
    const client=String(document.getElementById('br_r2_rep_client')?.value||'');
    const from=String(document.getElementById('br_r2_rep_from')?.value||'');
    const to=String(document.getElementById('br_r2_rep_to')?.value||'');
    const stLabel={analise:'Em análise',nao_recebido:'Não recebido',recebido:'Recebido'}[st]||'Todos';
    const period=from||to?`${from?fmtDate(from):'início'} a ${to?fmtDate(to):'hoje'}`:'Todos';
    return {status:stLabel,client:client||'Todos',period};
  }

  window.brR2UpdateReportSummary=function(){
    const items=reportItems();
    const s=calc(items);
    const pairs={br_r2_rep_count:String(items.length),br_r2_rep_total:fmtMoney(s.total),br_r2_rep_pending:fmtMoney(s.pending),br_r2_rep_received:fmtMoney(s.received),br_r2_rep_analysis:fmtMoney(s.analysis)};
    Object.entries(pairs).forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.textContent=v});
  };

  window.brR2ClearReportFilters=function(){
    ['br_r2_rep_status','br_r2_rep_client','br_r2_rep_from','br_r2_rep_to'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});
    window.brR2UpdateReportSummary();
  };

  window.brR2OpenReport=function(){
    ensureCss();
    const body=`
      <div style="font-size:12px;color:#65747d;margin-bottom:10px">Escolha o status, o cliente e/ou o período que deseja levar para o relatório.</div>
      <div class="br-r2-report-filters">
        <div class="br-r2-report-filter"><label>Status</label><select id="br_r2_rep_status" onchange="brR2UpdateReportSummary()"><option value="">Todos</option><option value="analise">Em análise</option><option value="nao_recebido">Não recebido</option><option value="recebido">Recebido</option></select></div>
        <div class="br-r2-report-filter"><label>Cliente / Reembolsável por</label><select id="br_r2_rep_client" onchange="brR2UpdateReportSummary()"><option value="">Todos</option>${reportClientOptions()}</select></div>
        <div class="br-r2-report-filter"><label>De</label><input id="br_r2_rep_from" type="date" onchange="brR2UpdateReportSummary()"></div>
        <div class="br-r2-report-filter"><label>Até</label><input id="br_r2_rep_to" type="date" onchange="brR2UpdateReportSummary()"></div>
        <button class="btn" type="button" onclick="brR2ClearReportFilters()">Limpar</button>
      </div>
      <div class="br-r2-report-kpis">
        <div class="br-r2-report-kpi"><span>Registros</span><strong id="br_r2_rep_count">0</strong></div>
        <div class="br-r2-report-kpi"><span>Total</span><strong id="br_r2_rep_total">R$ 0,00</strong></div>
        <div class="br-r2-report-kpi"><span>A receber</span><strong id="br_r2_rep_pending">R$ 0,00</strong></div>
        <div class="br-r2-report-kpi"><span>Recebido</span><strong id="br_r2_rep_received">R$ 0,00</strong></div>
        <div class="br-r2-report-kpi"><span>Em análise</span><strong id="br_r2_rep_analysis">R$ 0,00</strong></div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px"><button class="btn" type="button" onclick="closeModal()">Cancelar</button><button class="btn green" type="button" onclick="brR2ExcelReport()">Excel</button><button class="btn primary" type="button" onclick="brR2PdfReport()">PDF</button></div>`;
    if(typeof openModal==='function'){openModal('Relatório de Reembolsos',body);setTimeout(()=>window.brR2UpdateReportSummary(),0)}
  };

  function loadScript(src,key){
    return new Promise((resolve,reject)=>{
      const ready=key==='xlsx'?window.XLSX:key==='jspdf'?window.jspdf:key==='autotable'?(window.jspdf?.jsPDF?.API?.autoTable||window.jspdf?.jsPDF):null;
      if(ready)return resolve();
      let s=document.querySelector(`script[data-br-r2x-lib="${key}"]`);
      if(s){s.addEventListener('load',()=>resolve(),{once:true});s.addEventListener('error',reject,{once:true});return}
      s=document.createElement('script');s.src=src;s.async=true;s.dataset.brR2xLib=key;s.onload=()=>resolve();s.onerror=reject;document.head.appendChild(s);
    });
  }

  function detailRows(items){return items.map(item=>({'Data':fmtDate(item?.date||''),'Descrição':item?.description||'','Recebido em':statusText(item),'Reembolsável por':item?.reimbursableBy||'','Fornecedor':item?.supplier||'','Valor':Number(item?.value||0)}))}

  window.brR2ExcelReport=async function(){
    const items=reportItems();if(!items.length)return alert('Nenhum registro encontrado para os filtros selecionados.');
    const s=calc(items),f=reportFilterDescription();
    try{
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js','xlsx');
      const XLSX=window.XLSX,wb=XLSX.utils.book_new();
      const summary=[{'Indicador':'Status selecionado','Valor':f.status},{'Indicador':'Cliente / Reembolsável por','Valor':f.client},{'Indicador':'Período','Valor':f.period},{'Indicador':'Registros','Valor':items.length},{'Indicador':'Total','Valor':s.total},{'Indicador':'A receber','Valor':s.pending},{'Indicador':'Recebido','Valor':s.received},{'Indicador':'Em análise','Valor':s.analysis}];
      const ws1=XLSX.utils.json_to_sheet(summary);ws1['!cols']=[{wch:28},{wch:40}];XLSX.utils.book_append_sheet(wb,ws1,'Resumo');
      const rows=detailRows(items),ws2=XLSX.utils.json_to_sheet(rows);ws2['!cols']=[{wch:13},{wch:40},{wch:18},{wch:28},{wch:38},{wch:16}];XLSX.utils.book_append_sheet(wb,ws2,'Reembolsos');
      XLSX.writeFile(wb,`BRCONDOS_Reembolsos_${new Date().toISOString().slice(0,10)}.xlsx`);if(typeof closeModal==='function')closeModal();
    }catch(err){console.error('BRCONDOS REEMBOLSOS EXCEL:',err);alert('Não foi possível gerar o Excel agora.');}
  };

  window.brR2PdfReport=async function(){
    const items=reportItems();if(!items.length)return alert('Nenhum registro encontrado para os filtros selecionados.');
    const s=calc(items),f=reportFilterDescription();
    try{
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js','jspdf');
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js','autotable');
      const {jsPDF}=window.jspdf,doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
      doc.setFontSize(16);doc.text('BRCONDOS - Relatório de Reembolsos',14,15);doc.setFontSize(8.5);
      doc.text(`Status: ${f.status}   Cliente: ${f.client}   Período: ${f.period}`,14,21);
      doc.text(`Registros: ${items.length}   Total: ${fmtMoney(s.total)}   A receber: ${fmtMoney(s.pending)}   Recebido: ${fmtMoney(s.received)}   Em análise: ${fmtMoney(s.analysis)}`,14,26);
      doc.autoTable({startY:31,head:[['Data','Descrição','Recebido em','Reembolsável por','Fornecedor','Valor']],body:items.map(x=>[fmtDate(x?.date||''),x?.description||'',statusText(x),x?.reimbursableBy||'',x?.supplier||'',fmtMoney(x?.value||0)]),styles:{fontSize:7,cellPadding:2,overflow:'linebreak'},headStyles:{fontStyle:'bold'},columnStyles:{0:{cellWidth:22},1:{cellWidth:65},2:{cellWidth:28},3:{cellWidth:42},4:{cellWidth:70},5:{cellWidth:28,halign:'right'}}});
      doc.save(`BRCONDOS_Reembolsos_${new Date().toISOString().slice(0,10)}.pdf`);if(typeof closeModal==='function')closeModal();
    }catch(err){console.error('BRCONDOS REEMBOLSOS PDF:',err);alert('Não foi possível gerar o PDF agora.');}
  };

  function scheduleMount(){clearTimeout(mountTimer);mountTimer=setTimeout(mountCards,35)}
  const oldApply=window.brR2ApplyFilter;if(typeof oldApply==='function')window.brR2ApplyFilter=function(){const out=oldApply.apply(this,arguments);setTimeout(updateCards,0);return out};
  const oldSave=window.brR2Save;if(typeof oldSave==='function')window.brR2Save=function(){const out=oldSave.apply(this,arguments);setTimeout(mountCards,0);return out};
  const oldDelete=window.brR2Delete;if(typeof oldDelete==='function')window.brR2Delete=function(){const out=oldDelete.apply(this,arguments);setTimeout(mountCards,0);return out};
  const oldShow=window.showView;if(typeof oldShow==='function')window.showView=function(name){const out=oldShow.apply(this,arguments);if(String(name||'').toLowerCase()==='reembolsos')setTimeout(mountCards,20);return out};

  function attach(){
    const view=document.getElementById('view-reembolsos');if(!view)return;
    if(!view.dataset.brR2CardsObserver){view.dataset.brR2CardsObserver='1';const obs=new MutationObserver(scheduleMount);obs.observe(view,{childList:true,subtree:false})}
    mountCards();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(attach,0),{once:true});else setTimeout(attach,0);
})();