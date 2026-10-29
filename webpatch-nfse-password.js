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
    const row=action?.row||(nfse||[]).find(x=>Number(x.id)===Number(action?.id));
    if(!row)return 'NFS-e selecionada';
    return `${row.client||'NFS-e'} • ${typeof money==='function'?money(row.value):row.value}`;
  }

  window.prepareNfsePasswordField=function(){
    const input=document.getElementById('nfse_confirm_password');
    if(!input)return;
    input.removeAttribute('readonly');
    if(input.dataset.userStarted!=='1'){
      input.value='';
      input.dataset.userStarted='1';
    }
  };

  function requestPassword(action){
    if(action?.type==='one'){
      const matches=(nfse||[]).filter(x=>String(x.id)===String(action.id));
      if(matches.length!==1) {
        alert('Emissão bloqueada: identificador duplicado ou inexistente. Nenhuma nota foi transmitida.');
        return;
      }
    }
    pendingAction=action;
    const description=actionDescription(action);
    const uniqueName=`nfse-confirm-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    openModal('Confirme sua senha para emitir',`
      <div class="notice">
        <b>Confirmação de segurança.</b> Para transmitir NFS-e à Giss, digite manualmente a mesma senha usada no login do BRCONDOS Financeiro.
      </div>
      <div style="margin-top:16px;padding:12px 14px;border:1px solid #e3e8eb;border-radius:8px;background:#f8fafb">
        <div class="subtle">EMISSÃO</div>
        <div style="font-weight:800;margin-top:4px">${esc(description)}</div>
      </div>
      <div class="field" style="margin-top:16px">
        <label>Senha de login</label>
        <input
          id="nfse_confirm_password"
          name="${uniqueName}"
          type="password"
          value=""
          readonly
          autocomplete="new-password"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          data-lpignore="true"
          data-1p-ignore="true"
          data-bwignore="true"
          placeholder="Digite sua senha"
          onpointerdown="prepareNfsePasswordField()"
          onkeydown="prepareNfsePasswordField();if(event.key==='Enter'){event.preventDefault();confirmNfseEmissionPassword()}"
        >
      </div>
      <div id="nfse_password_error" style="display:none;margin-top:8px;color:var(--danger);font-size:12px;font-weight:700"></div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px">
        <button class="btn" onclick="cancelNfsePasswordConfirmation()">Cancelar</button>
        <button id="nfse_password_confirm_btn" class="btn primary" onclick="confirmNfseEmissionPassword()">Confirmar e continuar</button>
      </div>`);

    // Mantém o campo vazio mesmo se o navegador tentar restaurar credenciais logo após abrir o modal.
    [0,80,220,500].forEach(ms=>setTimeout(()=>{
      const input=document.getElementById('nfse_confirm_password');
      if(input && input.dataset.userStarted!=='1') input.value='';
    },ms));
  }

  window.cancelNfsePasswordConfirmation=function(){
    pendingAction=null;
    validating=false;
    const input=document.getElementById('nfse_confirm_password');
    if(input)input.value='';
    closeModal();
  };

  window.confirmNfseEmissionPassword=async function(){
    if(validating||!pendingAction)return;
    const input=document.getElementById('nfse_confirm_password');
    const error=document.getElementById('nfse_password_error');
    const btn=document.getElementById('nfse_password_confirm_btn');

    // Se o usuário nunca interagiu com o campo, não aceita nenhum valor que um gerenciador de senhas tenha tentado injetar.
    if(input?.dataset.userStarted!=='1'){
      if(input)input.value='';
      if(error){error.textContent='Digite sua senha manualmente.';error.style.display='block';}
      input?.focus();
      return;
    }

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
        else if(action.row) originalEmitNfseOne?.(action.row);
      },60);
    }catch(e){
      validating=false;
      if(input){input.value='';input.focus();}
      if(error){error.textContent=e.message||'Senha inválida.';error.style.display='block';}
      if(btn){btn.disabled=false;btn.textContent='Confirmar e continuar';}
    }
  };


  // Emissão limitada aos três RPS pendentes conferidos na GISS.
  const enabledRps={'384':1921.70,'387':3759.50,'386':4147.50};
  const digits=v=>String(v||'').replace(/\D/g,'');
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  const selectedRow=btn=>{
    const tr=btn.closest('tr');
    const rps=String(tr?.querySelector('td')?.textContent||'').match(/^\s*(\d+)/)?.[1];
    if(!rps||!(rps in enabledRps))return null;
    const rows=(nfse||[]).filter(x=>String(x.competence)==='2026-10'&&String(x.rpsNumber||'')===rps);
    if(rows.length!==1)throw new Error('RPS '+rps+' duplicado ou inexistente.');
    const row=rows[0];
    if(row.status!=='rascunho'&&row.status!=='erro_nfse')throw new Error('Status não permite emissão.');
    if(Math.abs(Number(row.value)-enabledRps[rps])>0.01)throw new Error('Valor divergente do condomínio.');
    const client=(clients||[]).find(c=>Number(c.id)===Number(row.clientId));
    if(!client||norm(row.client)!==norm(client.name))throw new Error('Nome do tomador não confere com cadastro.');
    const doc=digits(client.doc);
    if(doc.length!==14)throw new Error('CNPJ do tomador inválido ou ausente.');
    const visible=norm(tr.children?.[1]?.textContent||'');
    if(!visible.includes(norm(row.client)))throw new Error('Condomínio exibido não confere com o RPS.');
    if((nfse||[]).some(x=>x!==row&&String(x.competence)==='2026-10'&&String(x.rpsNumber||'')===rps))throw new Error('RPS duplicado.');
    return row;
  };
  document.addEventListener('click',function(e){
    const btn=e.target.closest('button');
    if(!btn||!btn.closest('#view-nfse')||!/Emitir NF/i.test(btn.textContent||''))return;
    e.preventDefault();e.stopImmediatePropagation();
    try{
      const row=selectedRow(btn);
      if(!row)throw new Error('Emissão temporariamente autorizada apenas para Curimbatás (384), Eco Village I (387) e Torres Cidade Norte (386).');
      requestPassword({type:'one',id:row.id,row});
    }catch(error){alert('Emissão bloqueada: '+error.message);}
  },true);
  if(typeof originalEmitNfseOne==='function'){
    window.emitNfseOne=function(id){
      if(id&&typeof id==='object'){
        const row=id;
        if(!Object.prototype.hasOwnProperty.call(enabledRps,String(row.rpsNumber)))return alert('Emissão bloqueada.');
        return requestPassword({type:'one',id:row.id,row});
      }
      alert('Emissão bloqueada: use o botão da linha para validar RPS e tomador.');
    };
  }
  if(typeof originalEmitAllNfse==='function'){
    window.emitAllNfse=function(){alert('Emissão em lote permanece bloqueada.');};
  }
})();
