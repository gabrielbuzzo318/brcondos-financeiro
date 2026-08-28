(function(){
  function clientOptions(){
    return (clients||[])
      .slice()
      .sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'pt-BR'))
      .map(c=>`<option value="${esc(c.name||'')}"></option>`)
      .join('');
  }

  function injectNfAvulsaButton(){
    const view=document.getElementById('view-nfse');
    const actions=view?.querySelector('.section-title > div:last-child');
    if(!actions || document.getElementById('br-nf-avulsa-button'))return;
    const btn=document.createElement('button');
    btn.id='br-nf-avulsa-button';
    btn.className='btn primary';
    btn.type='button';
    btn.textContent='+ NF';
    btn.onclick=()=>window.openNfseNew();
    actions.appendChild(btn);
  }

  window.loadNfseManualDefaults=function(){
    const comp=document.getElementById('nf_new_comp')?.value||'';
    if(!comp)return;
    const cfg=typeof nfseSetting==='function'?nfseSetting(comp):{};
    const service=document.getElementById('nf_new_service');
    const aliq=document.getElementById('nf_new_aliq');
    if(service)service.value=cfg?.serviceDate||(typeof nfseLastDay==='function'?nfseLastDay(comp):'');
    if(aliq)aliq.value=cfg?.aliquotaPct!==undefined&&cfg?.aliquotaPct!==null&&cfg?.aliquotaPct!==''
      ?String(cfg.aliquotaPct).replace('.',',')
      :'';
  };

  window.openNfseNew=function(){
    const currentDate=typeof today==='function'?today():new Date().toISOString().slice(0,10);
    const comp=currentDate.slice(0,7);
    const cfg=typeof nfseSetting==='function'?nfseSetting(comp):{};
    const serviceDate=cfg?.serviceDate||currentDate;
    const aliquota=cfg?.aliquotaPct!==undefined&&cfg?.aliquotaPct!==null&&cfg?.aliquotaPct!==''
      ?String(cfg.aliquotaPct).replace('.',',')
      :'';
    const rps=typeof nextRpsNumber==='function'?nextRpsNumber():'';

    openModal('Nova NFS-e avulsa',`
      <datalist id="nf_new_clients">${clientOptions()}</datalist>
      <div class="notice"><b>Emissão avulsa:</b> esta NFS-e não precisa existir no faturamento nem ter boleto vinculado. Escolha um tomador cadastrado, preencha o serviço e salve ou emita.</div>
      <div class="modal-grid" style="margin-top:14px">
        ${field('Cliente / Tomador',`<input id="nf_new_client" list="nf_new_clients" placeholder="Digite ou escolha o tomador" autocomplete="off">`)}
        ${field('RPS',`<input id="nf_new_rps" value="${esc(rps)}" readonly>`)}
        ${field('Competência',`<input id="nf_new_comp" type="month" value="${esc(comp)}" onchange="loadNfseManualDefaults()">`)}
        ${field('Data emissão / RPS',`<input id="nf_new_issue" type="date" value="${esc(currentDate)}">`)}
        ${field('Data da prestação',`<input id="nf_new_service" type="date" value="${esc(serviceDate)}">`)}
        ${field('Alíquota ISS (%)',`<input id="nf_new_aliq" type="text" inputmode="decimal" value="${esc(aliquota)}" placeholder="Ex.: 4,41">`)}
        ${field('Valor',`<input id="nf_new_value" type="text" inputmode="decimal" placeholder="0,00">`)}
        <div class="field" style="grid-column:1/-1">
          <label>Descrição / Discriminação do serviço</label>
          <textarea id="nf_new_desc" rows="5" placeholder="Descreva o serviço que será faturado..."></textarea>
        </div>
      </div>
      <div class="notice" style="margin-top:14px">Se o tomador ainda não estiver cadastrado, cadastre primeiro em <b>Clientes</b> para que CNPJ/CPF e endereço sejam enviados corretamente à Giss.</div>
      <div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:18px">
        <button class="btn" onclick="closeModal()">Cancelar</button>
        <button class="btn" onclick="saveNfseNew(false)">Salvar rascunho</button>
        <button class="btn primary" onclick="saveNfseNew(true)">Salvar e emitir</button>
      </div>`);
  };

  window.saveNfseNew=function(emitAfter=false){
    const clientName=String(document.getElementById('nf_new_client')?.value||'').trim();
    const c=(clients||[]).find(x=>String(x.name||'').trim().toLocaleLowerCase('pt-BR')===clientName.toLocaleLowerCase('pt-BR'))
      ||(typeof findClientByLooseName==='function'?findClientByLooseName(clientName):null);
    if(!c)return alert('Selecione um tomador já cadastrado em Clientes. Se for um cliente novo, cadastre-o primeiro.');

    const competence=document.getElementById('nf_new_comp')?.value||'';
    const issueDate=document.getElementById('nf_new_issue')?.value||'';
    const serviceDate=document.getElementById('nf_new_service')?.value||'';
    const aliquota=typeof parseMoneyBR==='function'?parseMoneyBR(document.getElementById('nf_new_aliq')?.value||''):Number(document.getElementById('nf_new_aliq')?.value||0);
    const value=typeof parseMoneyBR==='function'?parseMoneyBR(document.getElementById('nf_new_value')?.value||''):Number(document.getElementById('nf_new_value')?.value||0);
    const description=String(document.getElementById('nf_new_desc')?.value||'').trim();

    if(!competence)return alert('Informe a competência.');
    if(!issueDate)return alert('Informe a data de emissão.');
    if(!serviceDate)return alert('Informe a data da prestação do serviço.');
    if(!Number(value)||Number(value)<=0)return alert('Informe um valor válido.');
    if(!description)return alert('Informe a descrição/discriminação do serviço.');

    const id=Date.now()+Math.floor(Math.random()*1000);
    const row={
      id,
      sourceBoletoId:'',
      clientId:c.id,
      client:c.name,
      competence,
      value:Number(value),
      description,
      rpsNumber:String(document.getElementById('nf_new_rps')?.value||nextRpsNumber()),
      gissRpsNumber:'',
      issueDate,
      serviceDate,
      aliquotaPct:Number(aliquota||0)||null,
      status:'rascunho',
      nfseNumber:'',
      verificationCode:'',
      gissInternalId:'',
      gissProtocol:'',
      lastError:'',
      gissResponse:null,
      manual:true
    };

    nfse.push(row);
    saveData('nfse',nfse);
    closeModal();
    if(typeof renderAll==='function')renderAll();
    else if(typeof renderNfse==='function')renderNfse();

    if(emitAfter){
      setTimeout(()=>{
        if(typeof emitNfseOne==='function')emitNfseOne(id);
      },80);
    }
  };

  const previousRenderNfse=window.renderNfse;
  if(typeof previousRenderNfse==='function'){
    window.renderNfse=function(){
      const out=previousRenderNfse.apply(this,arguments);
      injectNfAvulsaButton();
      return out;
    };
  }

  setTimeout(injectNfAvulsaButton,0);
})();
