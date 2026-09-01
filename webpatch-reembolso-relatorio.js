(function(){
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const esc2=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const statusKey2=r=>{
    if(String(r?.receivedDate||'').trim()||norm(r?.status)==='recebido')return'recebido';
    if(norm(r?.status).includes('analise'))return'analise';
    return'nao_recebido';
  };
  const statusLabel2=k=>k==='analise'?'Em análise':k==='recebido'?'Recebido':'Não recebido';

  const oldOpenReportModal=window.openReportModal;
  const oldGenerateReport=window.generateReport;

  window.openReportModal=function(type){
    if(type!=='reimbursements') return oldOpenReportModal.apply(this,arguments);

    const parties=[...new Set((reimbursements||[]).map(r=>String(r.reimbursedBy||'').trim()).filter(Boolean))]
      .sort((a,b)=>a.localeCompare(b,'pt-BR'));

    openModal('Relatório de Reembolsos',`
      <div class="modal-grid">
        ${field('Período - De',`<input id="rep_from" type="date">`)}
        ${field('Período - Até',`<input id="rep_to" type="date">`)}
        ${field('Status',`<select id="rep_status">
          <option value="">Todos</option>
          <option value="analise">Em análise</option>
          <option value="nao_recebido">Não recebido</option>
          <option value="recebido">Recebido</option>
        </select>`)}
        ${field('Reembolsável por',`<select id="rep_reimbursed_by"><option value="">Todos</option>${parties.map(x=>`<option value="${esc2(x)}">${esc2(x)}</option>`).join('')}</select>`)}
        ${field('Pesquisar no relatório',`<input id="rep_search" type="text" placeholder="Descrição, cliente / fornecedor, valor...">`)}
      </div>
      <div class="report-help">O período considera a <b>data do lançamento</b>. O relatório usa somente os dados cadastrados em Reembolsos.</div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px">
        <button class="btn" onclick="closeModal()">Cancelar</button>
        <button class="btn primary" onclick="generateReport('reimbursements')">Gerar relatório</button>
      </div>`);
  };

  window.generateReport=function(type){
    if(type!=='reimbursements') return oldGenerateReport.apply(this,arguments);

    const from=document.getElementById('rep_from')?.value||'';
    const to=document.getElementById('rep_to')?.value||'';
    const status=document.getElementById('rep_status')?.value||'';
    const reimbursedBy=document.getElementById('rep_reimbursed_by')?.value||'';
    const q=document.getElementById('rep_search')?.value||'';

    let data=[...(reimbursements||[])].filter(r=>{
      const date=String(r.date||'');
      const okDate=(!from||date>=from)&&(!to||date<=to);
      const k=statusKey2(r);
      const okStatus=!status||k===status;
      const okParty=!reimbursedBy||String(r.reimbursedBy||'')===reimbursedBy;
      const hay=norm([r.date,r.description,r.reimbursedBy,r.paidBy,r.value,statusLabel2(k),r.receivedDate].join(' '));
      const okSearch=!q||hay.includes(norm(q));
      return okDate&&okStatus&&okParty&&okSearch;
    });

    data.sort((a,b)=>(Number(a?.displayOrder||9999)-Number(b?.displayOrder||9999))||String(a.date||'').localeCompare(String(b.date||'')));

    const byStatus=k=>data.filter(r=>statusKey2(r)===k);
    const sum=arr=>arr.reduce((s,r)=>s+Number(r.value||0),0);
    const analise=byStatus('analise');
    const nao=byStatus('nao_recebido');
    const recebidos=byStatus('recebido');
    const total=sum(data);

    const summary=`
      <div class="sum"><small>TOTAL</small><b>${money(total)}</b></div>
      <div class="sum"><small>EM ANÁLISE</small><b>${money(sum(analise))}</b></div>
      <div class="sum"><small>NÃO RECEBIDO</small><b>${money(sum(nao))}</b></div>
      <div class="sum"><small>RECEBIDO</small><b>${money(sum(recebidos))}</b></div>`;

    const headers=['Data','Tipo','Descrição','Recebido em','Reembolsável por','Cliente / Fornecedor','Valor'];
    const rows=data.map(r=>{
      const k=statusKey2(r);
      const recebidoEm=k==='recebido'?(r.receivedDate?formatDate(r.receivedDate):'Recebido'):statusLabel2(k);
      return [
        r.date?formatDate(r.date):'-',
        'Saída',
        esc2(r.description||'-'),
        esc2(recebidoEm),
        esc2(r.reimbursedBy||'-'),
        esc2(r.paidBy||r.party||'-'),
        `- ${money(r.value)}`
      ];
    });

    const periodText=from||to?`${from?formatDate(from):'início'} até ${to?formatDate(to):'hoje'}`:'Todos os períodos';
    const statusText=status?` • Status: ${statusLabel2(status)}`:'';
    const partyText=reimbursedBy?` • Reembolsável por: ${esc2(reimbursedBy)}`:'';
    const searchText=q?` • Pesquisa: ${esc2(q)}`:'';

    closeModal();
    printableReport('Relatório de Reembolsos',`${periodText}${statusText}${partyText}${searchText}`,summary,headers,rows);
  };
})();