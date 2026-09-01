(function(){
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const XLSX_SRC='https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js';
  const INVESTMENTS=['Imóvel','Capital Social - Sicredi','Aplicações Financeiras'];

  function txList(){
    try{if(typeof transactions!=='undefined'&&Array.isArray(transactions))return transactions;}catch(_){ }
    return Array.isArray(window.transactions)?window.transactions:[];
  }
  function chartAccountList(){
    try{if(typeof chartAccounts!=='undefined'&&Array.isArray(chartAccounts))return chartAccounts;}catch(_){ }
    return Array.isArray(window.chartAccounts)?window.chartAccounts:[];
  }
  function investmentName(category){
    const n=norm(category);
    if(n===norm('Imóvel'))return'Imóvel';
    if(n===norm('Capital Social - Sicredi'))return'Capital Social - Sicredi';
    if(n===norm('Aplicações Financeiras')||n===norm('Aplicação Financeira'))return'Aplicações Financeiras';
    return'';
  }
  function feeValue(t){return t?.type==='saida'?Math.max(0,Number(t?.fine||0))+Math.max(0,Number(t?.interest||0)):0;}
  function baseValue(t){
    if(t?.baseValue!==undefined&&t?.baseValue!==null&&t?.baseValue!=='')return Number(t.baseValue||0);
    return Math.max(0,Number(t?.value||0)-feeValue(t));
  }
  function addMonths(prefix,delta){
    const [y,m]=String(prefix||'').split('-').map(Number);
    const d=new Date(Date.UTC(y,m-1+delta,1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
  }
  function monthsFromFilename(filename){
    const f=String(filename||'');
    let m=f.match(/^DRE_BRCONDOS_(\d{4})\.xlsx$/i);
    if(m)return Array.from({length:12},(_,i)=>`${m[1]}-${String(i+1).padStart(2,'0')}`);
    m=f.match(/^DRE_BRCONDOS_Ultimos_12_Meses_ate_(\d{4}-\d{2})\.xlsx$/i);
    return m?Array.from({length:12},(_,i)=>addMonths(m[1],i-11)):[];
  }
  function findRow(XLSX,ws,test){
    if(!ws?.['!ref'])return-1;
    const range=XLSX.utils.decode_range(ws['!ref']);
    for(let r=0;r<=range.e.r;r++){
      const label=String(ws[XLSX.utils.encode_cell({r,c:0})]?.v||'').trim();
      if(test(norm(label),label))return r;
    }
    return-1;
  }
  function setCell(XLSX,ws,r,c,value,format){
    ws[XLSX.utils.encode_cell({r,c})]=typeof value==='number'?{t:'n',v:value,z:format}:{t:'s',v:String(value??'')};
  }
  function monthlyInvestments(months){
    const rows=txList();
    return months.map(prefix=>{
      const out={'Imóvel':0,'Capital Social - Sicredi':0,'Aplicações Financeiras':0,total:0};
      rows.filter(t=>String(t?.date||'').startsWith(prefix)&&t?.status==='pago'&&t?.type==='saida').forEach(t=>{
        const name=investmentName(t?.category);
        if(name)out[name]+=baseValue(t);
      });
      out.total=INVESTMENTS.reduce((s,n)=>s+Number(out[n]||0),0);
      return out;
    });
  }

  function appendInvestments(XLSX,workbook,filename){
    if(!/^DRE_BRCONDOS_/i.test(String(filename||'')))return;
    const months=monthsFromFilename(filename);
    if(months.length!==12)return;
    const consolidated=workbook?.Sheets?.['DRE Consolidada'];
    if(!consolidated?.['!ref'])return;
    if(findRow(XLSX,consolidated,n=>n.includes('resultado do periodo apos aplicacoes'))>=0)return;

    const resultRow=findRow(XLSX,consolidated,n=>n==='resultado do periodo');
    const revenueRow=findRow(XLSX,consolidated,n=>n.includes('receita operacional'));
    if(resultRow<0||revenueRow<0)return;
    const invest=monthlyInvestments(months);
    const revenues=months.map((_,i)=>Number(consolidated[XLSX.utils.encode_cell({r:revenueRow,c:i+1})]?.v||0));

    function appendToSheet(ws,percent){
      if(!ws?.['!ref'])return;
      const rr=findRow(XLSX,ws,n=>n==='resultado do periodo');
      if(rr<0)return;
      const range=XLSX.utils.decode_range(ws['!ref']);
      let r=range.e.r+1;
      const existingResult=months.map((_,i)=>Number(ws[XLSX.utils.encode_cell({r:rr,c:i+1})]?.v||0));
      const fmt=percent?'0.00%':'R$ #,##0.00';
      const conv=(amount,i)=>percent?(revenues[i]?Number(amount||0)/revenues[i]:0):Number(amount||0);
      const data=[
        ['INVESTIMENTOS',months.map((_,i)=>conv(invest[i].total,i))],
        ['   (-) Imóvel',months.map((_,i)=>conv(invest[i]['Imóvel'],i))],
        ['   (-) Capital Social - Sicredi',months.map((_,i)=>conv(invest[i]['Capital Social - Sicredi'],i))],
        ['   (-) Aplicações Financeiras',months.map((_,i)=>conv(invest[i]['Aplicações Financeiras'],i))],
        ['RESULTADO DO PERÍODO APÓS APLICAÇÕES',months.map((_,i)=>existingResult[i]-conv(invest[i].total,i))]
      ];
      data.forEach(([label,values])=>{
        setCell(XLSX,ws,r,0,label,'');
        values.forEach((v,i)=>setCell(XLSX,ws,r,i+1,Number(v||0),fmt));
        r++;
      });
      range.e.r=r-1;
      ws['!ref']=XLSX.utils.encode_range(range);
    }

    appendToSheet(consolidated,false);
    appendToSheet(workbook?.Sheets?.['% Receita'],true);
  }

  function addAccumulatedColumns(XLSX,workbook,filename){
    if(!/^DRE_BRCONDOS_/i.test(String(filename||'')))return;
    const ws=workbook?.Sheets?.['DRE Consolidada'];
    if(!ws||!ws['!ref'])return;
    const range=XLSX.utils.decode_range(ws['!ref']);
    const headerRow=5;
    let lastMonthCol=0;
    for(let c=1;c<=range.e.c;c++){
      const label=norm(ws[XLSX.utils.encode_cell({r:headerRow,c})]?.v);
      if(!label||label==='acumulado'||label==='% acumulada')break;
      lastMonthCol=c;
    }
    if(lastMonthCol<1)return;
    const accumulatedCol=lastMonthCol+1,percentageCol=lastMonthCol+2;
    setCell(XLSX,ws,headerRow,accumulatedCol,'Acumulado','');
    setCell(XLSX,ws,headerRow,percentageCol,'% Acumulada','');

    const totals=new Map();let revenueRow=-1;
    for(let r=headerRow+1;r<=range.e.r;r++){
      const label=String(ws[XLSX.utils.encode_cell({r,c:0})]?.v||'').trim();
      if(!label)continue;
      let total=0;
      for(let c=1;c<=lastMonthCol;c++){
        const v=Number(ws[XLSX.utils.encode_cell({r,c})]?.v);
        if(Number.isFinite(v))total+=v;
      }
      totals.set(r,total);
      if(revenueRow<0&&norm(label).includes('receita operacional'))revenueRow=r;
    }
    const revenueAccumulated=revenueRow>=0?Number(totals.get(revenueRow)||0):0;
    totals.forEach((total,r)=>{
      setCell(XLSX,ws,r,accumulatedCol,Number(total||0),'R$ #,##0.00');
      setCell(XLSX,ws,r,percentageCol,revenueAccumulated?Number(total||0)/revenueAccumulated:0,'0.00%');
    });
    range.e.c=Math.max(range.e.c,percentageCol);
    ws['!ref']=XLSX.utils.encode_range(range);
    const cols=Array.isArray(ws['!cols'])?ws['!cols']:[];
    while(cols.length<=percentageCol)cols.push({wch:14});
    cols[accumulatedCol]={wch:16};cols[percentageCol]={wch:15};ws['!cols']=cols;
  }

  function boldGroupRows(XLSX,workbook){
    const groups=new Set(['investimentos']);
    chartAccountList().forEach(a=>{const group=norm(a?.group);if(group)groups.add(group);});
    ['DRE Consolidada','% Receita'].forEach(sheetName=>{
      const ws=workbook?.Sheets?.[sheetName];
      if(!ws?.['!ref'])return;
      const range=XLSX.utils.decode_range(ws['!ref']);
      for(let r=0;r<=range.e.r;r++){
        const label=String(ws[XLSX.utils.encode_cell({r,c:0})]?.v||'').trim();
        if(!groups.has(norm(label)))continue;
        for(let c=0;c<=range.e.c;c++){
          const cell=ws[XLSX.utils.encode_cell({r,c})];
          if(!cell)continue;
          const style=cell.s&&typeof cell.s==='object'?cell.s:{};
          const font=style.font&&typeof style.font==='object'?style.font:{};
          cell.s={...style,font:{...font,bold:true}};
        }
      }
    });
  }

  function enhanceWorkbook(XLSX,workbook,filename){
    appendInvestments(XLSX,workbook,filename);
    addAccumulatedColumns(XLSX,workbook,filename);
    boldGroupRows(XLSX,workbook);
  }
  function wrapXlsx(){
    const XLSX=window.XLSX;
    if(!XLSX||!XLSX.style_version||typeof XLSX.writeFile!=='function')return false;
    if(XLSX.writeFile.__brDreAccumulated===true)return true;
    const original=XLSX.writeFile;
    const wrapped=function(workbook,filename){
      try{enhanceWorkbook(XLSX,workbook,filename);}catch(err){console.error('DRE EXCEL COMPLETA:',err);}
      return original.apply(XLSX,arguments);
    };
    wrapped.__brDreAccumulated=true;wrapped.__brDreAccumulatedOriginal=original;XLSX.writeFile=wrapped;return true;
  }
  function ensureXlsxWrapped(){
    if(wrapXlsx())return Promise.resolve(window.XLSX);
    return new Promise((resolve,reject)=>{
      let script=document.querySelector('script[data-br-xlsx-style="1"]');
      const finish=()=>wrapXlsx()?resolve(window.XLSX):reject(new Error('XLSX com estilos indisponível'));
      if(script){
        if(window.XLSX?.style_version)return finish();
        script.addEventListener('load',finish,{once:true});script.addEventListener('error',()=>reject(new Error('Falha ao carregar XLSX com estilos')),{once:true});return;
      }
      script=document.createElement('script');script.src=XLSX_SRC;script.async=true;script.dataset.brXlsx='1';script.dataset.brXlsxStyle='1';
      script.addEventListener('load',finish,{once:true});script.addEventListener('error',()=>reject(new Error('Falha ao carregar XLSX com estilos')),{once:true});document.head.appendChild(script);
    });
  }
  function protectExportFunctions(){
    const oldLast12=window.brExportDreExcelLast12;
    if(typeof oldLast12==='function'&&!oldLast12.__brAccumulatedProtected){
      const w=function(){const args=arguments;return ensureXlsxWrapped().then(()=>oldLast12.apply(this,args)).catch(e=>alert(e?.message||'Não foi possível gerar o Excel da DRE.'));};
      w.__brAccumulatedProtected=true;window.brExportDreExcelLast12=w;
    }
    const oldYear=window.brExportDreExcelYear;
    if(typeof oldYear==='function'&&!oldYear.__brAccumulatedProtected){
      const w=function(){const args=arguments;return ensureXlsxWrapped().then(()=>oldYear.apply(this,args)).catch(e=>alert(e?.message||'Não foi possível gerar o Excel da DRE.'));};
      w.__brAccumulatedProtected=true;window.brExportDreExcelYear=w;
    }
  }
  wrapXlsx();protectExportFunctions();
  ensureXlsxWrapped().catch(()=>{});
  new MutationObserver(()=>{wrapXlsx();protectExportFunctions();}).observe(document.documentElement,{childList:true,subtree:true});
})();
