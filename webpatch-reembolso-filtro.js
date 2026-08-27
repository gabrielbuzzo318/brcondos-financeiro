(function(){
  const normalize=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();

  function mountReimbursementFilter(){
    const view=document.getElementById('view-reembolsos');
    if(!view)return;
    const tableWrap=view.querySelector('.table-wrap');
    if(!tableWrap||document.getElementById('reimb_search'))return;

    const bar=document.createElement('div');
    bar.className='filter-bar';
    bar.innerHTML=`
      <div class="field search">
        <label>Pesquisar reembolso</label>
        <input id="reimb_search" type="text" placeholder="Favorecido, quem reembolsa, descrição, categoria, status, data ou valor..." oninput="filterReimbursementsTable()">
      </div>
      <button class="btn" type="button" onclick="clearReimbursementsFilter()">Limpar</button>
      <div id="reimb_filter_result" class="filter-result"></div>`;
    tableWrap.parentNode.insertBefore(bar,tableWrap);
    filterReimbursementsTable();
  }

  window.filterReimbursementsTable=function(){
    const view=document.getElementById('view-reembolsos');
    if(!view)return;
    const q=normalize(document.getElementById('reimb_search')?.value||'');
    const rows=[...view.querySelectorAll('.table-wrap tbody tr')].filter(tr=>!tr.querySelector('.empty'));
    let visible=0;
    rows.forEach(tr=>{
      const hay=normalize(tr.textContent||'');
      const show=!q||hay.includes(q);
      tr.style.display=show?'':'none';
      if(show)visible++;
    });
    const result=document.getElementById('reimb_filter_result');
    if(result)result.textContent=`${visible} de ${rows.length} reembolso(s)`;
  };

  window.clearReimbursementsFilter=function(){
    const input=document.getElementById('reimb_search');
    if(input)input.value='';
    filterReimbursementsTable();
  };

  const original=window.renderReimbursements;
  if(typeof original==='function'){
    window.renderReimbursements=function(){
      const out=original.apply(this,arguments);
      setTimeout(mountReimbursementFilter,0);
      return out;
    };
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(mountReimbursementFilter,0),{once:true});
  else setTimeout(mountReimbursementFilter,0);
})();
