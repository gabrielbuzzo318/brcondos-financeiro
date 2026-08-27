(function(){
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();

  function accountForTransaction(t){
    const cat=norm(t?.category);
    if(!cat)return null;
    return chartAccounts.find(a=>norm(a.name)===cat && (!t.type || a.type===t.type))||null;
  }

  function goesToDre(t){
    const account=accountForTransaction(t);
    return account ? account.dre!==false : true;
  }

  chartAccounts=chartAccounts.map(a=>({...a,dre:a.dre!==false}));
  saveData('chartAccounts',chartAccounts);

  window.setChartAccountDre=function(id,value){
    const dre=String(value)==='sim';
    chartAccounts=chartAccounts.map(a=>a.id===id?{...a,dre}:a);
    saveData('chartAccounts',chartAccounts);
    renderDRE();
  };

  window.renderDRE=function(){
    const entradas=transactions.filter(x=>x.type==='entrada'&&x.status==='pago'&&goesToDre(x));
    const gastos=transactions.filter(x=>x.type==='saida'&&x.status==='pago'&&goesToDre(x));
    const receita=entradas.reduce((a,b)=>a+Number(b.value||0),0);
    const despesas=gastos.reduce((a,b)=>a+Number(b.value||0),0);
    const resultado=receita-despesas;
    const cats={};
    gastos.forEach(x=>cats[x.category]=(cats[x.category]||0)+Number(x.value||0));
    const view=document.getElementById('view-dre');
    if(!view)return;
    view.innerHTML=`
      <div class="section-title"><div><h2>DRE Gerencial</h2><span>Somente contas marcadas como “Vai para DRE: Sim” no Plano de Contas</span></div><div class="field"><select><option>Agosto/2026</option></select></div></div>
      <div class="grid two-cols">
        <div class="card">
          <div class="panel-title">Demonstrativo</div>
          <div class="dre-row"><span>(+) Receita operacional</span><b>${money(receita)}</b></div>
          <div class="dre-row"><span>(-) Deduções / estornos</span><b>${money(0)}</b></div>
          <div class="dre-row"><span>(=) Receita líquida</span><b>${money(receita)}</b></div>
          ${Object.entries(cats).map(([k,v])=>`<div class="dre-row"><span>(-) ${k}</span><b>${money(v)}</b></div>`).join('')}
          <div class="dre-row total"><span>Total de despesas</span><span>${money(despesas)}</span></div>
          <div class="dre-row result"><span>RESULTADO DO PERÍODO</span><span>${money(resultado)}</span></div>
        </div>
        <div class="card">
          <div class="panel-title">Indicadores</div>
          <div class="dre-row"><span>Margem operacional</span><b>${receita?((resultado/receita)*100).toFixed(1):'0.0'}%</b></div>
          <div class="dre-row"><span>Despesas / Receita</span><b>${receita?((despesas/receita)*100).toFixed(1):'0.0'}%</b></div>
          <div class="dre-row"><span>Resultado</span><b style="color:${resultado>=0?'#278c3a':'#c94848'}">${money(resultado)}</b></div>
          <div class="notice" style="margin-top:20px">No <b>Plano de Contas</b>, altere diretamente a coluna <b>Vai para DRE?</b> para incluir ou excluir uma conta da DRE.</div>
        </div>
      </div>`;
  };

  window.renderChartAccounts=function(){
    const entries=chartAccounts.filter(x=>x.type==='entrada').sort((a,b)=>(a.code||'').localeCompare(b.code||''));
    const exits=chartAccounts.filter(x=>x.type==='saida').sort((a,b)=>(a.code||'').localeCompare(b.code||''));
    const row=x=>`<tr>
      <td><b>${esc(x.code||'-')}</b></td>
      <td>${esc(x.name)}</td>
      <td>${esc(x.group||'-')}</td>
      <td style="min-width:125px">
        <select onchange="setChartAccountDre(${x.id},this.value)" style="min-width:95px;font-weight:700">
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
      <div class="grid two-cols">
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
        ${field('Vai para DRE?',`<select id="pc_dre"><option value="sim" ${x.dre!==false?'selected':''}>Sim</option><option value="nao" ${x.dre===false?'selected':''}>Não</option></select>`)}
      </div>
      <div class="notice" style="margin-top:14px">Se marcar <b>Não</b>, a conta continua sendo usada nos lançamentos, mas fica fora do resultado da DRE.</div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px">
        <button class="btn" onclick="closeModal()">Cancelar</button>
        <button class="btn primary" onclick="saveChartAccount(${id||'null'})">Salvar</button>
      </div>`);
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
})();
