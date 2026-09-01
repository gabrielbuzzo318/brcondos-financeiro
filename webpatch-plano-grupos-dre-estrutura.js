(function(){
  const ADMIN_REVENUE='Receita de Adm de Condominios';
  const ACCOUNTING_REVENUE='Receita de Contabilidade';
  const LEGACY_REVENUE='Receitas de serviços';
  const INVESTMENT_ACCOUNTS=['Imóvel','Capital Social - Sicredi','Aplicações Financeiras'];
  const LEGACY_APPLICATION='Aplicação Financeira';
  const GROUP_STORAGE_KEY='brcondos_chartAccountGroups';
  const collator=new Intl.Collator('pt-BR',{sensitivity:'base',numeric:true});
  const clean=v=>String(v??'').trim();
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ');
  const escHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const DEFAULT_GROUPS=[
    'Receitas Operacionais','Outras Receitas','Deduções da Receita','Despesas com Pessoal',
    'Despesas Administrativas','Despesas Comerciais','Despesas Financeiras','Despesas com Estrutura',
    'Investimentos','Investimentos – Imobilizados','Movimentações dos Sócios','Outras Despesas',
    'Contas fora da DRE','Transitória','Impostos e Taxas'
  ];

  function readCustomGroups(){
    try{
      const raw=localStorage.getItem(GROUP_STORAGE_KEY);
      const parsed=raw?JSON.parse(raw):[];
      return Array.isArray(parsed)?parsed.map(clean).filter(Boolean):[];
    }catch(_){return[];}
  }
  function saveCustomGroups(groups){
    const unique=[];
    groups.map(clean).filter(Boolean).forEach(g=>{if(!unique.some(x=>norm(x)===norm(g)))unique.push(g);});
    localStorage.setItem(GROUP_STORAGE_KEY,JSON.stringify(unique));
    try{if(typeof saveData==='function')saveData('chartAccountGroups',unique);}catch(_){ }
    return unique;
  }
  function allGroups(){
    const groups=[...DEFAULT_GROUPS,...readCustomGroups()];
    try{(Array.isArray(chartAccounts)?chartAccounts:[]).forEach(a=>{const g=clean(a?.group);if(g)groups.push(g);});}catch(_){ }
    const unique=[];
    groups.forEach(g=>{if(!unique.some(x=>norm(x)===norm(g)))unique.push(g);});
    return unique.sort((a,b)=>{
      const ai=DEFAULT_GROUPS.findIndex(x=>norm(x)===norm(a));
      const bi=DEFAULT_GROUPS.findIndex(x=>norm(x)===norm(b));
      if(ai>=0||bi>=0){if(ai<0)return 1;if(bi<0)return-1;return ai-bi;}
      return collator.compare(a,b);
    });
  }

  function sameAccountName(a,b){return norm(a)===norm(b);}
  function accountByName(type,name){
    try{return (Array.isArray(chartAccounts)?chartAccounts:[]).find(a=>a?.type===type&&sameAccountName(a?.name,name))||null;}catch(_){return null;}
  }

  function migrateStructure(){
    if(!Array.isArray(chartAccounts))return false;
    let accountsChanged=false,transactionsChanged=false,payablesChanged=false,reimbursementsChanged=false;

    let admin=accountByName('entrada',ADMIN_REVENUE);
    const legacy=accountByName('entrada',LEGACY_REVENUE);
    if(!admin&&legacy){
      legacy.name=ADMIN_REVENUE;legacy.group='Receitas Operacionais';legacy.dre=true;
      admin=legacy;accountsChanged=true;
    }
    if(!admin){
      chartAccounts.push({id:Date.now()+8401,code:'',name:ADMIN_REVENUE,type:'entrada',group:'Receitas Operacionais',dre:true});
      accountsChanged=true;
    }else{
      if(clean(admin.group)!=='Receitas Operacionais'){admin.group='Receitas Operacionais';accountsChanged=true;}
      if(admin.dre===false){admin.dre=true;accountsChanged=true;}
    }

    let accounting=accountByName('entrada',ACCOUNTING_REVENUE);
    if(!accounting){
      chartAccounts.push({id:Date.now()+8402,code:'',name:ACCOUNTING_REVENUE,type:'entrada',group:'Receitas Operacionais',dre:true});
      accountsChanged=true;
    }else{
      if(clean(accounting.group)!=='Receitas Operacionais'){accounting.group='Receitas Operacionais';accountsChanged=true;}
      if(accounting.dre===false){accounting.dre=true;accountsChanged=true;}
    }

    const legacyApp=accountByName('saida',LEGACY_APPLICATION);
    let app=accountByName('saida','Aplicações Financeiras');
    if(!app&&legacyApp){legacyApp.name='Aplicações Financeiras';app=legacyApp;accountsChanged=true;}
    INVESTMENT_ACCOUNTS.forEach(name=>{
      const a=accountByName('saida',name);
      if(!a)return;
      if(clean(a.group)!=='Investimentos'){a.group='Investimentos';accountsChanged=true;}
      if(a.dre!==false){a.dre=false;accountsChanged=true;}
    });

    if(Array.isArray(transactions)){
      transactions=transactions.map(t=>{
        let category=clean(t?.category),changed=false;
        if(t?.type==='entrada'&&sameAccountName(category,LEGACY_REVENUE)){category=ADMIN_REVENUE;changed=true;}
        if(t?.type==='saida'&&sameAccountName(category,LEGACY_APPLICATION)){category='Aplicações Financeiras';changed=true;}
        if(changed){transactionsChanged=true;return{...t,category};}
        return t;
      });
    }
    if(typeof payables!=='undefined'&&Array.isArray(payables)){
      payables=payables.map(p=>sameAccountName(p?.category,LEGACY_APPLICATION)?(payablesChanged=true,{...p,category:'Aplicações Financeiras'}):p);
    }
    if(typeof reimbursements!=='undefined'&&Array.isArray(reimbursements)){
      reimbursements=reimbursements.map(r=>sameAccountName(r?.category,LEGACY_APPLICATION)?(reimbursementsChanged=true,{...r,category:'Aplicações Financeiras'}):r);
    }

    if(accountsChanged)try{saveData('chartAccounts',chartAccounts);}catch(_){ }
    if(transactionsChanged)try{saveData('transactions',transactions);}catch(_){ }
    if(payablesChanged)try{saveData('payables',payables);}catch(_){ }
    if(reimbursementsChanged)try{saveData('reimbursements',reimbursements);}catch(_){ }
    return accountsChanged||transactionsChanged||payablesChanged||reimbursementsChanged;
  }

  function ensureStyles(){
    if(document.getElementById('br-plan-groups-dre-structure-style'))return;
    const s=document.createElement('style');
    s.id='br-plan-groups-dre-structure-style';
    s.textContent=`
      #view-plano .br-plan-title-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}
      #view-dre .br-dre-revenue-detail>span:first-child,#view-dre .br-dre-investment-detail>span:first-child{padding-left:18px;color:#52616b}
      #view-dre .br-dre-revenue-detail{background:#fbfcfd}
      #view-dre .br-dre-investment-header{margin-top:16px!important;background:#f2f7fa!important;border-color:#dce7ed!important}
      #view-dre .br-dre-investment-detail{background:#fbfdfe}
      #view-dre .br-dre-result-after{margin-top:7px;border-top:2px solid #d7e2e8!important;font-weight:900}
      #view-dre .br-dre-result-after .dre-compare-current,#view-dre .br-dre-result-after .dre-compare-prev{font-weight:900}
      @media(max-width:650px){#view-plano .br-plan-title-actions{width:100%;justify-content:flex-start}}
    `;
    document.head.appendChild(s);
  }

  window.openChartAccountGroupCreator=function(){
    openModal('Nova categoria / grupo',`
      <div class="field"><label>Nome da categoria / grupo</label><input id="br_new_chart_group" autocomplete="off" placeholder="Ex.: Despesas Jurídicas"></div>
      <div class="notice" style="margin-top:14px">Depois de salvar, o novo grupo aparecerá no campo <b>Categoria / Grupo</b> ao criar ou editar uma conta.</div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px">
        <button class="btn" onclick="closeModal()">Cancelar</button>
        <button class="btn primary" onclick="saveChartAccountGroup()">Salvar grupo</button>
      </div>`);
    setTimeout(()=>document.getElementById('br_new_chart_group')?.focus(),0);
  };
  window.saveChartAccountGroup=function(){
    const input=document.getElementById('br_new_chart_group');
    const name=clean(input?.value);
    if(!name){input?.focus();return alert('Informe o nome da categoria / grupo.');}
    const groups=allGroups();
    if(groups.some(g=>norm(g)===norm(name)))return alert('Essa categoria / grupo já existe.');
    saveCustomGroups([...readCustomGroups(),name]);
    closeModal();
    try{renderChartAccounts();}catch(_){ }
  };

  function decoratePlanHeader(){
    ensureStyles();
    const title=document.querySelector('#view-plano .section-title');
    const newAccountBtn=title?.querySelector('button.btn.primary');
    if(!title||!newAccountBtn||title.querySelector('.br-plan-add-group'))return;
    let actions=title.querySelector('.br-plan-title-actions');
    if(!actions){
      actions=document.createElement('div');actions.className='br-plan-title-actions';
      newAccountBtn.parentNode.insertBefore(actions,newAccountBtn);actions.appendChild(newAccountBtn);
    }
    const btn=document.createElement('button');
    btn.type='button';btn.className='btn br-plan-add-group';btn.textContent='+ Categoria / Grupo';
    btn.onclick=()=>openChartAccountGroupCreator();
    actions.insertBefore(btn,newAccountBtn);
  }

  window.openChartAccount=function(id=null){
    const x=id?(Array.isArray(chartAccounts)?chartAccounts:[]).find(a=>Number(a.id)===Number(id)):{name:'',type:'saida',group:'',dre:true,code:''};
    if(!x)return;
    const groups=allGroups();
    const selectedGroup=clean(x.group);
    const options=groups.map(g=>`<option value="${escHtml(g)}" ${norm(selectedGroup)===norm(g)?'selected':''}>${escHtml(g)}</option>`).join('');
    openModal(id?'Editar conta':'Nova conta do plano',`
      <div class="modal-grid">
        ${field('Tipo',`<select id="pc_type"><option value="entrada" ${x.type==='entrada'?'selected':''}>Entrada / Receita</option><option value="saida" ${x.type==='saida'?'selected':''}>Saída / Despesa</option></select>`)}
        ${field('Nome da conta',`<input id="pc_name" value="${escHtml(x.name||'')}" placeholder="Ex.: Honorários jurídicos">`)}
        ${field('Categoria / Grupo',`<select id="pc_group"><option value="">Selecione...</option>${options}</select>`)}
        ${field('Vai para DRE?',`<select id="pc_dre" class="br-dre-toggle ${x.dre!==false?'br-dre-sim':'br-dre-nao'}" onchange="updateDreSelectStyle(this)"><option value="sim" ${x.dre!==false?'selected':''}>Sim</option><option value="nao" ${x.dre===false?'selected':''}>Não</option></select>`)}
      </div>
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-top:14px;flex-wrap:wrap">
        <button class="btn small" type="button" onclick="openChartAccountGroupCreator()">+ Categoria / Grupo</button>
        <span class="subtle">Crie um grupo novo sem sair do Plano de Contas.</span>
      </div>
      <div class="notice" style="margin-top:14px">Contas de investimento aparecem em uma seção própria, depois do <b>Resultado do Período</b>.</div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px">
        <button class="btn" onclick="closeModal()">Cancelar</button>
        <button class="btn primary" onclick="saveChartAccount(${id||'null'})">Salvar</button>
      </div>`);
    setTimeout(()=>{try{updateDreSelectStyle(document.getElementById('pc_dre'));}catch(_){ }},0);
  };

  function accountAllowed(type,category){
    const a=accountByName(type,category);
    return a?a.dre!==false:true;
  }
  function isAccountingRevenue(t){return t?.type==='entrada'&&norm(t?.category)===norm(ACCOUNTING_REVENUE);}
  function revenueBucket(prefix,kind){
    const rows=(Array.isArray(transactions)?transactions:[]).filter(t=>String(t?.date||'').startsWith(prefix)&&t?.status==='pago'&&t?.type==='entrada'&&accountAllowed('entrada',t?.category));
    if(kind==='accounting')return rows.filter(isAccountingRevenue);
    return rows.filter(t=>!isAccountingRevenue(t));
  }
  function investmentKind(category){
    const n=norm(category);
    if(n===norm('Imóvel'))return'Imóvel';
    if(n===norm('Capital Social - Sicredi'))return'Capital Social - Sicredi';
    if(n===norm('Aplicações Financeiras')||n===norm(LEGACY_APPLICATION))return'Aplicações Financeiras';
    return'';
  }
  function feeValue(t){return t?.type==='saida'?Math.max(0,Number(t?.fine||0))+Math.max(0,Number(t?.interest||0)):0;}
  function baseValue(t){
    if(t?.type!=='saida')return Number(t?.value||0);
    if(t?.baseValue!==undefined&&t?.baseValue!==null&&t?.baseValue!=='')return Number(t.baseValue||0);
    return Math.max(0,Number(t?.value||0)-feeValue(t));
  }
  function investmentRows(prefix,name=''){
    return (Array.isArray(transactions)?transactions:[]).filter(t=>String(t?.date||'').startsWith(prefix)&&t?.status==='pago'&&t?.type==='saida'&&investmentKind(t?.category)&&(!name||norm(investmentKind(t.category))===norm(name)));
  }
  function previousPrefix(prefix){
    const [y,m]=String(prefix||'').split('-').map(Number);if(!y||!m)return'';
    const d=new Date(Date.UTC(y,m-2,1));return`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
  }
  function parseMoney(text){
    let raw=String(text||'').replace(/R\$/gi,'').replace(/\s/g,'');
    const negative=/^-/.test(raw)||/^\(.*\)$/.test(raw);
    raw=raw.replace(/[()]/g,'').replace(/\./g,'').replace(',','.').replace(/[^0-9.\-]/g,'');
    const n=Number(raw);if(!Number.isFinite(n))return 0;return negative&&n>0?-n:n;
  }
  function currentPrefix(){return clean(document.getElementById('dre_month')?.value);}
  function rowHtml(label,previous,current,extraClass='',onclick=''){
    const currentCell=onclick?`<button type="button" class="dre-compare-current" onclick="${onclick}">${money(current)}</button>`:`<span class="dre-compare-current">${money(current)}</span>`;
    return `<div class="dre-row dre-compare-row ${extraClass}"><span>${escHtml(label)}</span><span class="dre-compare-prev">${money(previous)}</span>${currentCell}</div>`;
  }

  function detailModal(title,rows){
    const sorted=[...rows].sort((a,b)=>String(a?.date||'').localeCompare(String(b?.date||''))||String(a?.id||'').localeCompare(String(b?.id||'')));
    const total=sorted.reduce((s,x)=>s+Number(x.__displayValue ?? x.value ?? 0),0);
    openModal(title,`
      <div class="cards grid" style="grid-template-columns:repeat(2,minmax(0,1fr));margin-bottom:14px">
        <div class="card accent-blue"><div class="kpi-label">LANÇAMENTOS</div><div class="kpi-value">${sorted.length}</div></div>
        <div class="card accent-green"><div class="kpi-label">TOTAL</div><div class="kpi-value">${money(total)}</div></div>
      </div>
      <div class="table-wrap"><table style="min-width:900px"><thead><tr><th>Data</th><th>Descrição</th><th>Conta</th><th>Cliente / Fornecedor</th><th>Valor</th></tr></thead><tbody>
        ${sorted.length?sorted.map(x=>`<tr><td>${escHtml(formatDate(x.date))}</td><td><b>${escHtml(x.description||'-')}</b></td><td>${escHtml(x.category||'-')}</td><td>${escHtml(x.party||'-')}</td><td class="amount ${x.type==='entrada'?'pos':'neg'}">${money(Number(x.__displayValue ?? x.value ?? 0))}</td></tr>`).join(''):`<tr><td colspan="5" class="empty">Nenhum lançamento encontrado neste período.</td></tr>`}
      </tbody></table></div>
      <div style="display:flex;justify-content:flex-end;margin-top:16px"><button class="btn primary" onclick="closeModal()">Fechar</button></div>`);
  }
  window.openBrRevenueDetails=function(kind){
    const prefix=currentPrefix();if(!/^\d{4}-\d{2}$/.test(prefix))return;
    const rows=revenueBucket(prefix,kind);
    detailModal(kind==='accounting'?'Receita de Contabilidade':'Receita de Adm de Condominios',rows);
  };
  window.openBrInvestmentDetails=function(encodedName){
    const prefix=currentPrefix();if(!/^\d{4}-\d{2}$/.test(prefix))return;
    const name=decodeURIComponent(String(encodedName||''));
    const rows=investmentRows(prefix,name).map(x=>({...x,__displayValue:baseValue(x)}));
    detailModal(name,rows);
  };

  let enhancing=false;
  function enhanceDre(){
    if(enhancing)return;enhancing=true;
    try{
      ensureStyles();
      const prefix=currentPrefix();if(!/^\d{4}-\d{2}$/.test(prefix))return;
      const prev=previousPrefix(prefix);
      const demo=document.querySelector('#view-dre .grid.two-cols > .card');if(!demo)return;
      demo.querySelectorAll(':scope > .br-dre-revenue-detail,:scope > .br-dre-investment-header,:scope > .br-dre-investment-detail,:scope > .br-dre-result-after').forEach(el=>el.remove());

      const rows=[...demo.querySelectorAll(':scope > .dre-compare-row')];
      const revenueRow=rows.find(r=>norm(r.firstElementChild?.textContent).includes('receita operacional'));
      if(revenueRow){
        const adminPrev=revenueBucket(prev,'admin').reduce((s,x)=>s+Number(x.value||0),0);
        const adminCur=revenueBucket(prefix,'admin').reduce((s,x)=>s+Number(x.value||0),0);
        const acctPrev=revenueBucket(prev,'accounting').reduce((s,x)=>s+Number(x.value||0),0);
        const acctCur=revenueBucket(prefix,'accounting').reduce((s,x)=>s+Number(x.value||0),0);
        const adminEl=document.createElement('div');adminEl.innerHTML=rowHtml(ADMIN_REVENUE,adminPrev,adminCur,'br-dre-revenue-detail',`openBrRevenueDetails('admin')`);const adminRow=adminEl.firstElementChild;
        const acctEl=document.createElement('div');acctEl.innerHTML=rowHtml(ACCOUNTING_REVENUE,acctPrev,acctCur,'br-dre-revenue-detail',`openBrRevenueDetails('accounting')`);const acctRow=acctEl.firstElementChild;
        revenueRow.insertAdjacentElement('afterend',adminRow);adminRow.insertAdjacentElement('afterend',acctRow);
      }

      const resultRow=[...demo.querySelectorAll(':scope > .dre-compare-row')].find(r=>norm(r.firstElementChild?.textContent)==='resultado do periodo');
      if(resultRow){
        const invPrevByName={},invCurByName={};
        INVESTMENT_ACCOUNTS.forEach(name=>{
          invPrevByName[name]=investmentRows(prev,name).reduce((s,x)=>s+baseValue(x),0);
          invCurByName[name]=investmentRows(prefix,name).reduce((s,x)=>s+baseValue(x),0);
        });
        const totalPrev=Object.values(invPrevByName).reduce((s,v)=>s+v,0),totalCur=Object.values(invCurByName).reduce((s,v)=>s+v,0);
        const operatingPrev=parseMoney(resultRow.querySelector('.dre-compare-prev')?.textContent);
        const operatingCur=parseMoney(resultRow.querySelector('.dre-compare-current')?.textContent);

        const header=document.createElement('div');header.className='dre-group-row br-dre-investment-header';header.innerHTML=`<span class="dre-group-name">INVESTIMENTOS</span><span class="dre-group-value">${money(totalPrev)}</span><span class="dre-group-value">${money(totalCur)}</span>`;
        let cursor=resultRow;cursor.insertAdjacentElement('afterend',header);cursor=header;
        INVESTMENT_ACCOUNTS.forEach(name=>{
          const holder=document.createElement('div');holder.innerHTML=rowHtml(`(-) ${name}`,invPrevByName[name],invCurByName[name],'br-dre-investment-detail',`openBrInvestmentDetails('${encodeURIComponent(name)}')`);
          const r=holder.firstElementChild;cursor.insertAdjacentElement('afterend',r);cursor=r;
        });
        const finalHolder=document.createElement('div');finalHolder.innerHTML=rowHtml('RESULTADO DO PERÍODO APÓS APLICAÇÕES',operatingPrev-totalPrev,operatingCur-totalCur,'result br-dre-result-after','');
        cursor.insertAdjacentElement('afterend',finalHolder.firstElementChild);
      }
    }finally{enhancing=false;}
  }

  const oldRenderChartAccounts=window.renderChartAccounts;
  if(typeof oldRenderChartAccounts==='function')window.renderChartAccounts=function(){
    migrateStructure();
    const out=oldRenderChartAccounts.apply(this,arguments);
    setTimeout(decoratePlanHeader,0);
    return out;
  };

  const oldRenderDRE=window.renderDRE;
  if(typeof oldRenderDRE==='function')window.renderDRE=function(){
    migrateStructure();
    const out=oldRenderDRE.apply(this,arguments);
    setTimeout(enhanceDre,90);
    return out;
  };

  migrateStructure();
  ensureStyles();
  setTimeout(()=>{decoratePlanHeader();enhanceDre();},140);
})();