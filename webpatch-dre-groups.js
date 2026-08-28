(function(){
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const escHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const collator=new Intl.Collator('pt-BR',{sensitivity:'base',numeric:true});
  const groupOrder=[
    'Despesas com Pessoal',
    'Despesas Administrativas',
    'Despesas Comerciais',
    'Despesas Financeiras',
    'Despesas com Estrutura',
    'Outras Despesas',
    'Movimentações dos Sócios',
    'Contas fora da DRE',
    'Sem grupo'
  ];

  function ensureStyles(){
    if(document.getElementById('dre-group-styles'))return;
    const style=document.createElement('style');
    style.id='dre-group-styles';
    style.textContent=`
      #view-dre .dre-group-row{
        display:grid;
        grid-template-columns:minmax(0,1fr) minmax(105px,130px) minmax(105px,130px);
        align-items:center;
        gap:12px;
        margin-top:10px;
        padding:9px 8px;
        border-top:1px solid #dfe5e9;
        border-bottom:1px solid #e9edef;
        background:#f7f9fa;
        color:#33424c;
      }
      #view-dre .dre-group-name{
        font-size:11px;
        font-weight:900;
        text-transform:uppercase;
        letter-spacing:.04em;
      }
      #view-dre .dre-group-value{
        text-align:right;
        font-size:12px;
        font-weight:900;
        color:#53616b;
        white-space:nowrap;
      }
      #view-dre .dre-group-row + .dre-compare-row{border-top:0}
      @media(max-width:720px){
        #view-dre .dre-group-row{
          grid-template-columns:minmax(150px,1fr) 105px 105px;
          gap:8px;
          min-width:390px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function parseMoney(v){
    const raw=String(v||'').replace(/R\$/gi,'').replace(/\s/g,'').replace(/\./g,'').replace(',','.');
    const n=Number(raw.replace(/[^0-9+\-.]/g,''));
    return Number.isFinite(n)?n:0;
  }

  function fallbackGroup(category){
    const n=norm(category);
    if(n.includes('distribuicao de lucros')&&n.includes('outros'))return'Despesas com Pessoal';
    if(n.includes('salario')||n.includes('pro-labore')||n.includes('pro labore')||n.includes('ferias')||n.includes('13')||n.includes('fgts')||n.includes('inss')||n.includes('beneficio')||n.includes('vale-transporte')||n.includes('vale transporte'))return'Despesas com Pessoal';
    if(n.includes('patrocin')||n.includes('publicidade')||n.includes('marketing')||n.includes('evento')||n.includes('brinde')||n.includes('comissao'))return'Despesas Comerciais';
    if(n.includes('despesa bancaria')||n.includes('tarifa bancaria')||n.includes('juros')||n.includes('multa')||n==='iof')return'Despesas Financeiras';
    if(n.includes('aluguel')||n.includes('condominio')||n.includes('manutencao')||n.includes('reparo')||n.includes('aparelho')||n.includes('equipamento'))return'Despesas com Estrutura';
    if(n.includes('internet')||n.includes('telefone')||n.includes('energia')||n.includes('material de escritorio')||n.includes('limpeza')||n.includes('mensageiro')||n.includes('bpo')||n.includes('sistema')||n.includes('software')||n.includes('contabil'))return'Despesas Administrativas';
    if(n.includes('distribuicao de lucros'))return'Movimentações dos Sócios';
    return'Outras Despesas';
  }

  function groupFor(category){
    try{
      const account=(window.chartAccounts||chartAccounts||[]).find(a=>a.type==='saida'&&norm(a.name)===norm(category));
      return String(account?.group||'').trim()||fallbackGroup(category);
    }catch(_){
      return fallbackGroup(category);
    }
  }

  function groupIndex(group){
    const i=groupOrder.indexOf(group);
    return i===-1?999:i;
  }

  function applyGroups(){
    ensureStyles();
    const view=document.getElementById('view-dre');
    const demo=view?.querySelector('.grid.two-cols > .card');
    if(!demo)return;

    demo.querySelectorAll(':scope > .dre-group-row').forEach(el=>el.remove());

    const rows=[...demo.querySelectorAll(':scope > .dre-compare-row')];
    const totalRow=rows.find(r=>r.classList.contains('total'));
    if(!totalRow)return;

    const expenses=rows.filter(row=>{
      if(row.classList.contains('total')||row.classList.contains('result'))return false;
      const label=String(row.firstElementChild?.textContent||'').trim();
      return /^\(-\)\s*/.test(label)&&norm(label)!==norm('(-) Simples Nacional');
    });
    if(!expenses.length)return;

    const groups=new Map();
    expenses.forEach(row=>{
      const label=String(row.firstElementChild?.textContent||'').trim();
      const category=label.replace(/^\(-\)\s*/,'').trim();
      const group=groupFor(category);
      if(!groups.has(group))groups.set(group,[]);
      groups.get(group).push({row,category});
      row.remove();
    });

    [...groups.entries()]
      .sort((a,b)=>groupIndex(a[0])-groupIndex(b[0])||collator.compare(a[0],b[0]))
      .forEach(([group,items])=>{
        items.sort((a,b)=>collator.compare(a.category,b.category));
        const prevTotal=items.reduce((s,item)=>s+parseMoney(item.row.querySelector('.dre-compare-prev')?.textContent),0);
        const curTotal=items.reduce((s,item)=>s+parseMoney(item.row.querySelector('.dre-compare-current')?.textContent),0);
        const header=document.createElement('div');
        header.className='dre-group-row';
        header.innerHTML=`<span class="dre-group-name">${escHtml(group)}</span><span class="dre-group-value">${money(prevTotal)}</span><span class="dre-group-value">${money(curTotal)}</span>`;
        demo.insertBefore(header,totalRow);
        items.forEach(item=>demo.insertBefore(item.row,totalRow));
      });
  }

  const oldRenderDRE=window.renderDRE;
  if(typeof oldRenderDRE==='function'){
    window.renderDRE=function(){
      const out=oldRenderDRE.apply(this,arguments);
      setTimeout(applyGroups,0);
      return out;
    };
  }

  setTimeout(applyGroups,0);
})();
