(function(){
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const hoje=()=>typeof today==='function'?today():new Date().toISOString().slice(0,10);

  function userInfo(){
    const raw=String(document.getElementById('userEmailMini')?.textContent||'').trim();
    const name=(raw.split('•')[0]||'').trim()||'Financeiro';
    const readOnly=typeof window.brcondosIsReadOnly==='function'&&window.brcondosIsReadOnly();
    return {name,readOnly,isAccounting:norm(name)==='contabilidade'};
  }

  function currentMonth(){return hoje().slice(0,7);}
  function monthLabel(prefix){
    const [y,m]=String(prefix||'').split('-').map(Number);
    const names=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    return `${names[(m||1)-1]||''}/${y||''}`;
  }

  function ensureStyles(){
    if(document.getElementById('br-dashboard-home-style'))return;
    const s=document.createElement('style');
    s.id='br-dashboard-home-style';
    s.textContent=`
      #view-dashboard .br-dash-bottom{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(300px,.75fr);gap:16px;margin-top:18px}
      #view-dashboard .br-dash-card{background:#fff;border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow);padding:18px}
      #view-dashboard .br-dash-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px}
      #view-dashboard .br-dash-head h3{font-size:15px;margin:0;color:var(--text)}
      #view-dashboard .br-dash-head span{display:block;font-size:11px;color:var(--muted);margin-top:4px}
      #view-dashboard .br-pending-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      #view-dashboard .br-pending{border:1px solid #e8ecef;background:#fbfcfd;border-radius:10px;padding:13px 14px;text-align:left;cursor:pointer;min-height:88px;transition:.15s ease}
      #view-dashboard .br-pending:hover{transform:translateY(-1px);border-color:#d7dee3;box-shadow:0 7px 18px rgba(39,54,64,.06)}
      #view-dashboard .br-pending .label{font-size:10px;font-weight:900;color:#71808a;text-transform:uppercase;letter-spacing:.35px}
      #view-dashboard .br-pending .value{font-size:20px;font-weight:900;margin-top:7px;color:#26343c}
      #view-dashboard .br-pending .note{font-size:10px;color:#8a979f;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #view-dashboard .br-pending.danger{border-left:3px solid #df4c4c}
      #view-dashboard .br-pending.warning{border-left:3px solid #e6a832}
      #view-dashboard .br-pending.info{border-left:3px solid #43b4df}
      #view-dashboard .br-pending.success{border-left:3px solid #52b957}
      #view-dashboard .br-pending .bad{color:#c84242}
      #view-dashboard .br-pending .good{color:#278c3a}
      #view-dashboard .br-shortcuts{display:grid;grid-template-columns:1fr 1fr;gap:9px}
      #view-dashboard .br-shortcut{min-height:57px;border:1px solid #e4e9ec;background:#fff;border-radius:10px;padding:10px 11px;text-align:left;display:flex;align-items:center;gap:10px;color:#33424b;font-weight:800;font-size:12px;cursor:pointer}
      #view-dashboard .br-shortcut:hover{background:#fff7f2;border-color:#f1c2ab;color:#d95722}
      #view-dashboard .br-shortcut .ico{width:29px;height:29px;border-radius:8px;background:#f3f6f8;display:grid;place-items:center;font-size:14px;flex:0 0 auto}
      #view-dashboard .br-dash-empty{border:1px dashed #d8e0e4;border-radius:10px;padding:22px;text-align:center;color:#74828b;font-size:12px}
      @media(max-width:1000px){#view-dashboard .br-dash-bottom{grid-template-columns:1fr}}
      @media(max-width:650px){#view-dashboard .br-pending-grid,#view-dashboard .br-shortcuts{grid-template-columns:1fr}}
    `;
    document.head.appendChild(s);
  }

  function boletoStatus(b){
    const s=norm(b?.sicrediStatus||'');
    if(/liquidad|pago|paga|baixado por solicit/.test(s)||b?.status==='recebido'||b?.status==='liquidado')return 'liquidado';
    if(/vencid/.test(s)||b?.status==='vencido'||(b?.due&&String(b.due)<hoje()))return 'vencido';
    return 'aberto';
  }

  function integrationCount(){
    let count=0;
    (window.nfse||[]).forEach(r=>{
      const st=norm(r?.status),msg=norm(r?.lastError||'');
      if(/emitida|cancelada/.test(st))return;
      if(/remessa ainda nao foi processada|ainda nao foi processada/.test(msg))return;
      if(/erro|falha|rejeit/.test(st)||msg)count++;
    });
    (window.boletos||[]).forEach(b=>{
      const st=norm(b?.status),real=norm(b?.sicrediStatus);
      const msg=String(b?.sicrediError||b?.integrationError||b?.registrationError||b?.lastError||b?.error||'').trim();
      if(/erro|falha|rejeit/.test(st)||/erro|falha|rejeit/.test(real)||msg)count++;
    });
    return count;
  }

  function dreClosed(){
    try{
      const state=JSON.parse(localStorage.getItem('brcondos_dre_closures_v1')||'{}');
      return state?.[currentMonth()]?.closed===true;
    }catch(_){return false;}
  }

  function overdueStats(){
    const overduePayables=(window.payables||[]).filter(p=>{
      const st=norm(p?.status);
      if(/pago|recebido|cancel/.test(st))return false;
      return st==='vencido'||(p?.due&&String(p.due)<hoje());
    });

    const overdueBoletos=(window.boletos||[]).filter(b=>boletoStatus(b)==='vencido');
    const overdueBoletoIds=new Set(overdueBoletos.map(b=>String(b.id)));
    const overdueReceipts=(window.receipts||[]).filter(r=>{
      if(r?.sourceBoletoId&&overdueBoletoIds.has(String(r.sourceBoletoId)))return false;
      if(typeof window.receiptFinanceStatus==='function')return window.receiptFinanceStatus(r)==='vencido';
      if(r?.paymentStatus==='liquidado')return false;
      const due=r?.dueDate||r?.issueDate||'';
      return due&&String(due)<hoje();
    });

    let manual=[];
    try{manual=JSON.parse(localStorage.getItem('brcondos_inadimplencias_manual')||'[]');if(!Array.isArray(manual))manual=[];}catch(_){manual=[];}
    const overdueManual=manual.filter(x=>!['liquidado','pago','baixado'].includes(norm(x?.status)));

    const inadCount=overdueBoletos.length+overdueReceipts.length+overdueManual.length;
    const inadValue=[...overdueBoletos,...overdueReceipts,...overdueManual].reduce((s,x)=>s+Number(x?.value||0),0);
    return {
      payCount:overduePayables.length,
      payValue:overduePayables.reduce((s,x)=>s+Number(x?.value||0),0),
      inadCount,inadValue
    };
  }

  window.brDashOpen=function(view){
    const btn=document.querySelector(`#app .nav button[data-view="${CSS.escape(String(view||''))}"]`);
    if(typeof showView==='function')showView(view,btn||undefined);
  };

  function quickLinks(info){
    if(info.isAccounting)return [
      ['▰','A Pagar','financeiro'],['⇄','Fluxo de Caixa','fluxo']
    ];
    if(info.readOnly)return [
      ['▥','DRE','dre'],['⇄','Fluxo de Caixa','fluxo'],['!','Inadimplências','inadimplencias'],['▤','Boletos','boletos'],['NF','Notas Fiscais','nfse']
    ];
    return [
      ['▰','A Pagar','financeiro'],['⇄','Fluxo de Caixa','fluxo'],['▤','Boletos','boletos'],['NF','Notas Fiscais','nfse'],['R$','Recibos','recibos'],['!','Inadimplências','inadimplencias']
    ];
  }

  function applyGreeting(){
    const dash=document.getElementById('view-dashboard');
    if(!dash||dash.classList.contains('hidden'))return;
    const info=userInfo();
    const title=document.getElementById('pageTitle');
    const subtitle=document.getElementById('pageSubtitle');
    if(title)title.textContent=`Olá, ${info.name}.`;
    if(subtitle)subtitle.textContent=info.readOnly?'O que gostaria de ver hoje?':'O que gostaria de fazer hoje?';
  }

  function enhanceDashboard(){
    const root=document.getElementById('view-dashboard');
    if(!root)return;
    ensureStyles();
    applyGreeting();

    root.querySelectorAll('.grid.two-cols,.br-dashboard-recent-full,.br-dash-bottom').forEach(el=>el.remove());

    const info=userInfo();
    const stats=overdueStats();
    const alerts=integrationCount();
    const closed=dreClosed();
    const links=quickLinks(info);

    const bottom=document.createElement('div');
    bottom.className='br-dash-bottom';
    bottom.innerHTML=`
      <div class="br-dash-card">
        <div class="br-dash-head"><div><h3>Pendências que precisam de atenção</h3><span>O que merece acompanhamento agora</span></div></div>
        <div class="br-pending-grid">
          <button class="br-pending ${stats.payCount?'danger':'success'}" onclick="brDashOpen('financeiro')">
            <div class="label">Contas vencidas</div><div class="value ${stats.payCount?'bad':'good'}">${stats.payCount}</div><div class="note">${stats.payCount?(typeof money==='function'?money(stats.payValue):stats.payValue):'Nenhuma conta vencida'}</div>
          </button>
          <button class="br-pending ${stats.inadCount?'danger':'success'}" onclick="brDashOpen('inadimplencias')">
            <div class="label">Inadimplências</div><div class="value ${stats.inadCount?'bad':'good'}">${stats.inadCount}</div><div class="note">${stats.inadCount?(typeof money==='function'?money(stats.inadValue):stats.inadValue):'Nenhuma cobrança vencida'}</div>
          </button>
          <button class="br-pending ${alerts?'warning':'success'}" onclick="document.querySelector('.br-alert-btn')?.click()">
            <div class="label">Integrações</div><div class="value ${alerts?'bad':'good'}">${alerts}</div><div class="note">${alerts?'GISS / Sicredi com pendência':'GISS e Sicredi sem alertas'}</div>
          </button>
          <button class="br-pending ${closed?'success':'info'}" onclick="brDashOpen('dre')">
            <div class="label">DRE • ${esc(monthLabel(currentMonth()))}</div><div class="value ${closed?'good':''}" style="font-size:16px">${closed?'Concluída':'Em fechamento'}</div><div class="note">Clique para abrir a DRE do período</div>
          </button>
        </div>
      </div>
      <div class="br-dash-card">
        <div class="br-dash-head"><div><h3>${info.readOnly?'Acessos rápidos':'Atalhos rápidos'}</h3><span>${info.readOnly?'Vá direto ao que deseja consultar':'Acesse as rotinas mais usadas'}</span></div></div>
        <div class="br-shortcuts">${links.map(([ico,label,view])=>`<button class="br-shortcut" onclick="brDashOpen('${view}')"><span class="ico">${esc(ico)}</span><span>${esc(label)}</span></button>`).join('')}</div>
      </div>`;
    root.appendChild(bottom);
  }

  const prevRenderDashboard=window.renderDashboard;
  if(typeof prevRenderDashboard==='function'){
    window.renderDashboard=function(){
      const out=prevRenderDashboard.apply(this,arguments);
      setTimeout(enhanceDashboard,0);
      return out;
    };
  }

  const prevShowView=window.showView;
  if(typeof prevShowView==='function'){
    window.showView=function(view,button){
      const out=prevShowView.apply(this,arguments);
      if(view==='dashboard')setTimeout(()=>{applyGreeting();enhanceDashboard();},0);
      return out;
    };
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(enhanceDashboard,100),{once:true});
  else setTimeout(enhanceDashboard,100);
})();