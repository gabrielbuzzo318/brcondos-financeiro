(function(){
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const brDate=v=>{const s=String(v||'').trim();const m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:s};
  const todayIso=()=>{try{return typeof today==='function'?today():new Date().toISOString().slice(0,10)}catch(_){return new Date().toISOString().slice(0,10)}};
  const list=()=>{try{if(typeof reimbursements!=='undefined'&&Array.isArray(reimbursements))return reimbursements}catch(_){ }return Array.isArray(window.reimbursements)?window.reimbursements:[]};
  const txList=()=>{try{if(typeof transactions!=='undefined'&&Array.isArray(transactions))return transactions}catch(_){ }return Array.isArray(window.transactions)?window.transactions:[]};
  const moneyText=v=>{const x=Math.abs(Number(v||0));try{return typeof money==='function'?money(x):x.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}catch(_){return`R$ ${x.toFixed(2).replace('.',',')}`}};
  const parseMoney=v=>{const s=String(v??'').replace(/[R$\s]/g,'').trim();if(!s)return 0;const n=s.includes(',')?Number(s.replace(/\./g,'').replace(',','.')):Number(s);return Number.isFinite(n)?n:0};
  const statusKey=r=>{if(String(r?.receivedDate||'').trim()||norm(r?.status)==='recebido')return'recebido';return norm(r?.status).includes('analise')?'analise':'nao_recebido'};
  const ordered=()=>[...list()].sort((a,b)=>(Number(a?.displayOrder||9999)-Number(b?.displayOrder||9999)));

  function saveReimbursements(next){
    try{reimbursements=next}catch(_){window.reimbursements=next}
    if(typeof saveData==='function')saveData('reimbursements',next);
  }
  function saveTransactions(next){
    try{transactions=next}catch(_){window.transactions=next}
    if(typeof saveData==='function')saveData('transactions',next);
  }

  function ensureStyle(){
    let s=document.getElementById('br-reimb-clean-style');
    if(!s){s=document.createElement('style');s.id='br-reimb-clean-style';document.head.appendChild(s)}
    s.textContent=`
      #view-reembolsos .filter-bar:has(#reimb_search){display:none!important}
      #view-reembolsos .br-reimb-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:10px 0 12px}
      #view-reembolsos .br-reimb-search{flex:1;min-width:280px;max-width:560px;height:36px;border:1px solid #dce3e7;border-radius:9px;padding:0 11px;font-size:12px;background:#fff;outline:none}
      #view-reembolsos .br-reimb-filter{height:36px;border:1px solid #dce3e7;border-radius:9px;padding:0 30px 0 10px;font-size:12px;background:#fff;color:#33424c}
      #view-reembolsos .br-reimb-count{margin-left:auto;font-size:11px;color:#7b8790;white-space:nowrap}
      #view-reembolsos .br-reimb-wrap{overflow:auto;max-height:68vh;border:1px solid #e1e6e9;border-radius:12px;background:#fff}
      #view-reembolsos .br-reimb-table{width:100%;min-width:1160px;border-collapse:separate;border-spacing:0;font-size:12px}
      #view-reembolsos .br-reimb-table thead th{position:sticky;top:0;z-index:3;background:#f7f9fa;color:#52616b;border-bottom:1px solid #e1e6e9;padding:10px;text-align:left;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.02em;white-space:nowrap}
      #view-reembolsos .br-reimb-table tbody td{padding:10px;border-bottom:1px solid #edf0f2;vertical-align:middle;color:#25343c;background:#fff}
      #view-reembolsos .br-reimb-table tbody tr:last-child td{border-bottom:0}
      #view-reembolsos .br-reimb-table tbody tr:hover td{background:#fafbfc}
      #view-reembolsos .br-reimb-type{font-size:11px;color:#596770}
      #view-reembolsos .br-status-select{height:30px;min-width:128px;border-radius:8px;padding:0 28px 0 9px;font-size:11px;font-weight:800;outline:none;cursor:pointer}
      #view-reembolsos .br-status-select.st-nao{color:#b42318;border:1px solid #f1b8b3;background:#fff5f4}
      #view-reembolsos .br-status-select.st-analise{color:#b85d0a;border:1px solid #f1c58d;background:#fff2df}
      #view-reembolsos .br-received-date{font-weight:700;color:#33424c;white-space:nowrap}
      #view-reembolsos .br-reimb-value{text-align:right;color:#b42318;font-weight:800;white-space:nowrap;font-variant-numeric:tabular-nums}
      #view-reembolsos .br-reimb-actions{white-space:nowrap;width:132px}
      #view-reembolsos .br-reimb-actions .btn{margin-right:5px}
      #view-reembolsos .br-reimb-empty{text-align:center!important;color:#84929b!important;padding:28px!important}
      #view-reembolsos .br-edit-received-wrap{margin-top:10px}
      #view-reembolsos .br-edit-hint{font-size:11px;color:#7a8790;margin-top:6px}
      @media(max-width:900px){#view-reembolsos .br-reimb-count{margin-left:0;width:100%}}
    `;
  }

  function cleanLegacy(view){
    [...view.querySelectorAll('.notice')].forEach(el=>{if(norm(el.textContent).includes('agora esta no fluxo certo'))el.remove()});
    [...view.querySelectorAll('*')].forEach(el=>{
      if(el.children.length===0&&norm(el.textContent).includes('registros importados')){
        el.textContent=`Controle do que foi pago e precisa ser reembolsado • ${list().length} registros`;
      }
    });
  }

  function statusCell(r){
    const k=statusKey(r);
    if(k==='recebido')return `<span class="br-received-date">${esc(brDate(r.receivedDate)||'')}</span>`;
    const cls=k==='analise'?'st-analise':'st-nao';
    return `<select class="br-status-select ${cls}" data-current="${k}" onchange="brReimbQuickStatus(${Number(r.id)},this)">
      <option value="analise"${k==='analise'?' selected':''}>Em análise</option>
      <option value="nao_recebido"${k==='nao_recebido'?' selected':''}>Não recebido</option>
      <option value="recebido">Recebido</option>
    </select>`;
  }

  function updateSummaryCards(view){
    const data=list();
    const totals={
      analise:data.filter(r=>statusKey(r)==='analise'),
      nao:data.filter(r=>statusKey(r)==='nao_recebido'),
      recebido:data.filter(r=>statusKey(r)==='recebido')
    };
    const setCard=(label,arr)=>{
      const labelEl=[...view.querySelectorAll('*')].find(el=>el.children.length===0&&norm(el.textContent)===norm(label));
      if(!labelEl)return;
      const card=labelEl.closest('.card,.metric-card,.stat-card')||labelEl.parentElement;
      if(!card)return;
      const total=arr.reduce((s,r)=>s+Number(r.value||0),0);
      const valueEl=[...card.querySelectorAll('*')].find(el=>el.children.length===0&&/R\$\s*[\d.,]+/i.test(el.textContent||''));
      if(valueEl)valueEl.textContent=moneyText(total);
      const countEl=[...card.querySelectorAll('*')].find(el=>el.children.length===0&&/item\(ns\)/i.test(el.textContent||''));
      if(countEl)countEl.textContent=`${arr.length} item(ns)`;
    };
    setCard('A SOLICITAR',totals.analise);
    setCard('SOLICITADO / A RECEBER',totals.nao);
    setCard('RECEBIDO',totals.recebido);
    setCard('VENCIDO',[]);
  }

  function renderClean(){
    const view=document.getElementById('view-reembolsos');if(!view)return;
    ensureStyle();cleanLegacy(view);updateSummaryCards(view);

    const table=view.querySelector('.br-reimb-table,.br-rtable,.table-wrap table,table');if(!table)return;
    let wrap=table.closest('.br-reimb-wrap,.br-rwrap,.table-wrap')||table.parentElement;
    if(!wrap)return;
    wrap.className='br-reimb-wrap';

    let toolbar=view.querySelector('.br-reimb-toolbar');
    if(!toolbar){
      toolbar=document.createElement('div');
      toolbar.className='br-reimb-toolbar';
      toolbar.innerHTML=`
        <input id="br_reimb_search" class="br-reimb-search" placeholder="Buscar reembolso..." oninput="brReimbApplyFilters()">
        <select id="br_reimb_status_filter" class="br-reimb-filter" onchange="brReimbApplyFilters()">
          <option value="">Todos</option>
          <option value="analise">Em análise</option>
          <option value="nao_recebido">Não recebido</option>
          <option value="recebido">Recebido</option>
        </select>
        <div class="br-reimb-count"></div>`;
      wrap.insertAdjacentElement('beforebegin',toolbar);
    }

    const data=ordered();
    table.className='br-reimb-table';
    table.innerHTML=`<thead><tr>
      <th>Data</th><th>Tipo</th><th>Descrição</th><th>Recebido em</th><th>Reembolsável por</th><th>Cliente / Fornecedor</th><th style="text-align:right">Valor</th><th>Ações</th>
    </tr></thead><tbody>${data.length?data.map(r=>{
      const k=statusKey(r);
      const search=norm([r.date,r.description,r.reimbursedBy,r.paidBy,r.value,k].join(' '));
      return `<tr data-id="${Number(r.id)}" data-status="${k}" data-search="${esc(search)}">
        <td>${esc(brDate(r.date)||'-')}</td>
        <td><span class="br-reimb-type">Saída</span></td>
        <td>${esc(r.description||'-')}</td>
        <td>${statusCell(r)}</td>
        <td>${esc(r.reimbursedBy||'-')}</td>
        <td>${esc(r.paidBy||r.party||'-')}</td>
        <td class="br-reimb-value">- ${esc(moneyText(r.value))}</td>
        <td class="br-reimb-actions">
          <button class="btn small" type="button" onclick="brReimbEdit(${Number(r.id)})">Editar</button>
          <button class="btn small danger" type="button" onclick="brReimbDelete(${Number(r.id)})">Excluir</button>
        </td>
      </tr>`;
    }).join(''):`<tr><td colspan="8" class="br-reimb-empty">Nenhum reembolso cadastrado.</td></tr>`}</tbody>`;

    brReimbApplyFilters();
  }

  window.brReimbApplyFilters=function(){
    const view=document.getElementById('view-reembolsos');if(!view)return;
    const q=norm(view.querySelector('#br_reimb_search')?.value||'');
    const st=String(view.querySelector('#br_reimb_status_filter')?.value||'');
    const rows=[...view.querySelectorAll('.br-reimb-table tbody tr[data-id]')];let visible=0;
    rows.forEach(tr=>{
      const show=(!q||String(tr.dataset.search||'').includes(q))&&(!st||tr.dataset.status===st);
      tr.style.display=show?'':'none';if(show)visible++;
    });
    const count=view.querySelector('.br-reimb-count');if(count)count.textContent=`${visible} de ${rows.length} reembolso(s)`;
  };

  function openReceiveDate(id,currentKey){
    const r=list().find(x=>Number(x.id)===Number(id));if(!r)return;
    const body=`<div class="modal-grid">
      ${typeof field==='function'?field('Data do recebimento',`<input id="br_reimb_received_date" type="date" value="${esc(r.receivedDate||todayIso())}">`):`<label>Data do recebimento<input id="br_reimb_received_date" type="date" value="${esc(r.receivedDate||todayIso())}"></label>`}
    </div>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px">
      <button class="btn" onclick="closeModal();renderAll()">Cancelar</button>
      <button class="btn primary" onclick="brReimbConfirmReceived(${Number(id)})">Confirmar</button>
    </div>`;
    if(typeof openModal==='function')openModal('Confirmar recebimento',body);
    else{
      const d=prompt('Data do recebimento (AAAA-MM-DD):',r.receivedDate||todayIso());
      if(d)brReimbConfirmReceived(id,d);
    }
  }

  window.brReimbQuickStatus=function(id,sel){
    const r=list().find(x=>Number(x.id)===Number(id));if(!r)return;
    if(String(r.receivedDate||'').trim()){
      alert('Este reembolso já possui data de recebimento. Para alterar o status, clique em Editar.');
      renderClean();return;
    }
    const next=String(sel.value||'');
    const current=String(sel.dataset.current||statusKey(r));
    if(next===current)return;
    if(next==='recebido'){sel.value=current;openReceiveDate(id,current);return;}
    const status=next==='analise'?'em_analise':'solicitado';
    saveReimbursements(list().map(x=>Number(x.id)===Number(id)?{...x,status,receivedDate:'',flowId:null}:x));
    if(typeof renderAll==='function')renderAll();else setTimeout(renderClean,20);
  };

  function upsertReceiptFlow(r,date,existingFlowId){
    let tx=txList();
    const flowId=existingFlowId?Number(existingFlowId):Date.now()+1;
    const flow={
      id:flowId,date,type:'entrada',status:'pago',
      description:`Reembolso recebido - ${r.description||'Reembolso'}`,
      category:'Reembolsos recebidos',
      party:String(r.reimbursedBy||r.paidBy||'').trim(),
      baseValue:Number(r.value||0),fine:0,interest:0,value:Number(r.value||0)
    };
    const idx=tx.findIndex(t=>Number(t.id)===flowId);
    if(idx>=0)tx=tx.map((t,i)=>i===idx?{...t,...flow}:t);else tx.push(flow);
    saveTransactions(tx);
    return flowId;
  }

  window.brReimbConfirmReceived=function(id,forcedDate){
    const r=list().find(x=>Number(x.id)===Number(id));if(!r)return;
    const d=String(forcedDate||(typeof val==='function'?val('br_reimb_received_date'):document.getElementById('br_reimb_received_date')?.value)||'').trim();
    if(!/^\d{4}-\d{2}-\d{2}$/.test(d))return alert('Informe a data do recebimento.');
    const flowId=upsertReceiptFlow(r,d,r.flowId);
    saveReimbursements(list().map(x=>Number(x.id)===Number(id)?{...x,status:'recebido',receivedDate:d,flowId}:x));
    if(typeof closeModal==='function')closeModal();
    if(typeof renderAll==='function')renderAll();else setTimeout(renderClean,20);
  };

  window.brReimbEdit=function(id){
    const r=list().find(x=>Number(x.id)===Number(id));if(!r)return;
    const k=statusKey(r);
    const statusValue=k==='analise'?'em_analise':k==='recebido'?'recebido':'solicitado';
    const f=(label,html)=>typeof field==='function'?field(label,html):`<label>${esc(label)}${html}</label>`;
    const body=`<div class="modal-grid">
      ${f('Data',`<input id="br_edit_date" type="date" value="${esc(r.date||'')}">`)}
      ${f('Descrição',`<input id="br_edit_desc" value="${esc(r.description||'')}">`)}
      ${f('Reembolsável por',`<input id="br_edit_reimb" value="${esc(r.reimbursedBy||'')}">`)}
      ${f('Cliente / Fornecedor',`<input id="br_edit_paidby" value="${esc(r.paidBy||r.party||'')}">`)}
      ${f('Valor',`<input id="br_edit_value" value="${esc(Number(r.value||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}))}">`)}
      ${f('Status',`<select id="br_edit_status" onchange="brReimbToggleEditDate()">
        <option value="em_analise"${statusValue==='em_analise'?' selected':''}>Em análise</option>
        <option value="solicitado"${statusValue==='solicitado'?' selected':''}>Não recebido</option>
        <option value="recebido"${statusValue==='recebido'?' selected':''}>Recebido</option>
      </select>`)}
      <div id="br_edit_received_wrap" class="br-edit-received-wrap" style="${statusValue==='recebido'?'':'display:none'}">
        ${f('Data do recebimento',`<input id="br_edit_received" type="date" value="${esc(r.receivedDate||todayIso())}">`)}
      </div>
    </div>
    <div class="br-edit-hint">Reembolsos que já têm data de recebimento só podem mudar de status por esta tela.</div>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px">
      <button class="btn" onclick="closeModal()">Cancelar</button>
      <button class="btn primary" onclick="brReimbSaveEdit(${Number(id)})">Salvar</button>
    </div>`;
    if(typeof openModal==='function')openModal('Editar reembolso',body);
  };

  window.brReimbToggleEditDate=function(){
    const st=document.getElementById('br_edit_status')?.value;
    const w=document.getElementById('br_edit_received_wrap');
    if(w)w.style.display=st==='recebido'?'':'none';
  };

  window.brReimbSaveEdit=function(id){
    const old=list().find(x=>Number(x.id)===Number(id));if(!old)return;
    const get=id=>document.getElementById(id)?.value??'';
    const status=get('br_edit_status');
    const next={
      ...old,
      date:String(get('br_edit_date')).trim(),
      description:String(get('br_edit_desc')).trim(),
      reimbursedBy:String(get('br_edit_reimb')).trim(),
      paidBy:String(get('br_edit_paidby')).trim(),
      value:parseMoney(get('br_edit_value')),
      status,
      receivedDate:status==='recebido'?String(get('br_edit_received')).trim():'',
    };
    if(!next.date)return alert('Informe a data.');
    if(!next.description)return alert('Informe a descrição.');
    if(!next.reimbursedBy)return alert('Informe quem reembolsa.');
    if(status==='recebido'&&!/^\d{4}-\d{2}-\d{2}$/.test(next.receivedDate))return alert('Informe a data do recebimento.');

    let tx=txList();
    if(status!=='recebido'&&old.flowId){
      tx=tx.filter(t=>Number(t.id)!==Number(old.flowId));
      saveTransactions(tx);
      next.flowId=null;
    }
    if(status==='recebido'){
      next.flowId=upsertReceiptFlow(next,next.receivedDate,old.flowId);
    }
    saveReimbursements(list().map(x=>Number(x.id)===Number(id)?next:x));
    if(typeof closeModal==='function')closeModal();
    if(typeof renderAll==='function')renderAll();else setTimeout(renderClean,20);
  };

  window.brReimbDelete=function(id){
    const r=list().find(x=>Number(x.id)===Number(id));if(!r)return;
    if(!confirm(`Excluir o reembolso "${r.description||''}"?`))return;
    if(r.flowId)saveTransactions(txList().filter(t=>Number(t.id)!==Number(r.flowId)));
    saveReimbursements(list().filter(x=>Number(x.id)!==Number(id)));
    if(typeof renderAll==='function')renderAll();else setTimeout(renderClean,20);
  };

  const oldRender=window.renderReimbursements;
  if(typeof oldRender==='function')window.renderReimbursements=function(){const out=oldRender.apply(this,arguments);setTimeout(renderClean,25);return out};
  const oldShow=window.showView;
  if(typeof oldShow==='function')window.showView=function(v,b){const out=oldShow.apply(this,arguments);if(v==='reembolsos')setTimeout(renderClean,60);return out};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(renderClean,250),{once:true});else setTimeout(renderClean,250);
})();