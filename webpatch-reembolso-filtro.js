(function(){
  const normalize=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();

  function isoFromBr(value){
    const m=String(value||'').match(/(\d{2})\/(\d{2})\/(\d{4})/);
    return m?`${m[3]}-${m[2]}-${m[1]}`:'';
  }

  function columnIndexes(view){
    const heads=[...view.querySelectorAll('.table-wrap thead th')].map(th=>normalize(th.textContent));
    return {
      paid:heads.findIndex(x=>x.includes('data paga')),
      status:heads.findIndex(x=>x==='status'||x.includes('status'))
    };
  }

  function reimbursementRows(view){
    return [...view.querySelectorAll('.table-wrap tbody tr')].filter(tr=>!tr.querySelector('.empty'));
  }

  function refreshStatusOptions(){
    const view=document.getElementById('view-reembolsos');
    const select=document.getElementById('reimb_status');
    if(!view||!select)return;
    const {status}=columnIndexes(view);
    if(status<0)return;
    const current=select.value;
    const values=[...new Set(reimbursementRows(view).map(tr=>String(tr.children[status]?.textContent||'').trim()).filter(Boolean))]
      .sort((a,b)=>a.localeCompare(b,'pt-BR',{sensitivity:'base'}));
    select.innerHTML='<option value="">Todos</option>'+values.map(v=>`<option value="${String(v).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')}">${String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;')}</option>`).join('');
    if(values.includes(current))select.value=current;
  }

  function mountReimbursementFilter(){
    const view=document.getElementById('view-reembolsos');
    if(!view)return;
    const tableWrap=view.querySelector('.table-wrap');
    if(!tableWrap)return;

    const existing=document.getElementById('reimb_search');
    if(existing){
      refreshStatusOptions();
      filterReimbursementsTable();
      return;
    }

    const bar=document.createElement('div');
    bar.className='filter-bar';
    bar.innerHTML=`
      <div class="field search">
        <label>Pesquisar reembolso</label>
        <input id="reimb_search" type="text" placeholder="Favorecido, quem reembolsa, descrição, categoria, status, data ou valor..." oninput="filterReimbursementsTable()">
      </div>
      <div class="field">
        <label>De</label>
        <input id="reimb_from" type="date" onchange="filterReimbursementsTable()">
      </div>
      <div class="field">
        <label>Até</label>
        <input id="reimb_to" type="date" onchange="filterReimbursementsTable()">
      </div>
      <div class="field">
        <label>Status</label>
        <select id="reimb_status" onchange="filterReimbursementsTable()"><option value="">Todos</option></select>
      </div>
      <button class="btn" type="button" onclick="clearReimbursementsFilter()">Limpar filtros</button>
      <div id="reimb_filter_result" class="filter-result"></div>`;
    tableWrap.parentNode.insertBefore(bar,tableWrap);
    refreshStatusOptions();
    filterReimbursementsTable();
  }

  window.filterReimbursementsTable=function(){
    const view=document.getElementById('view-reembolsos');
    if(!view)return;
    const q=normalize(document.getElementById('reimb_search')?.value||'');
    const from=String(document.getElementById('reimb_from')?.value||'');
    const to=String(document.getElementById('reimb_to')?.value||'');
    const wantedStatus=normalize(document.getElementById('reimb_status')?.value||'');
    const {paid,status}=columnIndexes(view);
    const rows=reimbursementRows(view);
    let visible=0;

    rows.forEach(tr=>{
      const hay=normalize(tr.textContent||'');
      const rowDate=paid>=0?isoFromBr(tr.children[paid]?.textContent||''):'';
      const rowStatus=status>=0?normalize(tr.children[status]?.textContent||''):'';
      const matchesSearch=!q||hay.includes(q);
      const matchesFrom=!from||!!rowDate&&rowDate>=from;
      const matchesTo=!to||!!rowDate&&rowDate<=to;
      const matchesStatus=!wantedStatus||rowStatus===wantedStatus;
      const show=matchesSearch&&matchesFrom&&matchesTo&&matchesStatus;
      tr.style.display=show?'':'none';
      if(show)visible++;
    });

    const result=document.getElementById('reimb_filter_result');
    if(result)result.textContent=`${visible} de ${rows.length} reembolso(s)`;
  };

  window.clearReimbursementsFilter=function(){
    ['reimb_search','reimb_from','reimb_to'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    const status=document.getElementById('reimb_status');
    if(status)status.value='';
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
