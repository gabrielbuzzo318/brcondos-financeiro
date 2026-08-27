(function(){
  const originalPrintBoleto = typeof printBoleto==='function' ? printBoleto : null;

  function pick(obj,names){
    for(const n of names){
      if(obj && obj[n]!==undefined && obj[n]!==null && String(obj[n]).trim()!=='') return obj[n];
    }
    return '';
  }

  printBoleto=async function(id){
    const b=(boletos||[]).find(x=>Number(x.id)===Number(id));
    if(!b)return;
    if(!b.sicrediRegistered){
      if(originalPrintBoleto)return originalPrintBoleto(id);
      return alert('Este boleto ainda não foi registrado no Sicredi.');
    }

    const nossoNumero=String(b.sicrediNossoNumero||'').replace(/\D/g,'');
    const linhaDigitavel=String(b.sicrediLinhaDigitavel||'').trim();
    if(nossoNumero.length!==9)return alert('Nosso Número do Sicredi não está disponível neste boleto.');
    if(!linhaDigitavel)return alert('Linha digitável do Sicredi não está disponível neste boleto.');

    const c=(typeof findClientByLooseName==='function'?findClientByLooseName(b.client):null) || (clients||[]).find(x=>Number(x.id)===Number(b.clientId));
    const resp=b.sicrediResponse||{};
    const codigoBarras=String(pick(resp,['codigoBarras','codigo_barras','codigoDeBarras'])||'');
    const qrCode=String(b.sicrediQrCode||pick(resp,['qrCode','qrcode','qrCodePix','pixCopiaECola','codigoQrCode'])||'');
    const enderecoPagador=[c?.street,c?.number,c?.complement,c?.district].filter(Boolean).join(', ');
    const hoje=typeof today==='function'?today():'';
    const dataDocumento=String(pick(resp,['dataDocumento','dataEmissao','dataCadastro','dataGeracao'])||b.issueDate||b.createdDate||hoje).slice(0,10);
    const dataProcessamento=String(pick(resp,['dataProcessamento','dataRegistro','dataCadastro','dataGeracao','dataEmissao'])||hoje).slice(0,10);

    try{
      const r=await fetch('/api/boletos/pdf',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          documento:String(b.docNumber||''),
          nossoNumero,
          seuNumero:String(pick(resp,['seuNumero'])||String(b.id).replace(/\D/g,'').slice(-10)),
          dataVencimento:b.due||'',
          dataDocumento,
          dataProcessamento,
          valor:Number(b.value||0),
          pagador:b.client||c?.name||'',
          documentoPagador:String(c?.doc||''),
          enderecoPagador,
          cidadePagador:String(c?.city||''),
          ufPagador:String(c?.state||''),
          cepPagador:String(c?.zip||''),
          descricao:b.description||'Cobrança BRCONDOS',
          detalhes:b.details||'',
          linhaDigitavel,
          codigoBarras,
          qrCode
        })
      });
      if(!r.ok){
        let data={};try{data=await r.json();}catch(_){ }
        throw new Error(data.error||`Erro HTTP ${r.status}`);
      }
      const blob=await r.blob();
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url;
      a.target='_blank';
      a.rel='noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),60000);
    }catch(e){
      alert(`Erro ao gerar PDF do boleto:\n${e.message}`);
    }
  };
})();
