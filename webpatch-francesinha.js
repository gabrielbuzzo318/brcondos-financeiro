(function(){
  const CUTOFF_DATE='2026-07-13';
  const ACCOUNT_NAME='Receitas de serviços';
  const ACCOUNT_CODE='1.01';
  const DESCRIPTION='Receita de serviços';

  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();

  function isReadOnly(){
    try{return typeof window.brcondosIsReadOnly==='function'&&window.brcondosIsReadOnly();}catch(_){return false;}
  }

  function loadXlsx(){
    if(window.XLSX)return Promise.resolve(window.XLSX);
    return new Promise((resolve,reject)=>{
      let s=document.querySelector('script[data-br-xlsx="1"],script[src*="xlsx.full.min.js"]');
      if(s){
        if(window.XLSX)return resolve(window.XLSX);
        s.addEventListener('load',()=>window.XLSX?resolve(window.XLSX):reject(new Error('Leitor de Excel indisponível.')),{once:true});
        s.addEventListener('error',()=>reject(new Error('Não foi possível carregar o leitor de Excel.')),{once:true});
        return;
      }
      s=document.createElement('script');
      s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.async=true;
      s.dataset.brXlsx='1';
      s.onload=()=>window.XLSX?resolve(window.XLSX):reject(new Error('Leitor de Excel indisponível.'));
      s.onerror=()=>reject(new Error('Não foi possível carregar o leitor de Excel.'));
      document.head.appendChild(s);
    });
  }

  function amount(v){
    if(typeof v==='number'&&Number.isFinite(v))return v;
    let s=String(v??'').trim();
    if(!s)return 0;
    s=s.replace(/R\$/gi,'').replace(/\s/g,'');
    if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');
    const n=Number(s.replace(/[^0-9.-]/g,''));
    return Number.isFinite(n)?n:0;
  }

  function isoDate(v,XLSX){
    if(v instanceof Date&&!Number.isNaN(v.getTime())){
      return `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,'0')}-${String(v.getDate()).padStart(2,'0')}`;
    }
    if(typeof v==='number'&&Number.isFinite(v)){
      const d=XLSX.SSF?.parse_date_code?.(v);
      if(d&&d.y&&d.m&&d.d)return `${String(d.y).padStart(4,'0')}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
    }
    const s=String(v??'').trim();
    let m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(m)return `${m[1]}-${m[2]}-${m[3]}`;
    m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if(m)return `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
    return '';
  }

  function findCol(row,names){
    const wanted=names.map(norm);
    return row.findIndex(v=>wanted.includes(norm(v)));
  }

  function parseFrancesinha(rows,XLSX,fileName){
    let cols=null;
    const found=[];
    let ignoredBefore=0, ignoredDebit=0, invalid=0;

    for(const row of rows){
      if(!Array.isArray(row))continue;
      const candidate={
        nosso:findCol(row,['Nosso Número','Nosso Numero']),
        txid:findCol(row,['TXID']),
        party:findCol(row,['Pagador']),
        date:findCol(row,['Data Lçto C/C','Data Lcto C/C']),
        nominal:findCol(row,['Vlr Nominal','Valor Nominal']),
        interest:findCol(row,['Juros']),
        fine:findCol(row,['Multa']),
        movementType:findCol(row,['Tipo Mvto','Tipo Movimento'])
      };
      if(candidate.party>=0&&candidate.date>=0&&candidate.nominal>=0){cols=candidate;continue;}
      if(!cols)continue;

      const party=String(row[cols.party]??'').replace(/\s+/g,' ').trim();
      if(!party)continue;
      const date=isoDate(row[cols.date],XLSX);
      const baseValue=amount(row[cols.nominal]);
      if(!date||!baseValue){invalid++;continue;}
      if(date<CUTOFF_DATE){ignoredBefore++;continue;}

      const movementType=cols.movementType>=0?norm(row[cols.movementType]):'';
      if(movementType&&movementType!=='credito'){ignoredDebit++;continue;}

      const fine=cols.fine>=0?amount(row[cols.fine]):0;
      const interest=cols.interest>=0?amount(row[cols.interest]):0;
      const txid=cols.txid>=0?String(row[cols.txid]??'').trim():'';
      const nossoNumero=cols.nosso>=0?String(row[cols.nosso]??'').trim():'';
      const rawKey=txid||nossoNumero||`${date}|${party}|${baseValue}|${fine}|${interest}`;
      const sourceKey=`francesinha:${rawKey}`;

      found.push({
        date,
        type:'entrada',
        description:DESCRIPTION,
        category:ACCOUNT_NAME,
        party,
        baseValue,
        fine,
        interest,
        value:baseValue+fine+interest,
        status:'pago',
        source:'francesinha',
        sourceKey,
        francesinhaTxid:txid,
        francesinhaNossoNumero:nossoNumero,
        francesinhaFile:fileName||''
      });
    }
    return {found,ignoredBefore,ignoredDebit,invalid};
  }

  function ensureRevenueAccount(){
    const exists=chartAccounts.find(a=>norm(a.code)===norm(ACCOUNT_CODE)||norm(a.name)===norm(ACCOUNT_NAME));
    if(exists)return false;
    chartAccounts.push({id:Date.now()+777,code:ACCOUNT_CODE,name:ACCOUNT_NAME,type:'entrada',group:'Receitas',dre:true});
    saveData('chartAccounts',chartAccounts);
    return true;
  }

  window.importFrancesinhaFile=async function(input){
    const file=input?.files?.[0];
    if(!file)return;
    try{
      const XLSX=await loadXlsx();
      const buffer=await file.arrayBuffer();
      const wb=XLSX.read(buffer,{type:'array',cellDates:false,raw:true});
      const sheet=wb.Sheets[wb.SheetNames[0]];
      if(!sheet)throw new Error('Não encontrei uma planilha no arquivo.');
      const rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:null,raw:true});
      const result=parseFrancesinha(rows,XLSX,file.name);
      if(!result.found.length)throw new Error(`Nenhum recebimento válido foi encontrado a partir de 13/07/2026.`);

      ensureRevenueAccount();
      const existingKeys=new Set(transactions.map(t=>String(t.sourceKey||'')));
      let seq=0;
      const fresh=[];
      for(const item of result.found){
        if(existingKeys.has(item.sourceKey))continue;
        existingKeys.add(item.sourceKey);
        fresh.push({...item,id:Date.now()+(++seq)});
      }
      if(fresh.length){
        transactions.push(...fresh);
        saveData('transactions',transactions);
        renderAll();
      }
      const duplicate=result.found.length-fresh.length;
      const total=fresh.reduce((s,x)=>s+Number(x.value||0),0);
      alert(
        `Francesinha processada.\n\n`+
        `Importados: ${fresh.length}\n`+
        `Duplicados ignorados: ${duplicate}\n`+
        `Anteriores a 13/07/2026 ignorados: ${result.ignoredBefore}\n`+
        `Débitos/tarifas ignorados: ${result.ignoredDebit}\n`+
        `Total importado: ${money(total)}`
      );
    }catch(err){
      console.error('BRCONDOS FRANCESINHA:',err);
      alert(`Não foi possível importar a francesinha.\n${err?.message||err}`);
    }finally{
      if(input)input.value='';
    }
  };

  function addButton(){
    if(isReadOnly())return;
    const root=document.getElementById('view-fluxo');
    if(!root)return;
    const section=root.querySelector('.section-title');
    if(!section)return;
    const actions=section.children?.[1];
    if(!actions)return;
    if(document.getElementById('br_francesinha_btn'))return;

    const input=document.createElement('input');
    input.id='br_francesinha_file';
    input.type='file';
    input.accept='.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    input.style.display='none';
    input.onchange=()=>window.importFrancesinhaFile(input);

    const btn=document.createElement('button');
    btn.id='br_francesinha_btn';
    btn.type='button';
    btn.className='btn';
    btn.textContent='⇧ Importar Francesinha';
    btn.title='Importar recebimentos da francesinha Sicredi';
    btn.onclick=()=>input.click();

    actions.insertBefore(btn,actions.firstChild);
    actions.appendChild(input);
  }

  const obs=new MutationObserver(()=>addButton());
  obs.observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addButton,{once:true});else addButton();
  setTimeout(addButton,250);
})();
