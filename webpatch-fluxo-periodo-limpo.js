(function(){
  const monthNames=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const validMonth=v=>/^\d{4}-\d{2}$/.test(String(v||''));
  const currentMonth=()=>{
    const d=String(typeof today==='function'?today():'');
    if(/^\d{4}-\d{2}-\d{2}$/.test(d))return d.slice(0,7);
    const now=new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  };
  const monthLabel=prefix=>{
    const [y,m]=String(prefix||'').split('-').map(Number);
    return `${monthNames[(m||1)-1]||''}/${y||''}`;
  };

  let selectedFluxMonth=currentMonth();

  function availableMonths(list){
    const set=new Set([currentMonth()]);
    (Array.isArray(list)?list:[]).forEach(t=>{
      const d=String(t?.date||'');
      if(/^\d{4}-\d{2}-\d{2}$/.test(d))set.add(d.slice(0,7));
    });
    return [...set].sort((a,b)=>b.localeCompare(a));
  }

  function ensureStyles(){
    if(document.getElementById('br-flux-clean-period-styles'))return;
    const style=document.createElement('style');
    style.id='br-flux-clean-period-styles';
    style.textContent=`
      #view-fluxo .br-flux-head-right{display:flex;align-items:flex-end;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-left:auto}
      #view-fluxo .br-flux-period{min-width:150px}
      #view-fluxo .br-flux-period label{display:block;margin:0 0 5px;font-size:11px;font-weight:800;color:#66747e}
      #view-fluxo .br-flux-period select{height:42px;min-width:150px;border-radius:8px}
      #view-dashboard .br-dashboard-recent-full{grid-template-columns:1fr!important}
      @media(max-width:720px){
        #view-fluxo .br-flux-head-right{width:100%;justify-content:flex-start;margin-left:0}
      }
    `;
    document.head.appendChild(style);
  }

  function cleanDashboard(){
    const root=document.getElementById('view-dashboard');
    if(!root)return;
    const grids=[...root.querySelectorAll('.grid.two-cols')];
    grids.forEach(grid=>{
      const summaryCard=[...grid.children].find(card=>{
        const title=card.querySelector('.panel-title');
        return String(title?.textContent||'').trim().toLowerCase()==='resumo do caixa';
      });
      if(summaryCard){
        summaryCard.remove();
        grid.classList.add('br-dashboard-recent-full');
        grid.style.gridTemplateColumns='1fr';
      }
    });
  }

  function removeFluxSummaryCards(root){
    const cards=root.querySelector('.cards.grid');
    if(cards)cards.remove();
  }

  function removeStatusColumn(root){
    root.querySelectorAll('table').forEach(table=>{
      const headers=[...table.querySelectorAll('thead th')];
      const index=headers.findIndex(th=>String(th.textContent||'').trim().toLowerCase()==='status');
      if(index<0)return;
      headers[index]?.remove();
      table.querySelectorAll('tbody tr').forEach(tr=>{
        const cells=[...tr.children];
        cells[index]?.remove();
      });
    });
  }

  function addPeriodSelector(root, allTransactions){
    const months=availableMonths(allTransactions);
    if(selectedFluxMonth!=='all'&&!months.includes(selectedFluxMonth))selectedFluxMonth=currentMonth();

    const section=[...root.querySelectorAll('.section-title')].find(el=>el.querySelector('h2')&&String(el.querySelector('h2').textContent||'').trim().toLowerCase()==='fluxo de caixa');
    if(!section)return;

    const period=document.createElement('div');
    period.className='field br-flux-period';
    period.innerHTML=`<label>Período</label><select onchange="setFluxMonth(this.value)"><option value="all" ${selectedFluxMonth==='all'?'selected':''}>Todos</option>${months.map(m=>`<option value="${m}" ${m===selectedFluxMonth?'selected':''}>${monthLabel(m)}</option>`).join('')}</select>`;

    const actions=section.querySelector('.actions');
    if(actions){
      const right=document.createElement('div');
      right.className='br-flux-head-right';
      actions.parentNode.insertBefore(right,actions);
      right.appendChild(period);
      right.appendChild(actions);
    }else{
      period.style.marginLeft='auto';
      section.appendChild(period);
    }
  }

  window.setFluxMonth=function(prefix){
    if(prefix!=='all'&&!validMonth(prefix))return;
    selectedFluxMonth=String(prefix);
    window.__brFluxSelectedMonth=selectedFluxMonth;
    if(typeof window.renderFluxo==='function')window.renderFluxo();
  };

  const previousDashboard=window.renderDashboard;
  if(typeof previousDashboard==='function'){
    window.renderDashboard=function(){
      const result=previousDashboard.apply(this,arguments);
      try{ensureStyles();cleanDashboard();}catch(err){console.error('BRCONDOS DASH CLEAN:',err);}
      return result;
    };
  }

  const previousFluxo=window.renderFluxo;
  if(typeof previousFluxo==='function'){
    window.renderFluxo=function(){
      ensureStyles();
      const allTransactions=Array.isArray(transactions)?transactions:[];
      if(selectedFluxMonth!=='all'&&!availableMonths(allTransactions).includes(selectedFluxMonth))selectedFluxMonth=currentMonth();
      window.__brAllTransactions=allTransactions;
      window.__brFluxSelectedMonth=selectedFluxMonth;
      const filtered=selectedFluxMonth==='all'?allTransactions:allTransactions.filter(t=>String(t?.date||'').startsWith(selectedFluxMonth));
      let result;
      try{
        transactions=filtered;
        result=previousFluxo.apply(this,arguments);
      }finally{
        transactions=allTransactions;
      }
      try{
        const root=document.getElementById('view-fluxo');
        if(root){
          removeFluxSummaryCards(root);
          removeStatusColumn(root);
          addPeriodSelector(root,allTransactions);
        }
      }catch(err){console.error('BRCONDOS FLUX CLEAN:',err);}
      return result;
    };
  }

  window.__brFluxSelectedMonth=selectedFluxMonth;
  setTimeout(()=>{
    try{ensureStyles();cleanDashboard();}catch(_){ }
  },0);
})();