(function(){
  const FEE_ACCOUNT='Juros e Multas';
  const TAX_ACCOUNT='Simples Nacional';
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const escHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function periodLabel(prefix){
    const [y,m]=String(prefix||'').split('-').map(Number);
    const names=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    return `${names[(m||1)-1]||''}/${y||''}`;
  }

  function monthLabel(prefix){
    const [,m]=String(prefix||'').split('-').map(Number);
    const names=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    return names[(m||1)-1]||'';
  }

  function previousPrefix(prefix){
    const [y,m]=String(prefix||'').split('-').map(Number);
    if(!y||!m)return '';
    const d=new Date(Date.UTC(y,m-2,1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
  }

  function accountFor(type,category){
    const cat=norm(category);
    return chartAccounts.find(a=>a.type===type&&norm(a.name)===cat)||null;
  }

  function accountAllowed(type,category){
    const account=accountFor(type,category);
    return account?account.dre!==false:true;
  }

  function isSimpleTax(category){
    const n=norm(category);
    return n===norm(TAX_ACCOUNT)||n==='simples';
  }

  function ensureFeeAccount(){
    let account=accountFor('saida',FEE_ACCOUNT);
    if(account){
      if(account.dre===false){
        chartAccounts=chartAccounts.map(a=>a.id===account.id?{...a,dre:true}:a);
        try{saveData('chartAccounts',chartAccounts)}catch(_){ }
      }
      return;
    }
    chartAccounts.push({
      id:Date.now()+731,
      code:'',
      name:FEE_ACCOUNT,
      type:'saida',
      group:'Despesas Financeiras',
      dre:true
    });
    try{saveData('chartAccounts',chartAccounts)}catch(_){ }
  }

  function feeValue(t){
    if(t?.type!=='saida')return 0;
    return Math.max(0,Number(t.fine||0))+Math.max(0,Number(t.interest||0));
  }

  function baseValue(t){
    if(t?.type!=='saida')return Number(t?.value||0);
    const fees=feeValue(t);
    if(t.baseValue!==undefined&&t.baseValue!==null&&t.baseValue!=='')return Number(t.baseValue||0);
    return Math.max(0,Number(t.value||0)-fees);
  }

  function baseTransactions(prefix){
    return transactions.filter(x=>String(x.date||'').startsWith(prefix)&&x.status==='pago');
  }

  function buildSummary(prefix){
    const rows=baseTransactions(prefix);
    const entradas=rows.filter(x=>x.type==='entrada'&&accountAllowed('entrada',x.category));
    const receita=entradas.reduce((s,x)=>s+Number(x.value||0),0);
    const cats={};
    let simples=0;

    rows.filter(x=>x.type==='saida').forEach(x=>{
      const base=baseValue(x);
      const fees=feeValue(x);
      const cat=x.category||'Contas a pagar';

      if(base&&accountAllowed('saida',cat)){
        if(isSimpleTax(cat)) simples+=base;
        else cats[cat]=(cats[cat]||0)+base;
      }

      if(fees){
        ensureFeeAccount();
        if(accountAllowed('saida',FEE_ACCOUNT))cats[FEE_ACCOUNT]=(cats[FEE_ACCOUNT]||0)+fees;
      }
    });

    const receitaLiquida=receita-simples;
    const despesas=Object.values(cats).reduce((s,v)=>s+Number(v||0),0);
    return {receita,simples,receitaLiquida,cats,despesas,resultado:receitaLiquida-despesas};
  }

  function ensureCompareStyles(){
    if(document.getElementById('dre-compare-styles'))return;
    const style=document.createElement('style');
    style.id='dre-compare-styles';
    style.textContent=`
      #view-dre .dre-compare-head,
      #view-dre .dre-compare-row{
        display:grid !important;
        grid-template-columns:minmax(0,1fr) minmax(105px,130px) minmax(105px,130px);
        align-items:center;
        gap:12px;
      }
      #view-dre .dre-compare-head{
        padding:5px 2px 8px;
        color:#75808b;
        font-size:11px;
        font-weight:800;
        text-transform:uppercase;
        letter-spacing:.04em;
        border-bottom:1px solid #edf0f2;
      }
      #view-dre .dre-compare-head span:nth-child(2),
      #view-dre .dre-compare-head span:nth-child(3),
      #view-dre .dre-compare-prev,
      #view-dre .dre-compare-current{
        text-align:right;
      }
      #view-dre .dre-compare-prev{
        color:#7a858f;
        font-weight:700;
        white-space:nowrap;
      }
      #view-dre .dre-compare-current{
        justify-self:end;
        border:0;
        background:transparent;
        padding:5px 7px;
        margin:-5px -7px -5px 0;
        border-radius:7px;
        color:inherit;
        font:inherit;
        font-weight:800;
        white-space:nowrap;
      }
      #view-dre button.dre-compare-current{
        cursor:pointer;
      }
      #view-dre button.dre-compare-current:hover,
      #view-dre button.dre-compare-current:focus-visible{
        background:#f3f6f8;
        outline:none;
        text-decoration:underline;
        text-underline-offset:2px;
      }
      #view-dre .dre-compare-row.result .dre-compare-current{
        padding:0;
        margin:0;
      }
      @media (max-width:720px){
        #view-dre .dre-compare-head,
        #view-dre .dre-compare-row{
          grid-template-columns:minmax(150px,1fr) 105px 105px;
          gap:8px;
          min-width:390px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function comparisonRow(label,previousValue,currentValue,kind,category='',bold=false,extraClass='',clickable=true){
    const encoded=encodeURIComponent(category);
    const current=clickable
      ?`<button type="button" class="dre-compare-current" title="Clique para ver os lançamentos deste mês" onclick="openDreDetails('${kind}','${encoded}')">${money(currentValue)}</button>`
      :`<span class="dre-compare-current">${money(currentValue)}</span>`;
    return `<div class="dre-row dre-compare-row ${extraClass}">
      <span style="${bold?'font-weight:800':''}">${escHtml(label)}</span>
      <span class="dre-compare-prev">${money(previousValue)}</span>
      ${current}
    </div>`;
  }

  function rebuildDre(){
    const prefix=String(document.getElementById('dre_month')?.value||'').trim();
    if(!/^\d{4}-\d{2}$/.test(prefix))return;
    const prevPrefix=previousPrefix(prefix);
    const view=document.getElementById('view-dre');
    const cards=view?.querySelectorAll('.grid.two-cols > .card');
    const demo=cards?.[0], indicators=cards?.[1];
    if(!demo)return;

    ensureCompareStyles();

    const current=buildSummary(prefix);
    const previous=buildSummary(prevPrefix);
    const catKeys=[...Object.keys(current.cats)];
    Object.keys(previous.cats).forEach(k=>{
      if(!catKeys.some(existing=>norm(existing)===norm(k)))catKeys.push(k);
    });

    demo.innerHTML=`
      <div class="panel-title">Demonstrativo — ${periodLabel(prefix)}</div>
      <div class="dre-compare-head"><span>Conta</span><span>${escHtml(monthLabel(prevPrefix))}</span><span>${escHtml(monthLabel(prefix))}</span></div>
      ${comparisonRow('(+) Receita operacional',previous.receita,current.receita,'revenue','',true)}
      ${comparisonRow('(-) Simples Nacional',previous.simples,current.simples,'deduction',TAX_ACCOUNT)}
      ${comparisonRow('(=) Receita líquida',previous.receitaLiquida,current.receitaLiquida,'net-revenue','',true)}
      ${catKeys.map(k=>comparisonRow(`(-) ${k}`,previous.cats[k]||0,current.cats[k]||0,'expense',k)).join('')}
      ${comparisonRow('Total de despesas',previous.despesas,current.despesas,'all-expenses','',false,'total')}
      ${comparisonRow('RESULTADO DO PERÍODO',previous.resultado,current.resultado,'result','',true,'result',false)}`;

    if(indicators){
      const metricRows=[...indicators.querySelectorAll(':scope > .dre-row')];
      if(metricRows[0])metricRows[0].innerHTML=`<span>Margem operacional</span><b>${current.receita?((current.resultado/current.receita)*100).toFixed(1):'0.0'}%</b>`;
      if(metricRows[1])metricRows[1].innerHTML=`<span>Despesas / Receita</span><b>${current.receita?((current.despesas/current.receita)*100).toFixed(1):'0.0'}%</b>`;
      if(metricRows[2])metricRows[2].innerHTML=`<span>Resultado</span><b style="color:${current.resultado>=0?'#278c3a':'#c94848'}">${money(current.resultado)}</b>`;
    }
  }

  function detailRows(prefix,kind,category){
    const rows=baseTransactions(prefix);
    const out=[];

    if(kind==='revenue'){
      rows.filter(x=>x.type==='entrada'&&accountAllowed('entrada',x.category)).forEach(x=>out.push({...x,value:Number(x.value||0)}));
      return out;
    }

    if(kind==='net-revenue'){
      rows.filter(x=>x.type==='entrada'&&accountAllowed('entrada',x.category)).forEach(x=>out.push({...x,value:Number(x.value||0)}));
      rows.filter(x=>x.type==='saida'&&isSimpleTax(x.category)&&accountAllowed('saida',x.category)).forEach(x=>{
        const base=baseValue(x);
        if(base)out.push({...x,id:`tax-${x.id}`,value:-base,category:TAX_ACCOUNT,description:`(-) Simples Nacional — ${x.description||TAX_ACCOUNT}`});
      });
      return out;
    }

    if(kind==='deduction'){
      rows.filter(x=>x.type==='saida'&&isSimpleTax(x.category)&&accountAllowed('saida',x.category)).forEach(x=>{
        const base=baseValue(x);
        if(base)out.push({...x,value:base,category:TAX_ACCOUNT});
      });
      return out;
    }

    rows.filter(x=>x.type==='saida').forEach(x=>{
      const base=baseValue(x);
      const fees=feeValue(x);
      const originalCat=x.category||'Contas a pagar';
      const baseIsSimple=isSimpleTax(originalCat);

      if(!baseIsSimple&&(kind==='all-expenses'||(kind==='expense'&&norm(category)===norm(originalCat)))){
        if(base&&accountAllowed('saida',originalCat))out.push({...x,value:base,category:originalCat});
      }

      if(fees&&accountAllowed('saida',FEE_ACCOUNT)&&(kind==='all-expenses'||(kind==='expense'&&norm(category)===norm(FEE_ACCOUNT)))){
        const parts=[];
        if(Number(x.fine||0))parts.push(`Multa ${money(Number(x.fine||0))}`);
        if(Number(x.interest||0))parts.push(`Juros ${money(Number(x.interest||0))}`);
        out.push({
          ...x,
          id:`fee-${x.id}`,
          value:fees,
          category:FEE_ACCOUNT,
          description:`Juros e multas — ${x.description||originalCat}${parts.length?` (${parts.join(' + ')})`:''}`
        });
      }
    });

    return out;
  }

  function widenDetailsModal(){
    const modal=document.getElementById('modal');
    const card=modal?.querySelector('.modal-card');
    if(card){card.style.width='min(1180px,96vw)';card.style.maxWidth='1180px';}
    const wrap=card?.querySelector('.table-wrap');
    if(wrap)wrap.style.overflowX='auto';
    const table=wrap?.querySelector('table');
    if(table){table.style.minWidth='980px';table.style.width='100%';}
  }

  window.openDreDetails=function(kind,encodedCategory=''){
    const prefix=String(document.getElementById('dre_month')?.value||'').trim();
    if(!/^\d{4}-\d{2}$/.test(prefix))return alert('Selecione um período válido na DRE.');
    const category=decodeURIComponent(String(encodedCategory||''));
    let rows=detailRows(prefix,kind,category);
    rows=[...rows].sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||String(a.id||'').localeCompare(String(b.id||'')));
    const total=rows.reduce((s,x)=>s+Number(x.value||0),0);
    const title=kind==='deduction'?`${TAX_ACCOUNT} — ${periodLabel(prefix)}`:kind==='expense'?`${category} — ${periodLabel(prefix)}`:kind==='all-expenses'?`Total de despesas — ${periodLabel(prefix)}`:kind==='net-revenue'?`Receita líquida — ${periodLabel(prefix)}`:`Receita operacional — ${periodLabel(prefix)}`;

    openModal(title,`
      <div class="cards grid" style="grid-template-columns:repeat(2,minmax(0,1fr));margin-bottom:14px">
        <div class="card accent-blue"><div class="kpi-label">LANÇAMENTOS</div><div class="kpi-value">${rows.length}</div></div>
        <div class="card ${kind==='revenue'||kind==='net-revenue'?'accent-green':'accent-orange'}"><div class="kpi-label">TOTAL</div><div class="kpi-value">${money(total)}</div></div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Data</th><th>Descrição</th><th>Conta</th><th>Cliente / Fornecedor</th><th>Status</th><th>Valor</th></tr></thead>
        <tbody>${rows.length?rows.map(x=>`<tr>
          <td>${escHtml(formatDate(x.date))}</td>
          <td><b>${escHtml(x.description||'-')}</b></td>
          <td>${escHtml(x.category||'-')}</td>
          <td>${escHtml(x.party||'-')}</td>
          <td>${statusBadge(x.status)}</td>
          <td class="amount ${Number(x.value||0)>=0&&x.type==='entrada'?'pos':'neg'}">${money(x.value)}</td>
        </tr>`).join(''):`<tr><td colspan="6" class="empty">Nenhum lançamento encontrado para esta conta neste período.</td></tr>`}</tbody>
      </table></div>
      <div style="display:flex;justify-content:flex-end;margin-top:16px"><button class="btn primary" onclick="closeModal()">Fechar</button></div>`);
    widenDetailsModal();
  };

  const oldRenderDRE=window.renderDRE;
  if(typeof oldRenderDRE==='function'){
    window.renderDRE=function(){
      const out=oldRenderDRE.apply(this,arguments);
      rebuildDre();
      return out;
    };
  }

  setTimeout(()=>{try{rebuildDre()}catch(_){ }},0);
})();
