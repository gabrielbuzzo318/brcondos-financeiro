(function(){
  localStorage.removeItem('brcondos_session');
  localStorage.removeItem('brcondos_auth_session_v2');

  const oldFetch=window.fetch.bind(window);
  const oldSaveData=typeof window.saveData==='function'?window.saveData:null;
  const SHARED_REV='brcondos_shared_rev_v1';
  const SHARED_SEED_EMAIL='bpobrcondos@gmail.com';
  const LOCAL_EXACT_SKIP=new Set(['brcondos_session','brcondos_auth_session_v2']);
  let profile=null;
  let setupMode=false;
  let pushTimer=null;
  let watchTimer=null;
  let pendingSharedState=null;

  function isReadOnly(){return profile?.access_level==='consulta';}
  function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();}
  function isContabilidade(){return String(profile?.email||'').toLowerCase()==='contabil01@logucomarc.com.br';}
  function canOpenAPagar(){
    const email=String(profile?.email||'').toLowerCase();
    return email==='antonio@zacchi.com.br'||email==='marco.dosualdo@brcondos.com'||email==='contabil01@logucomarc.com.br';
  }
  function shouldShareKey(key){
    const k=String(key||'');
    if(!k||LOCAL_EXACT_SKIP.has(k))return false;
    if(k.startsWith('sb-'))return false;
    return true;
  }
  function captureStorage(){
    const storage={};
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(!shouldShareKey(key))continue;
      storage[key]=localStorage.getItem(key);
    }
    return storage;
  }
  function applyStorage(storage){
    if(!storage||typeof storage!=='object'||Array.isArray(storage))return false;
    const remove=[];
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(shouldShareKey(key))remove.push(key);
    }
    remove.forEach(key=>localStorage.removeItem(key));
    Object.entries(storage).forEach(([key,value])=>{
      if(!shouldShareKey(key)||value==null)return;
      localStorage.setItem(key,String(value));
    });
    return true;
  }
  async function readSharedState(){
    const r=await oldFetch('/api/state',{cache:'no-store'});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||'Não foi possível carregar a base compartilhada.');
    return d;
  }

  function removeSharedUpdateNotice(){
    document.getElementById('brSharedUpdateNotice')?.remove();
  }

  function isOwnSharedUpdate(shared){
    const me=String(profile?.id||'');
    const by=String(shared?.updated_by||'');
    return !!me && !!by && me===by;
  }

  function applyPendingSharedUpdate(){
    const shared=pendingSharedState;
    if(!shared)return;
    const storage=shared?.data?.storage;
    const rev=String(shared?.updated_at||'');
    if(!storage||typeof storage!=='object')return;
    if(!applyStorage(storage))return;
    if(rev)sessionStorage.setItem(SHARED_REV,rev);
    pendingSharedState=null;
    removeSharedUpdateNotice();
    location.reload();
  }
  window.brcondosApplySharedUpdate=applyPendingSharedUpdate;

  function showSharedUpdateNotice(shared){
    pendingSharedState=shared;
    let box=document.getElementById('brSharedUpdateNotice');
    if(!box){
      box=document.createElement('div');
      box.id='brSharedUpdateNotice';
      box.style.cssText='position:fixed;right:22px;top:88px;z-index:9999;max-width:390px;background:#fff;border:1px solid #d9e1e6;border-left:4px solid #43b4df;border-radius:10px;box-shadow:0 12px 35px rgba(20,40,55,.18);padding:13px 14px;font-family:Inter,Segoe UI,Arial,sans-serif;color:#26343c;';
      box.innerHTML='<div style="font-size:12px;font-weight:800;margin-bottom:4px">Há dados novos no sistema</div><div style="font-size:11px;color:#687780;line-height:1.4;margin-bottom:10px">Outra sessão fez uma alteração. A página não será mais atualizada sozinha. Clique abaixo quando puder atualizar os dados.</div><button type="button" style="border:0;border-radius:7px;background:#43b4df;color:white;padding:8px 11px;font-size:11px;font-weight:800;cursor:pointer" onclick="brcondosApplySharedUpdate()">Atualizar dados agora</button>';
      document.body.appendChild(box);
    }
  }

  async function pushSharedState(){
    if(setupMode||isReadOnly()||!profile)return null;
    const storage=captureStorage();
    if(!Object.keys(storage).length)return null;
    const r=await oldFetch('/api/state',{
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({data:{version:1,storage}})
    });
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||'Não foi possível salvar a base compartilhada.');
    if(d.updated_at)sessionStorage.setItem(SHARED_REV,String(d.updated_at));
    pendingSharedState=null;
    removeSharedUpdateNotice();
    return d;
  }
  function scheduleSharedPush(){
    if(setupMode||isReadOnly()||!profile)return;
    clearTimeout(pushTimer);
    pushTimer=setTimeout(()=>{pushSharedState().catch(err=>console.error('BRCONDOS SYNC SAVE:',err));},350);
  }
  async function hydrateSharedState(){
    if(setupMode||!profile)return false;
    const shared=await readSharedState();
    if(!shared.exists){
      if(String(profile.email||'').toLowerCase()===SHARED_SEED_EMAIL&&!isReadOnly()){
        await pushSharedState();
      }
      return false;
    }
    const rev=String(shared.updated_at||'');
    if(rev&&sessionStorage.getItem(SHARED_REV)===rev)return false;
    const storage=shared?.data?.storage;
    if(!storage||typeof storage!=='object')return false;
    if(!applyStorage(storage))return false;
    if(rev)sessionStorage.setItem(SHARED_REV,rev);
    location.reload();
    return true;
  }
  async function checkSharedUpdate(){
    if(setupMode||!profile||document.visibilityState!=='visible')return;
    try{
      const shared=await readSharedState();
      if(!shared.exists)return;
      const rev=String(shared.updated_at||'');
      if(!rev||sessionStorage.getItem(SHARED_REV)===rev)return;

      // Alterações feitas pelo próprio usuário/sessão nunca devem provocar reload.
      if(isOwnSharedUpdate(shared)){
        sessionStorage.setItem(SHARED_REV,rev);
        pendingSharedState=null;
        removeSharedUpdateNotice();
        return;
      }

      const storage=shared?.data?.storage;
      if(!storage||typeof storage!=='object')return;

      // Alterações de outra sessão ficam pendentes e só são aplicadas por ação do usuário.
      // Isso evita perder formulários, lançamentos ou a posição atual por um reload inesperado.
      showSharedUpdateNotice(shared);
    }catch(err){console.error('BRCONDOS SYNC LOAD:',err);}
  }
  function startSharedWatch(){
    if(watchTimer)return;
    watchTimer=setInterval(checkSharedUpdate,20000);
    window.addEventListener('focus',checkSharedUpdate);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')checkSharedUpdate();});
  }

  window.brcondosIsReadOnly=isReadOnly;

  function showApp(){
    document.getElementById('loginScreen')?.classList.add('hidden');
    document.getElementById('app')?.classList.remove('hidden');
    const mini=document.getElementById('userEmailMini');
    if(mini&&profile) mini.textContent=setupMode?'Configuração • Completo':`${profile.full_name} • ${isReadOnly()?'Consulta':'Completo'}`;
    applyAccessMode();
    try{if(typeof renderAll==='function')renderAll();}catch(_){ }
    cleanUi();
    startSharedWatch();
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
      const result=oldSaveData.apply(this,arguments);
      scheduleSharedPush();
      return result;
    };
  }

  const mutationText=/\b(novo|nova|adicionar|editar|excluir|apagar|salvar|emitir|registrar|receber|pagar|agendar|finalizar|sincronizar|atualizar giss|atualizar dados|cancelar nf|cancelar boleto)\b/i;
  const mutationOnclick=/(save|delete|remove|receive|pay|schedule|emit|emitir|registr|finaliz|sync|cancelNf|cancelBoleto|openParty|openPayable|openTransaction|openReimbursement|quickCreate)/i;

  function mutationButton(el){
    if(!el||!el.closest('#app'))return false;
    const text=String(el.textContent||'').trim();
    const n=norm(text);
    const oc=String(el.getAttribute?.('onclick')||'');
    if(canOpenAPagar()&&n==='a pagar')return false;
    if(/pdf|imprimir|visualizar|consultar|pesquisar|filtrar/i.test(text))return false;
    return mutationText.test(text)||mutationOnclick.test(oc);
  }

  function hideReadOnlyOnlyButtons(){
    if(!isReadOnly())return;
    const exactPhrases=['criar recibo','configurar mes','importar pdf mensal'];
    document.querySelectorAll('#app button,#app a').forEach(el=>{
      const t=norm(el.textContent);
      if(exactPhrases.some(p=>t===p||t.endsWith(' '+p)||t.includes(p))){
        el.style.display='none';
        el.dataset.brHiddenConsulta='1';
      }
    });
  }

  function restrictContabilidadeTabs(){
    if(!isContabilidade())return;
    const allowed=new Set(['a pagar','fluxo de caixa','sair','logout']);
    const navRoots=[...document.querySelectorAll('#app nav,#app aside,#app .sidebar,#app [class*="sidebar"],#app [class*="menu"]')];
    navRoots.forEach(root=>{
      root.querySelectorAll('button,a,[role="button"]').forEach(el=>{
        const t=norm(el.textContent);
        if(!t)return;
        if(allowed.has(t)){
          el.style.display='';
          el.dataset.brContabilidadeAllowed='1';
          return;
        }
        if(t.includes('a pagar')||t.includes('fluxo de caixa')){
          el.style.display='';
          el.dataset.brContabilidadeAllowed='1';
          return;
        }
        el.style.display='none';
        el.dataset.brHiddenContabilidade='1';
      });
    });
  }

  function hideNoticeByPhrase(phrase){
    const candidates=[...document.querySelectorAll('#app p,#app div,#app span,#app aside,#app small')]
      .filter(el=>norm(el.textContent).includes(phrase))
      .sort((a,b)=>norm(a.textContent).length-norm(b.textContent).length);
    const hit=candidates[0];
    if(!hit)return;
    let target=hit;
    const decorated=hit.closest('[style*="background"],[class*="notice"],[class*="alert"],[class*="hint"],[class*="info"],[class*="banner"]');
    if(decorated&&decorated.closest('#app')) target=decorated;
    target.style.display='none';
    target.dataset.brHiddenNotice='1';
  }

  function cleanUi(){
    document.getElementById('brReadOnlyBanner')?.remove();
    hideNoticeByPhrase('simples de manter: voce pode criar quantas contas quiser. elas passam a aparecer automaticamente nos cadastros financeiros.');
    hideNoticeByPhrase('dre gerencial. o plano de contas pode ser ajustado depois para ficar exatamente igual ao formato usado pela brcondos.');
    if(isReadOnly()) hideReadOnlyOnlyButtons();
    restrictContabilidadeTabs();
  }

  function lockReadOnlyControls(){
    if(!isReadOnly())return;
    hideReadOnlyOnlyButtons();
    document.querySelectorAll('#app button,#app a[onclick]').forEach(el=>{
      const n=norm(el.textContent);
      if(canOpenAPagar()&&n==='a pagar'){
        el.disabled=false;
        el.style.opacity='';
        el.style.cursor='';
        el.title='';
        delete el.dataset.brReadOnly;
        return;
      }
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
    if(!el)return;
    if(canOpenAPagar()&&norm(el.textContent)==='a pagar')return;
    if(mutationButton(el)){
      e.preventDefault();e.stopImmediatePropagation();
      alert('Acesso somente para consulta. Nenhuma alteração é permitida para este usuário.');
    }
  },true);

  function applyAccessMode(){
    document.body.classList.toggle('br-readonly',isReadOnly());
    document.getElementById('brReadOnlyBanner')?.remove();
    cleanUi();
    if(isReadOnly())lockReadOnlyControls();
  }

  const observer=new MutationObserver(()=>{
    cleanUi();
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
      const reloading=await hydrateSharedState();
      if(reloading)return;
      showApp();
    }catch(err){
      console.error('BRCONDOS BOOT:',err);
      goLogin();
    }
  }

  setTimeout(boot,0);
})();
