(function(){
  const STORAGE_KEY='brcondos_reimbursementsV2';
  const LOGO_URL='https://upload.wikimedia.org/wikipedia/commons/c/cf/Logo_BRCondos_svg.svg';
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDate=v=>{const s=String(v||'');const m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:s};
  const fmtMoney=v=>{const n=Number(v||0);try{if(typeof money==='function')return money(n)}catch(_){ }return n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})};

  function list(){
    try{const raw=localStorage.getItem(STORAGE_KEY);const parsed=raw?JSON.parse(raw):[];return Array.isArray(parsed)?parsed:[]}
    catch(_){return []}
  }

  function statusValue(item){
    const s=norm(item?.status);
    if(s==='recebido')return'recebido';
    if(s.includes('nao recebido')||s==='nao_recebido')return'nao_recebido';
    return'analise';
  }

  function statusText(item){
    const s=statusValue(item);
    if(s==='recebido')return item?.receivedDate?fmtDate(item.receivedDate):'Recebido';
    if(s==='nao_recebido')return'Não recebido';
    return'Em análise';
  }

  function reportItems(){
    const status=String(document.getElementById('br_r2_rep_status')?.value||'');
    const client=norm(document.getElementById('br_r2_rep_client')?.value||'');
    const from=String(document.getElementById('br_r2_rep_from')?.value||'');
    const to=String(document.getElementById('br_r2_rep_to')?.value||'');
    return list().filter(item=>{
      const d=String(item?.date||'');
      return(!status||statusValue(item)===status)&&(!client||norm(item?.reimbursableBy)===client)&&(!from||d>=from)&&(!to||d<=to);
    }).sort((a,b)=>String(a?.date||'').localeCompare(String(b?.date||''))||Number(a?.id||0)-Number(b?.id||0));
  }

  function filterDescription(){
    const st=String(document.getElementById('br_r2_rep_status')?.value||'');
    const client=String(document.getElementById('br_r2_rep_client')?.value||'');
    const from=String(document.getElementById('br_r2_rep_from')?.value||'');
    const to=String(document.getElementById('br_r2_rep_to')?.value||'');
    return{
      status:{analise:'Em análise',nao_recebido:'Não recebido',recebido:'Recebido'}[st]||'Todos',
      client:client||'Todos',
      period:from||to?`${from?fmtDate(from):'início'} a ${to?fmtDate(to):'hoje'}`:'Todos'
    };
  }

  function summary(items){
    return items.reduce((o,x)=>{
      const v=Number(x?.value||0),s=statusValue(x);
      o.total+=v;
      if(s==='recebido')o.received+=v;
      else if(s==='nao_recebido')o.pending+=v;
      else o.analysis+=v;
      return o;
    },{total:0,pending:0,received:0,analysis:0});
  }

  function filterStripText(f){
    if(f.status==='Todos'&&f.client==='Todos'&&f.period==='Todos')return'Todos os períodos';
    return `Status: ${f.status}  •  Cliente / Reembolsável por: ${f.client}  •  Período: ${f.period}`;
  }

  window.brR2PdfReport=function(){
    const items=reportItems();
    if(!items.length)return alert('Nenhum registro encontrado para os filtros selecionados.');

    const f=filterDescription();
    const sums=summary(items);
    const reportWindow=window.open('','_blank');
    if(!reportWindow)return alert('O navegador bloqueou a abertura do relatório. Libere pop-ups para este site e tente novamente.');

    const rows=items.map(item=>`
      <tr>
        <td class="date">${esc(fmtDate(item?.date||''))}</td>
        <td>${esc(item?.description||'')}</td>
        <td class="received">${esc(statusText(item))}</td>
        <td>${esc(item?.reimbursableBy||'')}</td>
        <td>${esc(item?.supplier||'')}</td>
        <td class="amount">${esc(fmtMoney(item?.value||0))}</td>
      </tr>`).join('');

    const html=`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Relatório de Reembolsos</title>
<style>
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:#fff;color:#1b303b;font-family:Arial,Helvetica,sans-serif}
  body{font-size:12px}
  .report{width:100%;max-width:1240px;margin:0 auto;padding:42px 22px 30px}
  .header{display:flex;align-items:flex-start;justify-content:space-between;gap:28px;min-height:112px}
  .header-copy{padding-top:13px}
  h1{margin:0 0 6px;font-size:25px;line-height:1.15;font-weight:700;color:#172f3b}
  .subtitle{font-size:11px;color:#60727d}
  .logo{display:block;width:132px;height:108px;object-fit:contain;object-position:right top}
  .orange-line{height:3px;background:#f36f32;margin:5px 0 18px}
  .filter-strip{border:1px solid #d8e0e4;background:#f5f7f8;border-radius:7px;padding:10px 13px;margin-bottom:16px;color:#41535e;font-size:11px;line-height:1.3}
  .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:20px}
  .card{min-height:62px;background:#fff;border:1px solid #d5dde1;border-radius:9px;padding:12px 14px}
  .card-label{font-size:10px;line-height:1;text-transform:uppercase;color:#657883;margin-bottom:6px}
  .card-value{font-size:18px;line-height:1.1;font-weight:700;color:#152d39;white-space:nowrap}
  .table-wrap{width:100%;overflow:visible}
  table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:9.6px;color:#213640}
  thead{display:table-header-group}
  tr{break-inside:avoid;page-break-inside:avoid}
  th{background:#e8edf0;color:#334852;font-weight:700;text-align:left;border:1px solid #d3dce0;padding:8px 9px;line-height:1.2}
  td{border:1px solid #dfe5e8;padding:7px 9px;vertical-align:top;line-height:1.28;overflow-wrap:anywhere}
  tbody tr:nth-child(even) td{background:#fbfcfc}
  th:nth-child(1),td:nth-child(1){width:10%}
  th:nth-child(2),td:nth-child(2){width:24%}
  th:nth-child(3),td:nth-child(3){width:13%}
  th:nth-child(4),td:nth-child(4){width:18%}
  th:nth-child(5),td:nth-child(5){width:25%}
  th:nth-child(6),td:nth-child(6){width:10%}
  .date,.received{white-space:nowrap}
  .amount{text-align:right;white-space:nowrap;font-weight:700}
  .footer-note{margin-top:10px;font-size:9px;color:#788992;text-align:right}
  @media print{
    @page{size:A4 landscape;margin:10mm}
    html,body{width:auto}
    body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .report{max-width:none;padding:0}
    .header{min-height:88px}
    .header-copy{padding-top:8px}
    .logo{width:112px;height:82px}
    h1{font-size:21px}
    .cards{gap:8px;margin-bottom:15px}
    .card{min-height:54px;padding:10px 12px}
    .card-value{font-size:16px}
    table{font-size:8.7px}
    th{padding:6px 7px}
    td{padding:5px 7px}
  }
</style>
</head>
<body>
  <main class="report">
    <header class="header">
      <div class="header-copy">
        <h1>Relatório de Reembolsos</h1>
        <div class="subtitle">BRCONDOS • Financeiro - Sjrp</div>
      </div>
      <img class="logo" src="${LOGO_URL}" alt="BRCONDOS">
    </header>
    <div class="orange-line"></div>
    <div class="filter-strip">${esc(filterStripText(f))}</div>
    <section class="cards">
      <div class="card"><div class="card-label">Total</div><div class="card-value">${esc(fmtMoney(sums.total))}</div></div>
      <div class="card"><div class="card-label">A receber</div><div class="card-value">${esc(fmtMoney(sums.pending))}</div></div>
      <div class="card"><div class="card-label">Recebido</div><div class="card-value">${esc(fmtMoney(sums.received))}</div></div>
      <div class="card"><div class="card-label">Em análise</div><div class="card-value">${esc(fmtMoney(sums.analysis))}</div></div>
    </section>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Data</th><th>Descrição</th><th>Recebido em</th><th>Reembolsável por</th><th>Fornecedor</th><th>Valor</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="footer-note">${items.length} registro(s)</div>
  </main>
</body>
</html>`;

    reportWindow.onload=()=>setTimeout(()=>{try{reportWindow.focus();reportWindow.print()}catch(_){}},450);
    reportWindow.document.open();
    reportWindow.document.write(html);
    reportWindow.document.close();
    if(typeof closeModal==='function')closeModal();
  };
})();