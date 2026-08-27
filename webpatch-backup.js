(function(){
  const BACKUP_FORMAT='BRCONDOS_BACKUP_V1';
  const SHARED_REV='brcondos_shared_rev_v1';
  const SKIP_KEYS=new Set(['brcondos_session','brcondos_auth_session_v2']);

  function shouldBackupKey(key){
    const k=String(key||'');
    if(!k||SKIP_KEYS.has(k)||k.startsWith('sb-'))return false;
    return true;
  }

  function captureLocalStorage(){
    const storage={};
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(!shouldBackupKey(key))continue;
      storage[key]=localStorage.getItem(key);
    }
    return storage;
  }

  function applyLocalStorage(storage){
    if(!storage||typeof storage!=='object'||Array.isArray(storage))throw new Error('Armazenamento do backup inválido.');
    const remove=[];
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(shouldBackupKey(key))remove.push(key);
    }
    remove.forEach(key=>localStorage.removeItem(key));
    Object.entries(storage).forEach(([key,value])=>{
      if(!shouldBackupKey(key)||value==null)return;
      localStorage.setItem(key,String(value));
    });
  }

  function stamp(date=new Date()){
    const p=n=>String(n).padStart(2,'0');
    return `${date.getFullYear()}-${p(date.getMonth()+1)}-${p(date.getDate())}_${p(date.getHours())}-${p(date.getMinutes())}-${p(date.getSeconds())}`;
  }

  function downloadJson(data,prefix='BRCONDOS_BACKUP'){
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`${prefix}_${stamp()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }

  async function fetchSharedState(){
    const r=await fetch('/api/state',{cache:'no-store'});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||'Não foi possível ler a base compartilhada.');
    return d;
  }

  function countJsonArray(raw){
    try{const v=JSON.parse(raw||'[]');return Array.isArray(v)?v.length:null;}catch(_){return null;}
  }

  function summaryFrom(storage){
    const keys=[
      ['brcondos_payables','Contas a pagar'],
      ['brcondos_transactions','Fluxo de caixa'],
      ['brcondos_reimbursements','Reembolsos'],
      ['brcondos_boletos','Boletos'],
      ['brcondos_nfse','Notas fiscais'],
      ['brcondos_receipts','Recibos'],
      ['brcondos_clients','Clientes'],
      ['brcondos_suppliers','Fornecedores']
    ];
    return keys.map(([key,label])=>({key,label,count:countJsonArray(storage?.[key])}));
  }

  async function buildBackup(){
    const local=captureLocalStorage();
    let shared=null;
    try{shared=await fetchSharedState();}catch(err){shared={ok:false,error:String(err?.message||err)};}
    const restoreData=shared?.exists&&shared?.data&&typeof shared.data==='object'
      ? shared.data
      : {version:1,storage:local};
    const storageForSummary=restoreData?.storage&&typeof restoreData.storage==='object'?restoreData.storage:local;
    return {
      format:BACKUP_FORMAT,
      formatVersion:1,
      createdAt:new Date().toISOString(),
      app:'BRCONDOS Financeiro - SJRP',
      origin:location.origin,
      restoreData,
      sharedState:shared,
      localStorageSnapshot:local,
      summary:summaryFrom(storageForSummary)
    };
  }

  function setBackupStatus(text,isError=false){
    const el=document.getElementById('brBackupStatus');
    if(!el)return;
    el.textContent=text||'';
    el.style.color=isError?'#c94848':'#687780';
  }

  window.brcondosDownloadBackup=async function(){
    const btn=document.getElementById('brBackupDownloadBtn');
    try{
      if(btn){btn.disabled=true;btn.textContent='Gerando backup...';}
      setBackupStatus('Lendo a base atual do sistema...');
      const backup=await buildBackup();
      downloadJson(backup,'BRCONDOS_BACKUP');
      sessionStorage.setItem('brcondos_last_manual_backup_at',backup.createdAt);
      setBackupStatus(`Backup gerado em ${new Date(backup.createdAt).toLocaleString('pt-BR')}. Guarde o arquivo em local seguro.`);
      renderBackupView();
    }catch(err){
      console.error('BRCONDOS BACKUP:',err);
      setBackupStatus(err?.message||'Falha ao gerar backup.',true);
      alert(`Não foi possível gerar o backup.\n\n${err?.message||err}`);
    }finally{
      if(btn){btn.disabled=false;btn.textContent='⬇ Baixar backup completo';}
    }
  };

  async function restoreBackupFile(file){
    if(typeof window.brcondosIsReadOnly==='function'&&window.brcondosIsReadOnly()){
      alert('Seu usuário é somente consulta e não pode restaurar backups.');
      return;
    }
    const text=await file.text();
    let backup;
    try{backup=JSON.parse(text);}catch(_){throw new Error('O arquivo selecionado não é um JSON de backup válido.');}
    if(backup?.format!==BACKUP_FORMAT)throw new Error('Esse arquivo não é um backup reconhecido do BRCONDOS.');
    const data=backup?.restoreData;
    if(!data||typeof data!=='object'||Array.isArray(data)||!data.storage||typeof data.storage!=='object'){
      throw new Error('O backup não contém uma base restaurável.');
    }

    const ok1=confirm(`ATENÇÃO: restaurar este backup substituirá a base atual do sistema pela cópia de ${new Date(backup.createdAt||0).toLocaleString('pt-BR')}.\n\nAntes da restauração, o sistema baixará automaticamente uma cópia da base atual.\n\nDeseja continuar?`);
    if(!ok1)return;
    const typed=prompt('Para confirmar a restauração, digite exatamente: RESTAURAR');
    if(String(typed||'').trim().toUpperCase()!=='RESTAURAR'){
      alert('Restauração cancelada.');
      return;
    }

    setBackupStatus('Salvando uma cópia de segurança da base atual...');
    const pre=await buildBackup();
    downloadJson(pre,'BRCONDOS_PRE_RESTAURACAO');

    setBackupStatus('Restaurando a base selecionada...');
    const r=await fetch('/api/state',{
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({data})
    });
    const resp=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(resp.error||'Não foi possível restaurar o backup no servidor.');

    applyLocalStorage(data.storage);
    if(resp.updated_at)sessionStorage.setItem(SHARED_REV,String(resp.updated_at));
    alert('Backup restaurado com sucesso. O sistema será recarregado agora.');
    location.reload();
  }

  window.brcondosChooseBackupFile=function(){
    if(typeof window.brcondosIsReadOnly==='function'&&window.brcondosIsReadOnly()){
      alert('Seu usuário é somente consulta e não pode restaurar backups.');
      return;
    }
    document.getElementById('brBackupFile')?.click();
  };

  function lastBackupLabel(){
    const raw=sessionStorage.getItem('brcondos_last_manual_backup_at');
    if(!raw)return 'Nenhum backup baixado nesta sessão';
    const d=new Date(raw);
    return Number.isNaN(d.getTime())?'Backup realizado nesta sessão':d.toLocaleString('pt-BR');
  }

  function renderBackupView(){
    const view=document.getElementById('view-backup');
    if(!view)return;
    const readOnly=typeof window.brcondosIsReadOnly==='function'&&window.brcondosIsReadOnly();
    view.innerHTML=`
      <div class="section-title">
        <div><h2>Backup de segurança</h2><span>Baixe uma cópia independente da base do BRCONDOS para o seu computador.</span></div>
      </div>
      <div class="cards grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">
        <div class="card accent-green">
          <div class="kpi-label">ÚLTIMO BACKUP NESTA SESSÃO</div>
          <div style="font-size:16px;font-weight:800;margin-top:8px">${lastBackupLabel()}</div>
          <div class="kpi-foot">O arquivo fica salvo no seu computador.</div>
        </div>
        <div class="card accent-blue">
          <div class="kpi-label">O QUE É SALVO</div>
          <div style="font-size:16px;font-weight:800;margin-top:8px">Base financeira + cadastros</div>
          <div class="kpi-foot">A Pagar, Fluxo, Reembolsos, Boletos, NFs, Recibos, clientes, fornecedores e configurações compartilhadas.</div>
        </div>
      </div>
      <div class="card">
        <div class="panel-title">Backup manual</div>
        <p style="font-size:13px;color:var(--muted);line-height:1.55;margin:0 0 16px">Faça um backup ao final de cada dia de trabalho. O arquivo JSON é uma cópia separada do Supabase e pode ser usado para restaurar a base caso algum dado seja apagado ou sobrescrito.</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button id="brBackupDownloadBtn" class="btn green" type="button" onclick="brcondosDownloadBackup()">⬇ Baixar backup completo</button>
          ${readOnly?'':`<button class="btn" type="button" onclick="brcondosChooseBackupFile()">↥ Restaurar backup</button>`}
          <input id="brBackupFile" class="hidden" type="file" accept="application/json,.json">
        </div>
        <div id="brBackupStatus" style="font-size:12px;color:#687780;margin-top:13px"></div>
        <div class="notice" style="margin-top:18px;margin-bottom:0"><b>Rotina recomendada:</b> terminou os lançamentos do dia → abra Backup → clique em <b>Baixar backup completo</b>. Não substitua o arquivo anterior; mantenha alguns dias de histórico.</div>
      </div>`;
    const input=document.getElementById('brBackupFile');
    if(input){
      input.onchange=async()=>{
        const file=input.files?.[0];
        input.value='';
        if(!file)return;
        try{await restoreBackupFile(file);}catch(err){
          console.error('BRCONDOS RESTORE:',err);
          setBackupStatus(err?.message||'Falha ao restaurar backup.',true);
          alert(`Não foi possível restaurar o backup.\n\n${err?.message||err}`);
        }
      };
    }
  }

  window.brcondosShowBackup=function(button){
    document.querySelectorAll('#app .view').forEach(v=>v.classList.add('hidden'));
    const view=document.getElementById('view-backup');
    if(!view)return;
    view.classList.remove('hidden');
    document.querySelectorAll('#app .nav button').forEach(b=>b.classList.remove('active'));
    const navButton=button||document.querySelector('#app .nav [data-view="backup"]');
    navButton?.classList.add('active');
    const title=document.getElementById('pageTitle');
    const subtitle=document.getElementById('pageSubtitle');
    if(title)title.textContent='Backup';
    if(subtitle)subtitle.textContent='Cópias de segurança e restauração';
    renderBackupView();
    document.getElementById('sidebar')?.classList.remove('open');
  };

  function ensureBackupUi(){
    const nav=document.querySelector('#app .nav');
    const content=document.querySelector('#app .content');
    if(!nav||!content)return;
    if(!nav.querySelector('[data-view="backup"]')){
      const btn=document.createElement('button');
      btn.type='button';
      btn.dataset.view='backup';
      btn.innerHTML='<span class="ico">⤓</span>Backup';
      btn.onclick=function(){window.brcondosShowBackup(btn);};
      nav.appendChild(btn);
    }
    if(!document.getElementById('view-backup')){
      const section=document.createElement('section');
      section.id='view-backup';
      section.className='view hidden';
      content.appendChild(section);
    }
  }

  function init(){ensureBackupUi();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
  setTimeout(init,800);
})();
