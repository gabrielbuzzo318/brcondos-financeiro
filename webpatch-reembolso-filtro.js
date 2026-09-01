(function(){
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const brDate=v=>{const s=String(v||'').trim();const m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:s};
  const todayIso=()=>{try{return typeof today==='function'?today():new Date().toISOString().slice(0,10)}catch(_){return new Date().toISOString().slice(0,10)}};
  const list=()=>{try{if(typeof reimbursements!=='undefined'&&Array.isArray(reimbursements))return reimbursements}catch(_){ }return Array.isArray(window.reimbursements)?window.reimbursements:[]};
  const txList=()=>{try{if(typeof transactions!=='undefined'&&Array.isArray(transactions))return transactions}catch(_){ }return Array.isArray(window.transactions)?window.transactions:[]};
  const moneyText=v=>{const n=Math.abs(Number(v||0));try{return typeof money==='function'?money(n):n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}catch(_){return`R$ ${n.toFixed(2).replace('.',',')}`}};
  const statusKey=r=>{if(String(r?.receivedDate||'').trim()||norm(r?.status)==='recebido')return'recebido';const s=norm(r?.status);if(s.includes('analise'))return'analise';return'nao_recebido'};
  const statusLabel=k=>k==='analise'?'Em análise':k==='recebido'?'Recebido':'Não recebido';

  function ensureStyle(){
    if(document.getElementById('br-reimb-clean-style'))return;
    const s=document.createElement('style');s.id='br-reimb-clean-style';s.textContent=`
      #view-reembolsos .br-reimb-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:10px 0 12px;padding:10px 12px;border:1px solid #e3e8eb;border-radius:10px;background:#fff}
      #view-reembolsos .br-reimb-search{flex:1;min-width:260px;max-width:560px;height:36px;border:1px solid #d8e0e5;border-radius:8px;padding:0 11px;font-size:12px;outline:none;background:#fff}
      #view-reembolsos .br-reimb-filter{height:36px;border:1px solid #d8e0e5;border-radius:8px;padding:0 30px 0 10px;font-size:12px;background:#fff;color:#33424c}
      #view-reembolsos .br-reimb-count{margin-left:auto;font-size:11px;color:#77858e;white-space:nowrap}
      #view-reembolsos .br-reimb-wrap{overflow:auto;max-height:68vh;border:1px solid #e1e6e9;border-radius:10px;background:#fff}
      #view-reembolsos .br-reimb-table{width:100%;min-width:1120px;border-collapse:separate;border-spacing:0;font-size:12px}
      #view-reembolsos .br-reimb-table thead th{position:sticky;top:0;z-index:3;background:#f7f9fa;color:#52616b;border-bottom:1px solid #e1e6e9;padding:10px 10px;text-align:left;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.02em;white-space:nowrap}
      #view-reembolsos .br-reimb-table tbody td{padding:10px;border-bottom:1px solid #edf0f2;vertical-align:middle;color:#25343c;background:#fff}
      #view-reembolsos .br-reimb-table tbody tr:last-child td{border-bottom:0}
      #view-reembolsos .br-reimb-table tbody tr:hover td{background:#fafbfc}
      #view-reembolsos .br-reimb-type{display:inline-flex;align-items:center;padding:3px 7px;border-radius:999px;background:#f1f3f5;color:#5b6770;font-size:10px;font-weight:700}
      #view-reembolsos .br-reimb-status-select{height:30px;min-width:126px;border:1px solid transparent;border-radius:7px;padding:0 26px 0 7px;background:#fff;font-size:11px;font-weight:700;outline:none;cursor:pointer}
      #view-reembolsos .br-reimb-status-select.st-nao{color:#c62828;border-color:#f1caca;background:#fffafa}
      #view-reembolsos .br-reimb-status-select.st-analise{color:#946200;border-color:#f1dfb5;background:#fffdf6}
      #view-reembolsos .br-reimb-status-select.st-recebido{color:#33424c;border-color:#dfe5e8;background:#fff}
      #view-reembolsos .br-reimb-value{text-align:right;color:#c62828;font-weight:800;white-space:nowrap;font-variant-numeric:tabular-nums}
      #view-reembolsos .br-reimb-actions{white-space:nowrap;width:138px}
      #view-reembolsos .br-reimb-actions .btn{margin-right:5px}
      #view-reembolsos .br-reimb-empty{text-align:center!important;color:#84929b!important;padding:28px!important}
      #view-reembolsos .filter-bar:has(#reimb_search){display:none!important}
      @media(max-width:900px){#view-reembolsos .br-reimb-count{margin-left:0;width:100%}}
    `;document.head.appendChild(s);
  }

  function hideOldNotice(view){
    [...view.querySelectorAll('.notice')].forEach(el=>{if(norm(el.textContent).includes('agora esta no fluxo certo'))el.style.display='none'});
  }

  function statusSelect(r){
    const k=statusKey(r);const date=brDate(r?.receivedDate||'');
    const currentText=k==='recebido'?(date||'Recebido'):statusLabel(k);
    const cls=k==='recebido'?'st-recebido':k==='analise'?'st-analise':'st-nao';
    const opts=[
      `<option value="${k}" selected>${esc(currentText)}</option>`,
      ...(k!=='recebido'?[`<option value="recebido">Recebido</option>`]:[]),
      ...(k!=='nao_recebido'?[`<option value="nao_recebido">Não recebido</option>`]:[]),
      ...(k!=='analise'?[`<option value="analise">Em análise</option>`]:[])
    ].join('');
    return `<select class="br-reimb-status-select ${cls}" data-current="${k}" onchange="brReimbChangeStatus(${Number(r.id)},this)">${opts}</select>`;
  }

  function renderClean(){
    const view=document.getElementById('view-reembolsos');if(!view)return;
    ensureStyle();hideOldNotice(view);
    const oldTable=view.querySelector('.br-reimb-table, .br-rtable, .table-wrap table, table');if(!oldTable)return;
    const oldWrap=oldTable.closest('.br-reimb-wrap,.br-rwrap,.table-wrap')||oldTable.parentElement;
    let toolbar=view.querySelector('.br-reimb-toolbar');
    if(!toolbar){
      toolbar=document.createElement('div');toolbar.className='br-reimb-toolbar';toolbar.innerHTML=`
        <input id="br_reimb_search" class="br-reimb-search" placeholder="Buscar descrição, reembolsável por ou cliente / fornecedor" oninput="brReimbApplyFilters()">
        <select id="br_reimb_status_filter" class="br-reimb-filter" onchange="brReimbApplyFilters()">
          <option value="">Todos os status</option><option value="analise">Em análise</option><option value="nao_recebido">Não recebido</option><option value="recebido">Recebido</option>
        </select>
        <div class="br-reimb-count"></div>`;
      oldWrap.insertAdjacentElement('beforebegin',toolbar);
    }
    let wrap=oldWrap;
    if(!wrap.classList.contains('br-reimb-wrap')){wrap.className='br-reimb-wrap'}
    const data=list();
    oldTable.className='br-reimb-table';oldTable.dataset.brClean='1';
    oldTable.innerHTML=`<thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Recebido em</th><th>Reembolsável por</th><th>Cliente / Fornecedor</th><th style="text-align:right">Valor</th><th>Ações</th></tr></thead><tbody>${data.length?data.map(r=>{
      const k=statusKey(r);return `<tr data-id="${Number(r.id)}" data-status="${k}" data-search="${esc(norm([r.description,r.reimbursedBy,r.paidBy].join(' ')))}"><td>${esc(brDate(r.date)||'-')}</td><td><span class="br-reimb-type">Saída</span></td><td>${esc(r.description||'-')}</td><td>${statusSelect(r)}</td><td>${esc(r.reimbursedBy||'-')}</td><td>${esc(r.paidBy||r.party||'-')}</td><td class="br-reimb-value">- ${esc(moneyText(r.value))}</td><td class="br-reimb-actions"><button class="btn small" type="button" onclick="openReimbursement(${Number(r.id)})">Editar</button><button class="btn small danger" type="button" onclick="brReimbDelete(${Number(r.id)})">Excluir</button></td></tr>`
    }).join(''):`<tr><td colspan="8" class="br-reimb-empty">Nenhum reembolso cadastrado.</td></tr>`}</tbody>`;
    brReimbApplyFilters();
  }

  window.brReimbApplyFilters=function(){
    const view=document.getElementById('view-reembolsos');if(!view)return;
    const q=norm(view.querySelector('#br_reimb_search')?.value||'');
    const st=String(view.querySelector('#br_reimb_status_filter')?.value||'');
    const rows=[...view.querySelectorAll('.br-reimb-table tbody tr[data-id]')];let visible=0;
    rows.forEach(tr=>{const okQ=!q||String(tr.dataset.search||'').includes(q);const okS=!st||tr.dataset.status===st;const show=okQ&&okS;tr.style.display=show?'':'none';if(show)visible++});
    const count=view.querySelector('.br-reimb-count');if(count)count.textContent=`${visible} de ${rows.length} reembolso(s)`;
  };

  function saveReimbursements(next){
    try{reimbursements=next}catch(_){window.reimbursements=next}
    if(typeof saveData==='function')saveData('reimbursements',next);
  }
  function saveTransactions(next){
    try{transactions=next}catch(_){window.transactions=next}
    if(typeof saveData==='function')saveData('transactions',next);
  }

  window.brReimbChangeStatus=function(id,sel){
    const r=list().find(x=>Number(x.id)===Number(id));if(!r)return;
    const next=String(sel.value||'');const current=String(sel.dataset.current||statusKey(r));
    if(next===current)return;
    if(next==='recebido'){
      sel.value=current;
      const body=`<div class="modal-grid">${typeof field==='function'?field('Data do recebimento',`<input id="br_reimb_received_date" type="date" value="${esc(r.receivedDate||todayIso())}">`):`<label>Data do recebimento<input id="br_reimb_received_date" type="date" value="${esc(r.receivedDate||todayIso())}"></label>`}</div><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px"><button class="btn" onclick="closeModal();renderAll()">Cancelar</button><button class="btn primary" onclick="brReimbConfirmReceived(${Number(id)})">Confirmar</button></div>`;
      if(typeof openModal==='function')openModal('Confirmar recebimento',body);else{const d=prompt('Data do recebimento (AAAA-MM-DD):',r.receivedDate||todayIso());if(d)brReimbConfirmReceived(id,d)}
      return;
    }
    let tx=txList();
    if(r.flowId){tx=tx.filter(t=>Number(t.id)!==Number(r.flowId));saveTransactions(tx)}
    const nextStatus=next==='analise'?'em_analise':'solicitado';
    const updated=list().map(x=>Number(x.id)===Number(id)?{...x,status:nextStatus,receivedDate:'',flowId:null}:x);
    saveReimbursements(updated);
    if(typeof renderAll==='function')renderAll();else setTimeout(renderClean,30);
  };

  window.brReimbConfirmReceived=function(id,forcedDate){
    const r=list().find(x=>Number(x.id)===Number(id));if(!r)return;
    const d=String(forcedDate||(typeof val==='function'?val('br_reimb_received_date'):document.getElementById('br_reimb_received_date')?.value)||'').trim();
    if(!/^\d{4}-\d{2}-\d{2}$/.test(d))return alert('Informe a data do recebimento.');
    let tx=txList();
    const existingId=r.flowId?Number(r.flowId):null;
    let flowId=existingId||Date.now()+1;
    const flow={id:flowId,date:d,type:'entrada',status:'pago',description:`Reembolso recebido - ${r.description||'Reembolso'}`,category:'Reembolsos recebidos',party:String(r.reimbursedBy||r.paidBy||'').trim(),baseValue:Number(r.value||0),fine:0,interest:0,value:Number(r.value||0)};
    const idx=existingId!==null?tx.findIndex(t=>Number(t.id)===existingId):-1;
    if(idx>=0)tx=tx.map((t,i)=>i===idx?{...t,...flow}:t);else tx.push(flow);
    saveTransactions(tx);
    const updated=list().map(x=>Number(x.id)===Number(id)?{...x,status:'recebido',receivedDate:d,flowId}:x);
    saveReimbursements(updated);
    if(typeof closeModal==='function')closeModal();
    if(typeof renderAll==='function')renderAll();else setTimeout(renderClean,30);
  };

  window.brReimbDelete=function(id){
    const r=list().find(x=>Number(x.id)===Number(id));if(!r)return;
    if(!confirm(`Excluir o reembolso "${r.description||''}"?`))return;
    let tx=txList();if(r.flowId){tx=tx.filter(t=>Number(t.id)!==Number(r.flowId));saveTransactions(tx)}
    saveReimbursements(list().filter(x=>Number(x.id)!==Number(id)));
    if(typeof renderAll==='function')renderAll();else setTimeout(renderClean,30);
  };

  const oldRender=window.renderReimbursements;
  if(typeof oldRender==='function')window.renderReimbursements=function(){const out=oldRender.apply(this,arguments);setTimeout(renderClean,25);return out};
  const oldShow=window.showView;
  if(typeof oldShow==='function')window.showView=function(v,b){const out=oldShow.apply(this,arguments);if(v==='reembolsos')setTimeout(renderClean,60);return out};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(renderClean,250),{once:true});else setTimeout(renderClean,250);
})();