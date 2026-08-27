(function(){
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const escHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function accountForTransaction(t){
    const cat=norm(t?.category);
    if(!cat)return null;
    return chartAccounts.find(a=>norm(a.name)===cat && (!t.type || a.type===t.type))||null;
  }

  function goesToDre(t){
    const account=accountForTransaction(t);
    return account ? account.dre!==false : true;
  }

  function periodLabel(prefix){
    const [y,m]=String(prefix||'').split('-').map(Number);
    const names=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    return `${names[(m||1)-1]||''}/${y||''}`;
  }

  function baseRows(prefix){
    return transactions.filter(x=>
      String(x.date||'').startsWith(prefix) &&
      x.status==='pago' &&
      goesToDre(x)
    );
  }

  function widenDetailsModal(){
    const modal=document.getElementById('modal');
    const card=modal?.querySelector('.modal-card');
    if(card){
      card.style.width='min(1180px,96vw)';
      card.style.maxWidth='1180px';
    }
    const wrap=card?.querySelector('.table-wrap');
    if(wrap)wrap.style.overflowX='auto';
    const table=wrap?.querySelector('table');
    if(table){
      table.style.minWidth='980px';
      table.style.width='100%';
    }
  }

  window.openDreDetails=function(kind,encodedCategory=''){
    const prefix=String(document.getElementById('dre_month')?.value||'').trim();
    if(!/^\d{4}-\d{2}$/.test(prefix))return alert('Selecione um período válido na DRE.');

    const category=decodeURIComponent(String(encodedCategory||''));
    let title='Lançamentos da DRE';
    let rows=baseRows(prefix);

    if(kind==='expense'){
      rows=rows.filter(x=>x.type==='saida'&&norm(x.category)===norm(category));
      title=`${category} — ${periodLabel(prefix)}`;
    }else if(kind==='all-expenses'){
      rows=rows.filter(x=>x.type==='saida');
      title=`Total de despesas — ${periodLabel(prefix)}`;
    }else{
      rows=rows.filter(x=>x.type==='entrada');
      title=`Receita operacional — ${periodLabel(prefix)}`;
    }

    rows=[...rows].sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||Number(a.id||0)-Number(b.id||0));
    const total=rows.reduce((s,x)=>s+Number(x.value||0),0);

    openModal(title,`
      <div class="cards grid" style="grid-template-columns:repeat(2,minmax(0,1fr));margin-bottom:14px">
        <div class="card accent-blue">
          <div class="kpi-label">LANÇAMENTOS</div>
          <div class="kpi-value">${rows.length}</div>
        </div>
        <div class="card ${kind==='expense'||kind==='all-expenses'?'accent-orange':'accent-green'}">
          <div class="kpi-label">TOTAL</div>
          <div class="kpi-value">${money(total)}</div>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Data</th><th>Descrição</th><th>Conta</th><th>Cliente / Fornecedor</th><th>Status</th><th>Valor</th></tr></thead>
          <tbody>
            ${rows.length?rows.map(x=>`<tr>
              <td>${escHtml(formatDate(x.date))}</td>
              <td><b>${escHtml(x.description||'-')}</b></td>
              <td>${escHtml(x.category||'-')}</td>
              <td>${escHtml(x.party||'-')}</td>
              <td>${statusBadge(x.status)}</td>
              <td class="amount ${x.type==='entrada'?'pos':'neg'}">${money(x.value)}</td>
            </tr>`).join(''):`<tr><td colspan="6" class="empty">Nenhum lançamento encontrado para esta conta neste período.</td></tr>`}
          </tbody>
        </table>
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:16px"><button class="btn primary" onclick="closeModal()">Fechar</button></div>
    `);
    widenDetailsModal();
  };

  function makeClickable(row,kind,category=''){
    if(!row||row.dataset.dreDetailReady==='1')return;
    row.dataset.dreDetailReady='1';
    row.style.cursor='pointer';
    row.tabIndex=0;
    row.title='Clique para ver os lançamentos que formam este valor';
    const encoded=encodeURIComponent(category);
    const open=()=>window.openDreDetails(kind,encoded);
    row.addEventListener('click',open);
    row.addEventListener('keydown',e=>{
      if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}
    });
    row.addEventListener('mouseenter',()=>{row.style.background='#f8fafb';});
    row.addEventListener('mouseleave',()=>{row.style.background='';});
  }

  function decorateDre(){
    const view=document.getElementById('view-dre');
    const demo=view?.querySelector('.grid.two-cols > .card');
    if(!demo)return;

    demo.querySelectorAll('.dre-row').forEach(row=>{
      const label=row.querySelector('span');
      const text=String(label?.textContent||'').trim();
      const n=norm(text);

      if(n.includes('receita operacional')){
        if(label)label.style.fontWeight='800';
        makeClickable(row,'revenue');
        return;
      }

      if(n.includes('receita liquida')){
        if(label)label.style.fontWeight='800';
        makeClickable(row,'revenue');
        return;
      }

      if(n==='total de despesas'){
        makeClickable(row,'all-expenses');
        return;
      }

      if(/^\(-\)\s*/.test(text) && !n.includes('deducoes / estornos')){
        const category=text.replace(/^\(-\)\s*/,'').trim();
        makeClickable(row,'expense',category);
      }
    });
  }

  const originalRenderDRE=window.renderDRE;
  if(typeof originalRenderDRE==='function'){
    window.renderDRE=function(){
      const out=originalRenderDRE.apply(this,arguments);
      decorateDre();
      return out;
    };
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',decorateDre,{once:true});
  else setTimeout(decorateDre,0);
})();
