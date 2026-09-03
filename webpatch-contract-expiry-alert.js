(function(){
  const KEY='brcondos_contract_terms_v1';
  const escHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function readTerms(){
    try{
      const v=JSON.parse(localStorage.getItem(KEY)||'{}');
      return v&&typeof v==='object'&&!Array.isArray(v)?v:{};
    }catch(_){return {};}
  }
  function writeTerms(v){
    localStorage.setItem(KEY,JSON.stringify(v||{}));
  }
  function parseIso(s){
    const m=String(s||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!m)return null;
    return new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),12,0,0,0);
  }
  function isoDate(d){
    if(!(d instanceof Date)||Number.isNaN(d.getTime()))return '';
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function calcExpiry(start,months){
    const d=parseIso(start),n=Number(months||0);
    if(!d||!Number.isFinite(n)||n<=0)return '';
    const day=d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth()+Math.round(n));
    const last=new Date(d.getFullYear(),d.getMonth()+1,0,12).getDate();
    d.setDate(Math.min(day,last));
    d.setDate(d.getDate()-1);
    return isoDate(d);
  }
  function fmtDate(s){
    if(typeof formatDate==='function')return formatDate(s);
    const m=String(s||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m?`${m[3]}/${m[2]}/${m[1]}`:String(s||'');
  }
  function clientList(){
    try{return Array.isArray(clients)?clients:[];}catch(_){return Array.isArray(window.clients)?window.clients:[];}
  }

  function refreshExpiryPreview(forceFromMonths=false){
    const start=document.getElementById('p_contract_start')?.value||'';
    const months=document.getElementById('p_contract_months')?.value||'';
    const end=document.getElementById('p_contract_expiry');
    if(!end)return;
    const calc=calcExpiry(start,months);
    if(forceFromMonths||!end.value)end.value=calc;
    const note=document.getElementById('p_contract_expiry_note');
    if(note){
      const parsed=end.value?parseIso(end.value):null;
      note.textContent=parsed
        ?`O Dashboard avisará a partir de ${fmtDate(isoDate(new Date(parsed.getTime()-30*86400000)))}.`
        :'Informe o prazo ou a data prevista para ativar o aviso no Dashboard.';
    }
  }

  function injectContractFields(id){
    const start=document.getElementById('p_contract_start');
    if(!start||document.getElementById('p_contract_months'))return;
    const list=clientList();
    const c=id?list.find(x=>String(x.id)===String(id)):null;
    const terms=readTerms();
    const saved=c?terms[String(c.id)]||{}:{};
    const grid=start.closest('.modal-grid')||document.querySelector('#modal .modal-grid,.modal .modal-grid,.modal-grid');
    if(!grid)return;

    const monthsWrap=document.createElement('div');
    monthsWrap.className='field';
    monthsWrap.innerHTML=`<label>Prazo do contrato (meses)</label><input id="p_contract_months" type="number" min="1" step="1" value="${escHtml(saved.months||'')}" placeholder="Ex.: 24">`;

    const expiryWrap=document.createElement('div');
    expiryWrap.className='field';
    expiryWrap.innerHTML=`<label>Término previsto do contrato</label><input id="p_contract_expiry" type="date" value="${escHtml(saved.expiry||'')}"><div id="p_contract_expiry_note" class="subtle" style="margin-top:4px"></div>`;

    const startWrap=start.closest('.field')||start.parentElement;
    if(startWrap?.nextSibling){
      startWrap.parentNode.insertBefore(monthsWrap,startWrap.nextSibling);
      startWrap.parentNode.insertBefore(expiryWrap,monthsWrap.nextSibling);
    }else{
      grid.appendChild(monthsWrap);
      grid.appendChild(expiryWrap);
    }

    const monthsEl=document.getElementById('p_contract_months');
    const expiryEl=document.getElementById('p_contract_expiry');
    start.addEventListener('change',()=>refreshExpiryPreview(true));
    monthsEl?.addEventListener('input',()=>refreshExpiryPreview(true));
    expiryEl?.addEventListener('change',()=>refreshExpiryPreview(false));
    refreshExpiryPreview(false);
  }

  const prevOpenParty=window.openParty;
  if(typeof prevOpenParty==='function'){
    window.openParty=function(type,id){
      const out=prevOpenParty.apply(this,arguments);
      if(type==='client')setTimeout(()=>injectContractFields(id),0);
      return out;
    };
  }

  const prevSaveParty=window.saveParty;
  if(typeof prevSaveParty==='function'){
    window.saveParty=async function(type,id){
      let captured=null;
      let beforeIds=null;
      if(type==='client'){
        const list=clientList();
        beforeIds=new Set(list.map(x=>String(x.id)));
        captured={
          months:Number(document.getElementById('p_contract_months')?.value||0)||0,
          expiry:String(document.getElementById('p_contract_expiry')?.value||'').trim(),
          doc:String(document.getElementById('p_doc')?.value||'').replace(/\D/g,''),
          name:String(document.getElementById('p_name')?.value||'').trim()
        };
        if(!captured.expiry&&captured.months){
          captured.expiry=calcExpiry(document.getElementById('p_contract_start')?.value||'',captured.months);
        }
      }

      const out=await prevSaveParty.apply(this,arguments);

      if(type==='client'&&captured){
        const list=clientList();
        let c=id?list.find(x=>String(x.id)===String(id)):null;
        if(!c&&beforeIds)c=list.find(x=>!beforeIds.has(String(x.id)));
        if(!c&&captured.doc)c=list.find(x=>String(x.doc||'').replace(/\D/g,'')===captured.doc);
        if(!c&&captured.name)c=list.find(x=>String(x.name||'').trim()===captured.name);
        if(c){
          const terms=readTerms();
          if(captured.months||captured.expiry)terms[String(c.id)]={months:captured.months||'',expiry:captured.expiry||''};
          else delete terms[String(c.id)];
          writeTerms(terms);
          try{if(typeof saveData==='function')saveData('clients',list);}catch(_){ }
        }
      }
      return out;
    };
  }

  function contractAlerts(){
    const now=parseIso(typeof today==='function'?today():isoDate(new Date()))||new Date();
    now.setHours(12,0,0,0);
    const terms=readTerms();
    const alerts=[];

    clientList().forEach(c=>{
      const saved=terms[String(c.id)]||{};
      let expiry=String(saved.expiry||'').trim();
      if(!expiry&&saved.months&&c.contractStart)expiry=calcExpiry(c.contractStart,saved.months);

      let target=expiry;
      const resc=String(c.contractEnd||'').trim();
      if(resc&&(!target||resc<target))target=resc;
      if(!target)return;

      const d=parseIso(target);
      if(!d)return;
      const diff=Math.ceil((d-now)/86400000);
      if(diff<0||diff>30)return;

      alerts.push({
        id:c.id,
        name:c.name||c.tradeName||'Cliente',
        date:target,
        days:diff,
        reason:resc&&target===resc?'rescisão':'término previsto'
      });
    });

    return alerts.sort((a,b)=>a.date.localeCompare(b.date));
  }

  function openClients(){
    const btn=document.querySelector('#app .nav button[data-view="clientes"],#app [data-view="clientes"]');
    if(typeof showView==='function')showView('clientes',btn||undefined);
  }
  window.brOpenContractClients=openClients;

  function ensureStyle(){
    if(document.getElementById('br-contract-alert-style'))return;
    const s=document.createElement('style');
    s.id='br-contract-alert-style';
    s.textContent=`
      #view-dashboard .br-contract-alert{margin-top:14px;background:#fffaf0;border:1px solid #f0d59d;border-left:4px solid #e6a832;border-radius:11px;padding:14px 16px;box-shadow:0 5px 14px rgba(39,54,64,.04)}
      #view-dashboard .br-contract-alert-head{display:flex;justify-content:space-between;align-items:center;gap:12px}
      #view-dashboard .br-contract-alert-title{font-size:13px;font-weight:900;color:#6c4b08}
      #view-dashboard .br-contract-alert-sub{font-size:10px;color:#8b7447;margin-top:3px}
      #view-dashboard .br-contract-alert-list{display:grid;gap:7px;margin-top:11px}
      #view-dashboard .br-contract-alert-row{display:flex;justify-content:space-between;gap:14px;padding:9px 10px;background:rgba(255,255,255,.72);border:1px solid #f2dfb5;border-radius:8px;font-size:11px}
      #view-dashboard .br-contract-alert-row b{color:#3e4347}
      #view-dashboard .br-contract-alert-days{font-weight:900;color:#b67400;white-space:nowrap}
      #view-dashboard .br-contract-alert-btn{border:1px solid #e6c77f;background:#fff;color:#8b5c00;border-radius:7px;padding:7px 10px;font-size:10px;font-weight:900;cursor:pointer}
    `;
    document.head.appendChild(s);
  }

  function renderDashboardContractAlert(){
    const root=document.getElementById('view-dashboard');
    if(!root||root.classList.contains('hidden'))return;
    ensureStyle();
    root.querySelector('#brContractExpiryAlert')?.remove();
    const alerts=contractAlerts();
    if(!alerts.length)return;

    const box=document.createElement('div');
    box.id='brContractExpiryAlert';
    box.className='br-contract-alert';
    const shown=alerts.slice(0,6);
    box.innerHTML=`
      <div class="br-contract-alert-head">
        <div><div class="br-contract-alert-title">⚠ Contrato${alerts.length>1?'s':''} próximo${alerts.length>1?'s':''} do término</div><div class="br-contract-alert-sub">Aviso automático para contratos que terminam nos próximos 30 dias.</div></div>
        <button class="br-contract-alert-btn" type="button" onclick="brOpenContractClients()">Ver clientes</button>
      </div>
      <div class="br-contract-alert-list">
        ${shown.map(a=>`<div class="br-contract-alert-row"><span><b>${escHtml(a.name)}</b> • ${a.reason} em ${fmtDate(a.date)}</span><span class="br-contract-alert-days">${a.days===0?'Termina hoje':a.days===1?'Falta 1 dia':`Faltam ${a.days} dias`}</span></div>`).join('')}
        ${alerts.length>shown.length?`<div class="br-contract-alert-sub">+ ${alerts.length-shown.length} contrato(s) próximo(s) do término.</div>`:''}
      </div>`;

    const bottom=root.querySelector('.br-dash-bottom');
    if(bottom)root.insertBefore(box,bottom);
    else root.appendChild(box);
  }

  const prevRenderDashboard=window.renderDashboard;
  if(typeof prevRenderDashboard==='function'){
    window.renderDashboard=function(){
      const out=prevRenderDashboard.apply(this,arguments);
      setTimeout(renderDashboardContractAlert,30);
      return out;
    };
  }

  const prevShowView=window.showView;
  if(typeof prevShowView==='function'){
    window.showView=function(view,button){
      const out=prevShowView.apply(this,arguments);
      if(view==='dashboard')setTimeout(renderDashboardContractAlert,50);
      return out;
    };
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(renderDashboardContractAlert,250),{once:true});
  else setTimeout(renderDashboardContractAlert,250);
})();
