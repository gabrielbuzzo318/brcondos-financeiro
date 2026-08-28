(function(){
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
  const manualKey='inadimplencias_manual';
  const loadManual=()=>{try{const x=JSON.parse(localStorage.getItem('brcondos_'+manualKey)||'[]');return Array.isArray(x)?x:[]}catch(_){return []}};
  let manualInadimplencias=loadManual();
  const saveManual=()=>typeof saveData==='function'?saveData(manualKey,manualInadimplencias):localStorage.setItem('brcondos_'+manualKey,JSON.stringify(manualInadimplencias));
  const hoje=()=>typeof today==='function'?today():new Date().toISOString().slice(0,10);

  function boletoFinanceStatus(b){
    const s=norm(b?.sicrediStatus||'');
    if(/BAIXADO\s+POR\s+SOLICIT/.test(s))return 'baixado';
    if(/LIQUIDAD|PAGO|PAGA/.test(s))return 'liquidado';
    if(/VENCID/.test(s)||b?.status==='vencido')return 'vencido';
    if(b?.status==='recebido')return 'liquidado';
    if(b?.due&&String(b.due)<hoje())return 'vencido';
    return 'em_aberto';
  }

  function receiptDue(r){
    const b=(boletos||[]).find(x=>String(x.id)===String(r?.sourceBoletoId||''));
    return r?.dueDate||b?.due||r?.issueDate||'';
  }

  function receiptFinanceStatus(r){
    if(r?.paymentStatus==='liquidado')return 'liquidado';
    const b=(boletos||[]).find(x=>String(x.id)===String(r?.sourceBoletoId||''));
    if(b){
      const st=boletoFinanceStatus(b);
      if(st==='liquidado')return 'liquidado';
      if(st==='vencido')return 'vencido';
    }
    const due=receiptDue(r);
    return due&&String(due)<hoje()?'vencido':'em_aberto';
  }
  window.receiptFinanceStatus=receiptFinanceStatus;

  function finBadge(st){
    const m={em_aberto:['Em aberto','yellow'],vencido:['Vencido','red'],liquidado:['Liquidado','green']};
    const x=m[st]||[st,'gray'];
    return `<span class="badge ${x[1]}">${x[0]}</span>`;
  }

  function ensureInadimplencias(){
    if(typeof titles==='object'&&titles)titles.inadimplencias=['Inadimplências','Boletos, recibos e cobranças em atraso'];
    if(!document.getElementById('view-inadimplencias')){
      const v=document.createElement('section');
      v.id='view-inadimplencias';
      v.className='view hidden';
      const rec=document.getElementById('view-recibos');
      rec?.parentElement?.appendChild(v);
    }
    const nav=document.querySelector('.nav');
    if(nav&&!nav.querySelector('[data-view="inadimplencias"]')){
      const b=document.createElement('button');
      b.dataset.view='inadimplencias';
      b.innerHTML='<span class="ico">!</span>Inadimplências';
      b.onclick=function(){showView('inadimplencias',this)};
      const rec=nav.querySelector('[data-view="recibos"]');
      rec?rec.insertAdjacentElement('afterend',b):nav.appendChild(b);
    }
  }

  function findReceiptFlow(r){
    const direct=(transactions||[]).find(t=>String(t.sourceReceiptId||'')===String(r?.id||''));
    if(direct)return direct;
    if(r?.flowId){
      const byId=(transactions||[]).find(t=>String(t.id)===String(r.flowId));
      if(byId)return byId;
    }
    return null;
  }

  function syncReceiptToFlow(r,date){
    if(!r||!date)return null;
    const existing=findReceiptFlow(r);
    if(existing){
      existing.date=date;
      existing.type='entrada';
      existing.description=`Recebimento de recibo ${r.receiptNumber||''}`.trim();
      existing.category='Receitas de serviços';
      existing.party=r.client||'';
      existing.value=Number(r.value||0);
      existing.status='pago';
      existing.sourceType='recibo';
      existing.sourceReceiptId=r.id;
      r.flowId=existing.id;
      saveData('transactions',transactions);
      return existing.id;
    }

    const flowId=Date.now()+17;
    transactions.push({
      id:flowId,
      date,
      type:'entrada',
      description:`Recebimento de recibo ${r.receiptNumber||''}`.trim(),
      category:'Receitas de serviços',
      party:r.client||'',
      value:Number(r.value||0),
      status:'pago',
      sourceType:'recibo',
      sourceReceiptId:r.id
    });
    r.flowId=flowId;
    saveData('transactions',transactions);
    return flowId;
  }

  function removeReceiptFromFlow(r){
    if(!r)return;
    transactions=transactions.filter(t=>
      String(t.id)!==String(r.flowId||'') &&
      String(t.sourceReceiptId||'')!==String(r.id||'')
    );
    r.flowId=null;
    saveData('transactions',transactions);
  }

  window.renderReceipts=function(){
    const view=document.getElementById('view-recibos');if(!view)return;
    const rows=(receipts||[]).slice().sort((a,b)=>(b.competence||'').localeCompare(a.competence||'')||String(a.client||'').localeCompare(String(b.client||''),'pt-BR'));
    const open=rows.filter(x=>receiptFinanceStatus(x)==='em_aberto').length;
    const overdue=rows.filter(x=>receiptFinanceStatus(x)==='vencido').length;
    const liquid=rows.filter(x=>receiptFinanceStatus(x)==='liquidado').length;
    const total=rows.reduce((s,x)=>s+Number(x.value||0),0);
    const comps=[...new Set(rows.map(x=>x.competence).filter(Boolean))].sort().reverse();

    view.innerHTML=`
      <div class="section-title">
        <div><h2>Recibos</h2><span>Recibos de prestação de serviço e controle de recebimento</span></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn primary" onclick="openNewReceipt()">+ Recibo</button>
          <button class="btn" onclick="syncBillingFromBoletos()">↻ Sincronizar faturamento</button>
          <button class="btn" onclick="openReportModal('receipts')">▤ Relatório</button>
          <button class="btn green" onclick="generateAllReceipts()">⚡ Gerar todos</button>
        </div>
      </div>
      <div class="cards grid" style="grid-template-columns:repeat(4,1fr)">
        <div class="card accent-orange"><div class="kpi-label">EM ABERTO</div><div class="kpi-value">${open}</div></div>
        <div class="card" style="border-top:3px solid var(--danger)"><div class="kpi-label">VENCIDOS</div><div class="kpi-value">${overdue}</div></div>
        <div class="card accent-green"><div class="kpi-label">LIQUIDADOS</div><div class="kpi-value">${liquid}</div></div>
        <div class="card accent-blue"><div class="kpi-label">VALOR TOTAL</div><div class="kpi-value" style="font-size:20px">${money(total)}</div></div>
      </div>
      <div class="filter-bar">
        <div class="field search"><label>Pesquisar</label><input id="receipt_search" placeholder="Cliente, nº, competência, valor..." oninput="filterReceiptsTable()"></div>
        <div class="field"><label>Competência</label><select id="receipt_comp_filter" onchange="filterReceiptsTable()"><option value="">Todas</option>${comps.map(c=>`<option value="${c}">${receiptCompetenceLabel(c)}</option>`).join('')}</select></div>
        <div class="field"><label>Status</label><select id="receipt_status_filter" onchange="filterReceiptsTable()"><option value="">Todos</option><option value="em_aberto">Em aberto</option><option value="vencido">Vencido</option><option value="liquidado">Liquidado</option></select></div>
        <button class="btn" onclick="clearReceiptFilters()">Limpar filtros</button>
        <div id="receipt_filter_result" class="filter-result"></div>
      </div>
      <div class="table-wrap"><table><thead><tr><th>Recibo</th><th>Cliente</th><th>Competência</th><th>Data recibo</th><th>Vencimento</th><th>Status</th><th>Valor</th><th></th></tr></thead><tbody>
        ${rows.length?rows.map(x=>{
          const st=receiptFinanceStatus(x),due=receiptDue(x),linked=(boletos||[]).find(b=>String(b.id)===String(x.sourceBoletoId||''));
          return `<tr data-id="${x.id}" data-comp="${esc(x.competence||'')}" data-status="${st}" data-search="${esc([x.receiptNumber,x.client,x.competence,receiptCompetenceLabel(x.competence),x.issueDate,due,x.value,money(x.value),st].filter(Boolean).join(' '))}">
            <td><b>${esc(x.receiptNumber||'-')}</b><div class="subtle">${x.status==='gerado'?'PDF gerado':'PDF pendente'}</div></td>
            <td>${esc(x.client||'-')}</td>
            <td>${esc(receiptCompetenceLabel(x.competence))}</td>
            <td>${x.issueDate?formatDate(x.issueDate):'-'}</td>
            <td>${due?formatDate(due):'-'}</td>
            <td>${finBadge(st)}${linked?`<div class="subtle">Vínculo: ${esc(linked.docNumber||'boleto')}</div>`:''}${x.liquidationDate?`<div class="subtle">Baixa: ${formatDate(x.liquidationDate)}</div>`:''}</td>
            <td class="amount pos">${money(x.value)}</td>
            <td><div class="actions">
              <button class="btn small" onclick="openReceiptEdit(${x.id})">Editar</button>
              <button class="btn small" onclick="previewReceipt(${x.id})">Visualizar</button>
              <button class="btn small primary" onclick="generateReceiptPdf(${x.id})">${x.status==='gerado'?'Reimprimir PDF':'Gerar / Imprimir PDF'}</button>
              ${st!=='liquidado'?`<button class="btn small green" onclick="openReceiptLiquidation(${x.id})">Liquidar</button>`:(x.paymentStatus==='liquidado'?`<button class="btn small" onclick="reopenReceiptPayment(${x.id})">Reabrir</button>`:'')}
              <button class="btn small danger" onclick="deleteReceipt(${x.id})">Excluir</button>
            </div></td>
          </tr>`;
        }).join(''):`<tr><td colspan="8" class="empty">Nenhum recibo criado.</td></tr>`}
      </tbody></table></div>`;
    setTimeout(()=>filterReceiptsTable(),0);
  };

  window.filterReceiptsTable=function(){
    const q=normalizeSearchText(document.getElementById('receipt_search')?.value||'');
    const comp=document.getElementById('receipt_comp_filter')?.value||'';
    const status=document.getElementById('receipt_status_filter')?.value||'';
    const rows=[...document.querySelectorAll('#view-recibos tbody tr[data-search]')];
    let visible=0;
    rows.forEach(tr=>{
      const ok=(!q||normalizeSearchText(tr.dataset.search||'').includes(q))&&(!comp||tr.dataset.comp===comp)&&(!status||tr.dataset.status===status);
      tr.style.display=ok?'':'none';if(ok)visible++;
    });
    const e=document.getElementById('receipt_filter_result');if(e)e.textContent=`${visible} resultado(s)`;
  };

  window.openNewReceipt=function(){
    const list=(clients||[]).slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'pt-BR'));
    const comp=new Date().toISOString().slice(0,7);
    openModal('Novo recibo',`
      <div class="modal-grid">
        ${field('Cliente',`<select id="rec_new_client"><option value="">Selecione o cliente</option>${list.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>`)}
        ${field('Competência',`<input id="rec_new_comp" type="month" value="${comp}">`)}
        ${field('Data do recibo',`<input id="rec_new_date" type="date" value="${hoje()}">`)}
        ${field('Vencimento',`<input id="rec_new_due" type="date" value="${hoje()}">`)}
        ${field('Valor',`<input id="rec_new_value" type="text" inputmode="decimal" placeholder="0,00">`)}
      </div>
      <div class="notice">O status começa como <b>Em aberto</b> e vira <b>Vencido</b> automaticamente após o vencimento.</div>
      <div style="display:flex;justify-content:flex-end;gap:8px"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="saveNewReceipt()">Criar recibo</button></div>`);
  };

  window.saveNewReceipt=function(){
    const clientId=Number(val('rec_new_client'));
    const competence=val('rec_new_comp');
    const issueDate=val('rec_new_date');
    const dueDate=val('rec_new_due');
    const value=parseMoneyBR(val('rec_new_value'));
    const c=(clients||[]).find(x=>Number(x.id)===clientId);
    if(!c||!competence||!issueDate||!dueDate||!(value>0))return alert('Preencha cliente, competência, data, vencimento e valor.');
    const row=normalizeReceipt({
      id:Date.now(),sourceBoletoId:'',clientId:c.id,client:c.name,competence,issueDate,dueDate,value,
      description:'Honorários administrativos',receiptNumber:nextReceiptNumber(String(competence).slice(0,4)),
      status:'pendente',paymentStatus:'em_aberto',liquidationDate:'',flowId:null
    });
    receipts.push(row);saveData('receipts',receipts);closeModal();renderAll();
  };

  window.openReceiptEdit=function(id){
    const x=(receipts||[]).find(r=>r.id===id);if(!x)return;
    openModal('Editar recibo',`
      <div class="modal-grid">
        ${field('Cliente',`<input value="${esc(x.client||'')}" disabled>`)}
        ${field('Nº do recibo',`<input id="rec_number" value="${esc(x.receiptNumber||'')}">`)}
        ${field('Competência',`<input id="rec_comp" type="month" value="${esc(x.competence||'')}">`)}
        ${field('Data do recibo',`<input id="rec_date" type="date" value="${esc(x.issueDate||hoje())}">`)}
        ${field('Vencimento',`<input id="rec_due" type="date" value="${esc(receiptDue(x)||hoje())}">`)}
        ${field('Valor',`<input id="rec_value" inputmode="decimal" value="${esc(moneyInputBR(x.value))}">`)}
      </div>
      <div class="notice">O status financeiro é controlado pelos botões <b>Liquidar</b> e <b>Reabrir</b>. Ao liquidar, o sistema pede a data e lança a entrada no Fluxo de Caixa.</div>
      <div style="display:flex;justify-content:flex-end;gap:8px"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="saveReceiptEdit(${id})">Salvar</button></div>`);
  };

  window.saveReceiptEdit=function(id){
    const x=(receipts||[]).find(r=>r.id===id);if(!x)return;
    const number=val('rec_number').trim(),comp=val('rec_comp'),date=val('rec_date'),due=val('rec_due'),value=parseMoneyBR(val('rec_value'));
    if(!number||!comp||!date||!due||!(value>0))return alert('Preencha número, competência, data, vencimento e valor.');
    if((receipts||[]).some(r=>r.id!==id&&String(r.receiptNumber).toUpperCase()===number.toUpperCase()))return alert('Já existe um recibo com esse número.');
    Object.assign(x,{receiptNumber:number,competence:comp,issueDate:date,dueDate:due,value});
    if(x.paymentStatus==='liquidado'&&x.liquidationDate)syncReceiptToFlow(x,x.liquidationDate);
    saveData('receipts',receipts);closeModal();renderAll();
  };

  window.openReceiptLiquidation=function(id){
    const x=(receipts||[]).find(r=>r.id===id);if(!x)return;
    openModal('Liquidar recibo',`
      <div class="modal-grid">
        ${field('Recibo',`<input value="${esc(x.receiptNumber||'-')}" disabled>`)}
        ${field('Cliente',`<input value="${esc(x.client||'-')}" disabled>`)}
        ${field('Valor',`<input value="${esc(money(x.value))}" disabled>`)}
        ${field('Data da liquidação',`<input id="rec_liq_confirm_date" type="date" value="${hoje()}">`)}
      </div>
      <div class="notice">Ao confirmar, o recibo será marcado como <b>Liquidado</b> e entrará no Fluxo de Caixa como <b>Receitas de serviços</b> na data informada.</div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn green" onclick="confirmReceiptLiquidation(${id})">Liquidar</button></div>`);
  };

  window.confirmReceiptLiquidation=function(id){
    const x=(receipts||[]).find(r=>r.id===id);
    const d=val('rec_liq_confirm_date');
    if(!x)return;
    if(!d)return alert('Informe a data da liquidação.');
    x.paymentStatus='liquidado';
    x.liquidationDate=d;
    syncReceiptToFlow(x,d);
    saveData('receipts',receipts);
    closeModal();
    renderAll();
  };

  window.reopenReceiptPayment=function(id){
    const x=(receipts||[]).find(r=>r.id===id);
    if(!x||!confirm('Reabrir este recibo? A entrada correspondente será removida do Fluxo de Caixa.'))return;
    removeReceiptFromFlow(x);
    x.paymentStatus='em_aberto';
    x.liquidationDate='';
    saveData('receipts',receipts);
    renderAll();
  };

  function automaticRows(){
    const bs=(boletos||[]).filter(b=>boletoFinanceStatus(b)==='vencido').map(b=>({origin:'boleto',id:b.id,client:b.client||'-',document:b.docNumber||'Boleto',due:b.due||'',description:b.description||b.details||'Boleto vencido',value:Number(b.value||0),status:'vencido'}));
    const ids=new Set(bs.map(x=>String(x.id))),rs=[];
    (receipts||[]).forEach(r=>{
      if(receiptFinanceStatus(r)!=='vencido')return;
      const sid=String(r.sourceBoletoId||'');
      if(sid&&ids.has(sid)){
        const row=bs.find(x=>String(x.id)===sid);
        if(row){row.origin='boleto_recibo';row.document=`${row.document} / Recibo ${r.receiptNumber||''}`;}
        return;
      }
      rs.push({origin:'recibo',id:r.id,client:r.client||'-',document:`Recibo ${r.receiptNumber||''}`,due:receiptDue(r),description:r.description||'Recibo vencido',value:Number(r.value||0),status:'vencido'});
    });
    return [...bs,...rs];
  }

  const manualStatus=x=>x.status==='liquidado'?'liquidado':(x.due&&String(x.due)<hoje()?'vencido':'em_aberto');
  const originLabel=o=>({boleto:'Boleto',recibo:'Recibo',boleto_recibo:'Boleto + Recibo',manual:'Manual'}[o]||o);
  function daysLate(d){if(!d||d>=hoje())return 0;return Math.max(0,Math.floor((new Date(hoje()+'T12:00:00')-new Date(d+'T12:00:00'))/86400000))}

  window.renderInadimplencias=function(){
    ensureInadimplencias();
    const view=document.getElementById('view-inadimplencias');if(!view)return;
    const auto=automaticRows();
    const manual=manualInadimplencias.map(x=>({...x,origin:'manual',status:manualStatus(x)}));
    const rows=[...auto,...manual].sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999'));
    const active=rows.filter(x=>x.status==='vencido');
    const total=active.reduce((s,x)=>s+Number(x.value||0),0);
    const bCount=auto.filter(x=>x.origin==='boleto'||x.origin==='boleto_recibo').length;
    const rCount=auto.filter(x=>x.origin==='recibo'||x.origin==='boleto_recibo').length;

    view.innerHTML=`
      <div class="section-title"><div><h2>Inadimplências</h2><span>Controle consolidado de cobranças vencidas</span></div><button class="btn primary" onclick="openManualInadimplencia()">+ Nova inadimplência</button></div>
      <div class="cards grid" style="grid-template-columns:repeat(4,1fr)">
        <div class="card" style="border-top:3px solid var(--danger)"><div class="kpi-label">TOTAL EM ATRASO</div><div class="kpi-value">${money(total)}</div></div>
        <div class="card accent-blue"><div class="kpi-label">BOLETOS VENCIDOS</div><div class="kpi-value">${bCount}</div></div>
        <div class="card accent-orange"><div class="kpi-label">RECIBOS VENCIDOS</div><div class="kpi-value">${rCount}</div></div>
        <div class="card accent-slate"><div class="kpi-label">MANUAIS</div><div class="kpi-value">${manual.length}</div></div>
      </div>
      <div class="filter-bar">
        <div class="field search"><label>Pesquisar</label><input id="inad_search" placeholder="Cliente, documento, descrição, valor..." oninput="filterInadimplencias()"></div>
        <div class="field"><label>Origem</label><select id="inad_origin" onchange="filterInadimplencias()"><option value="">Todas</option><option value="boleto">Boleto</option><option value="recibo">Recibo</option><option value="boleto_recibo">Boleto + Recibo</option><option value="manual">Manual</option></select></div>
        <div class="field"><label>Status</label><select id="inad_status" onchange="filterInadimplencias()"><option value="">Todos</option><option value="vencido">Vencido</option><option value="em_aberto">Em aberto</option><option value="liquidado">Liquidado</option></select></div>
        <button class="btn" onclick="clearInadimplenciaFilters()">Limpar filtros</button><div id="inad_filter_result" class="filter-result"></div>
      </div>
      <div class="table-wrap"><table><thead><tr><th>Origem</th><th>Cliente / Devedor</th><th>Documento</th><th>Vencimento</th><th>Atraso</th><th>Descrição</th><th>Status</th><th>Valor</th><th></th></tr></thead><tbody>
        ${rows.length?rows.map(x=>`<tr data-origin="${x.origin}" data-status="${x.status}" data-search="${esc([originLabel(x.origin),x.client,x.document,x.due,x.description,x.status,x.value,money(x.value)].filter(Boolean).join(' '))}">
          <td><span class="badge ${x.origin==='manual'?'gray':'blue'}">${originLabel(x.origin)}</span></td>
          <td><b>${esc(x.client||'-')}</b></td><td>${esc(x.document||'-')}</td><td>${x.due?formatDate(x.due):'-'}</td>
          <td>${x.status==='vencido'?`<b style="color:var(--danger)">${daysLate(x.due)} dia(s)</b>`:'-'}</td><td>${esc(x.description||'-')}</td><td>${finBadge(x.status)}</td>
          <td class="amount ${x.status==='liquidado'?'pos':'neg'}">${money(x.value)}</td>
          <td><div class="actions">${x.origin==='manual'?`<button class="btn small" onclick="openManualInadimplencia(${x.id})">Editar</button>${x.status!=='liquidado'?`<button class="btn small green" onclick="liquidateManualInadimplencia(${x.id})">Liquidar</button>`:`<button class="btn small" onclick="reopenManualInadimplencia(${x.id})">Reabrir</button>`}<button class="btn small danger" onclick="deleteManualInadimplencia(${x.id})">Excluir</button>`:x.origin==='recibo'?`<button class="btn small" onclick="openReceiptEdit(${x.id})">Abrir recibo</button>`:`<button class="btn small" onclick="openBoleto(${x.id})">Abrir boleto</button>`}</div></td>
        </tr>`).join(''):`<tr><td colspan="9" class="empty">Nenhuma inadimplência encontrada.</td></tr>`}
      </tbody></table></div>`;
    setTimeout(()=>filterInadimplencias(),0);
  };

  window.filterInadimplencias=function(){
    const q=normalizeSearchText(document.getElementById('inad_search')?.value||''),o=document.getElementById('inad_origin')?.value||'',s=document.getElementById('inad_status')?.value||'';
    const rows=[...document.querySelectorAll('#view-inadimplencias tbody tr[data-search]')];let n=0;
    rows.forEach(tr=>{const ok=(!q||normalizeSearchText(tr.dataset.search||'').includes(q))&&(!o||tr.dataset.origin===o)&&(!s||tr.dataset.status===s);tr.style.display=ok?'':'none';if(ok)n++});
    const e=document.getElementById('inad_filter_result');if(e)e.textContent=`${n} resultado(s)`;
  };

  window.clearInadimplenciaFilters=function(){
    ['inad_search','inad_origin','inad_status'].forEach(id=>{const e=document.getElementById(id);if(e)e.value=''});
    filterInadimplencias();
  };

  window.openManualInadimplencia=function(id=null){
    const x=id?manualInadimplencias.find(r=>Number(r.id)===Number(id)):{client:'',due:hoje(),description:'',value:'',status:'em_aberto',liquidationDate:''};
    if(!x)return;
    const opts=(clients||[]).map(c=>`<option value="${esc(c.name||'')}"></option>`).join('');
    openModal(id?'Editar inadimplência':'Nova inadimplência',`
      <div class="modal-grid">
        ${field('Cliente / Devedor',`<input id="inad_manual_client" list="inad_client_list" value="${esc(x.client||'')}" placeholder="Nome do devedor"><datalist id="inad_client_list">${opts}</datalist>`)}
        ${field('Vencimento',`<input id="inad_manual_due" type="date" value="${esc(x.due||hoje())}">`)}
        ${field('Descrição',`<input id="inad_manual_desc" value="${esc(x.description||'')}" placeholder="Ex.: honorários em atraso">`)}
        ${field('Valor',`<input id="inad_manual_value" type="text" inputmode="decimal" value="${x.value!==''?esc(moneyInputBR(x.value)):''}" placeholder="0,00">`)}
        ${field('Status',`<select id="inad_manual_status"><option value="em_aberto" ${x.status!=='liquidado'?'selected':''}>Em aberto / automático</option><option value="liquidado" ${x.status==='liquidado'?'selected':''}>Liquidado</option></select>`)}
        ${field('Data da liquidação',`<input id="inad_manual_liq" type="date" value="${esc(x.liquidationDate||'')}">`)}
      </div>
      <div class="notice">Se o vencimento já passou e não estiver liquidado, o status vira <b>Vencido</b> automaticamente.</div>
      <div style="display:flex;justify-content:flex-end;gap:8px"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="saveManualInadimplencia(${id||'null'})">Salvar</button></div>`);
  };

  window.saveManualInadimplencia=function(id){
    const client=val('inad_manual_client').trim(),due=val('inad_manual_due'),description=val('inad_manual_desc').trim(),value=parseMoneyBR(val('inad_manual_value')),status=val('inad_manual_status'),liq=val('inad_manual_liq');
    if(!client||!due||!description||!(value>0))return alert('Preencha cliente, vencimento, descrição e valor.');
    const obj={id:id||Date.now(),client,due,description,value,status:status==='liquidado'?'liquidado':'em_aberto',liquidationDate:status==='liquidado'?(liq||hoje()):''};
    if(id)manualInadimplencias=manualInadimplencias.map(x=>Number(x.id)===Number(id)?obj:x);else manualInadimplencias.push(obj);
    saveManual();closeModal();renderAll();
  };

  window.liquidateManualInadimplencia=function(id){const x=manualInadimplencias.find(r=>Number(r.id)===Number(id));if(!x)return;x.status='liquidado';x.liquidationDate=hoje();saveManual();renderAll()};
  window.reopenManualInadimplencia=function(id){const x=manualInadimplencias.find(r=>Number(r.id)===Number(id));if(!x)return;x.status='em_aberto';x.liquidationDate='';saveManual();renderAll()};
  window.deleteManualInadimplencia=function(id){if(!confirm('Excluir esta inadimplência manual?'))return;manualInadimplencias=manualInadimplencias.filter(r=>Number(r.id)!==Number(id));saveManual();renderAll()};

  const oldRenderAll=window.renderAll;
  if(typeof oldRenderAll==='function')window.renderAll=function(){const out=oldRenderAll.apply(this,arguments);try{renderInadimplencias()}catch(e){console.error('INADIMPLENCIAS',e)}return out};
  ensureInadimplencias();
  setTimeout(()=>{try{renderReceipts();renderInadimplencias()}catch(e){console.error('INADIMPLENCIAS INIT',e)}},0);
})();