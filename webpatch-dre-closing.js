(function(){
  const STORAGE_KEY='brcondos_dre_closures_v1';
  const escHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function readState(){
    try{
      const raw=localStorage.getItem(STORAGE_KEY);
      const parsed=raw?JSON.parse(raw):{};
      return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{};
    }catch(_){return {};}
  }

  function writeState(state){
    localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
    try{
      if(typeof saveData==='function')saveData('dreClosures',state);
    }catch(_){ }
  }

  function currentPrefix(){
    return String(document.getElementById('dre_month')?.value||'').trim();
  }

  function periodLabel(prefix){
    const [y,m]=String(prefix||'').split('-').map(Number);
    const names=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    return `${names[(m||1)-1]||''}/${y||''}`;
  }

  function canManageClosing(){
    if(typeof window.brcondosIsReadOnly==='function')return !window.brcondosIsReadOnly();
    return false;
  }

  function ensureStyles(){
    if(document.getElementById('dre-closing-styles'))return;
    const style=document.createElement('style');
    style.id='dre-closing-styles';
    style.textContent=`
      #view-dre .dre-closing-title{
        display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;
      }
      #view-dre .dre-closing-actions{
        display:inline-flex;align-items:center;gap:7px;margin-left:auto;
      }
      #view-dre .dre-closing-badge{
        display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 9px;border-radius:999px;
        font-size:11px;font-weight:900;white-space:nowrap;border:1px solid transparent;
      }
      #view-dre .dre-closing-badge::before{content:'';width:7px;height:7px;border-radius:999px;background:currentColor}
      #view-dre .dre-closing-badge.open{color:#b52b2b;background:#fff1f1;border-color:#efaaaa}
      #view-dre .dre-closing-badge.closed{color:#19743a;background:#edf9f1;border-color:#8bd2a0}
      #view-dre .dre-closing-btn{
        height:30px;padding:0 10px;border-radius:8px;border:1px solid #d7dee3;background:#fff;color:#33424c;
        font-size:12px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;
        transition:.15s ease;white-space:nowrap;
      }
      #view-dre .dre-closing-btn:hover{background:#f6f8f9;border-color:#c6d0d7}
      #view-dre .dre-closing-btn.finish{color:#19743a;border-color:#a8d7b6;background:#f8fcf9}
      #view-dre .dre-closing-btn.reopen{color:#7a5b19;border-color:#e4d2a6;background:#fffaf0}
      #view-dre .card.dre-period-open{box-shadow:inset 0 3px 0 #d85b5b}
      #view-dre .card.dre-period-closed{box-shadow:inset 0 3px 0 #3aa35a}
      @media(max-width:650px){
        #view-dre .dre-closing-actions{width:100%;justify-content:flex-start;margin-left:0}
      }
    `;
    document.head.appendChild(style);
  }

  function applyStatus(){
    ensureStyles();
    const prefix=currentPrefix();
    if(!/^\d{4}-\d{2}$/.test(prefix))return;
    const view=document.getElementById('view-dre');
    const demo=view?.querySelector('.grid.two-cols > .card');
    const title=demo?.querySelector(':scope > .panel-title');
    if(!demo||!title)return;

    const state=readState();
    const closed=state[prefix]?.closed===true;
    const baseTitle=`Demonstrativo — ${periodLabel(prefix)}`;
    const canManage=canManageClosing();

    demo.classList.toggle('dre-period-closed',closed);
    demo.classList.toggle('dre-period-open',!closed);
    title.classList.add('dre-closing-title');
    title.innerHTML=`
      <span>${escHtml(baseTitle)}</span>
      <span class="dre-closing-actions">
        <span class="dre-closing-badge ${closed?'closed':'open'}">${closed?'Concluída':'Em fechamento'}</span>
        ${canManage?`<button type="button" class="dre-closing-btn ${closed?'reopen':'finish'}" onclick="toggleDreClosing()">${closed?'Reabrir':'Concluir'}</button>`:''}
      </span>`;
  }

  window.toggleDreClosing=function(){
    if(!canManageClosing()){
      return alert('Você não tem permissão para concluir ou reabrir a DRE.');
    }
    const prefix=currentPrefix();
    if(!/^\d{4}-\d{2}$/.test(prefix))return;
    const state=readState();
    const wasClosed=state[prefix]?.closed===true;

    if(wasClosed){
      state[prefix]={...(state[prefix]||{}),closed:false,reopenedAt:new Date().toISOString()};
    }else{
      state[prefix]={...(state[prefix]||{}),closed:true,concludedAt:new Date().toISOString()};
    }
    writeState(state);
    applyStatus();
  };

  const oldRenderDRE=window.renderDRE;
  if(typeof oldRenderDRE==='function'){
    window.renderDRE=function(){
      const out=oldRenderDRE.apply(this,arguments);
      setTimeout(applyStatus,0);
      return out;
    };
  }

  setTimeout(applyStatus,0);
})();