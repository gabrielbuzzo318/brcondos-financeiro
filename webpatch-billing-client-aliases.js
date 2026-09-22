(function(){
  function brLoose(v){
    return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  }

  const billingAliases={
    ALTOSDOIBORUNA:'ALTOSDEIBORUNA',
    ASSOCMONTECARLO:'ARMCASSOCIACAORESIDENCIALMONTECARLO',
    ASSOCIACAORECANTODOSCURIMBATAS:'ASSOCIACAODOSPROPRIETARIOSDORECANTODOSCURIMBATASAPREC',
    ASSOCRECANTODOSCURIMBATAS:'ASSOCIACAODOSPROPRIETARIOSDORECANTODOSCURIMBATASAPREC',
    ASSOCIACAOEUROPARKI:'ASSOCIACAOLOTEAMENTOEUROPARKI',
    ASSOCIACAOEUROPARKII:'ASSOCIACAOLOTEAMENTOEUROPARKII',
    ASSOCIACAOBOMJARDIMII:'ASSOCIACAODOSMORADORESDOCONDOMINIORESIDENCIALBOMJARDIMII',
    ASSOCIACAOEPLENUM:'ASSOCIACAODOSMORADORESEPLENUMAMOEPLENUM',
    ASSOCIACAORESIDENCIALASVEGASII:'ASSOCIACAORESIDENCIALLASVEGASII',
    RIOMAGIORE:'CONDOMINIOEDIFICIORIOMAGGIORE',
    VILLEDESALPES:'VILLESDESALPESRESIDENCE'
  };

  const previous=typeof findClientByLooseName==='function'?findClientByLooseName:null;
  findClientByLooseName=function(name){
    const n=brLoose(name);
    if(!n)return null;

    const exact=(clients||[]).find(c=>brLoose(c.name)===n || brLoose(c.tradeName)===n);
    if(exact)return exact;

    const target=billingAliases[n];
    if(target){
      const aliased=(clients||[]).find(c=>brLoose(c.name)===target || brLoose(c.tradeName)===target);
      if(aliased)return aliased;
    }

    const partial=(clients||[]).find(c=>{
      const cn=brLoose(c.name), tn=brLoose(c.tradeName);
      return (cn && (cn.includes(n)||n.includes(cn))) || (tn && (tn.includes(n)||n.includes(tn)));
    });
    if(partial)return partial;

    return previous?previous(name):null;
  };
})();