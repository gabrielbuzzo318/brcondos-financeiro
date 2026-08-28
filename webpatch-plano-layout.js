(function(){
  function ensurePlanStyles(){
    if(document.getElementById('br-plan-layout-styles'))return;
    const style=document.createElement('style');
    style.id='br-plan-layout-styles';
    style.textContent=`
      #view-plano .br-plan-help{
        display:flex;align-items:center;gap:10px;
        margin:0 0 16px;padding:10px 13px;
        border:1px solid #ead7a5;border-radius:10px;
        background:#fffaf0;color:#765a16;font-size:13px;
      }
      #view-plano .br-plan-help-dot{width:8px;height:8px;border-radius:999px;background:#d7a92d;flex:0 0 auto}
      #view-plano .br-plan-stack{display:grid;grid-template-columns:1fr;gap:16px}
      #view-plano .br-plan-card{padding:0;overflow:hidden}
      #view-plano .br-plan-card-head{
        display:flex;align-items:center;justify-content:space-between;gap:12px;
        padding:15px 18px 13px;border-bottom:1px solid #edf0f2;
      }
      #view-plano .br-plan-card-title{display:flex;align-items:center;gap:9px;font-weight:800;font-size:15px;color:#1f2933}
      #view-plano .br-plan-card-title::before{content:'';width:4px;height:18px;border-radius:999px;background:#4e7187}
      #view-plano .br-plan-card.saidas .br-plan-card-title::before{background:#b76a55}
      #view-plano .br-plan-count{
        display:inline-flex;align-items:center;justify-content:center;min-width:28px;height:24px;padding:0 8px;
        border-radius:999px;background:#f1f4f6;color:#65727d;font-size:12px;font-weight:800;
      }
      #view-plano .br-plan-groups{padding:10px 14px 14px;display:grid;gap:12px}
      #view-plano .br-plan-group-block{border:1px solid #e7ebee;border-radius:12px;overflow:hidden;background:#fff}
      #view-plano .br-plan-group-head{
        display:flex;align-items:center;justify-content:space-between;gap:12px;
        padding:10px 14px;background:#f6f8f9;border-bottom:1px solid #e7ebee;
      }
      #view-plano .br-plan-group-name{
        font-size:12px;font-weight:900;letter-spacing:.025em;text-transform:uppercase;color:#33424c;
      }
      #view-plano .br-plan-group-total{font-size:11px;font-weight:800;color:#7a8790}
      #view-plano .br-plan-group-block.pessoal .br-plan-group-head{background:#f7f7fb}
      #view-plano .br-plan-group-block.administrativas .br-plan-group-head{background:#f5f8fa}
      #view-plano .br-plan-group-block.comerciais .br-plan-group-head{background:#fff8f3}
      #view-plano .br-plan-group-block.financeiras .br-plan-group-head{background:#f8f6fb}
      #view-plano .br-plan-group-block.estrutura .br-plan-group-head{background:#f5f9f7}
      #view-plano .br-plan-group-block.socios .br-plan-group-head{background:#faf7f2}
      #view-plano .br-plan-group-block.deducoes .br-plan-group-head{background:#fff8ed}
      #view-plano .br-plan-group-block.fora .br-plan-group-head{background:#f4f5f6}
      #view-plano .br-plan-table-wrap{overflow-x:auto}
      #view-plano .br-plan-table{width:100%;min-width:570px;border-collapse:collapse;table-layout:fixed}
      #view-plano .br-plan-table thead th{
        padding:8px 14px;background:#fbfcfc;border-bottom:1px solid #edf0f2;
        color:#76828b;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.025em;text-align:left;
      }
      #view-plano .br-plan-table tbody td{
        padding:9px 14px;border-bottom:1px solid #edf0f2;vertical-align:middle;color:#27343d;font-size:13px;
      }
      #view-plano .br-plan-table tbody tr:last-child td{border-bottom:0}
      #view-plano .br-plan-table tbody tr:hover{background:#fafcfd}
      #view-plano .br-plan-name{font-weight:700;color:#202b33}
      #view-plano .br-plan-dre-cell{text-align:center!important}
      #view-plano .br-plan-actions{text-align:right!important}
      #view-plano .br-plan-actions .actions{display:flex;justify-content:flex-end;gap:6px;flex-wrap:nowrap}
      #view-plano .br-plan-actions .btn.small{height:32px;padding:0 11px;display:inline-flex;align-items:center;justify-content:center}
      #view-plano .br-dre-status{
        height:32px;min-width:70px;padding:0 11px;border-radius:8px;border:1px solid transparent;
        display:inline-flex;align-items:center;justify-content:center;gap:7px;
        font-size:13px;font-weight:800;cursor:pointer;transition:.15s ease;background:#fff;
      }
      #view-plano .br-dre-status::before{content:'';width:7px;height:7px;border-radius:999px;background:currentColor}
      #view-plano .br-dre-status.sim{color:#19743a;background:#edf9f1;border-color:#8bd2a0}
      #view-plano .br-dre-status.nao{color:#b52b2b;background:#fff1f1;border-color:#efaaaa}
      #view-plano .br-dre-status:hover{filter:brightness(.98);transform:translateY(-1px)}
      #view-plano .br-dre-status:focus-visible{outline:3px solid rgba(63,91,107,.16);outline-offset:1px}
      #view-plano .br-plan-empty{padding:28px!important;text-align:center;color:#7b8790!important}
      @media(max-width:800px){
        #view-plano .br-plan-card-head{padding:13px 14px}
        #view-plano .br-plan-groups{padding:8px}
        #view-plano .br-plan-table thead th,#view-plano .br-plan-table tbody td{padding-left:10px;padding-right:10px}
      }
    `;
    document.head.appendChild(style);
  }

  const collator=new Intl.Collator('pt-BR',{sensitivity:'base',numeric:true});
  const clean=v=>String(v||'').trim();
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ');

  const groupOrder=[
    'Receitas Operacionais',
    'Outras Receitas',
    'Deduções da Receita',
    'Despesas com Pessoal',
    'Despesas Administrativas',
    'Despesas Comerciais',
    'Despesas Financeiras',
    'Despesas com Estrutura',
    'Movimentações dos Sócios',
    'Outras Despesas',
    'Contas fora da DRE',
    'Sem grupo'
  ];

  function groupClass(group){
    const n=norm(group);
    if(n.includes('pessoal'))return'pessoal';
    if(n.includes('administr'))return'administrativas';
    if(n.includes('comerc'))return'comerciais';
    if(n.includes('financeir'))return'financeiras';
    if(n.includes('estrutura'))return'estrutura';
    if(n.includes('socio'))return'socios';
    if(n.includes('deduc'))return'deducoes';
    if(n.includes('fora da dre'))return'fora';
    return'';
  }

  function desiredGroup(account){
    const n=norm(account.name);
    const type=account.type;

    if(type==='entrada'){
      if(n==='valores a repassar'||n.includes('reembolso')||n==='saldo anterior')return{group:'Contas fora da DRE',dre:false};
      if(n.includes('receita')||n.includes('recebimento de boleto'))return{group:'Receitas Operacionais'};
      return null;
    }

    if(n.includes('simples nacional')||n==='simples')return{group:'Deduções da Receita',dre:true};

    if(n.includes('distribuicao de lucros')&&n.includes('outros'))return{group:'Despesas com Pessoal',dre:true};
    if(n.includes('distribuicao de lucros'))return{group:'Movimentações dos Sócios',dre:false};

    if(n.includes('salario')||n.includes('pro-labore')||n.includes('pro labore')||n.includes('ferias')||n.includes('13')||n.includes('fgts')||n.includes('inss')||n.includes('beneficio')||n.includes('vale-transporte')||n.includes('vale transporte'))return{group:'Despesas com Pessoal'};

    if(n.includes('patrocin')||n.includes('publicidade')||n.includes('marketing')||n.includes('evento')||n.includes('brinde')||n.includes('comissao'))return{group:'Despesas Comerciais'};

    if(n.includes('despesa bancaria')||n.includes('tarifa bancaria')||n.includes('juros')||n.includes('multa')||n==='iof')return{group:'Despesas Financeiras'};

    if(n.includes('aluguel')||n.includes('condominio')||n.includes('manutencao')||n.includes('reparo')||n.includes('aparelho')||n.includes('equipamento'))return{group:'Despesas com Estrutura'};

    if(n.includes('internet')||n.includes('telefone')||n.includes('energia')||n.includes('material de escritorio')||n.includes('limpeza')||n.includes('mensageiro')||n.includes('bpo')||n.includes('sistema')||n.includes('software')||n.includes('contabil'))return{group:'Despesas Administrativas'};

    if(n.includes('reembolso a receber')||n.includes('reembolsos a receber'))return{group:'Contas fora da DRE',dre:false};
    return null;
  }

  function normalizeExistingGroups(){
    let changed=false;
    chartAccounts=chartAccounts.map(account=>{
      const target=desiredGroup(account);
      if(!target)return account;
      const next={...account};
      if(clean(next.group)!==target.group){next.group=target.group;changed=true;}
      if(typeof target.dre==='boolean'&&next.dre!==target.dre){next.dre=target.dre;changed=true;}
      return next;
    });
    if(changed){try{saveData('chartAccounts',chartAccounts);}catch(_){}}
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

  window.toggleChartAccountDre=function(id){
    const item=chartAccounts.find(a=>Number(a.id)===Number(id));
    if(!item)return;
    const next=item.dre===false?'sim':'nao';
    if(typeof setChartAccountDre==='function')setChartAccountDre(item.id,next);
    if(typeof renderChartAccounts==='function')renderChartAccounts();
  };

  window.renderChartAccounts=function(){
    ensurePlanStyles();
    normalizeExistingGroups();

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

  window.openChartAccount=function(id=null){
    const x=id?chartAccounts.find(a=>Number(a.id)===Number(id)):{name:'',type:'saida',group:'',dre:true};
    if(!x)return;
    const groups=groupOrder.filter(x=>x!=='Sem grupo');
    const groupOptions=groups.map(g=>`<option value="${esc(g)}" ${clean(x.group)===g?'selected':''}>${esc(g)}</option>`).join('');
    openModal(id?'Editar conta':'Nova conta do plano',`
      <div class="modal-grid">
        ${field('Tipo',`<select id="pc_type"><option value="entrada" ${x.type==='entrada'?'selected':''}>Entrada / Receita</option><option value="saida" ${x.type==='saida'?'selected':''}>Saída / Despesa</option></select>`)}
        ${field('Nome da conta',`<input id="pc_name" value="${esc(x.name||'')}" placeholder="Ex.: Honorários jurídicos">`)}
        ${field('Categoria / Grupo',`<select id="pc_group"><option value="">Selecione...</option>${groupOptions}${clean(x.group)&&!groups.includes(clean(x.group))?`<option value="${esc(x.group)}" selected>${esc(x.group)}</option>`:''}</select>`)}
        ${field('Vai para DRE?',`<select id="pc_dre" class="br-dre-toggle ${x.dre!==false?'br-dre-sim':'br-dre-nao'}" onchange="updateDreSelectStyle(this)"><option value="sim" ${x.dre!==false?'selected':''}>Sim</option><option value="nao" ${x.dre===false?'selected':''}>Não</option></select>`)}
      </div>
      <div class="notice" style="margin-top:14px">Se marcar <b>Não</b>, a conta continua sendo usada nos lançamentos, mas fica fora do resultado da DRE.</div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px">
        <button class="btn" onclick="closeModal()">Cancelar</button>
        <button class="btn primary" onclick="saveChartAccount(${id||'null'})">Salvar</button>
      </div>`);
    setTimeout(()=>{if(typeof updateDreSelectStyle==='function')updateDreSelectStyle(document.getElementById('pc_dre'));},0);
  };

  window.saveChartAccount=function(id){
    const previous=id?chartAccounts.find(x=>Number(x.id)===Number(id)):null;
    const obj={
      id:id||Date.now(),
      name:val('pc_name'),
      type:val('pc_type'),
      group:val('pc_group'),
      dre:val('pc_dre')!=='nao'
    };
    if(!obj.name)return alert('Informe o nome da conta.');
    if(!obj.group)return alert('Selecione a categoria da conta.');
    const duplicate=chartAccounts.some(x=>Number(x.id)!==Number(id)&&String(x.name||'').trim().toLowerCase()===obj.name.trim().toLowerCase());
    if(duplicate)return alert('Já existe uma conta com esse nome.');
    if(previous&&previous.defaultDescription)obj.defaultDescription=previous.defaultDescription;
    if(previous&&previous.defaultCategory)obj.defaultCategory=previous.defaultCategory;
    if(id)chartAccounts=chartAccounts.map(x=>Number(x.id)===Number(id)?obj:x);else chartAccounts.push(obj);
    saveData('chartAccounts',chartAccounts);
    closeModal();
    renderAll();
  };

  ensurePlanStyles();
})();
