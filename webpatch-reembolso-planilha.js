(function(){
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function reimbursementsList(){
    try{if(typeof reimbursements!=='undefined'&&Array.isArray(reimbursements))return reimbursements;}catch(_){ }
    return Array.isArray(window.reimbursements)?window.reimbursements:[];
  }
  function reimbursementId(tr){
    const btn=[...tr.querySelectorAll('button')].find(b=>/openReimbursement\(/.test(String(b.getAttribute('onclick')||'')));
    const m=String(btn?.getAttribute('onclick')||'').match(/openReimbursement\((\d+)\)/);
    return m?Number(m[1]):null;
  }
  function findIndex(headers,tests){
    for(const test of tests){const i=headers.findIndex(h=>test(h));if(i>=0)return i;}
    return-1;
  }
  function brDateFromIso(value){
    const s=String(value||'').trim();
    if(typeof formatDate==='function'&&/^\d{4}-\d{2}-\d{2}$/.test(s))return formatDate(s);
    const m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:s;
  }
  function isoFromText(value){
    const s=String(value||'').trim();
    if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
    const m=s.match(/(\d{2})\/(\d{2})\/(\d{4})/);return m?`${m[3]}-${m[2]}-${m[1]}`:'';
  }
  function receivedText(r,oldStatus){
    const receivedDate=String(r?.receivedDate||'').trim();
    if(receivedDate)return brDateFromIso(receivedDate);
    const status=norm(r?.status||oldStatus||'');
    if(status.includes('analise'))return'Em análise';
    if(status==='recebido'||status.startsWith('recebido'))return'Recebido';
    return'Não recebido';
  }
  function statusClass(text){
    const n=norm(text);
    if(/^\d{2}\/\d{2}\/\d{4}$/.test(String(text).trim())||n==='recebido')return'received';
    if(n.includes('analise'))return'analysis';
    return'pending';
  }
  function moneyText(r,oldText){
    const raw=Number(r?.value);
    if(Number.isFinite(raw)){
      const formatted=typeof money==='function'?money(Math.abs(raw)):Math.abs(raw).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
      return`- ${formatted}`;
    }
    const txt=String(oldText||'').trim();return txt.startsWith('-')?txt:`- ${txt}`;
  }

  function ensureStyle(){
    if(document.getElementById('br-reimb-sheet-style'))return;
    const s=document.createElement('style');s.id='br-reimb-sheet-style';s.textContent=`
      #view-reembolsos .br-reimb-sheet-wrap{border:1px solid #d8e0e5;border-radius:10px;overflow:auto;max-height:68vh;background:#fff}
      #view-reembolsos .br-reimb-sheet{width:100%;min-width:1180px;border-collapse:separate;border-spacing:0;font-size:12px}
      #view-reembolsos .br-reimb-sheet thead th{position:sticky;z-index:4;background:#f6f8f9;color:#33424c;border-bottom:1px solid #dce3e7;padding:8px 8px;text-align:left;white-space:nowrap}
      #view-reembolsos .br-reimb-sheet thead tr:first-child th{top:0;font-weight:800}
      #view-reembolsos .br-reimb-sheet thead tr.br-reimb-filter-row th{top:33px;padding:5px 6px;background:#fff;box-shadow:0 1px 0 #e6ebee}
      #view-reembolsos .br-reimb-sheet .br-sort{border:0;background:transparent;padding:0;color:inherit;font:inherit;font-weight:800;cursor:pointer;display:flex;align-items:center;gap:5px;width:100%;text-align:left}
      #view-reembolsos .br-reimb-sheet .br-sort::after{content:'↕';font-size:9px;color:#87939b;margin-left:auto}
      #view-reembolsos .br-reimb-sheet .br-col-filter{width:100%;min-width:80px;height:25px;border:1px solid #d9e0e4;border-radius:5px;background:#fff;padding:2px 6px;font-size:10px;color:#46545d;outline:none}
      #view-reembolsos .br-reimb-sheet tbody td{padding:7px 8px;border-bottom:1px solid #edf0f2;vertical-align:middle;color:#25343c;background:#fff}
      #view-reembolsos .br-reimb-sheet tbody tr:hover td{background:#f7fafb}
      #view-reembolsos .br-reimb-sheet tbody tr.br-reimb-received td{background:#f1f6e9}
      #view-reembolsos .br-reimb-sheet tbody tr.br-reimb-received:hover td{background:#eaf2df}
      #view-reembolsos .br-reimb-sheet tbody tr.br-reimb-analysis td{background:#fffaf0}
      #view-reembolsos .br-reimb-sheet tbody tr.br-reimb-analysis:hover td{background:#fff5dc}
      #view-reembolsos .br-reimb-sheet td.br-reimb-value{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;color:#b42318;font-weight:700}
      #view-reembolsos .br-reimb-sheet th.br-reimb-value-head{text-align:right}
      #view-reembolsos .br-reimb-sheet td.br-reimb-actions{white-space:nowrap;min-width:150px}
      #view-reembolsos .br-reimb-sheet td.br-reimb-actions .actions{display:flex;gap:4px;flex-wrap:nowrap}
      #view-reembolsos .br-reimb-sheet .br-reimb-received-text{font-weight:700;color:#46612d}
      #view-reembolsos .br-reimb-sheet .br-reimb-analysis-text{font-weight:700;color:#8a6500}
      #view-reembolsos .br-reimb-sheet .br-reimb-pending-text{font-weight:700;color:#6c7880}
      #view-reembolsos .br-reimb-sheet-empty{text-align:center!important;color:#839099!important;padding:26px!important}
      #view-reembolsos .br-reimb-sheet-count{font-size:11px;color:#74818a;margin:8px 2px 6px}
      #view-reembolsos #reimb_search{display:none!important}
      #view-reembolsos #reimb_search~*{display:none!important}
      #view-reembolsos .filter-bar:has(#reimb_search){display:none!important}
    `;document.head.appendChild(s);
  }

  function actionHtml(oldCell,id,r){
    const html=oldCell?.innerHTML||'';
    if(html.trim())return html;
    const received=!!r?.receivedDate||norm(r?.status)==='recebido';
    return`<div class="actions"><button class="btn small" type="button" onclick="openReimbursement(${Number(id)})">Editar</button>${typeof window.receiveReimbursement==='function'?`<button class="btn small ${received?'':'primary'}" type="button" onclick="receiveReimbursement(${Number(id)})">${received?'Data da baixa':'Dar baixa'}</button>`:''}</div>`;
  }

  function applySheet(){
    const view=document.getElementById('view-reembolsos');if(!view)return;
    ensureStyle();
    const table=view.querySelector('.table-wrap table, table');if(!table||table.dataset.brReimbSheet==='1')return;
    const oldHeads=[...table.querySelectorAll('thead th')].map(th=>norm(th.textContent));
    if(!oldHeads.length)return;
    const idx={
      date:findIndex(oldHeads,[h=>h.includes('data paga'),h=>h==='data',h=>h.includes('pagamento')]),
      desc:findIndex(oldHeads,[h=>h.includes('descricao')]),
      reimb:findIndex(oldHeads,[h=>h.includes('reembolsado por'),h=>h.includes('reembolsavel por'),h=>h.includes('quem reembolsa')]),
      client:findIndex(oldHeads,[h=>h.includes('favorecido'),h=>h.includes('cliente')||h.includes('fornecedor'),h=>h.includes('pago por')]),
      value:findIndex(oldHeads,[h=>h==='valor'||h.includes('valor')]),
      status:findIndex(oldHeads,[h=>h.includes('status')]),
      actions:findIndex(oldHeads,[h=>h.includes('acoes')||h.includes('acao')])
    };
    const oldRows=[...table.querySelectorAll('tbody tr')];
    const data=[];
    oldRows.forEach(tr=>{
      if(tr.querySelector('.empty'))return;
      const cells=[...tr.children];const id=reimbursementId(tr);if(id===null)return;
      const r=reimbursementsList().find(x=>Number(x?.id)===id)||{};
      const oldStatus=idx.status>=0?cells[idx.status]?.textContent:'';
      const received=receivedText(r,oldStatus);
      const receivedClass=statusClass(received);
      const dateText=idx.date>=0?String(cells[idx.date]?.textContent||'').trim():brDateFromIso(r?.date||r?.paidDate||'');
      const descHtml=idx.desc>=0?cells[idx.desc]?.innerHTML:esc(r?.description||'-');
      const reimbHtml=idx.reimb>=0?cells[idx.reimb]?.innerHTML:esc(r?.reimbursedBy||'-');
      const clientHtml=idx.client>=0?cells[idx.client]?.innerHTML:esc(r?.supplier||r?.party||r?.paidBy||'-');
      const oldValue=idx.value>=0?cells[idx.value]?.textContent:'';
      const actions=idx.actions>=0?cells[idx.actions]:tr.querySelector('.actions')?.parentElement;
      data.push({id,r,dateText,descHtml,reimbHtml,clientHtml,received,receivedClass,valueText:moneyText(r,oldValue),actionsHtml:actionHtml(actions,id,r),value:Number(r?.value||0)});
    });

    const wrap=table.closest('.table-wrap');if(wrap){wrap.classList.add('br-reimb-sheet-wrap');wrap.classList.remove('table-wrap');}
    table.dataset.brReimbSheet='1';table.className='br-reimb-sheet';
    table.innerHTML=`<thead>
      <tr>
        <th><button class="br-sort" onclick="brReimbSort(0)">Data</button></th>
        <th><button class="br-sort" onclick="brReimbSort(1)">Tipo</button></th>
        <th><button class="br-sort" onclick="brReimbSort(2)">Descrição</button></th>
        <th><button class="br-sort" onclick="brReimbSort(3)">Recebido em</button></th>
        <th><button class="br-sort" onclick="brReimbSort(4)">Reembolsável por</button></th>
        <th><button class="br-sort" onclick="brReimbSort(5)">Cliente / Fornecedor</button></th>
        <th class="br-reimb-value-head"><button class="br-sort" onclick="brReimbSort(6)">Valor</button></th>
        <th>Ações</th>
      </tr>
      <tr class="br-reimb-filter-row">
        <th><input class="br-col-filter" data-col="0" placeholder="Data" oninput="brFilterReimbSheet()"></th>
        <th><select class="br-col-filter" data-col="1" onchange="brFilterReimbSheet()"><option value="">Todos</option><option>Saída</option></select></th>
        <th><input class="br-col-filter" data-col="2" placeholder="Descrição" oninput="brFilterReimbSheet()"></th>
        <th><select class="br-col-filter" data-col="3" onchange="brFilterReimbSheet()"><option value="">Todos</option><option value="recebido">Recebido</option><option value="em analise">Em análise</option><option value="nao recebido">Não recebido</option></select></th>
        <th><input class="br-col-filter" data-col="4" placeholder="Reembolsável por" oninput="brFilterReimbSheet()"></th>
        <th><input class="br-col-filter" data-col="5" placeholder="Cliente / fornecedor" oninput="brFilterReimbSheet()"></th>
        <th><input class="br-col-filter" data-col="6" placeholder="Valor" oninput="brFilterReimbSheet()"></th>
        <th></th>
      </tr>
    </thead><tbody>${data.length?data.map(x=>`<tr class="${x.receivedClass==='received'?'br-reimb-received':x.receivedClass==='analysis'?'br-reimb-analysis':''}" data-br-id="${x.id}" data-sort-date="${isoFromText(x.dateText)}" data-sort-value="${Number(x.value||0)}">
      <td>${esc(x.dateText||'-')}</td><td>Saída</td><td>${x.descHtml}</td>
      <td class="br-reimb-${x.receivedClass}-text">${esc(x.received)}</td><td>${x.reimbHtml}</td><td>${x.clientHtml}</td>
      <td class="br-reimb-value">${esc(x.valueText)}</td><td class="br-reimb-actions">${x.actionsHtml}</td>
    </tr>`).join(''):`<tr><td colspan="8" class="br-reimb-sheet-empty">Nenhum reembolso cadastrado.</td></tr>`}</tbody>`;
    let count=view.querySelector('.br-reimb-sheet-count');if(!count){count=document.createElement('div');count.className='br-reimb-sheet-count';table.parentElement?.insertAdjacentElement('beforebegin',count);}window.brFilterReimbSheet();
  }

  window.brFilterReimbSheet=function(){
    const view=document.getElementById('view-reembolsos');const table=view?.querySelector('.br-reimb-sheet');if(!table)return;
    const filters=[...table.querySelectorAll('.br-col-filter')].map(el=>({col:Number(el.dataset.col),value:norm(el.value)}));
    const rows=[...table.querySelectorAll('tbody tr[data-br-id]')];let visible=0;
    rows.forEach(tr=>{
      const cells=[...tr.children];let show=true;
      for(const f of filters){if(!f.value)continue;const text=norm(cells[f.col]?.textContent||'');if(f.col===3&&f.value==='recebido'){if(!(tr.classList.contains('br-reimb-received')))show=false;}else if(!text.includes(f.value))show=false;if(!show)break;}
      tr.style.display=show?'':'none';if(show)visible++;
    });
    const count=view.querySelector('.br-reimb-sheet-count');if(count)count.textContent=`${visible} de ${rows.length} reembolso(s)`;
  };

  let sortState={col:-1,dir:1};
  window.brReimbSort=function(col){
    const table=document.querySelector('#view-reembolsos .br-reimb-sheet');if(!table)return;
    sortState.dir=sortState.col===col?-sortState.dir:1;sortState.col=col;
    const tbody=table.querySelector('tbody');const rows=[...tbody.querySelectorAll('tr[data-br-id]')];
    rows.sort((a,b)=>{
      let av,bv;
      if(col===0){av=a.dataset.sortDate||'';bv=b.dataset.sortDate||'';}else if(col===6){av=Number(a.dataset.sortValue||0);bv=Number(b.dataset.sortValue||0);}else{av=norm(a.children[col]?.textContent||'');bv=norm(b.children[col]?.textContent||'');}
      return(av>bv?1:av<bv?-1:0)*sortState.dir;
    }).forEach(r=>tbody.appendChild(r));
  };

  const oldRender=window.renderReimbursements;
  if(typeof oldRender==='function')window.renderReimbursements=function(){const out=oldRender.apply(this,arguments);setTimeout(applySheet,30);return out;};
  const oldShow=window.showView;
  if(typeof oldShow==='function')window.showView=function(view,button){const out=oldShow.apply(this,arguments);if(view==='reembolsos')setTimeout(applySheet,60);return out;};
  function boot(){setTimeout(applySheet,250);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
