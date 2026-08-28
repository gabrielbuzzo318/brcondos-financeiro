(function(){
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();

  function ensureDreToggleStyles(){
    if(document.getElementById('br-dre-toggle-styles'))return;
    const style=document.createElement('style');
    style.id='br-dre-toggle-styles';
    style.textContent=`
      .br-dre-toggle{
        min-width:72px!important;
        width:72px!important;
        height:32px;
        padding:0 24px 0 10px!important;
        border-radius:8px!important;
        font-weight:800!important;
        font-size:13px!important;
        cursor:pointer;
        outline:none;
        transition:background .15s ease,border-color .15s ease,color .15s ease,box-shadow .15s ease;
      }
      .br-dre-toggle:focus{box-shadow:0 0 0 3px rgba(15,23,42,.08)}
      .br-dre-toggle.br-dre-sim{
        background:#eaf8ef!important;
        border-color:#82c994!important;
        color:#1e7b39!important;
      }
      .br-dre-toggle.br-dre-nao{
        background:#fdeeee!important;
        border-color:#e7a0a0!important;
        color:#b42323!important;
      }
    `;
    document.head.appendChild(style);
  }

  window.updateDreSelectStyle=function(el){
    if(!el)return;
    ensureDreToggleStyles();
    el.classList.add('br-dre-toggle');
    el.classList.toggle('br-dre-sim',String(el.value)==='sim');
    el.classList.toggle('br-dre-nao',String(el.value)!=='sim');
  };

  function accountForTransaction(t){
    const cat=norm(t?.category);
    if(!cat)return null;
    return chartAccounts.find(a=>norm(a.name)===cat && (!t.type || a.type===t.type))||null;
  }

  function goesToDre(t){
    const account=accountForTransaction(t);
    return account ? account.dre!==false : true;
  }

  function currentMonthPrefix(){
    const d=String(typeof today==='function'?today():'');
    if(/^\d{4}-\d{2}-\d{2}$/.test(d))return d.slice(0,7);
    const now=new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  }

  function monthLabel(prefix){
    const [y,m]=String(prefix).split('-').map(Number);
    const names=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    return `${names[(m||1)-1]||''}/${y||''}`;
  }

  function availableDreMonths(){
    const months=new Set([currentMonthPrefix()]);
    transactions.forEach(x=>{
      const m=String(x.date||'').match(/^(\d{4}-\d{2})-\d{2}$/);
      if(m)months.add(m[1]);
    });
    return [...months].sort((a,b)=>b.localeCompare(a));
  }

  function dreSummary(prefix=currentMonthPrefix()){
    const base=transactions.filter(x=>String(x.date||'').startsWith(prefix)&&x.status==='pago'&&goesToDre(x));
    const entradas=base.filter(x=>x.type==='entrada');
    const gastos=base.filter(x=>x.type==='saida');
    const receita=entradas.reduce((a,b)=>a+Number(b.value||0),0);
    const despesas=gastos.reduce((a,b)=>a+Number(b.value||0),0);
    const cats={};
    gastos.forEach(x=>cats[x.category]=(cats[x.category]||0)+Number(x.value||0));
    return {prefix,receita,despesas,resultado:receita-despesas,cats};
  }

  window.brDreSummaryForMonth=dreSummary;
  let selectedDreMonth=currentMonthPrefix();

  chartAccounts=chartAccounts.map(a=>({...a,dre:a.dre!==false}));
  saveData('chartAccounts',chartAccounts);

  window.setDreMonth=function(prefix){
    if(!/^\d{4}-\d{2}$/.test(String(prefix||'')))return;
    selectedDreMonth=String(prefix);
    renderDRE();
  };

  window.setChartAccountDre=function(id,value){
    const dre=String(value)==='sim';
    chartAccounts=chartAccounts.map(a=>a.id===id?{...a,dre}:a);
    saveData('chartAccounts',chartAccounts);
    renderDRE();
    if(typeof renderDashboard==='function')renderDashboard();
  };

  window.renderDRE=function(){
    const months=availableDreMonths();
    if(!months.includes(selectedDreMonth))selectedDreMonth=currentMonthPrefix();
    const dre=dreSummary(selectedDreMonth);
    const {receita,despesas,resultado,cats,prefix}=dre;
    const view=document.getElementById('view-dre');
    if(!view)return;
    view.innerHTML=`
      <div class="section-title">
        <div><h2>DRE Gerencial</h2><span>Somente contas marcadas como “Vai para DRE: Sim” no Plano de Contas</span></div>
        <div class="field">
          <label style="display:block;margin-bottom:5px">Período</label>
          <select id="dre_month" onchange="setDreMonth(this.value)">
            ${months.map(m=>`<option value="${m}" ${m===prefix?'selected':''}>${monthLabel(m)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="grid two-cols">
        <div class="card">
          <div class="panel-title">Demonstrativo — ${monthLabel(prefix)}</div>
          <div class="dre-row"><span>(+) Receita operacional</span><b>${money(receita)}</b></div>
          <div class="dre-row"><span>(-) Deduções / estornos</span><b>${money(0)}</b></div>
          <div class="dre-row"><span>(=) Receita líquida</span><b>${money(receita)}</b></div>
          ${Object.entries(cats).map(([k,v])=>`<div class="dre-row"><span>(-) ${k}</span><b>${money(v)}</b></div>`).join('')}
          <div class="dre-row total"><span>Total de despesas</span><span>${money(despesas)}</span></div>
          <div class="dre-row result"><span>RESULTADO DO PERÍODO</span><span>${money(resultado)}</span></div>
        </div>
        <div class="card">
          <div class="panel-title">Indicadores — ${monthLabel(prefix)}</div>
          <div class="dre-row"><span>Margem operacional</span><b>${receita?((resultado/receita)*100).toFixed(1):'0.0'}%</b></div>
          <div class="dre-row"><span>Despesas / Receita</span><b>${receita?((despesas/receita)*100).toFixed(1):'0.0'}%</b></div>
          <div class="dre-row"><span>Resultado</span><b style="color:${resultado>=0?'#278c3a':'#c94848'}">${money(resultado)}</b></div>
          <div class="notice" style="margin-top:20px">Use o seletor de <b>Período</b> para consultar meses anteriores. O card <b>Saldo DRE</b> do Dashboard continua mostrando somente o mês atual.</div>
        </div>
      </div>`;
  };

  window.renderChartAccounts=function(){
    ensureDreToggleStyles();
    const entries=chartAccounts.filter(x=>x.type==='entrada').sort((a,b)=>(a.code||'').localeCompare(b.code||''));
    const exits=chartAccounts.filter(x=>x.type==='saida').sort((a,b)=>(a.code||'').localeCompare(b.code||''));
    const row=x=>`<tr>
      <td><b>${esc(x.code||'-')}</b></td>
      <td>${esc(x.name)}</td>
      <td>${esc(x.group||'-')}</td>
      <td style="min-width:88px">
        <select class="br-dre-toggle ${x.dre!==false?'br-dre-sim':'br-dre-nao'}" onchange="setChartAccountDre(${x.id},this.value);updateDreSelectStyle(this)">
          <option value="sim" ${x.dre!==false?'selected':''}>Sim</option>
          <option value="nao" ${x.dre===false?'selected':''}>Não</option>
        </select>
      </td>
      <td><div class="actions"><button class="btn small" onclick="openChartAccount(${x.id})">Editar</button><button class="btn small danger" onclick="deleteChartAccount(${x.id})">Excluir</button></div></td>
    </tr>`;
    const view=document.getElementById('view-plano');
    if(!view)return;
    view.innerHTML=`
      <div class="section-title">
        <div><h2>Plano de Contas</h2><span>Defina quais contas devem ou não compor a DRE</span></div>
        <button class="btn primary" onclick="openChartAccount()">+ Nova conta</button>
      </div>
      <div class="notice"><b>Vai para DRE?</b> Escolha <b>Sim</b> ou <b>Não</b> diretamente em cada conta. Se marcar <b>Não</b>, a conta continua disponível no Fluxo de Caixa e no Contas a Pagar, mas seus lançamentos ficam fora da DRE.</div>
      <div class="grid" style="grid-template-columns:1fr">
        <div class="card">
          <div class="panel-title">Entradas / Receitas</div>
          <div class="table-wrap"><table style="min-width:0"><thead><tr><th>Código</th><th>Conta</th><th>Grupo</th><th>Vai para DRE?</th><th></th></tr></thead><tbody>
          ${entries.length?entries.map(row).join(''):`<tr><td colspan="5" class="empty">Nenhuma conta de entrada.</td></tr>`}
          </tbody></table></div>
        </div>
        <div class="card">
          <div class="panel-title">Saídas / Despesas</div>
          <div class="table-wrap"><table style="min-width:0"><thead><tr><th>Código</th><th>Conta</th><th>Grupo</th><th>Vai para DRE?</th><th></th></tr></thead><tbody>
          ${exits.length?exits.map(row).join(''):`<tr><td colspan="5" class="empty">Nenhuma conta de saída.</td></tr>`}
          </tbody></table></div>
        </div>
      </div>`;
  };

  window.openChartAccount=function(id=null){
    const x=id?chartAccounts.find(a=>a.id===id):{code:'',name:'',type:'saida',group:'',dre:true};
    if(!x)return;
    openModal(id?'Editar conta':'Nova conta do plano',`
      <div class="modal-grid">
        ${field('Código',`<input id="pc_code" value="${esc(x.code||'')}" placeholder="Ex.: 2.11">`)}
        ${field('Tipo',`<select id="pc_type"><option value="entrada" ${x.type==='entrada'?'selected':''}>Entrada / Receita</option><option value="saida" ${x.type==='saida'?'selected':''}>Saída / Despesa</option></select>`)}
        ${field('Nome da conta',`<input id="pc_name" value="${esc(x.name||'')}" placeholder="Ex.: Honorários jurídicos">`)}
        ${field('Grupo',`<input id="pc_group" value="${esc(x.group||'')}" placeholder="Ex.: Despesas Administrativas">`)}
        ${field('Vai para DRE?',`<select id="pc_dre" class="br-dre-toggle ${x.dre!==false?'br-dre-sim':'br-dre-nao'}" onchange="updateDreSelectStyle(this)"><option value="sim" ${x.dre!==false?'selected':''}>Sim</option><option value="nao" ${x.dre===false?'selected':''}>Não</option></select>`)}
      </div>
      <div class="notice" style="margin-top:14px">Se marcar <b>Não</b>, a conta continua sendo usada nos lançamentos, mas fica fora do resultado da DRE.</div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px">
        <button class="btn" onclick="closeModal()">Cancelar</button>
        <button class="btn primary" onclick="saveChartAccount(${id||'null'})">Salvar</button>
      </div>`);
    setTimeout(()=>updateDreSelectStyle(document.getElementById('pc_dre')),0);
  };

  window.saveChartAccount=function(id){
    const obj={
      id:id||Date.now(),
      code:val('pc_code'),
      name:val('pc_name'),
      type:val('pc_type'),
      group:val('pc_group'),
      dre:val('pc_dre')!=='nao'
    };
    if(!obj.name)return alert('Informe o nome da conta.');
    const duplicate=chartAccounts.some(x=>x.id!==id && x.name.trim().toLowerCase()===obj.name.trim().toLowerCase());
    if(duplicate)return alert('Já existe uma conta com esse nome.');
    if(id)chartAccounts=chartAccounts.map(x=>x.id===id?obj:x);else chartAccounts.push(obj);
    saveData('chartAccounts',chartAccounts);
    closeModal();
    renderAll();
  };

  ensureDreToggleStyles();
  setTimeout(()=>{try{renderDRE();renderDashboard()}catch(_){ }},0);
})();
