(function(){
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const isoLocal=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  function currentWindow(){
    const raw=String(typeof today==='function'?today():'');
    let end;
    if(/^\d{4}-\d{2}-\d{2}$/.test(raw)){
      const [y,m,d]=raw.split('-').map(Number);
      end=new Date(y,m-1,d);
    }else end=new Date();
    const start=new Date(end);
    start.setDate(start.getDate()-14);
    return {start:isoLocal(start),end:isoLocal(end)};
  }

  function allTransactions(){
    try{if(typeof transactions!=='undefined'&&Array.isArray(transactions))return transactions;}catch(_){ }
    return Array.isArray(window.transactions)?window.transactions:[];
  }

  function displayDate(iso){
    if(typeof formatDate==='function')return formatDate(iso);
    const m=String(iso||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m?`${m[3]}/${m[2]}/${m[1]}`:String(iso||'');
  }

  function recentRows(period){
    return allTransactions().filter(x=>{
      const date=String(x?.date||'');
      return /^\d{4}-\d{2}-\d{2}$/.test(date)&&date>=period.start&&date<=period.end;
    }).slice().sort((a,b)=>String(b?.date||'').localeCompare(String(a?.date||''))||Number(b?.id||0)-Number(a?.id||0));
  }

  function rowsHtml(rows){
    return rows.length?rows.map(x=>`<tr>
      <td>${displayDate(x.date)}</td>
      <td>${esc(x.description||'-')}</td>
      <td>${esc(x.party||'-')}</td>
      <td>${typeof statusBadge==='function'?statusBadge(x.status):esc(x.status||'-')}</td>
      <td class="amount ${x.type==='entrada'?'pos':'neg'}">${x.type==='saida'?'- ':''}${typeof money==='function'?money(x.value):esc(x.value||0)}</td>
    </tr>`).join(''):`<tr><td colspan="5" class="empty">Nenhuma movimentação nos últimos 15 dias.</td></tr>`;
  }

  function ensureStyles(){
    if(document.getElementById('br-dashboard-recent-style'))return;
    const s=document.createElement('style');
    s.id='br-dashboard-recent-style';
    s.textContent=`
      #view-dashboard .br-recent-card{margin-top:16px;background:#fff;border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow);padding:18px}
      #view-dashboard .br-recent-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:14px}
      #view-dashboard .br-recent-head h3{margin:0;font-size:15px;color:var(--text)}
      #view-dashboard .br-recent-head span{display:block;margin-top:4px;font-size:11px;color:var(--muted)}
      #view-dashboard .br-recent-card .table-wrap{box-shadow:none;max-height:390px;overflow:auto}
      #view-dashboard .br-recent-card table{min-width:760px}
      #view-dashboard .br-recent-card thead th{position:sticky;top:0;z-index:2}
      @media(max-width:650px){#view-dashboard .br-recent-head{align-items:center}}
    `;
    document.head.appendChild(s);
  }

  function buildCard(period,rows){
    const card=document.createElement('div');
    card.className='br-recent-card';
    card.innerHTML=`
      <div class="br-recent-head">
        <div><h3>Movimentações recentes</h3><span>Movimentações dos últimos 15 dias • ${displayDate(period.start)} a ${displayDate(period.end)}</span></div>
        <button type="button" class="btn small primary" onclick="brDashOpen('fluxo')">Ver fluxo</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Data</th><th>Descrição</th><th>Cliente / Fornecedor</th><th>Status</th><th>Valor</th></tr></thead>
          <tbody data-br-recent-period="${period.start}|${period.end}">${rowsHtml(rows)}</tbody>
        </table>
      </div>`;
    return card;
  }

  function renderRecent(){
    const root=document.getElementById('view-dashboard');
    if(!root)return;
    ensureStyles();
    root.querySelector('.br-recent-card')?.remove();
    const period=currentWindow();
    const card=buildCard(period,recentRows(period));
    const dashboardPanel=root.querySelector('.br-dash-bottom');
    if(dashboardPanel)dashboardPanel.insertAdjacentElement('afterend',card);else root.appendChild(card);
  }

  function repairRecent(){
    const root=document.getElementById('view-dashboard');
    const card=root?.querySelector('.br-recent-card');
    if(!card)return;
    const period=currentWindow();
    const periodKey=`${period.start}|${period.end}`;
    const span=card.querySelector('.br-recent-head span');
    const desired=`Movimentações dos últimos 15 dias • ${displayDate(period.start)} a ${displayDate(period.end)}`;
    if(span&&span.textContent!==desired)span.textContent=desired;
    const body=card.querySelector('tbody');
    if(body&&body.dataset.brRecentPeriod!==periodKey){
      body.innerHTML=rowsHtml(recentRows(period));
      body.dataset.brRecentPeriod=periodKey;
    }
  }

  let repairTimer=null;
  function scheduleRepair(){
    clearTimeout(repairTimer);
    repairTimer=setTimeout(repairRecent,25);
  }

  function watchRecent(){
    const root=document.getElementById('view-dashboard');
    if(!root||root.dataset.brRecentWatch==='1')return;
    root.dataset.brRecentWatch='1';
    new MutationObserver(scheduleRepair).observe(root,{childList:true,subtree:true,characterData:true});
  }

  const prevRenderDashboard=window.renderDashboard;
  if(typeof prevRenderDashboard==='function')window.renderDashboard=function(){const out=prevRenderDashboard.apply(this,arguments);setTimeout(renderRecent,40);setTimeout(scheduleRepair,210);return out;};
  const prevShowView=window.showView;
  if(typeof prevShowView==='function')window.showView=function(view,button){const out=prevShowView.apply(this,arguments);if(view==='dashboard'){setTimeout(renderRecent,55);setTimeout(scheduleRepair,220);}return out;};

  function boot(){watchRecent();setTimeout(renderRecent,180);setTimeout(scheduleRepair,360);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();