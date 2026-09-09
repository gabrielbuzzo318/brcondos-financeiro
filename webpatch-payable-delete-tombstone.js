(function(){
  const STORAGE_KEY='brcondos_deletedPayableSourceKeys';
  const seedDeleted=['resultxls-001','resultxls-002','resultxls-003','resultxls-008'];

  function readDeleted(){
    let arr=[];
    try{arr=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');}catch(_){arr=[];}
    if(!Array.isArray(arr))arr=[];
    return [...new Set([...seedDeleted,...arr.map(String)])];
  }

  function saveDeleted(arr){
    const clean=[...new Set((Array.isArray(arr)?arr:[]).map(String).filter(Boolean))];
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(clean));}catch(_){ }
    try{if(typeof saveData==='function')saveData('deletedPayableSourceKeys',clean);}catch(e){console.error('BRCONDOS TOMBSTONES',e);}
    return clean;
  }

  function applyDeleted(){
    if(typeof payables==='undefined'||!Array.isArray(payables))return false;
    const deleted=new Set(readDeleted());
    const before=payables.length;
    payables=payables.filter(p=>!p?.sourceKey||!deleted.has(String(p.sourceKey)));
    if(payables.length!==before){
      try{saveData('payables',payables);}catch(e){console.error('BRCONDOS REMOVE IMPORTADOS EXCLUIDOS',e);}
      return true;
    }
    return false;
  }

  saveDeleted(readDeleted());
  applyDeleted();

  window.delPayable=function(id){
    if(typeof payables==='undefined'||!Array.isArray(payables))return;
    const p=payables.find(x=>String(x?.id)===String(id));
    if(!p)return;
    if(!confirm('Excluir esta conta a pagar?'))return;

    if(p.sourceKey){
      const deleted=readDeleted();
      deleted.push(String(p.sourceKey));
      saveDeleted(deleted);
    }

    payables=payables.filter(x=>x!==p);
    try{saveData('payables',payables);}catch(e){console.error('BRCONDOS EXCLUIR CONTA',e);}
    try{renderAll();}catch(_){ }
  };

  const prevRenderFinanceiro=window.renderFinanceiro;
  if(typeof prevRenderFinanceiro==='function'){
    window.renderFinanceiro=function(){
      applyDeleted();
      return prevRenderFinanceiro.apply(this,arguments);
    };
  }
})();
