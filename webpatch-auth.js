(function(){
  const SESSION_KEY='brcondos_auth_session_v2';
  const oldFetch=window.fetch.bind(window);
  const oldSaveData=typeof window.saveData==='function'?window.saveData:null;
  let cfg=null;
  let session=null;
  let profile=null;
  let readyResolve;
  let readyReject;
  window.brcondosAuthReady=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});

  function apiUrl(input){
    try{
      if(typeof input==='string') return new URL(input,location.href);
      if(input&&input.url) return new URL(input.url,location.href);
    }catch(_){ }
    return null;
  }

  function isPublicAuthPath(path){
    return ['/api/auth/config','/api/auth/first-access','/api/auth/forgot-password'].includes(path);
  }

  async function ensureFreshSession(){
    if(!session) session=readSession();
    if(!session?.access_token) return null;
    const exp=Number(session.expires_at||0);
    if(exp && Date.now()/1000 < exp-45) return session;
    if(!session.refresh_token||!cfg) return session;
    try{
      const r=await oldFetch(`${cfg.supabaseUrl}/auth/v1/token?grant_type=refresh_token`,{
        method:'POST',
        headers:{'Content-Type':'application/json','apikey':cfg.publishableKey},
        body:JSON.stringify({refresh_token:session.refresh_token})
      });
      const data=await r.json().catch(()=>({}));
      if(!r.ok||!data.access_token) throw new Error('Sessão expirada.');
      saveSession(data);
      return session;
    }catch(_){
      clearSession();
      return null;
    }
  }

  window.fetch=async function(input,init={}){
    const u=apiUrl(input);
    if(u&&u.origin===location.origin&&u.pathname.startsWith('/api/')&&!isPublicAuthPath(u.pathname)){
      try{await window.brcondosAuthReady;}catch(_){ }
      const s=await ensureFreshSession();
      const headers=new Headers(init.headers||(input instanceof Request?input.headers:undefined));
      if(s?.access_token&&!headers.has('Authorization')) headers.set('Authorization',`Bearer ${s.access_token}`);
      init={...init,headers};
    }
    return oldFetch(input,init);
  };

  function readSession(){
    try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null');}catch(_){return null;}
  }
  function saveSession(data){
    session={
      access_token:data.access_token,
      refresh_token:data.refresh_token||session?.refresh_token||'',
      expires_at:data.expires_at||Math.floor(Date.now()/1000)+Number(data.expires_in||3600),
      token_type:data.token_type||'bearer'
    };
    localStorage.setItem(SESSION_KEY,JSON.stringify(session));
  }
  function clearSession(){
    session=null;profile=null;
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('brcondos_session');
  }

  function setLoginError(msg,color){
    const el=document.getElementById('loginError');
    if(el){el.textContent=msg||'';if(color)el.style.color=color;}
  }
  function forceLogin(){
    document.getElementById('loginScreen')?.classList.remove('hidden');
    document.getElementById('app')?.classList.add('hidden');
    const email=document.getElementById('loginEmail');
    if(email&&email.value==='financeiro@brcondos.com.br') email.value='';
  }
  function showApp(){
    document.getElementById('loginScreen')?.classList.add('hidden');
    document.getElementById('app')?.classList.remove('hidden');
    const mini=document.getElementById('userEmailMini');
    if(mini) mini.textContent=profile?`${profile.full_name} • ${profile.access_level==='consulta'?'Consulta':'Completo'}`:(session?.email||'');
    applyAccessMode();
    try{if(typeof renderAll==='function')renderAll();}catch(_){ }
  }

  async function directSupabase(path,options={}){
    if(!cfg) throw new Error('Autenticação não configurada.');
    const headers={'Content-Type':'application/json','apikey':cfg.publishableKey,...(options.headers||{})};
    return await oldFetch(`${cfg.supabaseUrl}${path}`,{...options,headers});
  }

  async function loadProfile(){
    const s=await ensureFreshSession();
    if(!s?.access_token) throw new Error('Sessão expirada.');
    const r=await oldFetch('/api/auth/me',{headers:{Authorization:`Bearer ${s.access_token}`,'Cache-Control':'no-store'}});
    const data=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(data.error||'Usuário sem acesso.');
    profile=data;
    return data;
  }

  function isReadOnly(){return profile?.access_level==='consulta';}
  window.brcondosIsReadOnly=isReadOnly;

  if(oldSaveData){
    window.saveData=function(){
      if(isReadOnly()){
        alert('Acesso somente para consulta. Nenhuma alteração é permitida para este usuário.');
        return;
      }
      return oldSaveData.apply(this,arguments);
    };
  }

  const mutationText=/\b(novo|nova|adicionar|editar|excluir|apagar|salvar|emitir|registrar|receber|pagar|agendar|finalizar|sincronizar|atualizar giss|atualizar dados|cancelar nf|cancelar boleto)\b/i;
  const mutationOnclick=/(save|delete|remove|receive|pay|schedule|emit|emitir|registr|finaliz|sync|cancelNf|cancelBoleto|openParty|openPayable|openTransaction|openReimbursement|quickCreate)/i;

  function mutationButton(el){
    if(!el||!el.closest('#app'))return false;
    const text=String(el.textContent||'').trim();
    const oc=String(el.getAttribute?.('onclick')||'');
    if(/pdf|imprimir|visualizar|consultar|pesquisar|filtrar/i.test(text))return false;
    return mutationText.test(text)||mutationOnclick.test(oc);
  }

  function lockReadOnlyControls(){
    if(!isReadOnly())return;
    document.querySelectorAll('#app button,#app a[onclick]').forEach(el=>{
      if(mutationButton(el)){
        el.dataset.brReadOnly='1';
        el.disabled=true;
        el.style.opacity='.45';
        el.style.cursor='not-allowed';
        el.title='Acesso somente para consulta';
      }
    });
  }

  document.addEventListener('click',function(e){
    if(!isReadOnly())return;
    const el=e.target.closest('button,a[onclick]');
    if(mutationButton(el)){
      e.preventDefault();e.stopImmediatePropagation();
      alert('Acesso somente para consulta. Nenhuma alteração é permitida para este usuário.');
    }
  },true);

  function applyAccessMode(){
    document.body.classList.toggle('br-readonly',isReadOnly());
    let banner=document.getElementById('brReadOnlyBanner');
    if(isReadOnly()){
      if(!banner){
        banner=document.createElement('div');banner.id='brReadOnlyBanner';
        banner.style.cssText='position:fixed;top:0;left:0;right:0;z-index:99999;background:#fff7ed;color:#9a3412;border-bottom:1px solid #fdba74;padding:7px 12px;text-align:center;font:700 12px Arial,sans-serif;';
        document.body.appendChild(banner);
      }
      banner.textContent='MODO CONSULTA — este usuário não possui permissão para alterar, emitir, excluir, baixar ou cancelar informações.';
      lockReadOnlyControls();
    }else if(banner)banner.remove();
  }

  const observer=new MutationObserver(()=>{if(isReadOnly())lockReadOnlyControls();});
  observer.observe(document.documentElement,{childList:true,subtree:true});

  function addLoginLinks(){
    const btn=document.querySelector('#loginScreen .login-btn');
    if(!btn||document.getElementById('brAuthLinks'))return;
    const box=document.createElement('div');box.id='brAuthLinks';
    box.style.cssText='display:flex;justify-content:center;gap:18px;margin-top:14px;flex-wrap:wrap;font-size:12px';
    box.innerHTML='<button type="button" id="brFirstAccess" style="border:0;background:none;color:#2563eb;cursor:pointer;text-decoration:underline">Primeiro acesso</button><button type="button" id="brForgot" style="border:0;background:none;color:#2563eb;cursor:pointer;text-decoration:underline">Esqueci minha senha</button>';
    btn.insertAdjacentElement('afterend',box);
    document.getElementById('brFirstAccess').onclick=()=>openEmailDialog('Primeiro acesso','first-access');
    document.getElementById('brForgot').onclick=()=>openEmailDialog('Esqueci minha senha','forgot-password');
  }

  function closeAuthModal(){document.getElementById('brAuthModal')?.remove();}
  function modalBase(title,body){
    closeAuthModal();
    const wrap=document.createElement('div');wrap.id='brAuthModal';
    wrap.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,.64);z-index:100000;display:flex;align-items:center;justify-content:center;padding:20px';
    wrap.innerHTML=`<div style="width:min(430px,100%);background:#fff;border-radius:16px;padding:24px;box-shadow:0 24px 70px rgba(0,0,0,.3);font-family:Arial,sans-serif"><h3 style="margin:0 0 16px;color:#111827">${title}</h3>${body}</div>`;
    document.body.appendChild(wrap);return wrap;
  }

  function openEmailDialog(title,mode){
    const wrap=modalBase(title,`<p style="font-size:13px;color:#475569;line-height:1.45">Informe o e-mail cadastrado no BRCONDOS. As instruções serão enviadas para esse endereço.</p><input id="brAuthEmail" type="email" placeholder="seu-email@empresa.com" style="width:100%;box-sizing:border-box;padding:11px;border:1px solid #cbd5e1;border-radius:9px;margin:4px 0 12px"><div id="brAuthMsg" style="min-height:18px;font-size:12px;color:#b91c1c"></div><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px"><button id="brAuthCancel" type="button" style="padding:9px 13px;border:1px solid #cbd5e1;border-radius:8px;background:#fff">Cancelar</button><button id="brAuthSend" type="button" style="padding:9px 13px;border:0;border-radius:8px;background:#2563eb;color:white;font-weight:700">Enviar</button></div>`);
    wrap.querySelector('#brAuthCancel').onclick=closeAuthModal;
    wrap.querySelector('#brAuthSend').onclick=async()=>{
      const email=wrap.querySelector('#brAuthEmail').value.trim().toLowerCase();
      const msg=wrap.querySelector('#brAuthMsg');const send=wrap.querySelector('#brAuthSend');
      if(!email){msg.textContent='Informe o e-mail.';return;}
      send.disabled=true;send.textContent='Enviando...';msg.textContent='';
      try{
        const r=await oldFetch(`/api/auth/${mode}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});
        const data=await r.json().catch(()=>({}));
        if(!r.ok)throw new Error(data.error||'Não foi possível enviar o e-mail.');
        msg.style.color='#15803d';msg.textContent=data.message||'E-mail enviado.';send.textContent='Enviado';
      }catch(err){msg.style.color='#b91c1c';msg.textContent=err.message;send.disabled=false;send.textContent='Enviar';}
    };
  }

  function showPasswordSetup(type){
    const title=type==='recovery'?'Criar nova senha':'Criar sua senha';
    const wrap=modalBase(title,`<p style="font-size:13px;color:#475569">Escolha uma senha para acessar o BRCONDOS Financeiro.</p><input id="brNewPass" type="password" placeholder="Nova senha" style="width:100%;box-sizing:border-box;padding:11px;border:1px solid #cbd5e1;border-radius:9px;margin:4px 0 10px"><input id="brNewPass2" type="password" placeholder="Confirme a nova senha" style="width:100%;box-sizing:border-box;padding:11px;border:1px solid #cbd5e1;border-radius:9px;margin-bottom:10px"><div id="brAuthMsg" style="min-height:18px;font-size:12px;color:#b91c1c"></div><button id="brSetPass" type="button" style="width:100%;padding:11px;border:0;border-radius:9px;background:#2563eb;color:white;font-weight:700;margin-top:8px">Salvar senha e entrar</button>`);
    wrap.querySelector('#brSetPass').onclick=async()=>{
      const p1=wrap.querySelector('#brNewPass').value,p2=wrap.querySelector('#brNewPass2').value,msg=wrap.querySelector('#brAuthMsg'),btn=wrap.querySelector('#brSetPass');
      if(p1.length<8){msg.textContent='Use uma senha com pelo menos 8 caracteres.';return;}
      if(p1!==p2){msg.textContent='As senhas não coincidem.';return;}
      btn.disabled=true;btn.textContent='Salvando...';
      try{
        const s=await ensureFreshSession();if(!s?.access_token)throw new Error('Link expirado. Solicite outro primeiro acesso ou recuperação.');
        const r=await directSupabase('/auth/v1/user',{method:'PUT',headers:{Authorization:`Bearer ${s.access_token}`},body:JSON.stringify({password:p1})});
        const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.msg||data.message||'Não foi possível definir a senha.');
        await oldFetch('/api/auth/first-access-complete',{method:'POST',headers:{Authorization:`Bearer ${s.access_token}`,'Content-Type':'application/json'},body:'{}'}).catch(()=>{});
        await loadProfile();closeAuthModal();showApp();
      }catch(err){msg.textContent=err.message;btn.disabled=false;btn.textContent='Salvar senha e entrar';}
    };
  }

  window.login=async function(){
    const email=document.getElementById('loginEmail')?.value.trim().toLowerCase()||'';
    const password=document.getElementById('loginPass')?.value||'';
    if(!email||!password){setLoginError('Informe e-mail e senha.');return;}
    setLoginError('Entrando...','#64748b');
    try{
      const r=await directSupabase('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})});
      const data=await r.json().catch(()=>({}));
      if(!r.ok||!data.access_token)throw new Error('E-mail ou senha inválidos.');
      saveSession(data);await loadProfile();setLoginError('');showApp();
    }catch(err){clearSession();forceLogin();setLoginError(err.message||'Não foi possível entrar.','#b91c1c');}
  };

  window.logout=async function(){
    try{
      const s=await ensureFreshSession();
      if(s?.access_token)await directSupabase('/auth/v1/logout',{method:'POST',headers:{Authorization:`Bearer ${s.access_token}`},body:'{}'});
    }catch(_){ }
    clearSession();forceLogin();
  };

  function parseAuthCallback(){
    const hash=new URLSearchParams(location.hash.replace(/^#/,''));
    const access=hash.get('access_token');
    if(!access)return null;
    saveSession({access_token:access,refresh_token:hash.get('refresh_token')||'',expires_in:Number(hash.get('expires_in')||3600),token_type:hash.get('token_type')||'bearer'});
    const type=hash.get('type')||'recovery';
    history.replaceState({},document.title,location.pathname+location.search);
    return type;
  }

  async function boot(){
    forceLogin();addLoginLinks();
    try{
      const cr=await oldFetch('/api/auth/config',{cache:'no-store'});cfg=await cr.json();
      if(!cr.ok||!cfg.configured)throw new Error('Login ainda não configurado.');
      const callbackType=parseAuthCallback();
      session=readSession();
      if(callbackType&&session?.access_token){
        readyResolve();
        showPasswordSetup(callbackType);
        return;
      }
      if(session?.access_token){
        try{await loadProfile();showApp();}catch(_){clearSession();forceLogin();}
      }
      readyResolve();
    }catch(err){
      setLoginError(err.message||'Falha ao iniciar autenticação.','#b91c1c');
      readyReject(err);
    }
  }

  clearTimeout(window.__brAuthBootTimer);
  window.__brAuthBootTimer=setTimeout(boot,0);
})();
