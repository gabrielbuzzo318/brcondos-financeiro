(function(){
  const STORAGE_KEY='brcondos_filter_state_v1';
  let restoring=false;
  let scheduled=false;

  function loadState(){
    try{return JSON.parse(sessionStorage.getItem(STORAGE_KEY)||'{}')||{}}catch(_){return {}}
  }
  function saveState(state){
    try{sessionStorage.setItem(STORAGE_KEY,JSON.stringify(state))}catch(_){ }
  }
  function isFilterField(el){
    return !!(el&&el.id&&el.closest&&el.closest('.filter-bar')&&/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName));
  }
  function remember(el){
    if(restoring||!isFilterField(el))return;
    const state=loadState();
    state[el.id]=String(el.value??'');
    saveState(state);
  }
  function clearBar(bar){
    if(!bar)return;
    const state=loadState();
    bar.querySelectorAll('input[id],select[id],textarea[id]').forEach(el=>delete state[el.id]);
    saveState(state);
  }
  function restoreFilters(){
    scheduled=false;
    const state=loadState();
    let changed=[];
    restoring=true;
    try{
      document.querySelectorAll('.filter-bar input[id],.filter-bar select[id],.filter-bar textarea[id]').forEach(el=>{
        if(!Object.prototype.hasOwnProperty.call(state,el.id))return;
        const wanted=String(state[el.id]??'');
        if(String(el.value??'')===wanted)return;
        el.value=wanted;
        changed.push(el);
      });
    }finally{restoring=false;}

    changed.forEach(el=>{
      try{
        const type=(el.tagName==='INPUT'&&(el.type==='text'||el.type==='search'))?'input':'change';
        el.dispatchEvent(new Event(type,{bubbles:true}));
      }catch(_){ }
    });
  }
  function scheduleRestore(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>requestAnimationFrame(restoreFilters));
  }

  document.addEventListener('input',e=>remember(e.target),true);
  document.addEventListener('change',e=>remember(e.target),true);
  document.addEventListener('click',e=>{
    const btn=e.target?.closest?.('button');
    if(!btn)return;
    const text=String(btn.textContent||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    if(text.includes('limpar')&&btn.closest('.filter-bar')) clearBar(btn.closest('.filter-bar'));
  },true);

  const obs=new MutationObserver(scheduleRestore);
  obs.observe(document.documentElement,{childList:true,subtree:true});

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scheduleRestore,{once:true});
  else scheduleRestore();
})();
