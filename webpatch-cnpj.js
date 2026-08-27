(function(){
  fetchCnpjPublic=async function(doc){
    const cnpj=String(doc||'').replace(/[^0-9A-Z]/gi,'').toUpperCase();
    if(!/^[0-9A-Z]{14}$/.test(cnpj)) throw new Error('CNPJ inválido');
    const r=await fetch(`/api/cnpj/${encodeURIComponent(cnpj)}`,{cache:'no-store'});
    const data=await r.json().catch(()=>({}));
    if(!r.ok){
      const detail=Array.isArray(data.details)&&data.details.length?` (${data.details.join(' | ')})`:'';
      throw new Error(`${data.error||`HTTP ${r.status}`}${detail}`);
    }
    return data;
  };
})();
