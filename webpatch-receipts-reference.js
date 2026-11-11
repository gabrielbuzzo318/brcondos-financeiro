(function(){
  function addReferenceField(id){
    const input=document.getElementById(id==='new'?'rec_new_value':'rec_value');
    if(!input)return;
    const grid=input.closest('.modal-grid');
    if(!grid||grid.querySelector('#rec_reference'))return;
    const box=document.createElement('div');
    box.style.gridColumn='1 / -1';
    box.innerHTML='<label style="display:block;font-weight:700;margin-bottom:6px">Referente a / Descrição do recibo</label><textarea id="rec_reference" rows="3" style="width:100%;padding:11px;border:1px solid #d9e0e5;border-radius:7px;resize:vertical" placeholder="Ex.: Impressão de livros"></textarea>';
    grid.appendChild(box);
  }
  const prevOpenNew=window.openNewReceipt;
  if(typeof prevOpenNew==='function')window.openNewReceipt=function(){
    const result=prevOpenNew.apply(this,arguments);
    addReferenceField('new');
    return result;
  };
  const prevSaveNew=window.saveNewReceipt;
  if(typeof prevSaveNew==='function')window.saveNewReceipt=function(){
    const description=String(document.getElementById('rec_reference')?.value||'').trim();
    if(!description)return alert('Informe a que se refere o recibo.');
    const before=new Set(receipts.map(r=>r.id));
    const result=prevSaveNew.apply(this,arguments);
    const created=receipts.find(r=>!before.has(r.id));
    if(created){
      created.description=description;
      saveData('receipts',receipts);
      renderAll();
    }
    return result;
  };
  const prevOpenEdit=window.openReceiptEdit;
  if(typeof prevOpenEdit==='function')window.openReceiptEdit=function(id){
    const result=prevOpenEdit.apply(this,arguments);
    addReferenceField('edit');
    const row=receipts.find(r=>r.id===id);
    const input=document.getElementById('rec_reference');
    if(input)input.value=String(row?.description||'');
    return result;
  };
  const prevSaveEdit=window.saveReceiptEdit;
  if(typeof prevSaveEdit==='function')window.saveReceiptEdit=function(id){
    const description=String(document.getElementById('rec_reference')?.value||'').trim();
    if(!description)return alert('Informe a que se refere o recibo.');
    const result=prevSaveEdit.apply(this,arguments);
    const row=receipts.find(r=>r.id===id);
    if(row && !document.getElementById('rec_reference')){
      row.description=description;
      saveData('receipts',receipts);
      renderAll();
    }
    return result;
  };
  window.receiptPageHtml=function(row){
    const c=receiptClient(row);
    const clientName=String(c?.name||row.client||'-').toUpperCase();
    const address=receiptAddress(c);
    const description=String(row.description||'Honorários administrativos').split(/\r?\n/).map(s=>s.trim()).filter(Boolean).map(s=>esc(s)).join('<br>');
    return '<section class="receipt-page">'+
      '<div class="receipt-number">RECIBO Nº '+esc(row.receiptNumber||'-')+'</div>'+
      '<div class="receipt-logo-slot"></div>'+
      '<h1>RECIBO DE PRESTAÇÃO DE SERVIÇO</h1>'+
      '<div class="receipt-text">RECEBEMOS DE <b><u>'+esc(clientName)+'</u></b>, SITO A '+esc(address)+
      ', A IMPORTÂNCIA DE <b>'+money(row.value)+'</b> ('+esc(receiptAmountWords(row.value))+'), REFERENTE A:<div style="margin-top:9mm;line-height:1.5">'+description+'</div>'+
      '<div style="margin-top:8mm">COMPETÊNCIA: '+esc(receiptCompetenceLabel(row.competence))+'</div></div>'+
      '<div class="receipt-date">São José do Rio Preto/SP, '+esc(receiptDateLong(row.issueDate))+'</div>'+
      '<div class="receipt-sign"><div class="receipt-line"></div>'+
      '<div style="font-weight:700">BRCONDOS S. J. RIO PRETO</div>'+
      
      '<div style="font-weight:700">CNPJ 29.941.735/0001-00</div></div></section>';
  };
})();