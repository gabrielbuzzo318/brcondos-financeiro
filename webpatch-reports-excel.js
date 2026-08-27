(function(){
  const CONSULTA_REPORT_EMAILS=new Set([
    'antonio@zacchi.com.br',
    'marco.dosualdo@brcondos.com',
    'contabil01@logucomarc.com.br'
  ]);
  let consultaReportAllowed=false;

  function norm(v){
    return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  }

  async function loadReportPermission(){
    try{
      const r=await fetch('/api/auth/me',{cache:'no-store'});
      if(!r.ok)return;
      const p=await r.json().catch(()=>({}));
      consultaReportAllowed=CONSULTA_REPORT_EMAILS.has(String(p.email||'').toLowerCase());
      activateConsultaReports();
    }catch(_){ }
  }

  function canUseReports(){
    try{
      if(typeof window.brcondosIsReadOnly==='function' && !window.brcondosIsReadOnly())return true;
    }catch(_){ }
    return consultaReportAllowed;
  }

  function unlockButton(btn){
    if(!btn)return;
    btn.disabled=false;
    btn.removeAttribute('disabled');
    btn.removeAttribute('aria-disabled');
    btn.style.pointerEvents='';
    btn.style.opacity='';
    btn.style.cursor='';
    btn.title='';
    delete btn.dataset.brReadOnly;
  }

  function activateConsultaReports(){
    if(!canUseReports())return;
    document.querySelectorAll('#view-financeiro button,#view-financeiro a').forEach(el=>{
      const oc=String(el.getAttribute?.('onclick')||'');
      if(/openReportModal\(['"]payables['"]\)/.test(oc) || norm(el.textContent).includes('relatorio')) unlockButton(el);
    });
    document.querySelectorAll('#view-fluxo button,#view-fluxo a').forEach(el=>{
      const oc=String(el.getAttribute?.('onclick')||'');
      if(/openReportModal\(['"]cashflow['"]\)/.test(oc)) unlockButton(el);
    });
  }

  function reportFilters(){
    return {
      from:document.getElementById('rep_from')?.value||'',
      to:document.getElementById('rep_to')?.value||'',
      status:document.getElementById('rep_status')?.value||'',
      q:document.getElementById('rep_search')?.value||'',
      typeFilter:document.getElementById('rep_type')?.value||''
    };
  }

  function buildExcelData(type){
    const {from,to,status,q,typeFilter}=reportFilters();
    if(type==='payables'){
      const data=payables
        .map(x=>({...x,status:payableEffectiveStatus(x)}))
        .filter(x=>reportDateOk(x.due,from,to) &&
          (!status || x.status===status) &&
          reportMatchesSearch([x.supplier,x.description,x.category,x.paymentMethod,x.status,x.value,money(x.value),x.notes,x.pixCode,x.barcode],q))
        .sort((a,b)=>(a.due||'').localeCompare(b.due||''));
      const rows=data.map(x=>({
        'Vencimento':x.due?formatDate(x.due):'',
        'Fornecedor':x.supplier||'',
        'Descrição':x.description||'',
        'Categoria':x.category||'',
        'Recorrência':x.recurring?({monthly:'Mensal',weekly:'Semanal',yearly:'Anual'}[x.frequency]||'Recorrente'):'Única',
        'Forma de pagamento':x.paymentMethod||'',
        'Status':statusLabelPayable(x.status),
        'Data agendada':x.scheduledDate?formatDate(x.scheduledDate):'',
        'Data da baixa':x.paymentDate?formatDate(x.paymentDate):'',
        'Valor':Number(x.value||0),
        'PIX / Copia e Cola':x.pixCode||'',
        'Código de barras':x.barcode||'',
        'Observações':x.notes||''
      }));
      const total=data.reduce((s,x)=>s+Number(x.value||0),0);
      const aberto=data.filter(x=>x.status!=='pago').reduce((s,x)=>s+Number(x.value||0),0);
      const vencido=data.filter(x=>x.status==='vencido').reduce((s,x)=>s+Number(x.value||0),0);
      const pago=data.filter(x=>x.status==='pago').reduce((s,x)=>s+Number(x.value||0),0);
      return {
        sheet:'A Pagar',
        filename:`BRCONDOS_A_Pagar_${today()}.xlsx`,
        rows,
        summary:[
          {'Indicador':'Total','Valor':total},
          {'Indicador':'Em aberto','Valor':aberto},
          {'Indicador':'Vencido','Valor':vencido},
          {'Indicador':'Pago','Valor':pago},
          {'Indicador':'Registros','Valor':data.length}
        ]
      };
    }

    const data=transactions
      .filter(x=>reportDateOk(x.date,from,to) &&
        (!status || x.status===status) &&
        (!typeFilter || x.type===typeFilter) &&
        reportMatchesSearch([x.party,x.description,x.category,x.type,x.status,x.value,money(x.value)],q))
      .sort((a,b)=>(a.date||'').localeCompare(b.date||''));
    const rows=data.map(x=>({
      'Data':x.date?formatDate(x.date):'',
      'Tipo':x.type==='entrada'?'Entrada':'Saída',
      'Descrição':x.description||'',
      'Categoria':x.category||'',
      'Cliente / Fornecedor':x.party||'',
      'Status':statusLabelFlow(x.status),
      'Valor':Number(x.value||0)
    }));
    const entradas=data.filter(x=>x.type==='entrada').reduce((s,x)=>s+Number(x.value||0),0);
    const saidas=data.filter(x=>x.type==='saida').reduce((s,x)=>s+Number(x.value||0),0);
    return {
      sheet:'Fluxo de Caixa',
      filename:`BRCONDOS_Fluxo_de_Caixa_${today()}.xlsx`,
      rows,
      summary:[
        {'Indicador':'Entradas','Valor':entradas},
        {'Indicador':'Saídas','Valor':saidas},
        {'Indicador':'Saldo','Valor':entradas-saidas},
        {'Indicador':'Lançamentos','Valor':data.length}
      ]
    };
  }

  function autoWidth(ws,rows){
    const keys=rows.length?Object.keys(rows[0]):[];
    ws['!cols']=keys.map(key=>{
      const longest=Math.max(key.length,...rows.slice(0,500).map(r=>String(r[key]??'').length));
      return {wch:Math.max(12,Math.min(48,longest+2))};
    });
  }

  function loadXlsx(){
    if(window.XLSX)return Promise.resolve(window.XLSX);
    return new Promise((resolve,reject)=>{
      const existing=document.querySelector('script[data-br-xlsx="1"]');
      if(existing){
        existing.addEventListener('load',()=>window.XLSX?resolve(window.XLSX):reject(new Error('XLSX indisponível')),{once:true});
        existing.addEventListener('error',()=>reject(new Error('Falha ao carregar XLSX')),{once:true});
        return;
      }
      const s=document.createElement('script');
      s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.async=true;
      s.dataset.brXlsx='1';
      s.onload=()=>window.XLSX?resolve(window.XLSX):reject(new Error('XLSX indisponível'));
      s.onerror=()=>reject(new Error('Falha ao carregar XLSX'));
      document.head.appendChild(s);
    });
  }

  function fallbackExcel(type,data){
    const cols=data.rows.length?Object.keys(data.rows[0]):[];
    const escXml=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const rowXml=data.rows.map(r=>`<Row>${cols.map(c=>`<Cell><Data ss:Type="${typeof r[c]==='number'?'Number':'String'}">${escXml(r[c])}</Data></Cell>`).join('')}</Row>`).join('');
    const xml=`<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="${escXml(data.sheet)}"><Table><Row>${cols.map(c=>`<Cell><Data ss:Type="String">${escXml(c)}</Data></Cell>`).join('')}</Row>${rowXml}</Table></Worksheet></Workbook>`;
    const blob=new Blob(['\ufeff',xml],{type:'application/vnd.ms-excel'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=data.filename.replace(/\.xlsx$/i,'.xml');
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }

  window.generateExcelReport=async function(type){
    if(type!=='payables'&&type!=='cashflow')return;
    const data=buildExcelData(type);
    try{
      const XLSX=await loadXlsx();
      const wb=XLSX.utils.book_new();
      const summaryWs=XLSX.utils.json_to_sheet(data.summary);
      autoWidth(summaryWs,data.summary);
      XLSX.utils.book_append_sheet(wb,summaryWs,'Resumo');
      const detailRows=data.rows.length?data.rows:[{'Resultado':'Nenhum registro encontrado para os filtros selecionados.'}];
      const ws=XLSX.utils.json_to_sheet(detailRows);
      autoWidth(ws,detailRows);
      XLSX.utils.book_append_sheet(wb,ws,data.sheet.substring(0,31));
      XLSX.writeFile(wb,data.filename);
      closeModal();
    }catch(err){
      console.warn('BRCONDOS EXCEL:',err);
      fallbackExcel(type,data);
      closeModal();
    }
  };

  function addExcelToModal(type){
    if(type!=='payables'&&type!=='cashflow')return;
    const modal=document.getElementById('modal');
    if(!modal||modal.classList.contains('hidden'))return;
    if(modal.querySelector('[data-br-excel-report="1"]'))return;
    const buttons=[...modal.querySelectorAll('button')];
    const generateBtn=buttons.find(b=>norm(b.textContent)==='gerar relatorio');
    if(!generateBtn)return;
    const excel=document.createElement('button');
    excel.className='btn green';
    excel.type='button';
    excel.dataset.brExcelReport='1';
    excel.textContent='Excel';
    excel.onclick=()=>window.generateExcelReport(type);
    generateBtn.parentElement.insertBefore(excel,generateBtn);
    unlockButton(generateBtn);
    unlockButton(excel);
  }

  const originalOpenReportModal=window.openReportModal;
  if(typeof originalOpenReportModal==='function'){
    window.openReportModal=function(type){
      const result=originalOpenReportModal.apply(this,arguments);
      setTimeout(()=>addExcelToModal(type),0);
      return result;
    };
  }

  const obs=new MutationObserver(()=>activateConsultaReports());
  obs.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(()=>{loadReportPermission();activateConsultaReports();},0);
})();
