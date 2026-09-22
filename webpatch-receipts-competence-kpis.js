(function(){
  function n(v){const x=Number(v||0);return Number.isFinite(x)?x:0;}
  function normLabel(v){
    return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
  }
  function todayYmd(){
    const d=new Date();
    const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
    return y+'-'+m+'-'+day;
  }
  function updateReceiptCompetenceCards(){
    const view=document.getElementById('view-recibos');
    if(!view)return;

    const comp=document.getElementById('receipt_comp_filter')?.value||'';
    const data=(Array.isArray(receipts)?receipts:[]).filter(x=>!comp||String(x.competence||'')===comp);
    const today=todayYmd();

    const liquidated=data.filter(x=>String(x.status||'')==='gerado');
    const pending=data.filter(x=>String(x.status||'')!=='gerado');
    const overdue=pending.filter(x=>String(x.issueDate||'') && String(x.issueDate)<today);
    const open=pending.filter(x=>!String(x.issueDate||'') || String(x.issueDate)>=today);
    const totalValue=data.reduce((sum,x)=>sum+n(x.value),0);

    const cards=[...view.querySelectorAll('.cards.grid .card')];
    cards.forEach(card=>{
      const labelEl=card.querySelector('.kpi-label');
      const valueEl=card.querySelector('.kpi-value');
      if(!labelEl||!valueEl)return;
      const label=normLabel(labelEl.textContent);

      if(label==='EM ABERTO') valueEl.textContent=String(open.length);
      else if(label==='VENCIDOS') valueEl.textContent=String(overdue.length);
      else if(label==='LIQUIDADOS') valueEl.textContent=String(liquidated.length);
      else if(label==='TOTAL') valueEl.textContent=String(data.length);
      else if(label==='PENDENTES') valueEl.textContent=String(pending.length);
      else if(label==='GERADOS') valueEl.textContent=String(liquidated.length);
      else if(label==='VALOR TOTAL') valueEl.textContent=money(totalValue);
    });
  }

  const previousFilter=window.filterReceiptsTable;
  if(typeof previousFilter==='function'){
    window.filterReceiptsTable=function(){
      const result=previousFilter.apply(this,arguments);
      try{updateReceiptCompetenceCards();}catch(e){console.error('Cards por competência',e);}
      return result;
    };
  }

  const previousRender=window.renderReceipts;
  if(typeof previousRender==='function'){
    window.renderReceipts=function(){
      const result=previousRender.apply(this,arguments);
      setTimeout(()=>{try{updateReceiptCompetenceCards();}catch(e){console.error('Cards por competência',e);}},0);
      return result;
    };
  }

  window.updateReceiptCompetenceCards=updateReceiptCompetenceCards;
})();