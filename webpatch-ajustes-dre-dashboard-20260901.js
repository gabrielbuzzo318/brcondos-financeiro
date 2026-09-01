(function(){
  const INVESTMENT_ACCOUNTS=['Imóvel','Capital Social - Sicredi','Aplicações Financeiras'];
  const LEGACY_APPLICATION='Aplicação Financeira';
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const isoLocal=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  function getTransactions(){
    try{
      if(Array.isArray(window.transactions))return window.transactions;
      if(typeof transactions!=='undefined'&&Array.isArray(transactions))return transactions;
    }catch(_){ }
    return [];
  }

  function todayDate(){
    const raw=String(typeof today==='function'?today():'');
    if(/^\d{4}-\d{2}-\d{2}$/.test(raw)){
      const [y,m,d]=raw.split('-').map(Number);
      return new Date(y,m-1,d);
    }
    return new Date();
  }

  function recentWindow(){
    const end=todayDate();
    const start=new Date(end);
    start.setDate(start.getDate()-14);
    return {start:isoLocal(start),end:isoLocal(end)};
  }

  function displayDate(iso){
    if(typeof formatDate==='function')return formatDate(iso);
    const m=String(iso||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m?`${m[3]}/${m[2]}/${m[1]}`:String(iso||'');
  }

  function renderRecent15Days(){
    const root=document.getElementById('view-dashboard');
    if(!root)return;
    const period=recentWindow();
    const rows=getTransactions().filter(x=>{
      const date=String(x?.date||'');
      return /^\d{4}-\d{2}-\d{2}$/.test(date)&&date>=period.start&&date<=period.end;
    }).slice().sort((a,b)=>String(b?.date||'').localeCompare(String(a?.date||''))||Number(b?.id||0)-Number(a?.id||0));

    let card=root.querySelector('.br-recent-card');
    if(!card)return;
    const head=card.querySelector('.br-recent-head > div');
    if(head)head.innerHTML=`<h3>Movimentações recentes</h3><span>Movimentações dos últimos 15 dias • ${displayDate(period.start)} a ${displayDate(period.end)}</span>`;
    const body=card.querySelector('tbody');
    if(body)body.innerHTML=rows.length?rows.map(x=>`<tr>
      <td>${displayDate(x.date)}</td>
      <td>${esc(x.description||'-')}</td>
      <td>${esc(x.party||'-')}</td>
      <td>${typeof statusBadge==='function'?statusBadge(x.status):esc(x.status||'-')}</td>
      <td class="amount ${x.type==='entrada'?'pos':'neg'}">${x.type==='saida'?'- ':''}${typeof money==='function'?money(x.value):esc(x.value||0)}</td>
    </tr>`).join(''):`<tr><td colspan="5" class="empty">Nenhuma movimentação nos últimos 15 dias.</td></tr>`;
  }

  function scheduleRecent(){setTimeout(renderRecent15Days,85);}
  const prevRenderDashboard=window.renderDashboard;
  if(typeof prevRenderDashboard==='function')window.renderDashboard=function(){const out=prevRenderDashboard.apply(this,arguments);scheduleRecent();return out;};
  const prevShowView=window.showView;
  if(typeof prevShowView==='function')window.showView=function(view,button){const out=prevShowView.apply(this,arguments);if(view==='dashboard')scheduleRecent();return out;};

  function parseMoney(text){
    let raw=String(text||'').replace(/R\$/gi,'').replace(/\s/g,'');
    const negative=/^-/.test(raw)||/^\(.*\)$/.test(raw);
    raw=raw.replace(/[()]/g,'').replace(/\./g,'').replace(',','.').replace(/[^0-9.\-]/g,'');
    const n=Number(raw);
    if(!Number.isFinite(n))return 0;
    return negative&&n>0?-n:n;
  }

  function ensureDreResultStyle(){
    if(document.getElementById('br-dre-result-after-negative-style'))return;
    const s=document.createElement('style');
    s.id='br-dre-result-after-negative-style';
    s.textContent=`
      #view-dre .br-dre-result-after.br-result-after-negative{background:#fff5f5!important;border-color:#f3c7c7!important}
      #view-dre .br-dre-result-after.br-result-after-negative>span:first-child,
      #view-dre .br-dre-result-after.br-result-after-negative .dre-compare-current,
      #view-dre .br-dre-result-after.br-result-after-negative .dre-percent-current{color:#c62828!important}
    `;
    document.head.appendChild(s);
  }

  function colorResultAfter(){
    ensureDreResultStyle();
    document.querySelectorAll('#view-dre .br-dre-result-after').forEach(row=>{
      const current=parseMoney(row.querySelector('.dre-compare-current')?.textContent||'');
      row.classList.toggle('br-result-after-negative',current<0);
    });
  }
  let dreTimer=null;
  function scheduleDreColor(){clearTimeout(dreTimer);dreTimer=setTimeout(colorResultAfter,55);}
  const dreView=document.getElementById('view-dre');
  if(dreView)new MutationObserver(scheduleDreColor).observe(dreView,{childList:true,subtree:true,characterData:true});
  const prevRenderDre=window.renderDRE;
  if(typeof prevRenderDre==='function')window.renderDRE=function(){const out=prevRenderDre.apply(this,arguments);scheduleDreColor();return out;};

  function investmentKind(category){
    const n=norm(category);
    if(n===norm('Imóvel'))return'Imóvel';
    if(n===norm('Capital Social - Sicredi'))return'Capital Social - Sicredi';
    if(n===norm('Aplicações Financeiras')||n===norm(LEGACY_APPLICATION))return'Aplicações Financeiras';
    return'';
  }
  function feeValue(t){return t?.type==='saida'?Math.max(0,Number(t?.fine||0))+Math.max(0,Number(t?.interest||0)):0;}
  function baseValue(t){
    if(t?.type!=='saida')return Number(t?.value||0);
    if(t?.baseValue!==undefined&&t?.baseValue!==null&&t?.baseValue!=='')return Number(t.baseValue||0);
    return Math.max(0,Number(t?.value||0)-feeValue(t));
  }
  function addMonths(prefix,delta){
    const [y,m]=String(prefix).split('-').map(Number);
    const d=new Date(Date.UTC(y,m-1+delta,1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
  }
  function monthsFromFilename(filename){
    const f=String(filename||'');
    let m=f.match(/^DRE_BRCONDOS_(\d{4})\.xlsx$/i);
    if(m)return Array.from({length:12},(_,i)=>`${m[1]}-${String(i+1).padStart(2,'0')}`);
    m=f.match(/^DRE_BRCONDOS_Ultimos_12_Meses_ate_(\d{4}-\d{2})\.xlsx$/i);
    if(m)return Array.from({length:12},(_,i)=>addMonths(m[1],i-11));
    return [];
  }
  function investmentValues(months){
    const tx=getTransactions();
    return months.map(prefix=>{
      const vals={};INVESTMENT_ACCOUNTS.forEach(n=>vals[n]=0);
      tx.filter(t=>String(t?.date||'').startsWith(prefix)&&t?.status==='pago'&&t?.type==='saida').forEach(t=>{
        const kind=investmentKind(t?.category);if(kind)vals[kind]+=baseValue(t);
      });
      vals.total=INVESTMENT_ACCOUNTS.reduce((s,n)=>s+Number(vals[n]||0),0);
      return vals;
    });
  }
  function findRow(XLSX,ws,predicate){
    if(!ws?.['!ref'])return-1;
    const range=XLSX.utils.decode_range(ws['!ref']);
    for(let r=0;r<=range.e.r;r++){
      const label=String(ws[XLSX.utils.encode_cell({r,c:0})]?.v||'').trim();
      if(predicate(norm(label),label))return r;
    }
    return-1;
  }
  function setCell(XLSX,ws,r,c,value,format){
    const ref=XLSX.utils.encode_cell({r,c});
    ws[ref]=typeof value==='number'?{t:'n',v:value,z:format||'R$ #,##0.00'}:{t:'s',v:String(value??'')};
  }
  function appendInvestmentSection(XLSX,ws,months,values,revenueValues,percentSheet=false){
    if(!ws?.['!ref']||!months.length)return;
    if(findRow(XLSX,ws,n=>n.includes('resultado do periodo apos aplicacoes'))>=0)return;
    const range=XLSX.utils.decode_range(ws['!ref']);
    const resultRow=findRow(XLSX,ws,n=>n==='resultado do periodo');
    if(resultRow<0)return;

    let r=range.e.r+1;
    const monthly=(selector)=>months.map((_,i)=>selector(values[i],i));
    const resultMonthly=months.map((_,i)=>Number(ws[XLSX.utils.encode_cell({r:resultRow,c:i+1})]?.v||0));
    const ratio=(amount,i)=>percentSheet?(Number(revenueValues[i]||0)?Number(amount||0)/Number(revenueValues[i]||0):0):Number(amount||0);
    const format=percentSheet?'0.00%':'R$ #,##0.00';

    const rows=[
      ['INVESTIMENTOS',monthly((v,i)=>ratio(v.total,i))],
      ['   (-) Imóvel',monthly((v,i)=>ratio(v['Imóvel'],i))],
      ['   (-) Capital Social - Sicredi',monthly((v,i)=>ratio(v['Capital Social - Sicredi'],i))],
      ['   (-) Aplicações Financeiras',monthly((v,i)=>ratio(v['Aplicações Financeiras'],i))],
      ['RESULTADO DO PERÍODO APÓS APLICAÇÕES',months.map((_,i)=>resultMonthly[i]-ratio(values[i].total,i))]
    ];

    rows.forEach(([label,vals])=>{
      setCell(XLSX,ws,r,0,label);
      vals.forEach((v,i)=>setCell(XLSX,ws,r,i+1,Number(v||0),format));
      r++;
    });
    range.e.r=r-1;
    ws['!ref']=XLSX.utils.encode_range(range);

    if(!percentSheet){
      const headerRow=5;
      const accCol=months.length+1,pctCol=months.length+2;
      const accHeader=norm(ws[XLSX.utils.encode_cell({r:headerRow,c:accCol})]?.v||'');
      const pctHeader=norm(ws[XLSX.utils.encode_cell({r:headerRow,c:pctCol})]?.v||'');
      if(accHeader==='acumulado'&&pctHeader==='% acumulada'){
        const revenueAccumulated=revenueValues.reduce((s,v)=>s+Number(v||0),0);
        for(let rr=r-rows.length;rr<r;rr++){
          let total=0;for(let c=1;c<=months.length;c++)total+=Number(ws[XLSX.utils.encode_cell({r:rr,c})]?.v||0);
          setCell(XLSX,ws,rr,accCol,total,'R$ #,##0.00');
          setCell(XLSX,ws,rr,pctCol,revenueAccumulated?total/revenueAccumulated:0,'0.00%');
        }
        const rr=XLSX.utils.decode_range(ws['!ref']);rr.e.c=Math.max(rr.e.c,pctCol);ws['!ref']=XLSX.utils.encode_range(rr);
      }
    }
  }

  function addInvestmentsToWorkbook(XLSX,workbook,filename){
    if(!/^DRE_BRCONDOS_/i.test(String(filename||'')))return;
    const months=monthsFromFilename(filename);if(months.length!==12)return;
    const consolidated=workbook?.Sheets?.['DRE Consolidada'];if(!consolidated)return;
    const revenueRow=findRow(XLSX,consolidated,n=>n.includes('receita operacional'));
    if(revenueRow<0)return;
    const revenueValues=months.map((_,i)=>Number(consolidated[XLSX.utils.encode_cell({r:revenueRow,c:i+1})]?.v||0));
    const values=investmentValues(months);
    appendInvestmentSection(XLSX,consolidated,months,values,revenueValues,false);
    const pct=workbook?.Sheets?.['% Receita'];
    if(pct)appendInvestmentSection(XLSX,pct,months,values,revenueValues,true);
  }

  function wrapXlsx(){
    const XLSX=window.XLSX;
    if(!XLSX||typeof XLSX.writeFile!=='function')return false;
    if(XLSX.writeFile.__brFinalDreFixes===true)return true;
    const original=XLSX.writeFile.bind(XLSX);
    const wrapped=function(workbook,filename){
      try{addInvestmentsToWorkbook(XLSX,workbook,filename);}catch(err){console.error('DRE EXCEL INVESTIMENTOS:',err);}
      return original.apply(null,arguments);
    };
    wrapped.__brFinalDreFixes=true;
    XLSX.writeFile=wrapped;
    return true;
  }
  function hookXlsx(){
    const s=document.querySelector('script[data-br-xlsx="1"]');
    if(!s||s.dataset.brFinalDreFixesHook==='1')return;
    s.dataset.brFinalDreFixesHook='1';
    s.addEventListener('load',()=>setTimeout(wrapXlsx,0),{once:true});
  }
  wrapXlsx();hookXlsx();
  new MutationObserver(()=>{if(!wrapXlsx())hookXlsx();}).observe(document.documentElement,{childList:true,subtree:true});

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{scheduleRecent();scheduleDreColor();},{once:true});
  else{scheduleRecent();scheduleDreColor();}
})();