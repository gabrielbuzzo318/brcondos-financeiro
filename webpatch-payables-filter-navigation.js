(function(){
  const STORAGE_KEY='brcondos_filter_state_v1';
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const hoje=()=>typeof today==='function'?today():new Date().toISOString().slice(0,10);

  function addDaysIso(date,days){
    const m=String(date||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!m)return date||'';
    const d=new Date(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3])+Number(days||0)));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
  }

  function filterForMode(mode){
    if(mode==='vencido')return {fin_search:'',fin_from:'',fin_to:'',fin_status:'vencido'};
    if(mode==='proximos7')return {fin_search:'',fin_from:hoje(),fin_to:addDaysIso(hoje(),7),fin_status:''};
    if(mode==='aberto')return {fin_search:'',fin_from:'',fin_to:'',fin_status:'aberto'};
    if(mode==='agendado')return {fin_search:'',fin_from:'',fin_to:'',fin_status:'agendado'};
    if(mode==='pago')return {fin_search:'',fin_from:'',fin_to:'',fin_status:'pago'};
    return {fin_search:'',fin_from:'',fin_to:'',fin_status:''};
  }

  function persistFilter(values){
    let state={};
    try{state=JSON.parse(sessionStorage.getItem(STORAGE_KEY)||'{}')||{};}catch(_){state={};}
    Object.assign(state,values);
    try{sessionStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch(_){ }
  }

  function applyFilter(values){
    Object.entries(values).forEach(([id,value])=>{
      const el=document.getElementById(id);
      if(!el)return;
      el.value=value;
      try{
        const ev=(el.tagName==='INPUT'&&(el.type==='text'||el.type==='search'))?'input':'change';
        el.dispatchEvent(new Event(ev,{bubbles:true}));
      }catch(_){ }
    });
    if(typeof filterFinanceiroTable==='function')filterFinanceiroTable();
  }

  window.brOpenPayablesFiltered=function(mode){
    const values=filterForMode(mode);
    persistFilter(values);

    const btn=document.querySelector('#app .nav button[data-view="financeiro"]');
    if(typeof showView==='function')showView('financeiro',btn||undefined);

    // Aplica depois do render e novamente no frame seguinte para vencer qualquer restauração assíncrona.
    requestAnimationFrame(()=>{
      applyFilter(values);
      requestAnimationFrame(()=>{
        persistFilter(values);
        applyFilter(values);
        document.querySelector('#view-financeiro .filter-bar')?.scrollIntoView({behavior:'smooth',block:'start'});
      });
    });
  };

  document.addEventListener('click',function(e){
    // Cards do Dashboard.
    const pending=e.target?.closest?.('#view-dashboard .br-pending');
    if(pending){
      const label=norm(pending.querySelector('.label')?.textContent);
      if(label==='contas vencidas'||label==='contas a vencer'){
        e.preventDefault();
        e.stopImmediatePropagation();
        window.brOpenPayablesFiltered(label==='contas vencidas'?'vencido':'proximos7');
        return;
      }
    }

    // Cards-resumo do A Pagar.
    const card=e.target?.closest?.('#view-financeiro .cards.grid .card');
    if(card){
      const label=norm(card.querySelector('.kpi-label')?.textContent);
      const modes={'vencido':'vencido','a pagar':'aberto','agendado':'agendado','pago':'pago'};
      const mode=modes[label];
      if(mode){
        e.preventDefault();
        e.stopImmediatePropagation();
        window.brOpenPayablesFiltered(mode);
      }
    }
  },true);
})();