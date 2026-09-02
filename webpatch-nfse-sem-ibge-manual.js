(function(){
  const CITY_IBGE={
    'SAO JOSE DO RIO PRETO|SP':'3549805',
    'BADY BASSITT|SP':'3504602',
    'GUAPIACU|SP':'3517505',
    'MENDONCA|SP':'3529500'
  };

  function normCity(v){
    return String(v||'')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g,' ')
      .replace(/\s+/g,' ')
      .trim();
  }

  // IBGE deixa de ser dado manual/obrigatório do cadastro. Quando necessário
  // para o XML da GISS, o sistema resolve internamente pela cidade/UF.
  nfseClientIbge=function(c){
    const explicit=String(c?.cityIbge||'').replace(/\D/g,'');
    if(explicit.length===7)return explicit;
    const city=normCity(c?.city);
    const uf=String(c?.state||'').trim().toUpperCase();
    return CITY_IBGE[`${city}|${uf}`]||'';
  };

  nfseClientCheck=function(c){
    if(!c)return 'Cliente não encontrado no cadastro.';
    const d=String(c.doc||'').replace(/\D/g,'');
    const missing=[];
    if(![11,14].includes(d.length))missing.push('CNPJ/CPF');
    if(!c.name)missing.push('Razão Social');
    if(!c.street)missing.push('endereço');
    if(!c.number)missing.push('número');
    if(!c.district)missing.push('bairro');
    if(!c.zip||String(c.zip).replace(/\D/g,'').length!==8)missing.push('CEP');
    if(!c.city)missing.push('cidade');
    if(!c.state)missing.push('UF');
    return missing.length?`Complete no cliente: ${missing.join(', ')}.`:'';
  };

  nfseTomadorFromClient=function(c){
    const err=nfseClientCheck(c);
    if(err)throw new Error(err);
    return {
      documento:String(c.doc||'').replace(/\D/g,''),
      nome:c.name,
      endereco:c.street,
      numero:c.number,
      complemento:c.complement||'',
      bairro:c.district,
      codigoMunicipio:nfseClientIbge(c),
      cidade:c.city,
      uf:c.state,
      cep:String(c.zip||'').replace(/\D/g,''),
      email:c.email||''
    };
  };

  // Atualiza a listagem para remover imediatamente qualquer aviso antigo de IBGE.
  setTimeout(()=>{try{if(typeof renderNfse==='function')renderNfse();}catch(_){ }},0);
})();
