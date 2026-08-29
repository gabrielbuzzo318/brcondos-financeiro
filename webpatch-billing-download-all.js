(function(){
  const MONTHS=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const KEY_BOLETO='brcondos_boleto_download_month_v1';
  const KEY_NFSE='brcondos_nfse_download_month_v1';

  function currentMonth(){
    const raw=String(typeof today==='function'?today():new Date().toISOString().slice(0,10));
    return /^\d{4}-\d{2}/.test(raw)?raw.slice(0,7):new Date().toISOString().slice(0,7);
  }
  function label(prefix){
    const [y,m]=String(prefix||'').split('-').map(Number);
    return `${MONTHS[(m||1)-1]||''}/${y||''}`;
  }
  function zipLabel(prefix){
    const [y,m]=String(prefix||'').split('-').map(Number);
    return `${(MONTHS[(m||1)-1]||'MÊS').toUpperCase()} ${y||''}`.trim();
  }
  function safe(value,fallback='DOCUMENTO'){
    return String(value||fallback).replace(/[\\/:*?"<>|\r\n\t]+/g,'-').replace(/\s+/g,' ').trim().slice(0,110)||fallback;
  }
  function pick(obj,names){
    for(const n of names){if(obj&&obj[n]!==undefined&&obj[n]!==null&&String(obj[n]).trim()!=='')return obj[n];}
    return '';
  }
  function saved(key,months){
    let value='';try{value=sessionStorage.getItem(key)||'';}catch(_){ }
    return months.includes(value)?value:(months.includes(currentMonth())?currentMonth():(months[0]||currentMonth()));
  }
  function remember(key,value){try{sessionStorage.setItem(key,String(value||''));}catch(_){ }}

  function boletoMonths(){
    const set=new Set([currentMonth()]);
    (Array.isArray(boletos)?boletos:[]).forEach(b=>{
      const due=String(b?.due||'');
      if(/^\d{4}-\d{2}-\d{2}$/.test(due))set.add(due.slice(0,7));
    });
    return [...set].sort((a,b)=>b.localeCompare(a));
  }
  function nfseMonths(){
    const set=new Set([currentMonth()]);
    (Array.isArray(nfse)?nfse:[]).forEach(n=>{
      const comp=String(n?.competence||'');
      if(/^\d{4}-\d{2}$/.test(comp))set.add(comp);
    });
    return [...set].sort((a,b)=>b.localeCompare(a));
  }

  function boletoPayload(b){
    const c=(typeof findClientByLooseName==='function'?findClientByLooseName(b.client):null)||(Array.isArray(clients)?clients:[]).find(x=>Number(x.id)===Number(b.clientId));
    const resp=b.sicrediResponse||{};
    const hoje=typeof today==='function'?today():new Date().toISOString().slice(0,10);
    return {
      documento:String(b.docNumber||''),
      nossoNumero:String(b.sicrediNossoNumero||'').replace(/\D/g,''),
      seuNumero:String(pick(resp,['seuNumero'])||String(b.id).replace(/\D/g,'').slice(-10)),
      dataVencimento:b.due||'',
      dataDocumento:String(pick(resp,['dataDocumento','dataEmissao','dataCadastro','dataGeracao'])||b.issueDate||b.createdDate||hoje).slice(0,10),
      dataProcessamento:String(pick(resp,['dataProcessamento','dataRegistro','dataCadastro','dataGeracao','dataEmissao'])||hoje).slice(0,10),
      valor:Number(b.value||0),
      pagador:b.client||c?.name||'',
      documentoPagador:String(c?.doc||''),
      enderecoPagador:[c?.street,c?.number,c?.complement,c?.district].filter(Boolean).join(', '),
      cidadePagador:String(c?.city||''),
      ufPagador:String(c?.state||''),
      cepPagador:String(c?.zip||''),
      descricao:b.description||'Cobrança BRCONDOS',
      detalhes:b.details||'',
      linhaDigitavel:String(b.sicrediLinhaDigitavel||'').trim(),
      codigoBarras:String(pick(resp,['codigoBarras','codigo_barras','codigoDeBarras'])||''),
      qrCode:String(b.sicrediQrCode||pick(resp,['qrCode','qrcode','qrCodePix','pixCopiaECola','codigoQrCode'])||'')
    };
  }

  async function requestZip(type,items,zipName,button){
    const old=button?.textContent||'↓ Baixar tudo';
    try{
      if(button){button.disabled=true;button.textContent='Preparando ZIP...';}
      const response=await fetch('/api/documents/zip',{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,items,zipName})
      });
      if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data?.error||'Não foi possível gerar o ZIP.');}
      const blob=await response.blob();
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download=zipName;document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),2000);
    }catch(err){
      console.error('BRCONDOS ZIP FATURAMENTO:',err);
      alert(err?.message||'Não foi possível baixar os documentos.');
    }finally{
      if(button){button.disabled=false;button.textContent=old;}
    }
  }

  window.brDownloadAllBoletos=async function(){
    const month=String(document.getElementById('boleto_download_month')?.value||currentMonth());
    const rows=(Array.isArray(boletos)?boletos:[]).filter(b=>String(b?.due||'').slice(0,7)===month&&b?.sicrediRegistered);
    if(!rows.length)return alert(`Não há boletos oficiais do Sicredi em ${label(month)}.`);
    const items=rows.map(b=>({
      name:`${safe(b.client,'CLIENTE')} - BOLETO ${safe(b.docNumber||b.sicrediNossoNumero||b.id,'SEM NÚMERO')}.pdf`,
      payload:boletoPayload(b)
    }));
    await requestZip('boletos',items,`BRCONDOS - BOLETOS - ${zipLabel(month)}.zip`,document.getElementById('boleto_download_all_btn'));
  };

  window.brDownloadAllNfse=async function(){
    const month=String(document.getElementById('nfse_download_month')?.value||currentMonth());
    const rows=(Array.isArray(nfse)?nfse:[]).filter(n=>String(n?.competence||'')===month&&['emitida_nfse','cancelada_nfse'].includes(n?.status)&&n?.nfseNumber);
    if(!rows.length)return alert(`Não há NFS-e emitidas em ${label(month)}.`);
    const items=rows.map(n=>({
      name:`${safe(n.client,'CLIENTE')} - NF ${safe(n.nfseNumber,'SEM NÚMERO')}.pdf`,
      idInterno:String(n.gissInternalId||''),numero:String(n.nfseNumber||''),rps:String(n.gissRpsNumber||n.rpsNumber||''),verificacao:String(n.verificationCode||'')
    }));
    await requestZip('nfse',items,`BRCONDOS - NOTAS FISCAIS - ${zipLabel(month)}.zip`,document.getElementById('nfse_download_all_btn'));
  };

  function controls(idPrefix,months,key,handler,title){
    const selected=saved(key,months);
    const wrap=document.createElement('div');
    wrap.className='br-billing-download-wrap';
    wrap.innerHTML=`<select id="${idPrefix}_download_month" class="br-billing-download-month" title="${title}">${months.map(m=>`<option value="${m}" ${m===selected?'selected':''}>${label(m)}</option>`).join('')}</select><button id="${idPrefix}_download_all_btn" type="button" class="btn">↓ Baixar tudo</button>`;
    wrap.querySelector('select')?.addEventListener('change',e=>remember(key,e.target.value));
    wrap.querySelector('button')?.addEventListener('click',handler);
    return wrap;
  }

  function injectBoleto(){
    const root=document.getElementById('view-boletos');const section=root?.querySelector('.section-title');const actions=section?.lastElementChild;
    if(!actions||actions.querySelector('#boleto_download_month'))return;
    actions.insertBefore(controls('boleto',boletoMonths(),KEY_BOLETO,window.brDownloadAllBoletos,'Mês de vencimento dos boletos'),actions.firstChild);
  }
  function injectNfse(){
    const root=document.getElementById('view-nfse');const section=root?.querySelector('.section-title');const actions=section?.lastElementChild;
    if(!actions||actions.querySelector('#nfse_download_month'))return;
    actions.insertBefore(controls('nfse',nfseMonths(),KEY_NFSE,window.brDownloadAllNfse,'Competência das notas fiscais'),actions.firstChild);
  }
  function inject(){injectBoleto();injectNfse();}

  if(!document.getElementById('br-billing-download-style')){
    const style=document.createElement('style');style.id='br-billing-download-style';style.textContent=`
      .br-billing-download-wrap{display:flex;align-items:center;gap:7px}
      .br-billing-download-month{height:38px;border:1px solid var(--line);border-radius:8px;background:#fff;padding:0 10px;font:inherit;color:var(--text);min-width:130px}
      .br-billing-download-wrap .btn{white-space:nowrap}
      @media(max-width:760px){.br-billing-download-wrap{width:100%}.br-billing-download-month{flex:1}}
    `;document.head.appendChild(style);
  }

  const oldBoletos=window.renderBoletos;
  if(typeof oldBoletos==='function')window.renderBoletos=function(){const out=oldBoletos.apply(this,arguments);setTimeout(injectBoleto,20);return out;};
  const oldNfse=window.renderNfse;
  if(typeof oldNfse==='function')window.renderNfse=function(){const out=oldNfse.apply(this,arguments);setTimeout(injectNfse,20);return out;};
  const obs=new MutationObserver(()=>setTimeout(inject,0));obs.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(inject,300);
})();
