(function(){
  const originalEmitNfseOne=window.emitNfseOne;
  const originalEmitAllNfse=window.emitAllNfse;
  let pendingAction=null;
  let validating=false;

  function actionDescription(action){
    if(action?.type==='all'){
      const visible=typeof visibleNfseRows==='function'?visibleNfseRows():[];
      const eligible=visible.filter(x=>typeof nfseCanEmit!=='function'||!nfseCanEmit(x));
      return eligible.length===1?'1 NFS-e apta para emissão':`${eligible.length} NFS-e aptas para emissão`;
    }
    const row=(nfse||[]).find(x=>Number(x.id)===Number(action?.id));
    if(!row)return 'NFS-e selecionada';
    return `${row.client||'NFS-e'} • ${typeof money==='function'?money(row.value):row.value}`;
  }

  function requestPassword(action){
    pendingAction=action;
    const description=actionDescription(action);
    openModal('Confirme sua senha para emitir',`
      <div class="notice">
        <b>Confirmação de segurança.</b> Para transmitir NFS-e à Giss, informe a mesma senha usada no login do BRCONDOS Financeiro.
      </div>
      <div style="margin-top:16px;padding:12px 14px;border:1px solid #e3e8eb;border-radius:8px;background:#f8fafb">
        <div class="subtle">EMISSÃO</div>
        <div style="font-weight:800;margin-top:4px">${esc(description)}</div>
      </div>
      <div class="field" style="margin-top:16px">
        <label>Senha de login</label>
        <input id="nfse_confirm_password" type="password" autocomplete="current-password" placeholder="Digite sua senha" onkeydown="if(event.key==='Enter'){event.preventDefault();confirmNfseEmissionPassword()}">
      </div>
      <div id="nfse_password_error" style="display:none;margin-top:8px;color:var(--danger);font-size:12px;font-weight:700"></div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px">
        <button class="btn" onclick="cancelNfsePasswordConfirmation()">Cancelar</button>
        <button id="nfse_password_confirm_btn" class="btn primary" onclick="confirmNfseEmissionPassword()">Confirmar e continuar</button>
      </div>`);
    setTimeout(()=>document.getElementById('nfse_confirm_password')?.focus(),60);
  }

  window.cancelNfsePasswordConfirmation=function(){
    pendingAction=null;
    validating=false;
    closeModal();
  };

  window.confirmNfseEmissionPassword=async function(){
    if(validating||!pendingAction)return;
    const input=document.getElementById('nfse_confirm_password');
    const error=document.getElementById('nfse_password_error');
    const btn=document.getElementById('nfse_password_confirm_btn');
    const password=String(input?.value||'');
    if(!password){
      if(error){error.textContent='Digite sua senha.';error.style.display='block';}
      input?.focus();
      return;
    }

    validating=true;
    if(btn){btn.disabled=true;btn.textContent='Validando...';}
    if(error)error.style.display='none';

    try{
      const r=await fetch('/api/auth/verify-nfse-password',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({password})
      });
      const data=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(data.error||'Senha inválida.');

      const action=pendingAction;
      pendingAction=null;
      if(input)input.value='';
      closeModal();
      validating=false;

      setTimeout(()=>{
        if(action.type==='all') originalEmitAllNfse?.();
        else originalEmitNfseOne?.(action.id);
      },60);
    }catch(e){
      validating=false;
      if(input){input.value='';input.focus();}
      if(error){error.textContent=e.message||'Senha inválida.';error.style.display='block';}
      if(btn){btn.disabled=false;btn.textContent='Confirmar e continuar';}
    }
  };

  if(typeof originalEmitNfseOne==='function'){
    window.emitNfseOne=function(id){
      requestPassword({type:'one',id});
    };
  }

  if(typeof originalEmitAllNfse==='function'){
    window.emitAllNfse=function(){
      requestPassword({type:'all'});
    };
  }
})();