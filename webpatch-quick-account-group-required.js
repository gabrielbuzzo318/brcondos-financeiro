(function(){
  const collator=new Intl.Collator('pt-BR',{sensitivity:'base',numeric:true});
  const clean=v=>String(v||'').trim();
  const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ');

  function ensureStyles(){
    if(document.getElementById('br-quick-account-style'))return;
    const s=document.createElement('style');
    s.id='br-quick-account-style';
    s.textContent=`
      .br-quick-account-overlay{position:fixed;inset:0;z-index:99999;background:rgba(18,25,30,.48);display:grid;place-items:center;padding:18px}
      .br-quick-account-box{width:min(480px,100%);background:#fff;border-radius:14px;box-shadow:0 24px 60px rgba(0,0,0,.22);padding:20px}
      .br-quick-account-box h3{margin:0 0 4px;font-size:17px;color:#24323a}
      .br-quick-account-box .sub{font-size:11px;color:#7b8992;margin-bottom:16px}
      .br-quick-account-box label{display:block;font-size:11px;font-weight:800;color:#66747e;margin:12px 0 5px}
      .br-quick-account-box input,.br-quick-account-box select{width:100%;height:42px;border:1px solid #d9e0e4;border-radius:8px;padding:0 11px;background:#fff;color:#26343c}
      .br-quick-account-box .req{color:#d34a4a}
      .br-quick-account-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}
    `;
    document.head.appendChild(s);
  }

  function groupsFor(type){
    const set=new Set();
    try{
      (Array.isArray(chartAccounts)?chartAccounts:[]).forEach(a=>{
        if(type&&a?.type!==type)return;
        const g=clean(a?.group);
        if(g&&norm(g)!=='sem grupo')set.add(g);
      });
    }catch(_){ }
    return [...set].sort(collator.compare);
  }

  function setTargetValue(targetId,type,name){
    const target=document.getElementById(targetId);
    if(!target)return;
    if(target.tagName==='SELECT'){
      if(typeof accountOptions==='function')target.innerHTML=accountOptions(type,name);
      else if(![...target.options].some(o=>o.value===name)){
        const o=document.createElement('option');o.value=name;o.textContent=name;target.appendChild(o);
      }
      target.value=name;
    }else{
      target.value=name;
      if(typeof window.refreshTransactionAccountOptions==='function')window.refreshTransactionAccountOptions();
      target.value=name;
    }
    target.dispatchEvent(new Event('change',{bubbles:true}));
  }

  window.quickCreateAccount=function(type,targetSelectId){
    ensureStyles();
    document.querySelector('.br-quick-account-overlay')?.remove();

    const groups=groupsFor(type);
    const overlay=document.createElement('div');
    overlay.className='br-quick-account-overlay';
    overlay.innerHTML=`
      <div class="br-quick-account-box" role="dialog" aria-modal="true" aria-label="Nova conta do plano">
        <h3>Nova conta do plano</h3>
        <div class="sub">A conta será adicionada ao Plano de Contas e ficará disponível nos lançamentos.</div>
        <label>Nome da conta <span class="req">*</span></label>
        <input id="br_quick_account_name" autocomplete="off" placeholder="Ex.: Honorários jurídicos">
        <label>Grupo <span class="req">*</span></label>
        <select id="br_quick_account_group" required>
          <option value="">Selecione um grupo...</option>
          ${groups.map(g=>`<option value="${String(g).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')}">${String(g).replace(/&/g,'&amp;').replace(/</g,'&lt;')}</option>`).join('')}
        </select>
        <div class="br-quick-account-actions">
          <button type="button" class="btn" id="br_quick_account_cancel">Cancelar</button>
          <button type="button" class="btn primary" id="br_quick_account_save">Salvar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const close=()=>overlay.remove();
    overlay.querySelector('#br_quick_account_cancel').onclick=close;
    overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
    const nameInput=overlay.querySelector('#br_quick_account_name');
    const groupSelect=overlay.querySelector('#br_quick_account_group');

    overlay.querySelector('#br_quick_account_save').onclick=()=>{
      const name=clean(nameInput.value);
      const group=clean(groupSelect.value);
      if(!name){nameInput.focus();return alert('Informe o nome da conta.');}
      if(!group){groupSelect.focus();return alert('Selecione o grupo da conta. O grupo é obrigatório.');}

      const existing=(chartAccounts||[]).find(a=>norm(a?.name)===norm(name));
      if(existing){
        if(existing.type!==type)return alert('Já existe uma conta com esse nome em outro tipo de lançamento.');
        setTargetValue(targetSelectId,type,existing.name);
        close();
        return;
      }

      const obj={id:Date.now(),code:'',name,type,group,dre:true};
      chartAccounts.push(obj);
      if(typeof saveData==='function')saveData('chartAccounts',chartAccounts);
      setTargetValue(targetSelectId,type,obj.name);
      if(typeof renderChartAccounts==='function')setTimeout(()=>renderChartAccounts(),0);
      close();
    };

    setTimeout(()=>nameInput.focus(),0);
  };
})();
