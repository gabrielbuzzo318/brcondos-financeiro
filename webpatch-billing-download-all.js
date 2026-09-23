(function(){
  const MONTHS=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const KEY_BOLETO='brcondos_boleto_download_month_v1';
  const KEY_NFSE='brcondos_nfse_download_month_v1';
  const KEY_RECEIPT='brcondos_receipt_download_month_v1';

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
  function boletoFileDate(v){
    const m=String(v||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m?`${m[3]}-${m[2]}-${m[1]}`:String(v||'SEM VENCIMENTO');
  }
  function boletoFileValue(v){
    return Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
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

  function updateBoletoMonthCards(){
    const root=document.getElementById('view-boletos');
    if(!root)return;
    const month=String(document.getElementById('boleto_download_month')?.value||currentMonth());
    const rows=(Array.isArray(boletos)?boletos:[]).filter(b=>String(b?.due||'').slice(0,7)===month);
    const open=rows.reduce((sum,b)=>{
      if(b.status==='recebido')return sum;
      if(b.status==='recebido_parcial')return sum+Math.max(0,Number(b.remainingBalance??(Number(b.value||0)-Number(b.receivedAmount||0))));
      return sum+Number(b.value||0);
    },0);
    const received=rows.reduce((sum,b)=>{
      if(b.status==='recebido')return sum+Number(b.receivedAmount??b.value||0);
      if(b.status==='recebido_parcial')return sum+Number(b.receivedAmount||0);
      return sum;
    },0);
    const noDue=0;
    const total=rows.length;

    [...root.querySelectorAll('.cards.grid .card')].forEach(card=>{
      const label=String(card.querySelector('.kpi-label')?.textContent||'').trim().toUpperCase();
      const value=card.querySelector('.kpi-value');
      if(!value)return;
      if(label==='EM ABERTO')value.textContent=money(open);
      else if(label==='RECEBIDOS')value.textContent=money(received);
      else if(label==='SEM VENCIMENTO')value.textContent=String(noDue);
      else if(label==='TOTAL DE BOLETOS')value.textContent=String(total);
    });
  }

  function removeBoletoNotice(){
    const root=document.getElementById('view-boletos');
    const notice=root?.querySelector('.notice');
    if(notice)notice.remove();
  }

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
  function receiptMonths(){
    const set=new Set([currentMonth()]);
    (Array.isArray(receipts)?receipts:[]).forEach(r=>{
      const comp=String(r?.competence||'');
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

  function receiptPayload(row){
    let cl=null;
    try{cl=typeof receiptClient==='function'?receiptClient(row):null;}catch(_){ }
    if(!cl){
      try{cl=(Array.isArray(clients)?clients:[]).find(x=>Number(x.id)===Number(row?.clientId))||findClientByLooseName(row?.client);}catch(_){ }
    }
    let address='-';
    try{address=typeof receiptAddress==='function'?receiptAddress(cl):'-';}catch(_){ }
    let competenceLabel=String(row?.competence||'');
    let issueDateLong=String(row?.issueDate||'');
    let amountWords='';
    try{if(typeof receiptCompetenceLabel==='function')competenceLabel=receiptCompetenceLabel(row?.competence);}catch(_){ }
    try{if(typeof receiptDateLong==='function')issueDateLong=receiptDateLong(row?.issueDate);}catch(_){ }
    try{if(typeof receiptAmountWords==='function')amountWords=receiptAmountWords(row?.value);}catch(_){ }
    return {
      receiptNumber:String(row?.receiptNumber||''),
      client:String(cl?.name||row?.client||''),
      address:String(address||'-'),
      value:Number(row?.value||0),
      amountWords,
      competence:String(row?.competence||''),
      competenceLabel,
      issueDate:String(row?.issueDate||''),
      issueDateLong,
      description:String(row?.description||'')
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
    const root=document.getElementById('view-boletos');
    const tableRows=[...root.querySelectorAll('tbody tr[data-id]')];
    const visibleIds=new Set(tableRows.filter(tr=>tr.style.display!=='none').map(tr=>String(tr.dataset.id||'')));
    const rows=(Array.isArray(boletos)?boletos:[]).filter(b=>
      String(b?.due||'').slice(0,7)===month &&
      b?.sicrediRegistered &&
      (!tableRows.length || visibleIds.has(String(b.id)))
    );
    if(!rows.length)return alert(`Não há boletos oficiais do Sicredi em ${label(month)}.`);
    const items=rows.map(b=>({
      name:`${safe(b.client,'CLIENTE')} - R$ ${boletoFileValue(b.value)} - ${boletoFileDate(b.due)}.pdf`,
      payload:boletoPayload(b)
    }));
    await requestZip('boletos',items,`BRCONDOS - BOLETOS - ${zipLabel(month)}.zip`,document.getElementById('boleto_download_all_btn'));
  };

  window.brDownloadAllNfse=async function(){
    const month=String(document.getElementById('nfse_download_month')?.value||currentMonth());
    const rows=(Array.isArray(nfse)?nfse:[]).filter(n=>String(n?.competence||'')===month&&['emitida_nfse','cancelada_nfse'].includes(n?.status)&&n?.nfseNumber);
    if(!rows.length)return alert(`Não há NFS-e emitidas em ${label(month)}.`);
    const items=rows.map(n=>({
      name:`${safe(n.client,'CLIENTE')} - NF ${safe(n.nfseNumber,'SEM NÚMERO')} - R$ ${boletoFileValue(n.value)}.pdf`,
      idInterno:String(n.gissInternalId||''),numero:String(n.nfseNumber||''),rps:String(n.gissRpsNumber||n.rpsNumber||''),verificacao:String(n.verificationCode||'')
    }));
    await requestZip('nfse',items,`BRCONDOS - NOTAS FISCAIS - ${zipLabel(month)}.zip`,document.getElementById('nfse_download_all_btn'));
  };

  window.brDownloadAllReceipts=async function(){
    const root=document.getElementById('view-recibos');
    const tableRows=[...root.querySelectorAll('tbody tr[data-id]')];
    const visibleIds=new Set(tableRows
      .filter(tr=>tr.style.display!=='none')
      .map(tr=>String(tr.dataset.id||'')));
    const comp=String(document.getElementById('receipt_comp_filter')?.value||'');
    const rows=(Array.isArray(receipts)?receipts:[]).filter(r=>{
      if(!visibleIds.has(String(r.id)))return false;
      if(comp && String(r.competence||'')!==comp)return false;
      return true;
    });
    if(!rows.length)return alert('Não há recibos nos filtros atuais para baixar.');
    const items=rows.map(r=>({
      name:`${safe(r.client,'CLIENTE')} - RECIBO ${safe(String(r.receiptNumber||'').replace('/','-'),'SEM NÚMERO')} - R$ ${boletoFileValue(r.value)}.pdf`,
      payload:receiptPayload(r)
    }));
    const suffix=comp?zipLabel(comp):'FILTRADOS';
    await requestZip('receipts',items,`BRCONDOS - RECIBOS - ${suffix}.zip`,document.getElementById('receipt_download_all_btn'));
  };

  function controls(idPrefix,months,key,handler,title){
    const selected=saved(key,months);
    const wrap=document.createElement('div');
    wrap.className='br-billing-download-wrap';
    wrap.innerHTML=`<select id="${idPrefix}_download_month" class="br-billing-download-month" title="${title}">${months.map(m=>`<option value="${m}" ${m===selected?'selected':''}>${label(m)}</option>`).join('')}</select><button id="${idPrefix}_download_all_btn" type="button" class="btn">↓ Baixar tudo</button>`;
    wrap.querySelector('select')?.addEventListener('change',e=>{
      remember(key,e.target.value);
      if(idPrefix==='boleto')updateBoletoMonthCards();
    });
    wrap.querySelector('button')?.addEventListener('click',handler);
    return wrap;
  }

  function injectBoleto(){
    const root=document.getElementById('view-boletos');const section=root?.querySelector('.section-title');const actions=section?.lastElementChild;
    if(!actions||actions.querySelector('#boleto_download_month'))return;
    actions.insertBefore(controls('boleto',boletoMonths(),KEY_BOLETO,window.brDownloadAllBoletos,'Mês de vencimento dos boletos'),actions.firstChild);
    removeBoletoNotice();
    updateBoletoMonthCards();
  }
  function injectNfse(){
    const root=document.getElementById('view-nfse');const section=root?.querySelector('.section-title');const actions=section?.lastElementChild;
    if(!actions||actions.querySelector('#nfse_download_month'))return;
    actions.insertBefore(controls('nfse',nfseMonths(),KEY_NFSE,window.brDownloadAllNfse,'Competência das notas fiscais'),actions.firstChild);
  }
  function injectReceipts(){
    const root=document.getElementById('view-recibos');const section=root?.querySelector('.section-title');const actions=section?.lastElementChild;
    if(!actions||actions.querySelector('#receipt_download_all_btn'))return;
    const btn=document.createElement('button');
    btn.id='receipt_download_all_btn';btn.type='button';btn.className='btn';btn.textContent='↓ Baixar tudo';
    btn.addEventListener('click',window.brDownloadAllReceipts);
    actions.insertBefore(btn,actions.firstChild);
  }
  function inject(){injectBoleto();injectNfse();injectReceipts();removeBoletoNotice();}

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
  const oldReceipts=window.renderReceipts;
  if(typeof oldReceipts==='function')window.renderReceipts=function(){const out=oldReceipts.apply(this,arguments);setTimeout(injectReceipts,20);return out;};
  const obs=new MutationObserver(()=>setTimeout(inject,0));obs.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(inject,300);
})();
