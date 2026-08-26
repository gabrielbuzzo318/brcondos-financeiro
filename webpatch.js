// Recuperação segura do histórico GISS 26/08/2026 — RPS 218 a 258.
// Consulta a GISS por RPS e associa cada nota pelo tomador/valor, sem confiar na
// numeração temporária criada pela reconstrução do localStorage.
(function(){
  const HIST_START=218;
  const HIST_END=258;
  const HIST_DONE_KEY='brcondos_giss_hist_218_258_recuperado_v1';
  const HIST_BACKUP_KEY='brcondos_nfse_backup_antes_recuperar_218_258_v1';

  const nfseCanEmitOriginal=nfseCanEmit;
  nfseCanEmit=function(row){
    const nr=Number(row?.rpsNumber||row?.gissRpsNumber||0);
    if(nr>=HIST_START && nr<=HIST_END && !['emitida_nfse','cancelada_nfse'].includes(row?.status)){
      return `RPS ${nr} pertence ao histórico de hoje e precisa ser confirmado na Giss antes de qualquer nova emissão.`;
    }
    return nfseCanEmitOriginal(row);
  };

  function localName(el){return String(el?.localName||el?.nodeName||'').split(':').pop();}
  function firstByLocal(root,name){
    if(!root)return null;
    const all=root.getElementsByTagName('*');
    for(let i=0;i<all.length;i++) if(localName(all[i])===name) return all[i];
    return null;
  }
  function textByLocal(root,name){return firstByLocal(root,name)?.textContent?.trim()||'';}
  function numValue(v){
    const s=String(v||'').trim().replace(/\s/g,'').replace(',','.');
    const n=Number(s);return Number.isFinite(n)?n:0;
  }
  function sameMoney(a,b){return Math.abs(Number(a||0)-Number(b||0))<0.01;}
  function onlyDigits(v){return String(v||'').replace(/\D/g,'');}

  function metaFromGissXml(xml,rpsNumber){
    const out={rps:String(rpsNumber),doc:'',nome:'',valor:0,competence:'',issueDate:'',serviceDate:'',description:''};
    if(!xml)return out;
    try{
      const doc=new DOMParser().parseFromString(xml,'text/xml');
      const infs=[...doc.getElementsByTagName('*')].filter(x=>localName(x)==='InfNfse');
      let inf=infs.find(x=>{
        const ident=firstByLocal(x,'IdentificacaoRps');
        return ident && textByLocal(ident,'Numero')===String(rpsNumber);
      })||infs[0]||doc;

      const tom=firstByLocal(inf,'TomadorServico');
      if(tom){
        out.nome=textByLocal(tom,'RazaoSocial');
        out.doc=onlyDigits(textByLocal(tom,'Cnpj')||textByLocal(tom,'Cpf'));
      }
      out.valor=numValue(textByLocal(inf,'ValorServicos'));
      const comp=textByLocal(inf,'Competencia');
      out.competence=/^\d{4}-\d{2}/.test(comp)?comp.slice(0,7):'';
      const rps=firstByLocal(inf,'IdentificacaoRps');
      if(rps){
        const rpsParent=rps.parentNode?.parentNode||rps.parentNode;
        const dt=textByLocal(rpsParent,'DataEmissao');
        if(/^\d{4}-\d{2}-\d{2}/.test(dt))out.issueDate=dt.slice(0,10);
      }
      out.description=textByLocal(inf,'Discriminacao')||'Administração de Condomínios.';
    }catch(e){}
    return out;
  }

  function clientFromMeta(meta){
    if(meta.doc){
      const c=clients.find(x=>onlyDigits(x.doc)===meta.doc);
      if(c)return c;
    }
    return meta.nome?findClientByLooseName(meta.nome):null;
  }

  function findTargetRow(meta,rpsNumber,usedIds){
    const exact=nfse.find(x=>
      !usedIds.has(x.id) &&
      Number(x.rpsNumber||x.gissRpsNumber)===Number(rpsNumber) &&
      ['emitida_nfse','cancelada_nfse'].includes(x.status)
    );
    if(exact)return exact;

    const c=clientFromMeta(meta);
    let candidates=nfse.filter(x=>!usedIds.has(x.id) && !['emitida_nfse','cancelada_nfse'].includes(x.status));
    if(c){
      const byClient=candidates.filter(x=>Number(x.clientId)===Number(c.id) || looseName(x.client)===looseName(c.name));
      if(byClient.length)candidates=byClient;
    }else if(meta.nome){
      const byName=candidates.filter(x=>looseName(x.client)===looseName(meta.nome));
      if(byName.length)candidates=byName;
    }
    if(meta.competence){
      const byComp=candidates.filter(x=>String(x.competence||'')===meta.competence);
      if(byComp.length)candidates=byComp;
    }
    if(meta.valor){
      const byValue=candidates.filter(x=>sameMoney(x.value,meta.valor));
      if(byValue.length)candidates=byValue;
    }
    return candidates[0]||null;
  }

  function boletoFromMeta(meta,c){
    let list=boletos.filter(b=>
      b.section!=='CONTABIL' && !/CONTABIL/i.test(String(b.description||'')) &&
      (!meta.competence || String(b.competence||'')===meta.competence)
    );
    if(c){
      const byClient=list.filter(b=>Number(b.clientId)===Number(c.id)||looseName(b.client)===looseName(c.name));
      if(byClient.length)list=byClient;
    }else if(meta.nome){
      const byName=list.filter(b=>looseName(b.client)===looseName(meta.nome));
      if(byName.length)list=byName;
    }
    if(meta.valor){
      const byValue=list.filter(b=>sameMoney(b.value,meta.valor));
      if(byValue.length)list=byValue;
    }
    return list[0]||null;
  }

  function applyRecovered(target,item,meta,data,rpsNumber){
    const c=clientFromMeta(meta);
    const b=boletoFromMeta(meta,c);
    const base=target||{};
    Object.assign(base,{
      id:base.id||Date.now()+Number(rpsNumber),
      sourceBoletoId:base.sourceBoletoId||b?.id||'',
      clientId:base.clientId||c?.id||b?.clientId||0,
      client:c?.name||meta.nome||base.client||b?.client||`RPS ${rpsNumber}`,
      competence:meta.competence||base.competence||b?.competence||'2026-08',
      value:meta.valor||Number(base.value||b?.value||0),
      description:meta.description||base.description||'Administração de Condomínios.',
      rpsNumber:String(rpsNumber),
      gissRpsNumber:String(rpsNumber),
      issueDate:(meta.issueDate||item.dataEmissao||base.issueDate||today()).slice(0,10),
      serviceDate:base.serviceDate||'',
      aliquotaPct:base.aliquotaPct??null,
      status:'emitida_nfse',
      nfseNumber:item.numero||base.nfseNumber||'',
      verificationCode:item.codigoVerificacao||base.verificationCode||'',
      gissInternalId:item.idInterno||base.gissInternalId||'',
      gissProtocol:base.gissProtocol||data.protocolo||'',
      lastError:'',
      gissResponse:{recuperadoPorRps:true,ambiente:data.ambiente||'homologacao'}
    });
    if(!target)nfse.push(base);
    return base;
  }

  function updateProgress(done,confirmed,failed,current){
    const el=document.getElementById('histRpsText');
    const bar=document.getElementById('histRpsBar');
    const stats=document.getElementById('histRpsStats');
    if(el)el.textContent=`Consultando RPS ${current} • ${done} de ${HIST_END-HIST_START+1}`;
    if(bar)bar.style.width=`${Math.round(done/(HIST_END-HIST_START+1)*100)}%`;
    if(stats)stats.textContent=`Confirmados: ${confirmed} • Não confirmados/erros: ${failed}`;
  }

  window.brcondosRecuperarHistoricoGiss=async function({silent=false}={}){
    if(localStorage.getItem(HIST_DONE_KEY)==='ok'){
      if(!silent)alert('O histórico RPS 218 a 258 já foi recuperado e confirmado pela Giss neste navegador.');
      return {ok:true,alreadyDone:true};
    }
    if(!localStorage.getItem(HIST_BACKUP_KEY)){
      try{localStorage.setItem(HIST_BACKUP_KEY,JSON.stringify(nfse));}catch(e){}
    }

    if(!silent){
      openModal('Recuperando NFS-e emitidas hoje',`
        <div class="notice"><b>Nenhuma nota será emitida.</b> O sistema vai apenas consultar na Giss os RPS 218 a 258 e reconstruir o histórico.</div>
        <div id="histRpsText" style="margin-top:14px;font-weight:800">Preparando...</div>
        <div class="bulk-progress-track"><div id="histRpsBar" class="bulk-progress-bar"></div></div>
        <div id="histRpsStats" class="subtle">Confirmados: 0 • Não confirmados/erros: 0</div>
      `);
    }

    const usedIds=new Set();
    const confirmed=[];
    const failures=[];
    const total=HIST_END-HIST_START+1;

    for(let n=HIST_START;n<=HIST_END;n++){
      try{
        const r=await fetch(`/api/nfse/consultar-rps?numero=${n}&serie=RPS&tipo=1`);
        const data=await r.json();
        if(!r.ok)throw new Error(data.error||`HTTP ${r.status}`);
        const item=(Array.isArray(data.nfse)?data.nfse:[]).find(x=>String(x.rpsNumero||'')===String(n)) || (Array.isArray(data.nfse)?data.nfse[0]:null);
        if(!item?.numero){
          const msg=(data.erros||[]).map(e=>[e.codigo,e.mensagem].filter(Boolean).join(' - ')).join('; ')||'NFS-e não localizada para este RPS.';
          failures.push({rps:n,error:msg});
        }else{
          const meta=metaFromGissXml(data.xmlRetorno||'',n);
          const target=findTargetRow(meta,n,usedIds);
          const row=applyRecovered(target,item,meta,data,n);
          usedIds.add(row.id);
          confirmed.push({rps:n,nfse:item.numero,client:row.client});
        }
      }catch(e){
        failures.push({rps:n,error:e.message||String(e)});
      }
      if(!silent)updateProgress(n-HIST_START+1,confirmed.length,failures.length,n);
      if(typeof sleepMs==='function')await sleepMs(120);else await new Promise(res=>setTimeout(res,120));
    }

    if(confirmed.length===total){
      // Com todos os 41 RPS confirmados pela Giss, elimina somente os rascunhos
      // temporários que ficaram com numeração 218–258 após a reconstrução.
      const seen=new Set();
      nfse=nfse.filter(row=>{
        const nr=Number(row.rpsNumber||row.gissRpsNumber||0);
        if(nr<HIST_START||nr>HIST_END)return true;
        if(!['emitida_nfse','cancelada_nfse'].includes(row.status))return false;
        if(seen.has(nr))return false;
        seen.add(nr);return true;
      });
      localStorage.setItem('brcondos_giss_last_rps',String(HIST_END));
      if(typeof brcondosRenumerarRpsPendentes==='function')brcondosRenumerarRpsPendentes();
      localStorage.setItem(HIST_DONE_KEY,'ok');
    }else{
      const maxConfirmed=confirmed.reduce((m,x)=>Math.max(m,Number(x.rps)||0),Number(localStorage.getItem('brcondos_giss_last_rps')||0));
      if(maxConfirmed)localStorage.setItem('brcondos_giss_last_rps',String(maxConfirmed));
    }

    saveData('nfse',nfse);
    renderAll();
    localStorage.setItem('brcondos_giss_hist_218_258_result',JSON.stringify({confirmed,failures,at:new Date().toISOString()}));

    if(!silent){
      const failHtml=failures.length?`<div class="notice" style="margin-top:12px"><b>RPS ainda não confirmados:</b> ${failures.map(x=>x.rps).join(', ')}</div>`:'';
      openModal('Recuperação do histórico concluída',`
        <div class="cards grid" style="grid-template-columns:repeat(3,1fr)">
          <div class="card accent-green"><div class="kpi-label">CONFIRMADOS</div><div class="kpi-value">${confirmed.length}</div></div>
          <div class="card accent-slate"><div class="kpi-label">ESPERADOS</div><div class="kpi-value">${total}</div></div>
          <div class="card" style="border-top:3px solid var(--danger)"><div class="kpi-label">PENDÊNCIAS</div><div class="kpi-value">${failures.length}</div></div>
        </div>
        ${confirmed.length===total?'<div class="notice" style="margin-top:12px"><b>Histórico fechado.</b> RPS 218 a 258 foram confirmados pela Giss e o próximo RPS fica a partir de 259.</div>':failHtml}
        <div style="display:flex;justify-content:flex-end;margin-top:18px"><button class="btn primary" onclick="closeModal()">Fechar</button></div>
      `);
    }
    return {ok:confirmed.length===total,confirmed,failures};
  };

  if(localStorage.getItem('brcondos_session') && localStorage.getItem(HIST_DONE_KEY)!=='ok'){
    setTimeout(()=>window.brcondosRecuperarHistoricoGiss({silent:false}),700);
  }
})();
