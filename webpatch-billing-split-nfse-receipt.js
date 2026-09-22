(function(){
  function num(v){const n=Number(v||0);return Number.isFinite(n)?n:0;}
  function isLockedNf(x){return ['emitida_nfse','cancelada_nfse'].includes(String(x?.status||''));}
  function isLockedReceipt(x){return String(x?.status||'')==='gerado';}

  function receiptLinesFromBreakdown(b){
    const d=b?.billingBreakdown||{};
    const lines=[];
    const add=(label,value)=>{value=num(value);if(value>0)lines.push(label+' - '+money(value));};
    add('Módulo cobrança',d.moduloCobranca);
    add('Módulo manutenção',d.moduloManutencao);
    add('Assemb. Extra',d.assembleiaExtra);
    const rpa=num(d.rpa);
    if(rpa>0){
      let line='RPA - '+money(rpa);
      const details=String(d.detalhes||'').trim();
      if(details)line+=' - '+details;
      lines.push(line);
    }
    return lines;
  }

  function extrasTotal(b){
    const d=b?.billingBreakdown||{};
    return num(d.moduloCobranca)+num(d.moduloManutencao)+num(d.assembleiaExtra)+num(d.rpa);
  }

  function syncSplitBilling(){
    const source=boletos.filter(b=>{
      if(!b.competence)return false;
      const d=b.billingBreakdown||{};
      const isNewCont=String(b.section||'').toUpperCase()==='CONTABIL' && num(d.honorarioCont)>0;
      return isNewCont || (b.section!=='CONTABIL' && !/CONTABIL/i.test(String(b.description||'')));
    });
    let nfCreated=0,nfUpdated=0,recCreated=0,recUpdated=0,ignored=0,missingClient=0,locked=0,legacy=0;

    source.forEach((b,i)=>{
      const c=clients.find(x=>x.id===b.clientId)||findClientByLooseName(b.client);
      if(!c){missingClient++;return;}

      const split=!!(b.billingBreakdown && typeof b.billingBreakdown==='object');
      if(!split){
        // Mantém a lógica antiga para boletos históricos/PDF que não vieram da nova planilha.
        const nfExisting=nfse.find(x=>String(x.sourceBoletoId)===String(b.id));
        const recExisting=receipts.find(x=>String(x.sourceBoletoId)===String(b.id));

        if(c.billingDocument==='receipt'){
          if(recExisting){ignored++;return;}
          if(nfExisting){
            if(isLockedNf(nfExisting)){locked++;return;}
            nfse=nfse.filter(x=>x.id!==nfExisting.id);
          }
          const issueDate=receiptDefaultIssueDate(b.competence,b.due||'');
          const year=String(b.competence||issueDate).slice(0,4);
          receipts.push(normalizeReceipt({
            id:Date.now()+i+Math.floor(Math.random()*100),
            sourceBoletoId:b.id,clientId:c.id,client:c.name||b.client,
            competence:b.competence,issueDate,value:Number(b.value||0),
            description:'Honorários administrativos',receiptNumber:nextReceiptNumber(year),status:'pendente'
          }));
          recCreated++;legacy++;return;
        }

        if(nfExisting){ignored++;return;}
        if(recExisting){
          if(isLockedReceipt(recExisting)){locked++;return;}
          receipts=receipts.filter(x=>x.id!==recExisting.id);
        }
        nfse.push({
          id:Date.now()+i+Math.floor(Math.random()*100),sourceBoletoId:b.id,clientId:c.id||b.clientId||0,client:b.client,
          competence:b.competence,value:Number(b.value||0),description:'Administração de Condomínios.',
          rpsNumber:nextRpsNumber(),issueDate:today(),serviceDate:'',aliquotaPct:null,status:'rascunho',
          nfseNumber:'',verificationCode:'',gissProtocol:'',lastError:'',gissResponse:null
        });
        nfCreated++;legacy++;return;
      }

      const isCont=String(b.section||'').toUpperCase()==='CONTABIL' && num(b.billingBreakdown.honorarioCont)>0;
      const honorario=num(b.billingBreakdown.honorarioAdm);
      const honorarioCont=num(b.billingBreakdown.honorarioCont);
      const receiptValue=isCont?honorarioCont:extrasTotal(b);
      const receiptLines=isCont
        ? ['Honorário Cont - '+money(honorarioCont)]
        : receiptLinesFromBreakdown(b);
      let nfExisting=nfse.find(x=>String(x.sourceBoletoId)===String(b.id));
      let recExisting=receipts.find(x=>String(x.sourceBoletoId)===String(b.id));

      // Quadro HONORÁRIOS CONTÁBEIS - ASSOCIAÇÕES: nunca gera NFS-e.
      if(isCont){
        if(nfExisting){
          if(isLockedNf(nfExisting)){locked++;}
          else{nfse=nfse.filter(x=>x.id!==nfExisting.id);nfUpdated++;}
        }
        if(receiptValue>0){
          const issueDate=receiptDefaultIssueDate(b.competence,b.due||'');
          const receiptDescription=receiptLines.join('\n');
          if(recExisting){
            if(isLockedReceipt(recExisting)){
              if(Math.abs(num(recExisting.value)-receiptValue)>0.005)locked++;
            }else{
              recExisting.clientId=c.id;
              recExisting.client=c.name||b.client;
              recExisting.competence=b.competence;
              recExisting.issueDate=issueDate;
              recExisting.value=receiptValue;
              recExisting.description=receiptDescription;
              recExisting.details='';
              recExisting.billingSplitType='honorario_cont';
              recUpdated++;
            }
          }else{
            const year=String(b.competence||issueDate).slice(0,4);
            receipts.push(normalizeReceipt({
              id:Date.now()+i+7000+Math.floor(Math.random()*100),
              sourceBoletoId:b.id,clientId:c.id,client:c.name||b.client,
              competence:b.competence,issueDate,value:receiptValue,
              description:receiptDescription,details:'',
              receiptNumber:nextReceiptNumber(year),status:'pendente',billingSplitType:'honorario_cont'
            }));
            recCreated++;
          }
        }
        return;
      }

      // NFS-e = SOMENTE HONORÁRIO ADM do quadro administrativo.
      if(honorario>0){
        if(nfExisting){
          if(isLockedNf(nfExisting)){
            if(Math.abs(num(nfExisting.value)-honorario)>0.005)locked++;
          }else{
            nfExisting.clientId=c.id||b.clientId||0;
            nfExisting.client=c.name||b.client;
            nfExisting.competence=b.competence;
            nfExisting.value=honorario;
            nfExisting.description='Administração de Condomínios.';
            nfExisting.billingSplitType='honorario_adm';
            nfUpdated++;
          }
        }else{
          nfse.push({
            id:Date.now()+i+Math.floor(Math.random()*100),sourceBoletoId:b.id,
            clientId:c.id||b.clientId||0,client:c.name||b.client,
            competence:b.competence,value:honorario,description:'Administração de Condomínios.',
            rpsNumber:nextRpsNumber(),issueDate:today(),serviceDate:'',aliquotaPct:null,status:'rascunho',
            nfseNumber:'',verificationCode:'',gissProtocol:'',lastError:'',gissResponse:null,
            billingSplitType:'honorario_adm'
          });
          nfCreated++;
        }
      }else if(nfExisting && !isLockedNf(nfExisting)){
        nfse=nfse.filter(x=>x.id!==nfExisting.id);
        nfUpdated++;
      }

      // Recibo = TODOS OS DEMAIS CAMPOS.
      if(receiptValue>0){
        const issueDate=receiptDefaultIssueDate(b.competence,b.due||'');
        const receiptDescription=receiptLines.join('\n');
        if(recExisting){
          if(isLockedReceipt(recExisting)){
            if(Math.abs(num(recExisting.value)-receiptValue)>0.005)locked++;
          }else{
            recExisting.clientId=c.id;
            recExisting.client=c.name||b.client;
            recExisting.competence=b.competence;
            recExisting.issueDate=issueDate;
            recExisting.value=receiptValue;
            recExisting.description=receiptDescription;
            recExisting.details=String(b.billingBreakdown.detalhes||'');
            recExisting.billingSplitType='extras';
            recUpdated++;
          }
        }else{
          const year=String(b.competence||issueDate).slice(0,4);
          receipts.push(normalizeReceipt({
            id:Date.now()+i+5000+Math.floor(Math.random()*100),
            sourceBoletoId:b.id,clientId:c.id,client:c.name||b.client,
            competence:b.competence,issueDate,value:receiptValue,
            description:receiptDescription,details:String(b.billingBreakdown.detalhes||''),
            receiptNumber:nextReceiptNumber(year),status:'pendente',billingSplitType:'extras'
          }));
          recCreated++;
        }
      }else if(recExisting && !isLockedReceipt(recExisting)){
        receipts=receipts.filter(x=>x.id!==recExisting.id);
        recUpdated++;
      }
    });

    saveData('nfse',nfse);
    saveData('receipts',receipts);
    renderAll();

    alert(
      'SINCRONIZAÇÃO CONCLUÍDA ✅\n\n'+
      'NFS-e (somente Honorário Adm): '+(nfCreated+nfUpdated)+'\n'+
      'Recibos (demais valores + Honorário Cont): '+(recCreated+recUpdated)+'\n'+
      'Já sincronizados: '+ignored+'\n'+
      'Cliente não encontrado: '+missingClient+'\n'+
      'Documentos já emitidos/gerados e preservados: '+locked+
      (legacy?'\n\n'+legacy+' boleto(s) antigo(s) mantiveram a regra anterior.':'')
    );
  }

  window.syncBillingFromBoletos=syncSplitBilling;
  window.syncNfseFromBoletos=syncSplitBilling;

  const originalReceiptPage=window.receiptPageHtml;
  window.receiptPageHtml=function(row){
    if(!['extras','honorario_cont'].includes(String(row?.billingSplitType||''))){
      return originalReceiptPage(row);
    }
    const c=receiptClient(row);
    const clientName=String(c?.name||row.client||'-').toUpperCase();
    const address=receiptAddress(c);
    const details=String(row.description||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    const list=details.map(x=>'<div style="margin:5px 0"><b>• '+esc(x)+'</b></div>').join('');
    return `<section class="receipt-page">
      <div class="receipt-number">RECIBO Nº ${esc(row.receiptNumber||'-')}</div>
      <div class="receipt-logo-slot"></div>
      <h1>RECIBO DE PRESTAÇÃO DE SERVIÇO</h1>
      <div class="receipt-text">
        RECEBEMOS DE <b><u>${esc(clientName)}</u></b>, SITO A ${esc(address)}, A IMPORTÂNCIA DE
        <b>${money(row.value)}</b> (${esc(receiptAmountWords(row.value))}), REFERENTE AOS SERVIÇOS DA COMPETÊNCIA
        ${esc(receiptCompetenceLabel(row.competence))}:
        <div style="margin-top:10mm;text-transform:none;line-height:1.45">${list}</div>
      </div>
      <div class="receipt-date">São José do Rio Preto/SP, ${esc(receiptDateLong(row.issueDate))}</div>
      <div class="receipt-sign">
        <div style="font-family:'Brush Script MT','Segoe Script','Lucida Handwriting',cursive;font-size:26px;font-style:italic;margin-bottom:6px;">Marco Antonio Dosualdo</div>
        <div class="receipt-line"></div>
        <div style="font-weight:700">COMARC ADMINISTRAÇÃO DE CONDOMÍNIOS LTDA</div>
        <div style="font-weight:700">UNIDADE SÃO JOSÉ DO RIO PRETO</div>
        <div style="font-weight:700">CNPJ 29.941.735/0001-00</div>
      </div>
    </section>`;
  };

  function updateReceiptsHelp(){
    const view=document.getElementById('view-recibos');
    if(!view)return;
    const subtitle=view.querySelector('.section-title span');
    if(subtitle)subtitle.textContent='Recibos dos módulos, assembleias extras, RPAs e honorários contábeis das associações';
    const notice=view.querySelector('.notice');
    if(notice)notice.innerHTML='<b>Regra da planilha nova:</b> no quadro ADM, a NFS-e recebe somente <b>Honorário Adm</b> e os demais itens viram Recibo. No quadro <b>Honorários Contábeis - Associações</b>, <b>não é criada NFS-e</b>: o Honorário Cont é emitido somente por Recibo.';
  }

  const oldRenderReceipts=window.renderReceipts;
  if(typeof oldRenderReceipts==='function'){
    window.renderReceipts=function(){
      const r=oldRenderReceipts.apply(this,arguments);
      try{updateReceiptsHelp();}catch(_){}
      return r;
    };
  }
})();