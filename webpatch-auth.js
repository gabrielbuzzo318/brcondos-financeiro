(function(){
  localStorage.removeItem('brcondos_session');
  localStorage.removeItem('brcondos_auth_session_v2');

  const oldFetch=window.fetch.bind(window);
  const oldSaveData=typeof window.saveData==='function'?window.saveData:null;
  let profile=null;
  let setupMode=false;

  function isReadOnly(){return profile?.access_level==='consulta';}
  window.brcondosIsReadOnly=isReadOnly;

  function normalizeText(v){
    return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  }

  function hideClosestNotice(el){
    if(!el)return;
    const box=el.closest('.notice,.alert,.info-box,.card,.panel,[class*="notice"],[class*="alert"],[class*="hint"],[class*="tip"]')||el;
    box.style.display='none';
  }

  function cleanGlobalNotices(){
    const targets=[
      'simples de manter: voce pode criar quantas contas quiser. elas passam a aparecer automaticamente nos cadastros financeiros.',
      'dre gerencial. o plano de contas pode ser ajustado depois para ficar exatamente igual ao formato usado pela brcondos.'
    ];
    document.querySelectorAll('#app *').forEach(el=>{
      if(el.children.length>8)return;
      const text=normalizeText(el.textContent);
      if(targets.some(t=>text.includes(t))) hideClosestNotice(el);
    });
    document.getElementById('brReadOnlyBanner')?.remove();
  }

  function showApp(){
    document.getElementById('loginScreen')?.classList.add('hidden');
    document.getElementById('app')?.classList.remove('hidden');
    const mini=document.getElementById('userEmailMini');
    if(mini&&profile) mini.textContent=setupMode?'Configuração • Completo':`${profile.full_name} • ${isReadOnly()?'Consulta':'Completo'}`;
    applyAccessMode();
    try{if(typeof renderAll==='function')renderAll();}catch(_){ }
    cleanGlobalNotices();
  }

  function goLogin(){location.replace('/login');}

  window.fetch=async function(input,init={}){
    const res=await oldFetch(input,init);
    try{
      const u=new URL(typeof input==='string'?input:input.url,location.href);
      if(!setupMode&&u.origin===location.origin&&u.pathname.startsWith('/api/')&&res.status===401&&!u.pathname.startsWith('/api/auth/')){
        setTimeout(goLogin,0);
      }
    }catch(_){ }
    return res;
  };

  window.login=goLogin;
  window.logout=async function(){
    if(setupMode){
      alert('O login definitivo será ativado assim que o domínio for conectado.');
      return;
    }
    try{await oldFetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});}catch(_){ }
    localStorage.removeItem('brcondos_session');
    goLogin();
  };

  if(oldSaveData){
    window.saveData=function(){
      if(isReadOnly()){
        alert('Acesso somente para consulta. Nenhuma alteração é permitida para este usuário.');
        return;
      }
      return oldSaveData.apply(this,arguments);
    };
  }

  const mutationText=/\b(novo|nova|criar|adicionar|editar|excluir|apagar|salvar|emitir|registrar|receber|pagar|agendar|finalizar|sincronizar|configurar|importar|atualizar giss|atualizar dados|cancelar nf|cancelar boleto)\b/i;
  const mutationOnclick=/(save|delete|remove|receive|pay|schedule|emit|emitir|registr|finaliz|sync|cancelNf|cancelBoleto|openParty|openPayable|openTransaction|openReimbursement|quickCreate|config|import)/i;

  function restrictedReadOnlyControl(el){
    const text=normalizeText(el?.textContent);
    return text.includes('criar recibo')||text.includes('configurar mes')||text.includes('importar pdf mensal');
  }

  function mutationButton(el){
    if(!el||!el.closest('#app'))return false;
    if(restrictedReadOnlyControl(el))return true;
    const text=String(el.textContent||'').trim();
    const oc=String(el.getAttribute?.('onclick')||'');
    if(/pdf|imprimir|visualizar|consultar|pesquisar|filtrar/i.test(text))return false;
    return mutationText.test(text)||mutationOnclick.test(oc);
  }

  function lockReadOnlyControls(){
    if(!isReadOnly())return;
    document.querySelectorAll('#app button,#app a[onclick],#app a').forEach(el=>{
      if(restrictedReadOnlyControl(el)){
        el.dataset.brReadOnly='1';
        el.style.display='none';
        return;
      }
      if(mutationButton(el)){
        el.dataset.brReadOnly='1';
        if('disabled' in el) el.disabled=true;
        el.style.opacity='.45';
        el.style.cursor='not-allowed';
        el.title='Acesso somente para consulta';
      }
    });
  }

  document.addEventListener('click',function(e){
    if(!isReadOnly())return;
    const el=e.target.closest('button,a[onclick],a');
    if(mutationButton(el)){
      e.preventDefault();e.stopImmediatePropagation();
      alert('Acesso somente para consulta. Nenhuma alteração é permitida para este usuário.');
    }
  },true);

  function applyAccessMode(){
    document.body.classList.toggle('br-readonly',isReadOnly());
    document.getElementById('brReadOnlyBanner')?.remove();
    cleanGlobalNotices();
    if(isReadOnly()) lockReadOnlyControls();
  }

  const observer=new MutationObserver(()=>{
    cleanGlobalNotices();
    if(isReadOnly())lockReadOnlyControls();
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});

  async function boot(){
    document.getElementById('loginScreen')?.classList.add('hidden');
    document.getElementById('app')?.classList.add('hidden');
    try{
      const cr=await oldFetch('/api/auth/config',{cache:'no-store'});
      const cfg=await cr.json().catch(()=>({}));
      if(!cr.ok||!cfg.configured) throw new Error('Login ainda não configurado.');
      if(!cfg.publicUrlConfigured){
        setupMode=true;
        profile={full_name:'Configuração',email:'configuracao@local',access_level:'admin',first_access_required:false,setup_mode:true};
        return showApp();
      }
      const r=await oldFetch('/api/auth/me',{cache:'no-store'});
      const data=await r.json().catch(()=>({}));
      if(!r.ok) return goLogin();
      profile=data;
      showApp();
    }catch(_){goLogin();}
  }

  setTimeout(boot,0);
})();
