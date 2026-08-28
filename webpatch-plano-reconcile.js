(function(){
  const clean=v=>String(v||'').trim();
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ');

  function classify(name,type){
    const n=norm(name);

    if(type==='entrada'){
      if(n.includes('reembolso')||n==='valores a repassar'||n==='saldo anterior'){
        return {group:'Contas fora da DRE',dre:false};
      }
      return {group:'Receitas Operacionais',dre:true};
    }

    if(n.includes('simples nacional')||n==='simples')return{group:'Deduções da Receita',dre:true};
    if(n.includes('distribuicao de lucros')&&n.includes('outros'))return{group:'Despesas com Pessoal',dre:true};
    if(n.includes('distribuicao de lucros'))return{group:'Movimentações dos Sócios',dre:false};

    if(
      n.includes('salario')||n.includes('pro-labore')||n.includes('pro labore')||n.includes('ferias')||
      n.includes('13')||n.includes('fgts')||n.includes('inss')||n.includes('beneficio')||
      n.includes('vale-transporte')||n.includes('vale transporte')||n.includes('vale alimentacao')||
      n.includes('plano de saude')||n.includes('sindicato patronal')||(n.includes('assoc')&&n.includes('classe'))
    )return{group:'Despesas com Pessoal',dre:true};

    if(n==='imovel'||n.includes('imobilizado'))return{group:'Investimentos – Imobilizados',dre:true};

    if(n.includes('grafica')||n.includes('patrocin')||n.includes('publicidade')||n.includes('marketing')||
       n.includes('evento')||n.includes('brinde')||n.includes('comissao')){
      return{group:'Despesas Comerciais',dre:true};
    }

    if(n.includes('despesa bancaria')||n.includes('tarifa bancaria')||n.includes('juros')||n.includes('multa')||n==='iof'){
      return{group:'Despesas Financeiras',dre:true};
    }

    if(n.includes('locacao de equipamento')||n.includes('aluguel')||n.includes('condominio')||
       n.includes('manutencao')||n.includes('reparo')||n.includes('aparelho')||n.includes('equipamento')){
      return{group:'Despesas com Estrutura',dre:true};
    }

    if(n.includes('assistencia t.i')||n.includes('assistencia ti')||(n.includes('honorario')&&n.includes('contab'))||
       n.includes('internet')||n.includes('telefone')||n.includes('energia')||n.includes('material de escritorio')||
       n.includes('limpeza')||n.includes('mensageiro')||n.includes('bpo')||n.includes('sistema')||
       n.includes('software')||n.includes('contabil')){
      return{group:'Despesas Administrativas',dre:true};
    }

    if(n.includes('reembolso a receber')||n.includes('reembolsos a receber'))return{group:'Contas fora da DRE',dre:false};
    return{group:'Outras Despesas',dre:true};
  }

  function reconcileHistoricalAccounts(){
    if(!Array.isArray(chartAccounts)||!Array.isArray(transactions))return false;

    const historical=new Map();
    transactions.forEach(t=>{
      const name=clean(t?.category);
      if(!name)return;
      const type=t?.type==='entrada'?'entrada':'saida';
      const key=`${type}|${norm(name)}`;
      if(!historical.has(key))historical.set(key,{name,type});
    });

    let changed=false;
    let seq=0;
    historical.forEach(item=>{
      const keyName=norm(item.name);
      let account=chartAccounts.find(a=>a.type===item.type&&norm(a.name)===keyName);
      const target=classify(item.name,item.type);

      if(!account){
        chartAccounts.push({
          id:Date.now()+(seq++),
          name:item.name,
          type:item.type,
          group:target.group,
          dre:target.dre
        });
        changed=true;
        return;
      }

      // Só preenche o que estiver realmente vazio. Alterações manuais têm prioridade.
      if(!clean(account.group)){
        account.group=target.group;
        changed=true;
      }
      if(typeof account.dre!=='boolean'&&typeof target.dre==='boolean'){
        account.dre=target.dre;
        changed=true;
      }
    });

    if(changed){
      try{saveData('chartAccounts',chartAccounts);}catch(err){console.error('PLANO RECONCILE:',err);}
    }
    return changed;
  }

  window.brReconcileHistoricalChartAccounts=reconcileHistoricalAccounts;

  const oldRenderChartAccounts=window.renderChartAccounts;
  if(typeof oldRenderChartAccounts==='function'){
    window.renderChartAccounts=function(){
      reconcileHistoricalAccounts();
      return oldRenderChartAccounts.apply(this,arguments);
    };
  }

  reconcileHistoricalAccounts();
})();