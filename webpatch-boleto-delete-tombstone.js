(function(){
  function deleteKeyForBoleto(b){
    const source=String(b?.sourceKey||'').trim();
    if(source)return 'source:'+source;
    const id=String(b?.id??'').trim();
    return id?'id:'+id:'';
  }
  function getDeletedKeys(){
    try{
      const raw=localStorage.getItem('brcondos_deletedBoletoKeys');
      const arr=raw?JSON.parse(raw):[];
      return Array.isArray(arr)?arr.map(String):[];
    }catch(_){return [];}
  }
  function persistDeletedKey(key){
    if(!key)return;
    const keys=[...new Set([...getDeletedKeys(),key])];
    localStorage.setItem('brcondos_deletedBoletoKeys',JSON.stringify(keys));
    try{
      if(typeof saveData==='function')saveData('deletedBoletoKeys',keys);
    }catch(_){}
  }

  window.delBoleto=function(id){
    const b=(boletos||[]).find(x=>Number(x.id)===Number(id));
    if(!b)return;
    if(!confirm('Excluir este boleto?\n\nEle não será recriado automaticamente depois.'))return;

    persistDeletedKey(deleteKeyForBoleto(b));
    boletos=(boletos||[]).filter(x=>Number(x.id)!==Number(id));
    if(typeof saveData==='function')saveData('boletos',boletos);
    if(typeof renderAll==='function')renderAll();
  };
})();