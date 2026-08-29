(function(){
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const hoje=()=>typeof today==='function'?today():new Date().toISOString().slice(0,10);

  function addDaysIso(date,days){
    const m=String(date||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!m)return date||'';
    const d=new Date(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3])+Number(days||0)));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
  }

  function upcomingStats(){
    const start=hoje();
    const end=addDaysIso(start,7);
    const rows=(window.payables||[]).filter(p=>{
      const st=norm(p?.status);
      const due=String(p?.due||'');
      if(!/^\d{4}-\d{2}-\d{2}$/.test(due))return false;
      if(/pago|recebido|cancel/.test(st))return false;
      return due>=start&&due<=end;
    });
    return {
      count:rows.length,
      value:rows.reduce((s,x)=>s+Number(x?.value||0),0)
    };
  }

  function updateCard(){
    const root=document.getElementById('view-dashboard');
    if(!root)return;
    const cards=[...root.querySelectorAll('.br-pending')];
    const card=cards.find(el=>norm(el.querySelector('.label')?.textContent)==='integracoes');
    if(!card)return;

    const stats=upcomingStats();
    card.classList.remove('danger','success','warning','info');
    card.classList.add(stats.count?'warning':'success');
    card.setAttribute('onclick',"brDashOpen('financeiro')");
    card.innerHTML=`
      <div class="label">Contas a vencer</div>
      <div class="value ${stats.count?'':'good'}">${stats.count}</div>
      <div class="note">${stats.count?(typeof money==='function'?money(stats.value):stats.value):'Nenhuma conta nos próximos 7 dias'}</div>`;
  }

  const prevRenderDashboard=window.renderDashboard;
  if(typeof prevRenderDashboard==='function'){
    window.renderDashboard=function(){
      const out=prevRenderDashboard.apply(this,arguments);
      setTimeout(updateCard,60);
      return out;
    };
  }

  const prevShowView=window.showView;
  if(typeof prevShowView==='function'){
    window.showView=function(view,button){
      const out=prevShowView.apply(this,arguments);
      if(view==='dashboard')setTimeout(updateCard,80);
      return out;
    };
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(updateCard,250),{once:true});
  else setTimeout(updateCard,250);
})();