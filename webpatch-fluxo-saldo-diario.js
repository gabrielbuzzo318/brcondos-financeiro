(function(){
  const originalRenderFluxo=window.renderFluxo;
  if(typeof originalRenderFluxo!=='function')return;

  function validDate(v){
    return /^\d{4}-\d{2}-\d{2}$/.test(String(v||''));
  }

  function selectedMonth(){
    const explicit=String(window.__brFluxSelectedMonth||'');
    if(/^\d{4}-\d{2}$/.test(explicit))return explicit;
    const d=String(typeof today==='function'?today():'');
    if(validDate(d))return d.slice(0,7);
    const now=new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  }

  function sourceTransactions(){
    return Array.isArray(window.__brAllTransactions)
      ? window.__brAllTransactions
      : (Array.isArray(transactions)?transactions:[]);
  }

  function buildDailyBalances(){
    const byDay=new Map();
    sourceTransactions().forEach(t=>{
      if(t?.status!=='pago'||!validDate(t?.date))return;
      if(!byDay.has(t.date))byDay.set(t.date,{date:t.date,entradas:0,saidas:0});
      const day=byDay.get(t.date);
      const value=Number(t.value||0);
      if(t.type==='entrada')day.entradas+=value;
      else if(t.type==='saida')day.saidas+=value;
    });

    let saldo=0;
    const allRows=[];
    [...byDay.values()].sort((a,b)=>a.date.localeCompare(b.date)).forEach(day=>{
      const movimento=day.entradas-day.saidas;
      saldo+=movimento;
      allRows.push({...day,movimento,saldo,month:day.date.slice(0,7)});
    });

    const month=selectedMonth();
    return allRows.filter(x=>x.month===month).sort((a,b)=>b.date.localeCompare(a.date));
  }

  function renderDailyBalanceBlock(){
    const root=document.getElementById('view-fluxo');
    if(!root)return;
    root.querySelector('#brDailyBalanceBlock')?.remove();

    const rows=buildDailyBalances();
    const block=document.createElement('div');
    block.id='brDailyBalanceBlock';
    block.className='card';
    block.style.marginBottom='18px';

    if(!rows.length){
      block.innerHTML='<div class="panel-title">Saldo diário</div><div class="empty">Ainda não há movimentações pagas/recebidas neste período para calcular o saldo diário.</div>';
    }else{
      block.innerHTML=`
        <div class="section-title" style="margin-bottom:12px">
          <div>
            <h2 style="font-size:16px">Saldo diário</h2>
            <span>Fechamento de cada dia • considera somente valores pagos/recebidos • o saldo acumulado continua de um mês para o outro</span>
          </div>
        </div>
        <div class="table-wrap" style="max-height:360px;overflow:auto">
          <table style="min-width:720px">
            <thead><tr><th>Data</th><th>Entradas do dia</th><th>Saídas do dia</th><th>Movimento do dia</th><th>Saldo acumulado</th></tr></thead>
            <tbody>
              ${rows.map(x=>`<tr>
                <td><b>${formatDate(x.date)}</b></td>
                <td class="amount pos">${money(x.entradas)}</td>
                <td class="amount neg">${money(x.saidas)}</td>
                <td class="amount ${x.movimento>=0?'pos':'neg'}">${x.movimento<0?'- ':''}${money(Math.abs(x.movimento))}</td>
                <td class="amount ${x.saldo>=0?'pos':'neg'}"><b>${x.saldo<0?'- ':''}${money(Math.abs(x.saldo))}</b></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    }

    const cards=root.querySelector('.cards.grid');
    if(cards)cards.insertAdjacentElement('afterend',block);
    else root.prepend(block);
  }

  window.renderFluxo=function(){
    const result=originalRenderFluxo.apply(this,arguments);
    try{renderDailyBalanceBlock();}catch(err){console.error('BRCONDOS SALDO DIARIO:',err);}
    return result;
  };
})();