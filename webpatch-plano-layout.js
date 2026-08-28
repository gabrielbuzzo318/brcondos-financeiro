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
      #view-plano .br-plan-table-wrap{overflow-x:auto}
      #view-plano .br-plan-table{width:100%;min-width:680px;border-collapse:collapse;table-layout:fixed}
      #view-plano .br-plan-table thead th{
        padding:10px 14px;background:#f7f9fa;border-bottom:1px solid #e6eaed;
        color:#66737e;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.02em;text-align:left;
      }
      #view-plano .br-plan-table tbody td{
        padding:10px 14px;border-bottom:1px solid #edf0f2;vertical-align:middle;color:#27343d;font-size:13px;
      }
      #view-plano .br-plan-table tbody tr:last-child td{border-bottom:0}
      #view-plano .br-plan-table tbody tr:hover{background:#fafcfd}
      #view-plano .br-plan-name{font-weight:700;color:#202b33}
      #view-plano .br-plan-group{color:#55636e}
      #view-plano .br-plan-group-chip{
        display:inline-flex;align-items:center;min-height:26px;padding:4px 9px;border-radius:999px;
        background:#f2f5f7;color:#596873;font-size:12px;font-weight:700;line-height:1.2;
      }
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
        #view-plano .br-plan-table thead th,#view-plano .br-plan-table tbody td{padding-left:10px;padding-right:10px}
      }
    `;
    document.head.appendChild(style);
  }

  const collator=new Intl.Collator('pt-BR',{sensitivity:'base',numeric:true});
  const clean=v=>String(v||'').trim();
  const displayGroup=x=>clean(x.group)||'Sem grupo';

  window.toggleChartAccountDre=function(id){
    const item=chartAccounts.find(a=>Number(a.id)===Number(id));
    if(!item)return;
    const next=item.dre===false?'sim':'nao';
    if(typeof setChartAccountDre==='function')setChartAccountDre(item.id,next);
    if(typeof renderChartAccounts==='function')renderChartAccounts();
  };

  window.renderChartAccounts=function(){
    ensurePlanStyles();

    const entries=chartAccounts
      .filter(x=>x.type==='entrada')
      .sort((a,b)=>collator.compare(clean(a.name),clean(b.name)));

    const exits=chartAccounts
      .filter(x=>x.type==='saida')
      .sort((a,b)=>{
        const g=collator.compare(displayGroup(a),displayGroup(b));
        return g||collator.compare(clean(a.name),clean(b.name));
      });

    const rows=list=>list.length?list.map(x=>`<tr>
      <td class="br-plan-name">${esc(x.name||'—')}</td>
      <td class="br-plan-group"><span class="br-plan-group-chip">${esc(displayGroup(x))}</span></td>
      <td class="br-plan-dre-cell">
        <button type="button" class="br-dre-status ${x.dre!==false?'sim':'nao'}" onclick="toggleChartAccountDre(${x.id})" title="Clique para alterar">
          ${x.dre!==false?'Sim':'Não'}
        </button>
      </td>
      <td class="br-plan-actions"><div class="actions">
        <button class="btn small" onclick="openChartAccount(${x.id})">Editar</button>
        <button class="btn small danger" onclick="deleteChartAccount(${x.id})">Excluir</button>
      </div></td>
    </tr>`).join(''):`<tr><td colspan="4" class="br-plan-empty">Nenhuma conta cadastrada.</td></tr>`;

    const card=(title,list,kind)=>`<div class="card br-plan-card ${kind}">
      <div class="br-plan-card-head">
        <div class="br-plan-card-title">${title}</div>
        <span class="br-plan-count">${list.length}</span>
      </div>
      <div class="br-plan-table-wrap"><table class="br-plan-table">
        <colgroup><col style="width:43%"><col style="width:30%"><col style="width:120px"><col style="width:170px"></colgroup>
        <thead><tr><th>Conta</th><th>Grupo</th><th style="text-align:center">Vai para DRE?</th><th style="text-align:right">Ações</th></tr></thead>
        <tbody>${rows(list)}</tbody>
      </table></div>
    </div>`;

    const view=document.getElementById('view-plano');
    if(!view)return;
    view.innerHTML=`
      <div class="section-title">
        <div><h2>Plano de Contas</h2><span>Defina quais contas devem ou não compor a DRE</span></div>
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
    openModal(id?'Editar conta':'Nova conta do plano',`
      <div class="modal-grid">
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
    const duplicate=chartAccounts.some(x=>Number(x.id)!==Number(id) && String(x.name||'').trim().toLowerCase()===obj.name.trim().toLowerCase());
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
