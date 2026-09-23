(function(){
  function digits(v){return String(v??'').replace(/\D/g,'');}
  function norm(v){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();}
  function isLiquidatedStatus(v){return /LIQUIDAD|PAGO|PAGA/.test(norm(v))&&!/BAIXAD/.test(norm(v));}
  function isoToday(){return typeof today==='function'?today():new Date().toISOString().slice(0,10);}
  function isoToDate(v){
    const m=String(v||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!m)return null;
    return new Date(Date.UTC(+m[1],+m[2]-1,+m[3]));
  }
  function dateToIso(d){
    return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0');
  }
  function addDays(v,n){
    const d=isoToDate(v);if(!d)return '';
    d.setUTCDate(d.getUTCDate()+Number(n||0));
    return dateToIso(d);
  }
  function maxIso(a,b){return String(a||'')>String(b||'')?a:b;}
  function minIso(a,b){return String(a||'')<String(b||'')?a:b;}
  function daysBetween(from,to,maxDays=120){
    let start=isoToDate(from),end=isoToDate(to);
    if(!start||!end||start>end)return [];
    const floor=new Date(end);floor.setUTCDate(floor.getUTCDate()-maxDays+1);
    if(start<floor)start=floor;
    const out=[];
    for(let d=new Date(start);d<=end;d.setUTCDate(d.getUTCDate()+1))out.push(dateToIso(d));
    return out;
  }
  function selectedMonth(){
    const top=String(document.getElementById('boleto_download_month')?.value||'');
    if(/^\d{4}-\d{2}$/.test(top))return top;
    const from=String(document.getElementById('boleto_from')?.value||'');
    if(/^\d{4}-\d{2}-\d{2}$/.test(from))return from.slice(0,7);
    return isoToday().slice(0,7);
  }
  function monthLabel(m){
    const names=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const [y,mm]=String(m||'').split('-').map(Number);
    return (names[(mm||1)-1]||m)+'/'+y;
  }
  function responseStatus(data){
    if(typeof window.brSicrediStatusFromResponse==='function')return window.brSicrediStatusFromResponse(data)||'';
    return data?.situacao||data?.status||data?.situacaoBoleto||'';
  }
  async function fetchLiquidatedDay(day){
    const r=await fetch('/api/boletos/liquidados-dia?dia='+encodeURIComponent(day),{cache:'no-store'});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data?.error||('HTTP '+r.status));
    return Array.isArray(data?.items)?data.items:[];
  }
  async function liquidationsForDays(days,onProgress){
    const byNosso=new Map();
    const errors=[];
    const concurrency=6;
    let done=0;
    for(let i=0;i<days.length;i+=concurrency){
      const batch=days.slice(i,i+concurrency);
      const results=await Promise.all(batch.map(async day=>{
        try{return {day,items:await fetchLiquidatedDay(day)};}
        catch(e){return {day,error:e?.message||String(e),items:[]};}
      }));
      for(const r of results){
        if(r.error)errors.push(r);
        for(const item of r.items){
          const nn=digits(item?.nossoNumero);
          if(nn)byNosso.set(nn,item);
        }
      }
      done+=batch.length;
      if(typeof onProgress==='function')onProgress(done,days.length);
    }
    return {byNosso,errors};
  }
  function applyLiquidation(b,item){
    if(!b||!item)return false;
    const data={
      ...(b.sicrediResponse&&typeof b.sicrediResponse==='object'?b.sicrediResponse:{}),
      situacao:'LIQUIDADO',
      dadosLiquidacao:{
        data:item.dataPagamento||'',
        valor:Number(item.valorLiquidado??item.valor??b.value||0),
        tipoLiquidacao:item.tipoLiquidacao||''
      },
      liquidacaoConfirmadaPorDia:item
    };
    b.sicrediStatus='LIQUIDADO';
    b.sicrediStatusUpdatedAt=new Date().toISOString();
    b.sicrediResponse=data;
    b.sicrediLiquidationSource='liquidados-dia';
    if(typeof window.brSyncLiquidatedToFlow==='function'){
      window.brSyncLiquidatedToFlow(b,data,'LIQUIDADO',{persist:false});
    }else{
      b.status='recebido';
      b.receiptDate=item.dataPagamento||b.receiptDate||'';
      b.sicrediLiquidationDate=item.dataPagamento||b.sicrediLiquidationDate||'';
    }
    return true;
  }
  async function consultNormal(b){
    const nn=digits(b?.sicrediNossoNumero);
    if(!nn)throw new Error('Nosso Número não disponível.');
    const response=await fetch('/api/boletos/'+encodeURIComponent(nn),{cache:'no-store'});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data?.error||('HTTP '+response.status));
    return data;
  }
  async function crossCheckOne(b){
    const due=String(b?.due||'');
    const end=isoToday();
    let start=due&&/^\d{4}-\d{2}-\d{2}$/.test(due)?addDays(due,-15):addDays(end,-45);
    start=maxIso(start,addDays(end,-119));
    const days=daysBetween(start,end,120);
    const {byNosso,errors}=await liquidationsForDays(days);
    return {item:byNosso.get(digits(b?.sicrediNossoNumero))||null,errors};
  }

  window.consultSicrediBoleto=async function(id){
    const b=(boletos||[]).find(x=>Number(x.id)===Number(id));
    if(!b?.sicrediNossoNumero)return alert('Nosso Número não disponível.');
    try{
      window.__brSicrediBulkConsult=true;
      const data=await consultNormal(b);
      const st=responseStatus(data);
      let confirmed=null;
      let dayErrors=[];
      if(!isLiquidatedStatus(st)){
        const check=await crossCheckOne(b);
        confirmed=check.item;
        dayErrors=check.errors;
        if(confirmed)applyLiquidation(b,confirmed);
      }
      if(typeof saveData==='function'){
        saveData('boletos',boletos);
        saveData('transactions',transactions);
      }
      if(typeof renderAll==='function')renderAll();

      const finalStatus=confirmed?'LIQUIDADO':(responseStatus(b.sicrediResponse||data)||st||'SEM STATUS');
      let msg='Consulta Sicredi concluída.\n\n'
        +'Nosso Número: '+b.sicrediNossoNumero+'\n'
        +'Status final: '+finalStatus;
      if(confirmed){
        msg+='\nData da liquidação: '+String(confirmed.dataPagamento||'-');
        msg+='\nValor liquidado: '+(typeof money==='function'?money(confirmed.valorLiquidado??confirmed.valor??b.value):String(confirmed.valorLiquidado??confirmed.valor??b.value));
        msg+='\n\n✓ Liquidação confirmada pela consulta de boletos liquidados do Sicredi.';
      }else if(dayErrors.length){
        msg+='\n\nA consulta principal foi concluída, mas houve '+dayErrors.length+' falha(s) na conferência diária de liquidações.';
      }
      alert(msg);
    }catch(e){
      alert('Erro na consulta Sicredi:\n'+(e?.message||e));
    }finally{
      window.__brSicrediBulkConsult=false;
    }
  };

  function statusGroup(b){
    const s=norm(b?.sicrediStatus||'');
    if(/BAIXAD|CANCELAD/.test(s)||b?.status==='baixado')return 'baixado';
    if(isLiquidatedStatus(s)||b?.status==='recebido'||b?.status==='liquidado')return 'liquidado';
    if(/VENCID/.test(s))return 'vencido';
    return 'aberto';
  }

  window.brConsultarTodosBoletos=async function(){
    const month=selectedMonth();
    const rows=(Array.isArray(boletos)?boletos:[]).filter(b=>
      String(b?.due||'').slice(0,7)===month &&
      b?.sicrediRegistered &&
      digits(b?.sicrediNossoNumero)
    );
    if(!rows.length)return alert('Não há boletos registrados no Sicredi em '+monthLabel(month)+'.');
    if(!confirm('Consultar '+rows.length+' boleto(s) no Sicredi de '+monthLabel(month)+'?\n\nAlém da situação do título, o sistema vai conferir a lista oficial de liquidados para evitar falsos vencidos.'))return;

    const btn=document.getElementById('btnConsultarTodosSicredi');
    const old=btn?.textContent||'↻ Consultar todos';
    const failures=[];
    let confirmedByDay=0;

    try{
      window.__brSicrediBulkConsult=true;
      if(btn){btn.disabled=true;btn.textContent='Consultando títulos...';}

      const concurrency=6;
      let done=0;
      for(let i=0;i<rows.length;i+=concurrency){
        const batch=rows.slice(i,i+concurrency);
        const results=await Promise.all(batch.map(async b=>{
          try{return {ok:true,b,data:await consultNormal(b)};}
          catch(e){return {ok:false,b,error:e?.message||String(e)};}
        }));
        results.forEach(r=>{if(!r.ok)failures.push(r);});
        done+=batch.length;
        if(btn)btn.textContent='Consultando '+done+'/'+rows.length+'...';
      }

      const nonLiquid=rows.filter(b=>statusGroup(b)!=='liquidado');
      if(nonLiquid.length){
        const dues=nonLiquid.map(b=>String(b.due||'')).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
        const end=isoToday();
        let start=dues.length?addDays(dues[0],-15):addDays(end,-45);
        start=maxIso(start,addDays(end,-119));
        const days=daysBetween(start,end,120);

        if(btn)btn.textContent='Conferindo liquidações 0/'+days.length+'...';
        const check=await liquidationsForDays(days,(d,total)=>{
          if(btn)btn.textContent='Conferindo liquidações '+d+'/'+total+'...';
        });

        for(const b of nonLiquid){
          const item=check.byNosso.get(digits(b.sicrediNossoNumero));
          if(item&&applyLiquidation(b,item))confirmedByDay++;
        }
        check.errors.forEach(e=>failures.push({b:null,error:'Liquidados '+e.day+': '+e.error}));
      }

      if(typeof saveData==='function'){
        saveData('boletos',boletos);
        saveData('transactions',transactions);
      }
      if(typeof renderAll==='function')renderAll();

      const refreshed=rows.map(r=>(boletos||[]).find(x=>String(x.id)===String(r.id))||r);
      const counts={liquidado:0,baixado:0,vencido:0,aberto:0};
      refreshed.forEach(b=>counts[statusGroup(b)]++);

      let msg='Consulta concluída ✅\n\n'
        +monthLabel(month)+'\n'
        +'Consultados: '+rows.length+'\n'
        +'Liquidados/recebidos: '+counts.liquidado+'\n'
        +'Baixados/cancelados: '+counts.baixado+'\n'
        +'Vencidos: '+counts.vencido+'\n'
        +'Em aberto/outros: '+counts.aberto+'\n'
        +'Liquidações corrigidas pela conferência: '+confirmedByDay;
      if(failures.length)msg+='\nFalhas técnicas: '+failures.length;
      alert(msg);
    }finally{
      window.__brSicrediBulkConsult=false;
      const current=document.getElementById('btnConsultarTodosSicredi');
      if(current){current.disabled=false;current.textContent=old;}
    }
  };
})();