(function(){
  const KEY='brcondos_deletedBoletoKeys';
  const SEEDED=['source:pdf-2026-08-ADM-GIARDINO-2301.80-10-'];

  function deleteKey(b){
    const source=String(b?.sourceKey||'').trim();
    if(source)return 'source:'+source;
    const id=String(b?.id??'').trim();
    return id?'id:'+id:'';
  }
  function readDeleted(){
    let arr=[];
    try{arr=JSON.parse(localStorage.getItem(KEY)||'[]');}catch(_){arr=[];}
    if(!Array.isArray(arr))arr=[];
    return [...new Set([...SEEDED,...arr.map(String)].filter(Boolean))];
  }
  function persistDeleted(arr){
    const clean=[...new Set((Array.isArray(arr)?arr:[]).map(String).filter(Boolean))];
    try{localStorage.setItem(KEY,JSON.stringify(clean));}catch(_){}
    try{if(typeof saveData==='function')saveData('deletedBoletoKeys',clean);}catch(e){console.error('BOLETO TOMBSTONES',e);}
    return clean;
  }
  function applyDeleted({persist=false}={}){
    if(typeof boletos==='undefined'||!Array.isArray(boletos))return false;
    const deleted=new Set(readDeleted());
    const before=boletos.length;
    boletos=boletos.filter(b=>!deleted.has(deleteKey(b)));
    const changed=boletos.length!==before;
    if(changed&&persist){
      try{if(typeof saveData==='function')saveData('boletos',boletos);}catch(e){console.error('REMOVE BOLETO EXCLUIDO',e);}
    }
    return changed;
  }

  persistDeleted(readDeleted());
  applyDeleted({persist:true});

  window.delBoleto=function(id){
    if(typeof boletos==='undefined'||!Array.isArray(boletos))return;
    const b=boletos.find(x=>String(x?.id)===String(id));
    if(!b)return;
    if(!confirm('Excluir este boleto?'))return;

    const key=deleteKey(b);
    if(key){
      const deleted=readDeleted();
      deleted.push(key);
      persistDeleted(deleted);
    }

    boletos=boletos.filter(x=>String(x?.id)!==String(id));
    try{if(typeof saveData==='function')saveData('boletos',boletos);}catch(e){console.error('EXCLUIR BOLETO',e);}
    try{renderAll();}catch(_){}
  };

  const oldRender=window.renderBoletos;
  if(typeof oldRender==='function'){
    window.renderBoletos=function(){
      applyDeleted({persist:false});
      return oldRender.apply(this,arguments);
    };
  }
})();