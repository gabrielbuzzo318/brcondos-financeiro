(function(){
  const clean=v=>String(v||'').trim();
  const collator=new Intl.Collator('pt-BR',{sensitivity:'base',numeric:true});
  const groupOrder=[
    'Receitas Operacionais',
    'Outras Receitas',
    'Deduções da Receita',
    'Despesas com Pessoal',
    'Despesas Administrativas',
    'Despesas Comerciais',
    'Despesas Financeiras',
    'Despesas com Estrutura',
    'Investimentos – Imobilizados',
    'Movimentações dos Sócios',
    'Outras Despesas',
    'Contas fora da DRE',
    'Sem grupo'
  ];
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ');

  function groupClass(group){
    const n=norm(group);
    if(n.includes('pessoal'))return'pessoal';
    if(n.includes('administr'))return'administrativas';
    if(n.includes('comerc'))return'comerciais';
    if(n.includes('financeir'))return'financeiras';
    if(n.includes('estrutura'))return'estrutura';
    if(n.includes('investimento')||n.includes('imobilizado'))return'investimentos';
    if(n.includes('socio'))return'socios';
    if(n.includes('deduc'))return'deducoes';
    if(n.includes('fora da dre'))return'fora';
    return'';
  }

  function displayGroup(x){return clean(x.group)||'Sem grupo';}
  function sortGroups(a,b){
    const ai=groupOrder.indexOf(a),bi=groupOrder.indexOf(b);
    if(ai!==-1||bi!==-1){
      if(ai===-1)return 1;
      if(bi===-1)return-1;
      return ai-bi;
    }
    return collator.compare(a,b);
  }

  window.renderChartAccounts=function(){
    if(!Array.isArray(chartAccounts))return;

    const entries=chartAccounts.filter(x=>x.type==='entrada');
    const exits=chartAccounts.filter(x=>x.type==='saida');

    const row=x=>`<tr>
      <td class="br-plan-name">${esc(x.name||'—')}</td>
      <td class="br-plan-dre-cell">
        <button type="button" class="br-dre-status ${x.dre!==false?'sim':'nao'}" onclick="toggleChartAccountDre(${x.id})" title="Clique para alterar">
          ${x.dre!==false?'Sim':'Não'}
        </button>
      </td>
      <td class="br-plan-actions"><div class="actions">
        <button class="btn small" onclick="openChartAccount(${x.id})">Editar</button>
        <button class="btn small danger" onclick="deleteChartAccount(${x.id})">Excluir</button>
      </div></td>
    </tr>`;

    const grouped=list=>{
      if(!list.length)return`<div class="br-plan-empty">Nenhuma conta cadastrada.</div>`;
      const map=new Map();
      list.forEach(x=>{
        const g=displayGroup(x);
        if(!map.has(g))map.set(g,[]);
        map.get(g).push(x);
      });
      return[...map.entries()]
        .sort((a,b)=>sortGroups(a[0],b[0]))
        .map(([group,items])=>{
          items.sort((a,b)=>collator.compare(clean(a.name),clean(b.name)));
          return`<div class="br-plan-group-block ${groupClass(group)}">
            <div class="br-plan-group-head">
              <span class="br-plan-group-name">${esc(group)}</span>
              <span class="br-plan-group-total">${items.length} ${items.length===1?'conta':'contas'}</span>
            </div>
            <div class="br-plan-table-wrap"><table class="br-plan-table">
              <colgroup><col><col style="width:120px"><col style="width:180px"></colgroup>
              <thead><tr><th>Conta</th><th style="text-align:center">Vai para DRE?</th><th style="text-align:right">Ações</th></tr></thead>
              <tbody>${items.map(row).join('')}</tbody>
            </table></div>
          </div>`;
        }).join('');
    };

    const card=(title,list,kind)=>`<div class="card br-plan-card ${kind}">
      <div class="br-plan-card-head">
        <div class="br-plan-card-title">${title}</div>
        <span class="br-plan-count">${list.length}</span>
      </div>
      <div class="br-plan-groups">${grouped(list)}</div>
    </div>`;

    const view=document.getElementById('view-plano');
    if(!view)return;
    view.innerHTML=`
      <div class="section-title">
        <div><h2>Plano de Contas</h2><span>Contas organizadas por categoria para facilitar a leitura da DRE</span></div>
        <button class="btn primary" onclick="openChartAccount()">+ Nova conta</button>
      </div>
      <div class="br-plan-help"><span class="br-plan-help-dot"></span><span><b>Vai para DRE?</b> Clique no status para alternar entre <b>Sim</b> e <b>Não</b>. Contas marcadas como Não continuam disponíveis nos lançamentos, mas ficam fora da DRE.</span></div>
      <div class="br-plan-stack">
        ${card('Entradas / Receitas',entries,'entradas')}
        ${card('Saídas / Despesas',exits,'saidas')}
      </div>`;
  };

  // A partir daqui a classificação automática nunca mais sobrescreve alterações manuais.
  setTimeout(()=>{
    try{
      const view=document.getElementById('view-plano');
      if(view&&view.offsetParent!==null)window.renderChartAccounts();
    }catch(_){ }
  },0);
})();