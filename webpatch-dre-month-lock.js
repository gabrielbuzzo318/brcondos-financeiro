(function(){
  const CLOSURE_KEY='brcondos_dre_closures_v1';
  const BIA_EMAIL='bpobrcondos@gmail.com';
  let userCache=null;
  let userPromise=null;

  function normEmail(v){return String(v||'').trim().toLowerCase();}
  function monthOf(date){
    const m=String(date||'').match(/^(\d{4})-(\d{2})-/);
    return m?`${m[1]}-${m[2]}`:'';
  }
  function readClosures(){
    try{
      const raw=localStorage.getItem(CLOSURE_KEY);
      const data=raw?JSON.parse(raw):{};
      return data&&typeof data==='object'&&!Array.isArray(data)?data:{};
    }catch(_){return {};}
  }
  function closedMonth(month){return !!(month&&readClosures()?.[month]?.closed===true);}
  function monthLabel(month){
    const [y,m]=String(month||'').split('-').map(Number);
    const names=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    return `${names[(m||1)-1]||month}/${y||''}`;
  }

  async function currentUser(){
    if(userCache)return userCache;
    if(userPromise)return userPromise;
    userPromise=fetch('/api/auth/me',{cache:'no-store'})
      .then(async r=>{
        const d=await r.json().catch(()=>({}));
        userCache=r.ok?d:{};
        return userCache;
      })
      .catch(()=>({}))
      .finally(()=>{userPromise=null;});
    return userPromise;
  }

  function askPassword(months){
    return new Promise(resolve=>{
      document.getElementById('brDreLockOverlay')?.remove();
      const overlay=document.createElement('div');
      overlay.id='brDreLockOverlay';
      overlay.style.cssText='position:fixed;inset:0;z-index:20000;background:rgba(24,34,40,.48);display:flex;align-items:center;justify-content:center;padding:18px;font-family:Inter,Segoe UI,Arial,sans-serif';
      const labels=months.map(monthLabel).join(', ');
      overlay.innerHTML=`
        <div style="width:min(440px,96vw);background:#fff;border-radius:14px;box-shadow:0 24px 70px rgba(0,0,0,.28);padding:22px;color:#26343c">
          <div style="font-size:18px;font-weight:900;margin-bottom:7px">Mês com DRE concluída</div>
          <div style="font-size:12px;color:#66757f;line-height:1.5;margin-bottom:15px">${labels}. Para a Bia alterar lançamentos desse período, informe a senha de login da Ester.</div>
          <label style="display:block;font-size:11px;font-weight:800;margin-bottom:6px">Senha da Ester</label>
          <input id="brDreOwnerPassword" type="password" autocomplete="current-password" style="width:100%;height:42px;border:1px solid #d6dee3;border-radius:8px;padding:0 11px;font-size:14px;box-sizing:border-box">
          <div id="brDreLockError" style="min-height:18px;margin-top:7px;font-size:11px;color:#c83d3d"></div>
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px">
            <button id="brDreLockCancel" type="button" class="btn">Cancelar</button>
            <button id="brDreLockConfirm" type="button" class="btn primary">Desbloquear alteração</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      const input=overlay.querySelector('#brDreOwnerPassword');
      const cancel=overlay.querySelector('#brDreLockCancel');
      const confirm=overlay.querySelector('#brDreLockConfirm');
      const error=overlay.querySelector('#brDreLockError');
      const done=value=>{overlay.remove();resolve(value);};
      cancel.onclick=()=>done('');
      overlay.addEventListener('click',e=>{if(e.target===overlay)done('');});
      confirm.onclick=async()=>{
        const password=String(input.value||'');
        if(!password){error.textContent='Informe a senha.';input.focus();return;}
        confirm.disabled=true;cancel.disabled=true;error.textContent='Validando...';
        try{
          const r=await fetch('/api/auth/dre-owner-verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});
          const d=await r.json().catch(()=>({}));
          if(!r.ok)throw new Error(d.error||'Senha inválida.');
          done(password);
        }catch(err){
          error.textContent=err?.message||'Não foi possível validar a senha.';
          confirm.disabled=false;cancel.disabled=false;input.select();input.focus();
        }
      };
      input.addEventListener('keydown',e=>{if(e.key==='Enter')confirm.click();});
      setTimeout(()=>input.focus(),20);
    });
  }

  async function authorizeDates(dates){
    const user=await currentUser();
    if(normEmail(user?.email)!==BIA_EMAIL)return true;
    const months=[...new Set((dates||[]).map(monthOf).filter(Boolean).filter(closedMonth))];
    if(!months.length)return true;
    const password=await askPassword(months);
    return !!password;
  }
  async function authorizeMonths(months){
    const user=await currentUser();
    if(normEmail(user?.email)!==BIA_EMAIL)return true;
    const closed=[...new Set((months||[]).filter(closedMonth))];
    if(!closed.length)return true;
    return !!(await askPassword(closed));
  }

  function tx(id){try{return (transactions||[]).find(x=>String(x?.id)===String(id));}catch(_){return null;}}
  function payable(id){try{return (payables||[]).find(x=>String(x?.id)===String(id));}catch(_){return null;}}
  function reimbursement(id){try{return (reimbursements||[]).find(x=>String(x?.id)===String(id));}catch(_){return null;}}
  function boleto(id){try{return (boletos||[]).find(x=>String(x?.id)===String(id));}catch(_){return null;}}
  function v(id){return String(document.getElementById(id)?.value||'').trim();}

  function wrap(name,dateGetter){
    const original=window[name];
    if(typeof original!=='function')return;
    window[name]=async function(){
      const args=[...arguments];
      let dates=[];
      try{dates=dateGetter?dateGetter.apply(this,args)||[]:[];}catch(_){dates=[];}
      if(!(await authorizeDates(dates)))return;
      return original.apply(this,args);
    };
  }

  wrap('saveTransaction',id=>[tx(id)?.date,v('m_date')]);
  wrap('delTransaction',id=>[tx(id)?.date]);

  wrap('savePayable',id=>{
    const p=payable(id);
    return [p?.due,p?.paymentDate,v('ap_due')];
  });
  wrap('delPayable',id=>{const p=payable(id);return[p?.due,p?.paymentDate];});
  wrap('confirmPayablePaid',id=>{const p=payable(id);return[p?.due,p?.paymentDate,v('payable_payment_date')];});
  wrap('reversePayablePayment',id=>{const p=payable(id);return[p?.due,p?.paymentDate];});

  wrap('saveReimbursement',id=>{
    const r=reimbursement(id);
    return [r?.date,r?.receivedDate,v('rb_date'),v('rb_received_date')];
  });
  wrap('deleteReimbursement',id=>{const r=reimbursement(id);return[r?.date,r?.receivedDate];});
  wrap('receiveReimbursement',id=>{const r=reimbursement(id);return[r?.receivedDate,(typeof today==='function'?today():'')];});
  wrap('confirmReimbursementReceived',id=>{const r=reimbursement(id);return[r?.receivedDate,v('reimbursement_received_date'),v('rb_received_date')];});

  wrap('confirmBoletoReceived',id=>{const b=boleto(id);return[b?.receiptDate,v('boleto_receipt_date')];});
  wrap('delBoleto',id=>{const b=boleto(id);return b?.status==='recebido'?[b?.receiptDate]:[];});
  wrap('saveBoleto',id=>{const b=boleto(id);return b?.status==='recebido'?[b?.receiptDate]:[];});

  const originalToggle=window.toggleDreClosing;
  if(typeof originalToggle==='function'){
    window.toggleDreClosing=async function(){
      const month=String(document.getElementById('dre_month')?.value||'').trim();
      if(closedMonth(month)&&!(await authorizeMonths([month])))return;
      return originalToggle.apply(this,arguments);
    };
  }

  window.brDreMonthIsClosed=closedMonth;
  window.brDreAuthorizeDates=authorizeDates;
})();