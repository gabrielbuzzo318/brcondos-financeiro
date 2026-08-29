(function(){
  const STORAGE_KEY='brcondos_ap_download_month_v1';
  const MONTHS=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  function currentMonth(){
    const raw=String(typeof today==='function'?today():new Date().toISOString().slice(0,10));
    return /^\d{4}-\d{2}/.test(raw)?raw.slice(0,7):new Date().toISOString().slice(0,7);
  }

  function monthLabel(prefix){
    const [y,m]=String(prefix||'').split('-').map(Number);
    return `${MONTHS[(m||1)-1]||''}/${y||''}`;
  }

  function monthZipLabel(prefix){
    const [y,m]=String(prefix||'').split('-').map(Number);
    return `${(MONTHS[(m||1)-1]||'MES').toUpperCase()} ${y||''}`.trim();
  }

  function availableMonths(){
    const set=new Set([currentMonth()]);
    (Array.isArray(payables)?payables:[]).forEach(p=>{
      const due=String(p?.due||'');
      if(/^\d{4}-\d{2}-\d{2}$/.test(due))set.add(due.slice(0,7));
    });
    return [...set].sort((a,b)=>b.localeCompare(a));
  }

  function selectedMonth(){
    const months=availableMonths();
    const saved=sessionStorage.getItem(STORAGE_KEY)||currentMonth();
    return months.includes(saved)?saved:(months[0]||currentMonth());
  }

  function saveSelectedMonth(value){
    try{sessionStorage.setItem(STORAGE_KEY,String(value||''));}catch(_){ }
  }

  function safePart(value,fallback='SEM NOME'){
    return String(value||fallback)
      .replace(/[\\/:*?"<>|\r\n\t]+/g,'-')
      .replace(/\s+/g,' ')
      .trim()
      .slice(0,80)||fallback;
  }

  function extensionOf(name){
    const m=String(name||'').match(/(\.[A-Za-z0-9]{1,8})$/);
    return m?m[1]:'';
  }

  function payableFileName(p){
    const due=String(p?.due||'');
    const date=/^\d{4}-(\d{2})-(\d{2})$/.exec(due);
    const dayMonth=date?`${date[2]}.${date[1]}`:'SEM DATA';
    const supplier=safePart(p?.supplier||p?.description||'SEM FORNECEDOR');
    const value=typeof money==='function'?money(Number(p?.value||0)):`R$ ${Number(p?.value||0).toFixed(2).replace('.',',')}`;
    const ext=extensionOf(p?.attachmentName||'');
    return safePart(`${dayMonth} - ${supplier} - ${value}`, 'documento')+ext;
  }

  async function migrateLegacyAttachment(p){
    if(p?.attachmentRef)return p.attachmentRef;
    if(!p?.attachmentData)return '';
    const response=await fetch('/api/payables/attachments',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({fileName:p.attachmentName||'anexo',dataUrl:p.attachmentData})
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data?.error||'Não foi possível preparar um anexo antigo.');
    const ref=String(data?.id||'');
    if(!ref)throw new Error('O servidor não retornou a referência do anexo.');
    p.attachmentRef=ref;
    p.attachmentName=data.fileName||p.attachmentName||'anexo';
    p.attachmentData='';
    return ref;
  }

  async function downloadMonthZip(){
    const select=document.getElementById('ap_download_month');
    const button=document.getElementById('ap_download_all_btn');
    const month=String(select?.value||selectedMonth());
    const monthRows=(Array.isArray(payables)?payables:[]).filter(p=>String(p?.due||'').slice(0,7)===month);
    const withDocs=monthRows.filter(p=>p?.attachmentRef||p?.attachmentData);

    if(!withDocs.length){
      alert(`Não há documentos anexados nas contas de ${monthLabel(month)}.`);
      return;
    }

    const oldText=button?.textContent||'↓ Baixar tudo';
    try{
      if(button){button.disabled=true;button.textContent='Preparando ZIP...';}

      const items=[];
      for(const p of withDocs){
        const id=await migrateLegacyAttachment(p);
        if(id)items.push({id,name:payableFileName(p)});
      }

      if(typeof saveData==='function')saveData('payables',payables);
      if(!items.length)throw new Error('Nenhum anexo pôde ser preparado.');

      const zipName=`BRCONDOS - A PAGAR - ${monthZipLabel(month)}.zip`;
      const response=await fetch('/api/payables/attachments/zip',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({items,zipName})
      });
      if(!response.ok){
        const data=await response.json().catch(()=>({}));
        throw new Error(data?.error||'Não foi possível gerar o ZIP.');
      }

      const blob=await response.blob();
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url;
      a.download=zipName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1500);
    }catch(err){
      console.error('BRCONDOS ZIP A PAGAR:',err);
      alert(err?.message||'Não foi possível baixar os documentos.');
    }finally{
      if(button){button.disabled=false;button.textContent=oldText;}
    }
  }

  window.brDownloadAllPayablesDocs=downloadMonthZip;

  function injectControls(){
    const root=document.getElementById('view-financeiro');
    if(!root)return;
    const section=root.querySelector('.section-title');
    if(!section)return;
    const actions=section.lastElementChild;
    if(!actions||actions.querySelector('#ap_download_month'))return;

    const months=availableMonths();
    const selected=selectedMonth();
    const wrap=document.createElement('div');
    wrap.className='br-ap-download-wrap';
    wrap.innerHTML=`
      <select id="ap_download_month" class="br-ap-month" title="Mês dos documentos">
        ${months.map(m=>`<option value="${m}" ${m===selected?'selected':''}>${monthLabel(m)}</option>`).join('')}
      </select>
      <button id="ap_download_all_btn" type="button" class="btn" onclick="brDownloadAllPayablesDocs()">↓ Baixar tudo</button>`;
    wrap.querySelector('#ap_download_month')?.addEventListener('change',e=>saveSelectedMonth(e.target.value));
    actions.insertBefore(wrap,actions.firstChild);
  }

  if(!document.getElementById('br-ap-download-style')){
    const style=document.createElement('style');
    style.id='br-ap-download-style';
    style.textContent=`
      #view-financeiro .br-ap-download-wrap{display:flex;align-items:center;gap:7px}
      #view-financeiro .br-ap-month{height:38px;border:1px solid var(--line);border-radius:8px;background:#fff;padding:0 10px;font:inherit;color:var(--text);min-width:130px}
      #view-financeiro #ap_download_all_btn{white-space:nowrap}
      @media(max-width:760px){#view-financeiro .br-ap-download-wrap{width:100%}#view-financeiro .br-ap-month{flex:1}}
    `;
    document.head.appendChild(style);
  }

  const prevRender=window.renderFinanceiro;
  if(typeof prevRender==='function'){
    window.renderFinanceiro=function(){
      const out=prevRender.apply(this,arguments);
      setTimeout(injectControls,20);
      return out;
    };
  }

  const observer=new MutationObserver(()=>{
    if(!document.getElementById('view-financeiro')?.classList.contains('hidden'))injectControls();
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(injectControls,200),{once:true});
  else setTimeout(injectControls,200);
})();
