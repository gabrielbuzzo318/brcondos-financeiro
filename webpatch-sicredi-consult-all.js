(function(){
  function selectedMonth(){
    const top=String(document.getElementById('boleto_download_month')?.value||'');
    if(/^\d{4}-\d{2}$/.test(top))return top;
    const from=String(document.getElementById('boleto_from')?.value||'');
    if(/^\d{4}-\d{2}-\d{2}$/.test(from))return from.slice(0,7);
    const now=new Date();
    return now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  }

  function monthLabel(m){
    const names=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const [y,mm]=String(m||'').split('-').map(Number);
    return (names[(mm||1)-1]||m)+'/'+y;
  }

  function normalize(v){
    return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
  }

  function statusGroup(b){
    const s=normalize(b?.sicrediStatus||'');
    if(/BAIXAD|CANCELAD/.test(s)||b?.status==='baixado')return 'baixado';
    if(/LIQUIDAD|PAGO|PAGA/.test(s)||b?.status==='recebido'||b?.status==='liquidado')return 'liquidado';
    if(/VENCID/.test(s))return 'vencido';
    return 'aberto';
  }

  async function consultOne(b){
    const nn=String(b?.sicrediNossoNumero||'').replace(/\D/g,'');
    if(!nn)return {ok:false,b,error:'Nosso Número não disponível'};
    try{
      const response=await fetch('/api/boletos/'+encodeURIComponent(nn),{cache:'no-store'});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data?.error||('HTTP '+response.status));
      return {ok:true,b,data};
    }catch(e){
      return {ok:false,b,error:e?.message||String(e)};
    }
  }

  window.brConsultarTodosBoletos=async function(){
    const month=selectedMonth();
    const rows=(Array.isArray(boletos)?boletos:[]).filter(b=>
      String(b?.due||'').slice(0,7)===month &&
      b?.sicrediRegistered &&
      String(b?.sicrediNossoNumero||'').replace(/\D/g,'')
    );

    if(!rows.length)return alert('Não há boletos registrados no Sicredi em '+monthLabel(month)+'.');
    if(!confirm('Consultar '+rows.length+' boleto(s) no Sicredi de '+monthLabel(month)+'?\n\nOs status e recebimentos serão atualizados automaticamente.'))return;

    const btn=document.getElementById('btnConsultarTodosSicredi');
    const old=btn?.textContent||'↻ Consultar todos';
    const failures=[];
    let done=0;

    try{
      window.__brSicrediBulkConsult=true;
      if(btn){btn.disabled=true;btn.textContent='Consultando 0/'+rows.length+'...';}

      const concurrency=6;
      for(let i=0;i<rows.length;i+=concurrency){
        const batch=rows.slice(i,i+concurrency);
        const results=await Promise.all(batch.map(consultOne));
        results.forEach(r=>{if(!r.ok)failures.push(r);});
        done+=batch.length;
        if(btn)btn.textContent='Consultando '+done+'/'+rows.length+'...';
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
        +'Em aberto/outros: '+counts.aberto;
      if(failures.length)msg+='\nErros de consulta: '+failures.length;
      alert(msg);
    }finally{
      window.__brSicrediBulkConsult=false;
      const current=document.getElementById('btnConsultarTodosSicredi');
      if(current){current.disabled=false;current.textContent=old;}
    }
  };

  function inject(){
    const root=document.getElementById('view-boletos');
    const actions=root?.querySelector('.section-title')?.lastElementChild;
    if(!actions||document.getElementById('btnConsultarTodosSicredi'))return;

    const btn=document.createElement('button');
    btn.id='btnConsultarTodosSicredi';
    btn.type='button';
    btn.className='btn';
    btn.textContent='↻ Consultar todos';
    btn.onclick=window.brConsultarTodosBoletos;

    const test=document.getElementById('btnTestarSicredi');
    if(test&&test.parentElement===actions)test.insertAdjacentElement('afterend',btn);
    else{
      const importBtn=[...actions.querySelectorAll('button')].find(b=>/Importar planilha/i.test(b.textContent||''));
      if(importBtn)actions.insertBefore(btn,importBtn);
      else actions.appendChild(btn);
    }
  }

  const oldRender=window.renderBoletos;
  if(typeof oldRender==='function'){
    window.renderBoletos=function(){
      const out=oldRender.apply(this,arguments);
      setTimeout(inject,0);
      return out;
    };
  }

  const obs=new MutationObserver(()=>setTimeout(inject,0));
  obs.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(inject,300);
})();