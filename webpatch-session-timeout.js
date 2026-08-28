(function(){
  const INACTIVITY_MS=30*60*1000;
  const CHECK_EVERY_MS=15000;
  const STORAGE_KEY='brcondos_last_activity_v1';
  let lastActivity=Date.now();
  let lastRecordedAt=0;
  let loggingOut=false;

  try{
    const saved=Number(sessionStorage.getItem(STORAGE_KEY)||0);
    if(Number.isFinite(saved)&&saved>0)lastActivity=saved;
  }catch(_){ }

  function recordActivity(force=false){
    if(loggingOut)return;
    const now=Date.now();
    // Evita gravar no sessionStorage centenas de vezes por segundo em mousemove/scroll.
    if(!force&&now-lastRecordedAt<3000){
      lastActivity=now;
      return;
    }
    lastActivity=now;
    lastRecordedAt=now;
    try{sessionStorage.setItem(STORAGE_KEY,String(now));}catch(_){ }
  }

  async function logoutInactive(){
    if(loggingOut)return;
    loggingOut=true;
    try{sessionStorage.removeItem(STORAGE_KEY);}catch(_){ }
    try{
      await fetch('/api/auth/logout',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:'{}',
        keepalive:true
      });
    }catch(_){ }
    try{localStorage.removeItem('brcondos_session');}catch(_){ }
    location.replace('/login');
  }

  function checkInactivity(){
    if(loggingOut)return;
    const now=Date.now();
    if(now-lastActivity>=INACTIVITY_MS)logoutInactive();
  }

  ['pointerdown','keydown','touchstart','scroll','mousemove'].forEach(eventName=>{
    window.addEventListener(eventName,()=>recordActivity(false),{passive:true,capture:true});
  });

  window.addEventListener('focus',()=>{
    checkInactivity();
    if(!loggingOut)recordActivity(true);
  });

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'){
      checkInactivity();
      if(!loggingOut)recordActivity(true);
    }
  });

  recordActivity(true);
  setInterval(checkInactivity,CHECK_EVERY_MS);
})();