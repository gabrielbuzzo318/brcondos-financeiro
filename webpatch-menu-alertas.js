(function(){
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();

  const GROUPS=[
    {label:'VISÃO GERAL',views:['dashboard']},
    {label:'FINANCEIRO',views:['financeiro','reembolsos','fluxo','inadimplencias']},
    {label:'GESTÃO',views:['dre','plano']},
    {label:'CADASTROS',views:['clientes','fornecedores']},
    {label:'EMISSÃO',views:['boletos','nfse','recibos']},
    {label:'SISTEMA',views:['backup']}
  ];

  function ensureStyles(){
    if(document.getElementById('br-menu-alertas-style'))return;
    const s=document.createElement('style');
    s.id='br-menu-alertas-style';
    s.textContent=`
      #app .nav{padding:10px 12px 18px;overflow-y:auto;overflow-x:hidden}
      #app .br-nav-group{margin:0 0 12px}
      #app .br-nav-label{font-size:9px;font-weight:900;letter-spacing:1.15px;color:#9aa6ad;padding:8px 12px 4px;text-transform:uppercase;user-select:none}
      #app .br-nav-group button{margin:2px 0;padding:10px 12px}
      #app .br-nav-group+.br-nav-group{padding-top:3px;border-top:1px solid #f1f3f4}
      #app .top-actions{align-items:center;position:relative}
      #app .br-alert-wrap{position:relative;display:flex;align-items:center}
      #app .br-alert-btn{width:34px;height:34px;border:1px solid var(--line);background:#fff;border-radius:9px;display:grid;place-items:center;position:relative;color:#56656f;font-size:16px;padding:0}
      #app .br-alert-btn:hover{background:#f7f9fa}
      #app .br-alert-count{position:absolute;right:-5px;top:-6px;min-width:17px;height:17px;padding:0 4px;border-radius:999px;background:#df4c4c;color:#fff;font-size:9px;font-weight:900;display:grid;place-items:center;border:2px solid #fff}
      #app .br-alert-panel{position:absolute;right:0;top:42px;width:min(390px,calc(100vw - 30px));background:#fff;border:1px solid var(--line);border-radius:12px;box-shadow:0 18px 50px rgba(38,52,60,.18);z-index:80;overflow:hidden}
      #app .br-alert-head{display:flex;align-items:center;justify-content:space-between;padding:13px 15px;border-bottom:1px solid var(--line);font-size:13px;font-weight:900}
      #app .br-alert-sub{font-size:10px;color:var(--muted);font-weight:600}
      #app .br-alert-list{max-height:380px;overflow:auto}
      #app .br-alert-item{width:100%;border:0;border-bottom:1px solid #eef1f3;background:#fff;text-align:left;padding:12px 14px;display:block;cursor:pointer}
      #app .br-alert-item:hover{background:#fafbfc}
      #app .br-alert-item:last-child{border-bottom:0}
      #app .br-alert-title{font-size:11px;font-weight:900;color:#c3463f;margin-bottom:4px}
      #app .br-alert-msg{font-size:11px;color:#43515a;line-height:1.4}
      #app .br-alert-meta{font-size:9px;color:#98a3aa;margin-top:5px}
      #app .br-alert-ok{padding:22px 16px;text-align:center;color:#667681;font-size:12px}
      #app .br-alert-ok b{display:block;color:#2f8c43;margin-bottom:4px}
      #app tr.br-alert-highlight{outline:2px solid rgba(243,108,47,.45);outline-offset:-2px;background:#fff8f4!important}
      @media(max-width:760px){#app .status-line{display:none}#app .br-alert-panel{position:fixed;right:12px;top:66px}}
    `;
    document.head.appendChild(s);
  }

  function groupMenu(){
    const nav=document.querySelector('#app .nav');
    if(!nav)return;
    const buttons=[...nav.querySelectorAll('button[data-view]')];
    if(!buttons.length)return;
    const byView=new Map(buttons.map(b=>[b.dataset.view,b]));
    nav.innerHTML='';
    GROUPS.forEach(g=>{
      const present=g.views.map(v=>byView.get(v)).filter(Boolean);
      if(!present.length)return;
      const box=document.createElement('div');
      box.className='br-nav-group';
      box.dataset.group=g.label;
      const label=document.createElement('div');
      label.className='br-nav-label';
      label.textContent=g.label;
      box.appendChild(label);
      present.forEach(b=>box.appendChild(b));
      nav.appendChild(box);
    });
    const used=new Set(GROUPS.flatMap(g=>g.views));
    const extras=buttons.filter(b=>!used.has(b.dataset.view));
    if(extras.length){
      let box=nav.querySelector('[data-group="SISTEMA"]');
      if(!box){
        box=document.createElement('div');box.className='br-nav-group';box.dataset.group='SISTEMA';
        const label=document.createElement('div');label.className='br-nav-label';label.textContent='SISTEMA';box.appendChild(label);nav.appendChild(box);
      }
      extras.forEach(b=>box.appendChild(b));
    }
  }

  function nfseAlerts(){
    return (window.nfse||[]).filter(r=>{
      const st=norm(r?.status);
      const msg=String(r?.lastError||'').trim();
      if(/EMITIDA|CANCELADA/.test(st))return false;
      if(/REMESSA AINDA NAO FOI PROCESSADA|AINDA NAO FOI PROCESSADA/.test(norm(msg)))return false;
      return /ERRO|FALHA|REJEIT/.test(st)||!!msg;
    }).map(r=>({
      type:'GISS',view:'nfse',id:r.id,
      title:'Falha na GISS',
      message:`${r.client||'NFS-e'}${r.rpsNumber?` • RPS ${r.rpsNumber}`:''}${r.lastError?` — ${r.lastError}`:''}`,
      meta:r.nfseNumber?`NFS-e ${r.nfseNumber}`:'Clique para abrir Notas Fiscais'
    }));
  }

  function boletoAlerts(){
    return (window.boletos||[]).filter(b=>{
      const st=norm(b?.status);
      const real=norm(b?.sicrediStatus);
      const msg=String(b?.sicrediError||b?.integrationError||b?.registrationError||b?.lastError||b?.error||'').trim();
      return /ERRO|FALHA|REJEIT/.test(st)||/ERRO|FALHA|REJEIT/.test(real)||!!msg;
    }).map(b=>({
      type:'SICREDI',view:'boletos',id:b.id,
      title:'Falha no Sicredi',
      message:`${b.client||'Boleto'}${b.docNumber?` • ${b.docNumber}`:''}${(b.sicrediError||b.integrationError||b.registrationError||b.lastError||b.error)?` — ${b.sicrediError||b.integrationError||b.registrationError||b.lastError||b.error}`:''}`,
      meta:b.sicrediNossoNumero?`Nosso Número ${b.sicrediNossoNumero}`:'Clique para abrir Boletos'
    }));
  }

  function getAlerts(){
    return [...nfseAlerts(),...boletoAlerts()].slice(0,40);
  }

  function closePanel(){document.getElementById('brIntegrationAlertPanel')?.remove();}

  window.brOpenIntegrationAlert=function(view,id){
    closePanel();
    const btn=document.querySelector(`#app .nav button[data-view="${CSS.escape(String(view||''))}"]`);
    if(typeof showView==='function')showView(view,btn||undefined);
    setTimeout(()=>{
      const tr=document.querySelector(`#view-${CSS.escape(String(view||''))} tr[data-id="${CSS.escape(String(id||''))}"]`);
      if(tr){
        tr.classList.add('br-alert-highlight');
        tr.scrollIntoView({behavior:'smooth',block:'center'});
        setTimeout(()=>tr.classList.remove('br-alert-highlight'),3500);
      }
    },180);
  };

  function togglePanel(){
    const old=document.getElementById('brIntegrationAlertPanel');
    if(old){old.remove();return;}
    const wrap=document.querySelector('#app .br-alert-wrap');
    if(!wrap)return;
    const alerts=getAlerts();
    const panel=document.createElement('div');
    panel.id='brIntegrationAlertPanel';
    panel.className='br-alert-panel';
    panel.innerHTML=`
      <div class="br-alert-head"><span>Alertas de integração</span><span class="br-alert-sub">${alerts.length?`${alerts.length} pendência(s)`:'Tudo certo'}</span></div>
      <div class="br-alert-list">
        ${alerts.length?alerts.map(a=>`<button class="br-alert-item" type="button" onclick="brOpenIntegrationAlert('${esc(a.view)}','${esc(a.id)}')"><div class="br-alert-title">${esc(a.title)}</div><div class="br-alert-msg">${esc(a.message)}</div><div class="br-alert-meta">${esc(a.meta)}</div></button>`).join(''):`<div class="br-alert-ok"><b>✓ Nenhum erro de integração</b>GISS e Sicredi sem pendências identificadas no sistema.</div>`}
      </div>`;
    wrap.appendChild(panel);
  }

  function renderAlertButton(){
    const actions=document.querySelector('#app .top-actions');
    if(!actions)return;
    let wrap=actions.querySelector('.br-alert-wrap');
    if(!wrap){
      wrap=document.createElement('div');wrap.className='br-alert-wrap';
      const status=actions.querySelector('.status-line');
      if(status)actions.insertBefore(wrap,status);else actions.prepend(wrap);
    }
    const count=getAlerts().length;
    wrap.innerHTML=`<button class="br-alert-btn" type="button" title="Alertas de integração" aria-label="Alertas de integração">🔔${count?`<span class="br-alert-count">${count>99?'99+':count}</span>`:''}</button>`;
    wrap.querySelector('button')?.addEventListener('click',e=>{e.stopPropagation();togglePanel();});
  }

  function refresh(){
    ensureStyles();
    groupMenu();
    renderAlertButton();
  }

  const originalRenderAll=window.renderAll;
  if(typeof originalRenderAll==='function'){
    window.renderAll=function(){
      const out=originalRenderAll.apply(this,arguments);
      setTimeout(refresh,0);
      return out;
    };
  }

  document.addEventListener('click',e=>{
    const panel=document.getElementById('brIntegrationAlertPanel');
    if(panel&&!e.target.closest('.br-alert-wrap'))closePanel();
  });
  window.addEventListener('storage',()=>setTimeout(renderAlertButton,0));

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh,{once:true});
  else refresh();
  setTimeout(refresh,900);
  setInterval(renderAlertButton,30000);
})();