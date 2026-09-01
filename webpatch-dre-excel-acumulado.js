(function(){
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const XLSX_SRC='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

  function addAccumulatedColumns(XLSX,workbook,filename){
    if(!/^DRE_BRCONDOS_/i.test(String(filename||'')))return;
    const ws=workbook?.Sheets?.['DRE Consolidada'];
    if(!ws||!ws['!ref'])return;

    const range=XLSX.utils.decode_range(ws['!ref']);
    const headerRow=5; // linha 6 no Excel
    let lastMonthCol=0;

    for(let c=1;c<=range.e.c;c++){
      const cell=ws[XLSX.utils.encode_cell({r:headerRow,c})];
      const label=norm(cell?.v);
      if(!label)break;
      if(label==='acumulado'||label==='% acumulada')break;
      lastMonthCol=c;
    }
    if(lastMonthCol<1)return;

    const accumulatedCol=lastMonthCol+1;
    const percentageCol=lastMonthCol+2;
    ws[XLSX.utils.encode_cell({r:headerRow,c:accumulatedCol})]={t:'s',v:'Acumulado'};
    ws[XLSX.utils.encode_cell({r:headerRow,c:percentageCol})]={t:'s',v:'% Acumulada'};

    const rowTotals=new Map();
    let revenueRow=-1;

    for(let r=headerRow+1;r<=range.e.r;r++){
      const label=String(ws[XLSX.utils.encode_cell({r,c:0})]?.v||'').trim();
      if(!label)continue;

      let total=0;
      for(let c=1;c<=lastMonthCol;c++){
        const cell=ws[XLSX.utils.encode_cell({r,c})];
        const value=Number(cell?.v);
        if(Number.isFinite(value))total+=value;
      }
      rowTotals.set(r,total);

      const n=norm(label);
      if(revenueRow<0&&(n==='(+) receita operacional'||n.includes('receita operacional')))revenueRow=r;
    }

    const revenueAccumulated=revenueRow>=0?Number(rowTotals.get(revenueRow)||0):0;

    for(let r=headerRow+1;r<=range.e.r;r++){
      if(!rowTotals.has(r))continue;
      const total=Number(rowTotals.get(r)||0);
      const accCell=XLSX.utils.encode_cell({r,c:accumulatedCol});
      const pctCell=XLSX.utils.encode_cell({r,c:percentageCol});
      ws[accCell]={t:'n',v:total,z:'R$ #,##0.00'};
      ws[pctCell]={t:'n',v:revenueAccumulated?total/revenueAccumulated:0,z:'0.00%'};
    }

    range.e.c=Math.max(range.e.c,percentageCol);
    ws['!ref']=XLSX.utils.encode_range(range);
    const cols=Array.isArray(ws['!cols'])?ws['!cols']:[];
    while(cols.length<=percentageCol)cols.push({wch:14});
    cols[accumulatedCol]={wch:16};
    cols[percentageCol]={wch:15};
    ws['!cols']=cols;
  }

  function wrapXlsx(){
    const XLSX=window.XLSX;
    if(!XLSX||typeof XLSX.writeFile!=='function')return false;
    if(XLSX.writeFile.__brDreAccumulated===true)return true;

    const original=XLSX.writeFile;
    const wrapped=function(workbook,filename){
      try{addAccumulatedColumns(XLSX,workbook,filename);}catch(err){console.error('DRE EXCEL ACUMULADO:',err);}
      return original.apply(XLSX,arguments);
    };
    wrapped.__brDreAccumulated=true;
    wrapped.__brDreAccumulatedOriginal=original;
    XLSX.writeFile=wrapped;
    return true;
  }

  function ensureXlsxWrapped(){
    if(wrapXlsx())return Promise.resolve(window.XLSX);

    return new Promise((resolve,reject)=>{
      let script=document.querySelector('script[data-br-xlsx="1"]');
      const finish=()=>{
        if(wrapXlsx())resolve(window.XLSX);
        else reject(new Error('XLSX indisponível'));
      };

      if(script){
        if(window.XLSX)return finish();
        script.addEventListener('load',finish,{once:true});
        script.addEventListener('error',()=>reject(new Error('Falha ao carregar XLSX')),{once:true});
        return;
      }

      script=document.createElement('script');
      script.src=XLSX_SRC;
      script.async=true;
      script.dataset.brXlsx='1';
      script.addEventListener('load',finish,{once:true});
      script.addEventListener('error',()=>reject(new Error('Falha ao carregar XLSX')),{once:true});
      document.head.appendChild(script);
    });
  }

  function protectExportFunctions(){
    const oldLast12=window.brExportDreExcelLast12;
    if(typeof oldLast12==='function'&&!oldLast12.__brAccumulatedProtected){
      const wrappedLast12=function(){
        const args=arguments;
        return ensureXlsxWrapped().then(()=>oldLast12.apply(this,args)).catch(e=>alert(e?.message||'Não foi possível gerar o Excel da DRE.'));
      };
      wrappedLast12.__brAccumulatedProtected=true;
      window.brExportDreExcelLast12=wrappedLast12;
    }

    const oldYear=window.brExportDreExcelYear;
    if(typeof oldYear==='function'&&!oldYear.__brAccumulatedProtected){
      const wrappedYear=function(){
        const args=arguments;
        return ensureXlsxWrapped().then(()=>oldYear.apply(this,args)).catch(e=>alert(e?.message||'Não foi possível gerar o Excel da DRE.'));
      };
      wrappedYear.__brAccumulatedProtected=true;
      window.brExportDreExcelYear=wrappedYear;
    }
  }

  wrapXlsx();
  protectExportFunctions();

  const observer=new MutationObserver(()=>{
    wrapXlsx();
    protectExportFunctions();
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
})();
