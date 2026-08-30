(function(){
  const MONTHS=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const GROUP_ORDER=['Despesas com Pessoal','Despesas Administrativas','Despesas Comerciais','Despesas Financeiras','Despesas com Estrutura','Investimentos – Imobilizados','Outras Despesas','Movimentações dos Sócios','Contas fora da DRE','Sem grupo'];
  const FEE_ACCOUNT='Juros e Multas';
  const TAX_ACCOUNT='Simples Nacional';
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const collator=new Intl.Collator('pt-BR',{sensitivity:'base',numeric:true});

  function monthLabel(prefix,short=false){
    const [y,m]=String(prefix||'').split('-').map(Number);
    const name=MONTHS[(m||1)-1]||'';
    return short?`${name.slice(0,3)}/${String(y||'').slice(-2)}`:`${name}/${y||''}`;
  }
  function currentPrefix(){
    const d=String(typeof today==='function'?today():'');
    return /^\d{4}-\d{2}/.test(d)?d.slice(0,7):new Date().toISOString().slice(0,7);
  }
  function addMonths(prefix,delta){
    const [y,m]=String(prefix).split('-').map(Number);
    const d=new Date(Date.UTC(y,m-1+delta,1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
  }
  function last12Months(){
    const end=currentPrefix();
    return Array.from({length:12},(_,i)=>addMonths(end,i-11));
  }
  function yearMonths(year){return Array.from({length:12},(_,i)=>`${year}-${String(i+1).padStart(2,'0')}`);}

  function accountFor(type,category){
    const cat=norm(category);
    return (Array.isArray(chartAccounts)?chartAccounts:[]).find(a=>a.type===type&&norm(a.name)===cat)||null;
  }
  function accountAllowed(type,category){const a=accountFor(type,category);return a?a.dre!==false:true;}
  function isSimpleTax(category){const n=norm(category);return n===norm(TAX_ACCOUNT)||n==='simples';}
  function feeValue(t){return t?.type==='saida'?Math.max(0,Number(t.fine||0))+Math.max(0,Number(t.interest||0)):0;}
  function baseValue(t){
    if(t?.type!=='saida')return Number(t?.value||0);
    if(t.baseValue!==undefined&&t.baseValue!==null&&t.baseValue!=='')return Number(t.baseValue||0);
    return Math.max(0,Number(t.value||0)-feeValue(t));
  }
  function fallbackGroup(category){
    const n=norm(category);
    if(n.includes('distribuicao de lucros')&&n.includes('outros'))return'Despesas com Pessoal';
    if(n.includes('salario')||n.includes('pro-labore')||n.includes('pro labore')||n.includes('ferias')||n.includes('13')||n.includes('fgts')||n.includes('inss')||n.includes('beneficio')||n.includes('vale-transporte')||n.includes('vale transporte')||n.includes('vale alimentacao')||n.includes('plano de saude')||n.includes('sindicato patronal')||(n.includes('assoc')&&n.includes('classe')))return'Despesas com Pessoal';
    if(n==='imovel'||n.includes('imobilizado'))return'Investimentos – Imobilizados';
    if(n.includes('patrocin')||n.includes('publicidade')||n.includes('marketing')||n.includes('evento')||n.includes('brinde')||n.includes('comissao'))return'Despesas Comerciais';
    if(n.includes('despesa bancaria')||n.includes('tarifa bancaria')||n.includes('juros')||n.includes('multa')||n==='iof')return'Despesas Financeiras';
    if(n.includes('aluguel')||n.includes('condominio')||n.includes('manutencao')||n.includes('reparo')||n.includes('aparelho')||n.includes('equipamento'))return'Despesas com Estrutura';
    if(n.includes('internet')||n.includes('telefone')||n.includes('energia')||n.includes('material de escritorio')||n.includes('limpeza')||n.includes('mensageiro')||n.includes('bpo')||n.includes('sistema')||n.includes('software')||n.includes('contabil'))return'Despesas Administrativas';
    if(n.includes('distribuicao de lucros'))return'Movimentações dos Sócios';
    return'Outras Despesas';
  }
  function groupFor(category){
    const a=accountFor('saida',category);
    return String(a?.group||'').trim()||fallbackGroup(category);
  }
  function groupIndex(group){const i=GROUP_ORDER.indexOf(group);return i<0?999:i;}

  function summary(prefix){
    const rows=(Array.isArray(transactions)?transactions:[]).filter(x=>String(x.date||'').startsWith(prefix)&&x.status==='pago');
    const receita=rows.filter(x=>x.type==='entrada'&&accountAllowed('entrada',x.category)).reduce((s,x)=>s+Number(x.value||0),0);
    let simples=0;const cats={};
    rows.filter(x=>x.type==='saida').forEach(x=>{
      const base=baseValue(x),fees=feeValue(x),cat=x.category||'Contas a pagar';
      if(base&&accountAllowed('saida',cat)){
        if(isSimpleTax(cat))simples+=base;else cats[cat]=(cats[cat]||0)+base;
      }
      if(fees&&accountAllowed('saida',FEE_ACCOUNT))cats[FEE_ACCOUNT]=(cats[FEE_ACCOUNT]||0)+fees;
    });
    const receitaLiquida=receita-simples;
    const despesas=Object.values(cats).reduce((s,v)=>s+Number(v||0),0);
    return {receita,simples,receitaLiquida,cats,despesas,resultado:receitaLiquida-despesas};
  }
  function closureStatus(prefix){
    try{return JSON.parse(localStorage.getItem('brcondos_dre_closures_v1')||'{}')?.[prefix]?.closed===true?'Concluída':'Em fechamento';}catch(_){return'Em fechamento';}
  }

  async function emissionMeta(){
    let name='Usuário não identificado';
    try{const r=await fetch('/api/auth/me',{cache:'no-store'});if(r.ok){const p=await r.json();name=p?.full_name||p?.email||name;}}catch(_){ }
    const now=new Date();
    return {
      name,
      date:now.toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'}),
      time:now.toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',second:'2-digit'})
    };
  }
  function loadXlsx(){
    if(window.XLSX)return Promise.resolve(window.XLSX);
    return new Promise((resolve,reject)=>{
      const existing=document.querySelector('script[data-br-xlsx="1"]');
      if(existing){existing.addEventListener('load',()=>window.XLSX?resolve(window.XLSX):reject(new Error('XLSX indisponível')),{once:true});existing.addEventListener('error',()=>reject(new Error('Falha ao carregar XLSX')),{once:true});return;}
      const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';s.async=true;s.dataset.brXlsx='1';s.onload=()=>window.XLSX?resolve(window.XLSX):reject(new Error('XLSX indisponível'));s.onerror=()=>reject(new Error('Falha ao carregar XLSX'));document.head.appendChild(s);
    });
  }

  function orderedCategories(summaries){
    const set=new Map();
    summaries.forEach(s=>Object.keys(s.cats).forEach(c=>set.set(norm(c),c)));
    return [...set.values()].sort((a,b)=>groupIndex(groupFor(a))-groupIndex(groupFor(b))||collator.compare(groupFor(a),groupFor(b))||collator.compare(a,b));
  }
  function consolidatedRows(months,summaries,percent=false){
    const rows=[];
    const value=(amount,rev)=>percent?(rev?amount/rev:0):amount;
    rows.push(['(+) Receita operacional',...summaries.map(s=>percent?(s.receita?1:0):s.receita)]);
    rows.push(['(-) Simples Nacional',...summaries.map(s=>value(s.simples,s.receita))]);
    rows.push(['(=) Receita líquida',...summaries.map(s=>value(s.receitaLiquida,s.receita))]);
    const cats=orderedCategories(summaries);
    const groups=[...new Set(cats.map(groupFor))].sort((a,b)=>groupIndex(a)-groupIndex(b)||collator.compare(a,b));
    groups.forEach(group=>{
      const gcats=cats.filter(c=>groupFor(c)===group);
      rows.push([group,...summaries.map(s=>value(gcats.reduce((sum,c)=>sum+Number(s.cats[c]||0),0),s.receita))]);
      gcats.forEach(c=>rows.push([`   (-) ${c}`,...summaries.map(s=>value(Number(s.cats[c]||0),s.receita))]));
    });
    rows.push(['Total de despesas',...summaries.map(s=>value(s.despesas,s.receita))]);
    rows.push(['RESULTADO DO PERÍODO',...summaries.map(s=>value(s.resultado,s.receita))]);
    return rows;
  }

  function setMoneyFormats(ws,startRow,endRow,startCol,endCol,percent=false){
    for(let r=startRow;r<=endRow;r++)for(let c=startCol;c<=endCol;c++){
      const cell=ws[window.XLSX.utils.encode_cell({r,c})];if(cell&&typeof cell.v==='number')cell.z=percent?'0.00%':'R$ #,##0.00';
    }
  }
  function sheetWithMetadata(XLSX,title,months,rows,meta,percent=false){
    const aoa=[
      [title],
      ['Emitido em',meta.date],
      ['Hora',meta.time],
      ['Emitido por',meta.name],
      [],
      ['Conta',...months.map(m=>monthLabel(m,true))],
      ...rows
    ];
    const ws=XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols']=[{wch:38},...months.map(()=>({wch:14}))];
    ws['!freeze']={xSplit:1,ySplit:6};
    setMoneyFormats(ws,6,aoa.length-1,1,months.length,percent);
    return ws;
  }

  async function exportExcel(mode,year){
    const months=mode==='year'?yearMonths(year):last12Months();
    const summaries=months.map(summary);
    const meta=await emissionMeta();
    const XLSX=await loadXlsx();
    const wb=XLSX.utils.book_new();

    const resumo=[
      ['Relatório DRE Gerencial'],
      ['Período',mode==='year'?`Ano completo de ${year}`:`Últimos 12 meses — ${monthLabel(months[0])} a ${monthLabel(months[months.length-1])}`],
      ['Emitido em',meta.date],['Hora',meta.time],['Emitido por',meta.name],[],
      ['Mês','Receita Operacional','Simples Nacional','Receita Líquida','Total Despesas','Resultado','Margem Operacional','Despesas / Receita','Status']
    ];
    months.forEach((m,i)=>{const s=summaries[i];resumo.push([monthLabel(m),s.receita,s.simples,s.receitaLiquida,s.despesas,s.resultado,s.receita?s.resultado/s.receita:0,s.receita?s.despesas/s.receita:0,closureStatus(m)]);});
    const rws=XLSX.utils.aoa_to_sheet(resumo);rws['!cols']=[{wch:18},{wch:18},{wch:18},{wch:18},{wch:18},{wch:18},{wch:18},{wch:18},{wch:16}];
    for(let r=7;r<resumo.length;r++){
      for(let c=1;c<=5;c++){const cell=rws[XLSX.utils.encode_cell({r,c})];if(cell)cell.z='R$ #,##0.00';}
      for(let c=6;c<=7;c++){const cell=rws[XLSX.utils.encode_cell({r,c})];if(cell)cell.z='0.00%';}
    }
    XLSX.utils.book_append_sheet(wb,rws,'Resumo');
    XLSX.utils.book_append_sheet(wb,sheetWithMetadata(XLSX,'DRE Consolidada',months,consolidatedRows(months,summaries,false),meta,false),'DRE Consolidada');
    XLSX.utils.book_append_sheet(wb,sheetWithMetadata(XLSX,'% sobre Receita Operacional',months,consolidatedRows(months,summaries,true),meta,true),'% Receita');

    const filename=mode==='year'?`DRE_BRCONDOS_${year}.xlsx`:`DRE_BRCONDOS_Ultimos_12_Meses_ate_${months[months.length-1]}.xlsx`;
    XLSX.writeFile(wb,filename);
    if(typeof closeModal==='function')closeModal();
  }

  window.brExportDreExcelLast12=()=>exportExcel('last12').catch(e=>alert(e?.message||'Não foi possível gerar o Excel da DRE.'));
  window.brExportDreExcelYear=()=>{
    const input=document.getElementById('br_dre_excel_year');
    const year=Number(input?.value||new Date().getFullYear());
    if(!Number.isInteger(year)||year<2000||year>2100)return alert('Informe um ano válido.');
    exportExcel('year',year).catch(e=>alert(e?.message||'Não foi possível gerar o Excel da DRE.'));
  };
  window.openDreExcelReport=function(){
    const year=Number(currentPrefix().slice(0,4))||new Date().getFullYear();
    openModal('Relatório Excel da DRE',`
      <div class="notice"><b>Escolha o período do relatório.</b> O Excel trará a DRE consolidada, os percentuais sobre a Receita Operacional e um resumo mensal.</div>
      <div class="grid two-cols" style="margin-top:14px">
        <div class="card"><div class="panel-title">Últimos 12 meses</div><div class="subtle" style="margin-bottom:14px">Do mês atual voltando 12 competências.</div><button class="btn green" onclick="brExportDreExcelLast12()">Gerar últimos 12 meses</button></div>
        <div class="card"><div class="panel-title">Ano completo</div><div class="field"><label>Qual ano?</label><input id="br_dre_excel_year" type="number" min="2000" max="2100" value="${year}"></div><button class="btn green" onclick="brExportDreExcelYear()">Gerar ano completo</button></div>
      </div>`);
  };

  function addButton(){
    const actions=document.querySelector('#view-dre .dre-closing-actions');
    if(!actions||actions.querySelector('.dre-excel-history-btn'))return;
    const btn=document.createElement('button');btn.type='button';btn.className='dre-pdf-btn dre-excel-history-btn';btn.textContent='Excel';btn.title='Gerar relatório histórico da DRE em Excel';btn.onclick=()=>openDreExcelReport();
    const pdf=actions.querySelector('.dre-pdf-btn');if(pdf)pdf.insertAdjacentElement('afterend',btn);else actions.prepend(btn);
  }
  const old=window.renderDRE;if(typeof old==='function')window.renderDRE=function(){const out=old.apply(this,arguments);setTimeout(addButton,60);return out;};
  setTimeout(addButton,200);
})();
