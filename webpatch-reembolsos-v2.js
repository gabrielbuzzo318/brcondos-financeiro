(function(){
  const STORAGE_KEY='brcondos_reimbursementsV2';
  const DATA_KEY='reimbursementsV2';

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();

  function list(){
    try{
      const raw=localStorage.getItem(STORAGE_KEY);
      const parsed=raw?JSON.parse(raw):[];
      return Array.isArray(parsed)?parsed:[];
    }catch(_){return []}
  }

  function persist(items){
    localStorage.setItem(STORAGE_KEY,JSON.stringify(items));
    try{if(typeof saveData==='function')saveData(DATA_KEY,items)}catch(_){ }
  }

  function fmtDate(v){
    const s=String(v||'');
    const m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m?`${m[3]}/${m[2]}/${m[1]}`:s;
  }

  function fmtMoney(v){
    const n=Number(v||0);
    if(typeof money==='function'){
      try{return money(n)}catch(_){ }
    }
    return n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  }

  function parseMoney(v){
    let s=String(v??'').trim().replace(/R\$/gi,'').replace(/\s/g,'');
    if(!s)return NaN;
    if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');
    else if((s.match(/\./g)||[]).length>1)s=s.replace(/\./g,'');
    return Number(s);
  }

  function statusValue(item){
    const s=norm(item?.status);
    if(s==='recebido')return'recebido';
    if(s.includes('nao recebido')||s==='nao_recebido')return'nao_recebido';
    return'analise';
  }

  function statusLabel(item){
    const s=statusValue(item);
    if(s==='recebido')return item.receivedDate?fmtDate(item.receivedDate):'Recebido';
    if(s==='nao_recebido')return'Não recebido';
    return'Em análise';
  }

  function statusCell(item){
    const s=statusValue(item);
    if(s==='recebido')return `<span class="br-r2-date">${esc(fmtDate(item.receivedDate||''))}</span>`;
    if(s==='nao_recebido')return '<span class="br-r2-badge br-r2-pending">Não recebido</span>';
    return '<span class="br-r2-badge br-r2-analysis">Em análise</span>';
  }

  function filterState(){
    return {
      q:norm(document.getElementById('br_r2_filter_q')?.value||''),
      from:String(document.getElementById('br_r2_filter_from')?.value||''),
      to:String(document.getElementById('br_r2_filter_to')?.value||''),
      status:String(document.getElementById('br_r2_filter_status')?.value||''),
      reimb:norm(document.getElementById('br_r2_filter_reimb')?.value||'')
    };
  }

  function filteredItems(){
    const f=filterState();
    return list().filter(item=>{
      const date=String(item.date||'');
      const st=statusValue(item);
      const reimb=norm(item.reimbursableBy||'');
      const hay=norm([item.date,fmtDate(item.date),item.description,statusLabel(item),item.reimbursableBy,item.supplier,item.value,fmtMoney(item.value)].join(' '));
      return (!f.q||hay.includes(f.q)) &&
        (!f.from||date>=f.from) &&
        (!f.to||date<=f.to) &&
        (!f.status||st===f.status) &&
        (!f.reimb||reimb===f.reimb);
    }).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||Number(b.id||0)-Number(a.id||0));
  }

  function ensureCss(){
    if(document.getElementById('br-r2-style'))return;
    const style=document.createElement('style');
    style.id='br-r2-style';
    style.textContent=`
      #view-reembolsos .br-r2-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:14px}
      #view-reembolsos .br-r2-head h2{margin:0;font-size:20px;color:#23343e}
      #view-reembolsos .br-r2-head p{margin:4px 0 0;color:#7a8891;font-size:12px}
      #view-reembolsos .br-r2-head-actions{display:flex;gap:8px;align-items:center}
      #view-reembolsos .br-r2-filters{display:grid;grid-template-columns:minmax(220px,2fr) 140px 140px 160px minmax(170px,1fr) auto;gap:9px;align-items:end;margin-bottom:14px;padding:12px;border:1px solid #e2e8eb;border-radius:11px;background:#fafcfc}
      #view-reembolsos .br-r2-filter label{display:block;font-size:10px;font-weight:800;color:#6a7880;margin-bottom:5px;text-transform:uppercase}
      #view-reembolsos .br-r2-filter input,#view-reembolsos .br-r2-filter select{width:100%;height:36px;border:1px solid #d8e0e4;border-radius:7px;padding:0 9px;background:#fff;color:#26363f;font-size:12px}
      #view-reembolsos .br-r2-filter-result{grid-column:1/-1;font-size:11px;color:#738089;margin-top:-2px}
      #view-reembolsos .br-r2-table-wrap{overflow:auto;border:1px solid #e1e7ea;border-radius:12px;background:#fff}
      #view-reembolsos .br-r2-table{width:100%;min-width:980px;border-collapse:collapse}
      #view-reembolsos .br-r2-table th{background:#f6f8f9;color:#52626c;font-size:11px;text-transform:uppercase;letter-spacing:.02em;text-align:left;padding:11px 12px;border-bottom:1px solid #e1e7ea;white-space:nowrap}
      #view-reembolsos .br-r2-table td{padding:12px;border-bottom:1px solid #edf1f3;font-size:12px;color:#25363f;vertical-align:middle}
      #view-reembolsos .br-r2-table tbody tr:last-child td{border-bottom:0}
      #view-reembolsos .br-r2-table tbody tr:hover td{background:#fafcfc}
      #view-reembolsos .br-r2-value{text-align:right;font-weight:700;white-space:nowrap}
      #view-reembolsos .br-r2-actions{display:flex;gap:7px;white-space:nowrap}
      #view-reembolsos .br-r2-badge{display:inline-flex;align-items:center;padding:5px 9px;border-radius:999px;font-weight:700;font-size:11px;border:1px solid transparent;white-space:nowrap}
      #view-reembolsos .br-r2-analysis{background:#fff3dc;border-color:#f7c76d;color:#9a5b00}
      #view-reembolsos .br-r2-pending{background:#fff1f0;border-color:#f2b8b5;color:#bd2c24}
      #view-reembolsos .br-r2-date{font-weight:700;color:#278c3a;white-space:nowrap}
      #view-reembolsos .br-r2-empty{padding:42px 20px!important;text-align:center;color:#8a969d!important}
      #view-reembolsos .br-r2-modal-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
      #view-reembolsos .br-r2-field label,.modal .br-r2-field label{display:block;font-size:11px;font-weight:700;color:#596870;margin-bottom:6px;text-transform:uppercase}
      #view-reembolsos .br-r2-field input,#view-reembolsos .br-r2-field select,.modal .br-r2-field input,.modal .br-r2-field select{width:100%;height:40px;border:1px solid #d8e0e4;border-radius:8px;padding:0 10px;background:#fff;color:#26363f}
      #view-reembolsos .br-r2-field.br-r2-wide,.modal .br-r2-field.br-r2-wide{grid-column:1/-1}
      .br-r2-report-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin:8px 0 16px}.br-r2-report-card{border:1px solid #e1e7ea;border-radius:9px;padding:10px;background:#fafcfc}.br-r2-report-card span{display:block;font-size:10px;text-transform:uppercase;color:#738089;font-weight:800}.br-r2-report-card strong{display:block;margin-top:5px;font-size:15px;color:#26363f}
      @media(max-width:1000px){#view-reembolsos .br-r2-filters{grid-template-columns:1fr 1fr 1fr}}
      @media(max-width:760px){#view-reembolsos .br-r2-modal-grid,.modal .br-r2-modal-grid{grid-template-columns:1fr}#view-reembolsos .br-r2-field.br-r2-wide,.modal .br-r2-field.br-r2-wide{grid-column:auto}#view-reembolsos .br-r2-filters{grid-template-columns:1fr}#view-reembolsos .br-r2-head{align-items:flex-start;flex-direction:column}.br-r2-report-summary{grid-template-columns:1fr 1fr}}
    `;
    document.head.appendChild(style);
  }

  function reimbursementOptions(items){
    return [...new Set(items.map(x=>String(x.reimbursableBy||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')).map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
  }

  function render(){
    const view=document.getElementById('view-reembolsos');
    if(!view)return;
    ensureCss();
    view.hidden=false;
    view.removeAttribute('aria-hidden');
    view.style.display='';

    const all=list().slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||Number(b.id||0)-Number(a.id||0));
    const rows=all.map(item=>`
      <tr data-br-r2-id="${Number(item.id)}">
        <td>${esc(fmtDate(item.date||''))}</td>
        <td>${esc(item.description||'')}</td>
        <td>${statusCell(item)}</td>
        <td>${esc(item.reimbursableBy||'')}</td>
        <td>${esc(item.supplier||'')}</td>
        <td class="br-r2-value">${esc(fmtMoney(item.value||0))}</td>
        <td><div class="br-r2-actions"><button class="btn small" type="button" onclick="brR2Open(${Number(item.id)})">Editar</button><button class="btn small danger" type="button" onclick="brR2Delete(${Number(item.id)})">Excluir</button></div></td>
      </tr>`).join('');

    view.innerHTML=`
      <div class="br-r2-head">
        <div><h2>Reembolsos</h2><p>Controle de valores reembolsáveis</p></div>
        <div class="br-r2-head-actions"><button class="btn" type="button" onclick="brR2OpenReport()">Relatório</button><button class="btn primary" type="button" onclick="brR2Open()">+ Novo reembolso</button></div>
      </div>
      <div class="br-r2-filters">
        <div class="br-r2-filter"><label>Pesquisar</label><input id="br_r2_filter_q" type="text" placeholder="Descrição, fornecedor, valor..." oninput="brR2ApplyFilter()"></div>
        <div class="br-r2-filter"><label>De</label><input id="br_r2_filter_from" type="date" onchange="brR2ApplyFilter()"></div>
        <div class="br-r2-filter"><label>Até</label><input id="br_r2_filter_to" type="date" onchange="brR2ApplyFilter()"></div>
        <div class="br-r2-filter"><label>Status</label><select id="br_r2_filter_status" onchange="brR2ApplyFilter()"><option value="">Todos</option><option value="analise">Em análise</option><option value="nao_recebido">Não recebido</option><option value="recebido">Recebido</option></select></div>
        <div class="br-r2-filter"><label>Reembolsável por</label><select id="br_r2_filter_reimb" onchange="brR2ApplyFilter()"><option value="">Todos</option>${reimbursementOptions(all)}</select></div>
        <button class="btn" type="button" onclick="brR2ClearFilter()">Limpar</button>
        <div id="br_r2_filter_result" class="br-r2-filter-result"></div>
      </div>
      <div class="br-r2-table-wrap">
        <table class="br-r2-table">
          <thead><tr><th>Data</th><th>Descrição</th><th>Recebido em</th><th>Reembolsável por</th><th>Fornecedor</th><th style="text-align:right">Valor</th><th>Ações</th></tr></thead>
          <tbody>${rows||'<tr><td colspan="7" class="br-r2-empty">Nenhum reembolso cadastrado.</td></tr>'}</tbody>
        </table>
      </div>`;
    window.brR2ApplyFilter();
  }

  window.brR2ApplyFilter=function(){
    const view=document.getElementById('view-reembolsos');
    if(!view)return;
    const visible=new Set(filteredItems().map(x=>Number(x.id)));
    let count=0,total=0;
    view.querySelectorAll('tbody tr[data-br-r2-id]').forEach(tr=>{
      const id=Number(tr.dataset.brR2Id);
      const show=visible.has(id);
      tr.style.display=show?'':'none';
      if(show){
        count++;
        const item=list().find(x=>Number(x.id)===id);
        total+=Number(item?.value||0);
      }
    });
    const result=document.getElementById('br_r2_filter_result');
    if(result)result.textContent=`${count} reembolso(s) • Total: ${fmtMoney(total)}`;
  };

  window.brR2ClearFilter=function(){
    ['br_r2_filter_q','br_r2_filter_from','br_r2_filter_to'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});
    ['br_r2_filter_status','br_r2_filter_reimb'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});
    window.brR2ApplyFilter();
  };

  function field(label,html,wide=false){return `<div class="br-r2-field${wide?' br-r2-wide':''}"><label>${label}</label>${html}</div>`}

  window.brR2StatusChanged=function(){
    const sel=document.getElementById('br_r2_status');
    const wrap=document.getElementById('br_r2_received_wrap');
    const date=document.getElementById('br_r2_received_date');
    if(!sel||!wrap)return;
    const received=sel.value==='recebido';
    wrap.style.display=received?'block':'none';
    if(!received&&date)date.value='';
    if(received&&date){
      setTimeout(()=>{try{date.focus();if(typeof date.showPicker==='function')date.showPicker()}catch(_){ }},30);
    }
  };

  window.brR2Open=function(id){
    const items=list();
    const item=id?items.find(x=>Number(x.id)===Number(id)):null;
    const status=statusValue(item||{});
    const title=item?'Editar reembolso':'Novo reembolso';
    const body=`
      <div class="br-r2-modal-grid">
        ${field('Data',`<input id="br_r2_date" type="date" value="${esc(item?.date||'')}">`)}
        ${field('Recebido em',`<select id="br_r2_status" onchange="brR2StatusChanged()"><option value="analise"${status==='analise'?' selected':''}>Em análise</option><option value="nao_recebido"${status==='nao_recebido'?' selected':''}>Não recebido</option><option value="recebido"${status==='recebido'?' selected':''}>Recebido</option></select>`)}
        ${field('Descrição',`<input id="br_r2_description" type="text" value="${esc(item?.description||'')}" autocomplete="off">`,true)}
        ${field('Reembolsável por',`<input id="br_r2_reimbursable_by" type="text" value="${esc(item?.reimbursableBy||'')}" autocomplete="off">`)}
        ${field('Fornecedor',`<input id="br_r2_supplier" type="text" value="${esc(item?.supplier||'')}" autocomplete="off">`)}
        ${field('Valor',`<input id="br_r2_value" type="text" inputmode="decimal" placeholder="0,00" value="${item?esc(Number(item.value||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})):''}">`)}
        <div id="br_r2_received_wrap" class="br-r2-field" style="display:${status==='recebido'?'block':'none'}"><label>Data do recebimento</label><input id="br_r2_received_date" type="date" value="${esc(item?.receivedDate||'')}"></div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px"><button class="btn" type="button" onclick="closeModal()">Cancelar</button><button class="btn primary" type="button" onclick="brR2Save(${item?Number(item.id):'null'})">Salvar</button></div>`;
    if(typeof openModal==='function')openModal(title,body);else alert('Não foi possível abrir o formulário.');
  };

  window.brR2Save=function(id){
    const date=String(document.getElementById('br_r2_date')?.value||'');
    const description=String(document.getElementById('br_r2_description')?.value||'').trim();
    const status=String(document.getElementById('br_r2_status')?.value||'analise');
    const reimbursableBy=String(document.getElementById('br_r2_reimbursable_by')?.value||'').trim();
    const supplier=String(document.getElementById('br_r2_supplier')?.value||'').trim();
    const value=parseMoney(document.getElementById('br_r2_value')?.value||'');
    const receivedDate=String(document.getElementById('br_r2_received_date')?.value||'');
    if(!date)return alert('Informe a data.');
    if(!description)return alert('Informe a descrição.');
    if(!reimbursableBy)return alert('Informe quem é o reembolsável por.');
    if(!supplier)return alert('Informe o fornecedor.');
    if(!Number.isFinite(value)||value<0)return alert('Informe um valor válido.');
    if(status==='recebido'&&!receivedDate)return alert('Informe a data do recebimento.');

    let items=list();
    const now=new Date().toISOString();
    if(id!=null){
      const old=items.find(x=>Number(x.id)===Number(id));
      if(!old)return;
      items=items.map(x=>Number(x.id)===Number(id)?{...x,date,description,status,reimbursableBy,supplier,value,receivedDate:status==='recebido'?receivedDate:'',updatedAt:now}:x);
    }else{
      const newId=Date.now();
      items.push({id:newId,date,description,status,reimbursableBy,supplier,value,receivedDate:status==='recebido'?receivedDate:'',createdAt:now,updatedAt:now});
    }
    persist(items);
    if(typeof closeModal==='function')closeModal();
    render();
  };

  window.brR2Delete=function(id){
    const items=list();
    const item=items.find(x=>Number(x.id)===Number(id));
    if(!item)return;
    if(!confirm(`Excluir o reembolso "${item.description||''}"?`))return;
    persist(items.filter(x=>Number(x.id)!==Number(id)));
    render();
  };

  function reportSummary(items){
    return {
      total:items.reduce((s,x)=>s+Number(x.value||0),0),
      analysis:items.filter(x=>statusValue(x)==='analise').length,
      pending:items.filter(x=>statusValue(x)==='nao_recebido').length,
      received:items.filter(x=>statusValue(x)==='recebido').length
    };
  }

  window.brR2OpenReport=function(){
    const items=filteredItems();
    const s=reportSummary(items);
    const body=`
      <div style="font-size:12px;color:#65747d;margin-bottom:8px">O relatório usará exatamente os filtros aplicados na tela de Reembolsos.</div>
      <div class="br-r2-report-summary">
        <div class="br-r2-report-card"><span>Registros</span><strong>${items.length}</strong></div>
        <div class="br-r2-report-card"><span>Total</span><strong>${esc(fmtMoney(s.total))}</strong></div>
        <div class="br-r2-report-card"><span>Em análise</span><strong>${s.analysis}</strong></div>
        <div class="br-r2-report-card"><span>Não recebido / Recebido</span><strong>${s.pending} / ${s.received}</strong></div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px"><button class="btn" type="button" onclick="closeModal()">Cancelar</button><button class="btn green" type="button" onclick="brR2ExcelReport()">Excel</button><button class="btn primary" type="button" onclick="brR2PdfReport()">PDF</button></div>`;
    if(typeof openModal==='function')openModal('Relatório de Reembolsos',body);
  };

  function reportRows(){
    return filteredItems().map(item=>({
      'Data':fmtDate(item.date||''),
      'Descrição':item.description||'',
      'Recebido em':statusLabel(item),
      'Reembolsável por':item.reimbursableBy||'',
      'Fornecedor':item.supplier||'',
      'Valor':Number(item.value||0)
    }));
  }

  function loadScript(src,key){
    return new Promise((resolve,reject)=>{
      const ready=key==='xlsx'?window.XLSX:key==='jspdf'?window.jspdf:key==='autotable'?(window.jspdf?.jsPDF?.API?.autoTable||window.jspdf?.jsPDF):null;
      if(ready)return resolve();
      let s=document.querySelector(`script[data-br-r2-lib="${key}"]`);
      if(s){s.addEventListener('load',()=>resolve(),{once:true});s.addEventListener('error',reject,{once:true});return}
      s=document.createElement('script');s.src=src;s.async=true;s.dataset.brR2Lib=key;s.onload=()=>resolve();s.onerror=reject;document.head.appendChild(s);
    });
  }

  window.brR2ExcelReport=async function(){
    const rows=reportRows();
    try{
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js','xlsx');
      const XLSX=window.XLSX;
      const wb=XLSX.utils.book_new();
      const s=reportSummary(filteredItems());
      const resumo=[
        {Indicador:'Registros',Valor:rows.length},
        {Indicador:'Total',Valor:s.total},
        {Indicador:'Em análise',Valor:s.analysis},
        {Indicador:'Não recebido',Valor:s.pending},
        {Indicador:'Recebido',Valor:s.received}
      ];
      const ws1=XLSX.utils.json_to_sheet(resumo);ws1['!cols']=[{wch:22},{wch:18}];
      XLSX.utils.book_append_sheet(wb,ws1,'Resumo');
      const detail=rows.length?rows:[{'Resultado':'Nenhum registro encontrado para os filtros selecionados.'}];
      const ws2=XLSX.utils.json_to_sheet(detail);ws2['!cols']=[{wch:13},{wch:38},{wch:18},{wch:24},{wch:30},{wch:16}];
      XLSX.utils.book_append_sheet(wb,ws2,'Reembolsos');
      XLSX.writeFile(wb,`BRCONDOS_Reembolsos_${new Date().toISOString().slice(0,10)}.xlsx`);
      if(typeof closeModal==='function')closeModal();
    }catch(err){console.error('BRCONDOS REEMBOLSOS EXCEL:',err);alert('Não foi possível gerar o Excel agora.');}
  };

  window.brR2PdfReport=async function(){
    const items=filteredItems();
    if(!items.length)return alert('Nenhum registro encontrado para os filtros selecionados.');
    try{
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js','jspdf');
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js','autotable');
      const {jsPDF}=window.jspdf;
      const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
      const s=reportSummary(items);
      doc.setFontSize(16);doc.text('BRCONDOS - Relatório de Reembolsos',14,16);
      doc.setFontSize(9);doc.text(`Registros: ${items.length}   Total: ${fmtMoney(s.total)}   Em análise: ${s.analysis}   Não recebido: ${s.pending}   Recebido: ${s.received}`,14,23);
      doc.autoTable({
        startY:29,
        head:[['Data','Descrição','Recebido em','Reembolsável por','Fornecedor','Valor']],
        body:items.map(x=>[fmtDate(x.date||''),x.description||'',statusLabel(x),x.reimbursableBy||'',x.supplier||'',fmtMoney(x.value||0)]),
        styles:{fontSize:7,cellPadding:2,overflow:'linebreak'},
        headStyles:{fontStyle:'bold'},
        columnStyles:{0:{cellWidth:22},1:{cellWidth:65},2:{cellWidth:28},3:{cellWidth:42},4:{cellWidth:70},5:{cellWidth:28,halign:'right'}}
      });
      doc.save(`BRCONDOS_Reembolsos_${new Date().toISOString().slice(0,10)}.pdf`);
      if(typeof closeModal==='function')closeModal();
    }catch(err){console.error('BRCONDOS REEMBOLSOS PDF:',err);alert('Não foi possível gerar o PDF agora.');}
  };

  window.renderReimbursements=render;

  const originalShowView=window.showView;
  if(typeof originalShowView==='function'&&!originalShowView.__brR2Wrapped){
    const wrapped=function(name){
      const out=originalShowView.apply(this,arguments);
      if(String(name||'').toLowerCase()==='reembolsos')setTimeout(render,0);
      return out;
    };
    wrapped.__brR2Wrapped=true;
    window.showView=wrapped;
  }

  window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY)render()});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(render,0),{once:true});
})();
