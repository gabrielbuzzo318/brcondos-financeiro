(function(){
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
  const hoje=()=>typeof today==='function'?today():new Date().toISOString().slice(0,10);

  function boletoFinanceStatus(b){
    const s=norm(b?.sicrediStatus||'');
    if(/BAIXADO\s+POR\s+SOLICIT/.test(s))return 'baixado';
    if(/LIQUIDAD|PAGO|PAGA/.test(s))return 'liquidado';
    if(/VENCID/.test(s)||b?.status==='vencido')return 'vencido';
    if(b?.status==='recebido')return 'liquidado';
    if(b?.due&&String(b.due)<hoje())return 'vencido';
    return 'em_aberto';
  }

  function receiptDue(r){
    const b=(Array.isArray(boletos)?boletos:[]).find(x=>String(x.id)===String(r?.sourceBoletoId||''));
    return r?.dueDate||b?.due||r?.issueDate||'';
  }

  function receiptFinanceStatusLocal(r){
    if(r?.paymentStatus==='liquidado')return 'liquidado';
    const b=(Array.isArray(boletos)?boletos:[]).find(x=>String(x.id)===String(r?.sourceBoletoId||''));
    if(b){
      const st=boletoFinanceStatus(b);
      if(st==='liquidado')return 'liquidado';
      if(st==='vencido')return 'vencido';
    }
    const due=receiptDue(r);
    return due&&String(due)<hoje()?'vencido':'em_aberto';
  }

  function loadManual(){
    try{
      const x=JSON.parse(localStorage.getItem('brcondos_inadimplencias_manual')||'[]');
      return Array.isArray(x)?x:[];
    }catch(_){return [];}
  }

  function manualStatus(x){
    return x?.status==='liquidado'?'liquidado':(x?.due&&String(x.due)<hoje()?'vencido':'em_aberto');
  }

  function inadStats(){
    const overdueBoletos=(Array.isArray(boletos)?boletos:[])
      .filter(b=>boletoFinanceStatus(b)==='vencido')
      .map(b=>({id:b.id,value:Number(b.value||0)}));

    const boletoIds=new Set(overdueBoletos.map(x=>String(x.id)));
    const overdueReceipts=[];
    (Array.isArray(receipts)?receipts:[]).forEach(r=>{
      if(receiptFinanceStatusLocal(r)!=='vencido')return;
      const sid=String(r?.sourceBoletoId||'');
      if(sid&&boletoIds.has(sid))return; // Boleto + Recibo contam uma única inadimplência, igual à aba.
      overdueReceipts.push({id:r.id,value:Number(r.value||0)});
    });

    const overdueManual=loadManual()
      .filter(x=>manualStatus(x)==='vencido')
      .map(x=>({id:x.id,value:Number(x.value||0)}));

    const all=[...overdueBoletos,...overdueReceipts,...overdueManual];
    return {count:all.length,value:all.reduce((s,x)=>s+Number(x.value||0),0)};
  }

  function fixCard(){
    const root=document.getElementById('view-dashboard');
    if(!root)return;
    const cards=[...root.querySelectorAll('.br-pending')];
    const card=cards.find(c=>norm(c.querySelector('.label')?.textContent)==='INADIMPLENCIAS');
    if(!card)return;
    const stats=inadStats();
    card.classList.remove('danger','success','warning','info');
    card.classList.add(stats.count?'danger':'success');
    card.onclick=()=>window.brDashOpen?.('inadimplencias');
    card.innerHTML=`<div class="label">Inadimplências</div><div class="value ${stats.count?'bad':'good'}">${stats.count}</div><div class="note">${stats.count?(typeof money==='function'?money(stats.value):stats.value):'Nenhuma cobrança vencida'}</div>`;
  }

  function schedule(){setTimeout(fixCard,180);}

  const oldDash=window.renderDashboard;
  if(typeof oldDash==='function')window.renderDashboard=function(){const out=oldDash.apply(this,arguments);schedule();return out;};

  const oldShow=window.showView;
  if(typeof oldShow==='function')window.showView=function(view,button){const out=oldShow.apply(this,arguments);if(view==='dashboard')schedule();return out;};

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(fixCard,1000),{once:true});
  else setTimeout(fixCard,1000);
})();
