(function(){
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const hoje=()=>typeof today==='function'?today():new Date().toISOString().slice(0,10);

  function addDaysIso(date,days){
    const m=String(date||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!m)return date||'';
    const d=new Date(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3])+Number(days||0)));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
  }

  function effectivePayableStatus(p){
    if(typeof payableEffectiveStatus==='function')return payableEffectiveStatus(p);
    if(p?.status==='pago'||p?.status==='agendado')return p.status;
    if(p?.due&&String(p.due)<hoje())return 'vencido';
    return 'aberto';
  }

  function payableStats(){
    const list=Array.isArray(payables)?payables:[];
    const overdue=list.filter(p=>effectivePayableStatus(p)==='vencido');
    const start=hoje(),end=addDaysIso(start,7);
    const upcoming=list.filter(p=>{
      const due=String(p?.due||'');
      const st=effectivePayableStatus(p);
      return /^\d{4}-\d{2}-\d{2}$/.test(due)&&st!=='pago'&&due>=start&&due<=end;
    });
    return {
      overdueCount:overdue.length,
      overdueValue:overdue.reduce((s,x)=>s+Number(x?.value||0),0),
      upcomingCount:upcoming.length,
      upcomingValue:upcoming.reduce((s,x)=>s+Number(x?.value||0),0)
    };
  }

  function fixDashboardCards(){
    const root=document.getElementById('view-dashboard');
    if(!root)return;
    const stats=payableStats();
    const cards=[...root.querySelectorAll('.br-pending')];

    const overdue=cards.find(c=>norm(c.querySelector('.label')?.textContent)==='contas vencidas');
    if(overdue){
      overdue.classList.remove('danger','success','warning','info');
      overdue.classList.add(stats.overdueCount?'danger':'success');
      overdue.onclick=()=>window.brOpenPayablesFiltered?.('vencido');
      overdue.innerHTML=`<div class="label">Contas vencidas</div><div class="value ${stats.overdueCount?'bad':'good'}">${stats.overdueCount}</div><div class="note">${stats.overdueCount?(typeof money==='function'?money(stats.overdueValue):stats.overdueValue):'Nenhuma conta vencida'}</div>`;
    }

    let upcoming=cards.find(c=>norm(c.querySelector('.label')?.textContent)==='contas a vencer');
    if(!upcoming){
      upcoming=cards.find(c=>norm(c.querySelector('.label')?.textContent)==='integracoes');
    }
    if(upcoming){
      upcoming.classList.remove('danger','success','warning','info');
      upcoming.classList.add(stats.upcomingCount?'warning':'success');
      upcoming.onclick=()=>window.brOpenPayablesFiltered?.('proximos7');
      upcoming.innerHTML=`<div class="label">Contas a vencer</div><div class="value ${stats.upcomingCount?'':'good'}">${stats.upcomingCount}</div><div class="note">${stats.upcomingCount?(typeof money==='function'?money(stats.upcomingValue):stats.upcomingValue):'Nenhuma conta nos próximos 7 dias'}</div>`;
    }
  }

  function currentWindow(){
    const raw=hoje();
    const [y,m,d]=raw.split('-').map(Number);
    const end=new Date(y,m-1,d);
    const monthStart=new Date(y,m-1,1);
    const start=new Date(end);start.setDate(start.getDate()-14);
    if(start<monthStart)start.setTime(monthStart.getTime());
    const iso=x=>`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;
    return {start:iso(start),end:iso(end)};
  }

  function fixRecent(){
    const card=document.querySelector('#view-dashboard .br-recent-card');
    if(!card)return;
    const period=currentWindow();
    const rows=(Array.isArray(transactions)?transactions:[])
      .filter(x=>{const d=String(x?.date||'');return /^\d{4}-\d{2}-\d{2}$/.test(d)&&d>=period.start&&d<=period.end;})
      .slice().sort((a,b)=>String(b?.date||'').localeCompare(String(a?.date||''))||Number(b?.id||0)-Number(a?.id||0));

    const sub=card.querySelector('.br-recent-head span');
    if(sub)sub.textContent=`Movimentações dos últimos 15 dias do mês atual • ${typeof formatDate==='function'?formatDate(period.start):period.start} a ${typeof formatDate==='function'?formatDate(period.end):period.end}`;
    const tbody=card.querySelector('tbody');
    if(!tbody)return;
    tbody.innerHTML=rows.length?rows.map(x=>`<tr>
      <td>${typeof formatDate==='function'?formatDate(x.date):esc(x.date||'-')}</td>
      <td>${esc(x.description||'-')}</td>
      <td>${esc(x.party||'-')}</td>
      <td>${typeof statusBadge==='function'?statusBadge(x.status):esc(x.status||'-')}</td>
      <td class="amount ${x.type==='entrada'?'pos':'neg'}">${x.type==='saida'?'- ':''}${typeof money==='function'?money(x.value):esc(x.value||0)}</td>
    </tr>`).join(''):`<tr><td colspan="5" class="empty">Nenhuma movimentação nos últimos 15 dias deste mês.</td></tr>`;
  }

  function setFinanceiroFilters({status='',from='',to=''}){
    const s=document.getElementById('fin_status');
    const f=document.getElementById('fin_from');
    const t=document.getElementById('fin_to');
    const q=document.getElementById('fin_search');
    if(q)q.value='';
    if(s)s.value=status;
    if(f)f.value=from;
    if(t)t.value=to;
    if(typeof filterFinanceiroTable==='function')filterFinanceiroTable();
    document.querySelector('#view-financeiro .filter-bar')?.scrollIntoView({behavior:'smooth',block:'start'});
  }

  window.brOpenPayablesFiltered=function(mode){
    const btn=document.querySelector('#app .nav button[data-view="financeiro"]');
    if(typeof showView==='function')showView('financeiro',btn||undefined);
    setTimeout(()=>{
      if(mode==='vencido')setFinanceiroFilters({status:'vencido'});
      else if(mode==='proximos7')setFinanceiroFilters({from:hoje(),to:addDaysIso(hoje(),7)});
      else if(['aberto','agendado','pago'].includes(mode))setFinanceiroFilters({status:mode});
      else setFinanceiroFilters({});
    },180);
  };

  function bindFinanceiroCards(){
    const root=document.getElementById('view-financeiro');if(!root)return;
    const cards=[...root.querySelectorAll('.cards.grid .card')];
    cards.forEach(card=>{
      const label=norm(card.querySelector('.kpi-label')?.textContent);
      const mode=label==='vencido'?'vencido':label==='a pagar'?'aberto':label==='agendado'?'agendado':label==='pago'?'pago':'';
      if(!mode)return;
      card.style.cursor='pointer';
      card.title=`Filtrar contas: ${card.querySelector('.kpi-label')?.textContent||''}`;
      card.onclick=()=>window.brOpenPayablesFiltered(mode);
    });
  }

  function refreshDashboard(){setTimeout(()=>{fixDashboardCards();fixRecent();},140);}

  const prevDash=window.renderDashboard;
  if(typeof prevDash==='function')window.renderDashboard=function(){const out=prevDash.apply(this,arguments);refreshDashboard();return out;};

  const prevFin=window.renderFinanceiro;
  if(typeof prevFin==='function')window.renderFinanceiro=function(){const out=prevFin.apply(this,arguments);setTimeout(bindFinanceiroCards,30);return out;};

  const prevShow=window.showView;
  if(typeof prevShow==='function')window.showView=function(view,button){const out=prevShow.apply(this,arguments);if(view==='dashboard')refreshDashboard();if(view==='financeiro')setTimeout(bindFinanceiroCards,80);return out;};

  if(!document.getElementById('br-dashboard-data-fix-style')){
    const s=document.createElement('style');s.id='br-dashboard-data-fix-style';s.textContent='#view-financeiro .cards.grid .card{transition:.15s ease}#view-financeiro .cards.grid .card:hover{transform:translateY(-1px);box-shadow:0 8px 22px rgba(30,45,55,.08)}';document.head.appendChild(s);
  }
  setTimeout(()=>{fixDashboardCards();fixRecent();bindFinanceiroCards();},900);
})();