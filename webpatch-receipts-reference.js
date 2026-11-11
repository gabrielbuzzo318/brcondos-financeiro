(function(){
  function receiptDue(row){
    const source=(Array.isArray(boletos)?boletos:[]).find(b=>String(b.id)===String(row?.sourceBoletoId||''));
    return String(row?.dueDate||row?.due||source?.due||row?.issueDate||'');
  }
  function ensureDueField(mode,row){
    const existing=document.querySelector(mode==='new'?'#rec_new_due, #rec_new_due_date':'#rec_due, #rec_edit_due');
    if(existing){
      if(mode==='edit')existing.value=receiptDue(row);
      return existing;
    }
    const anchor=document.getElementById(mode==='new'?'rec_new_date':'rec_date');
    const grid=anchor?.closest('.modal-grid');
    if(!anchor||!grid)return null;
    const container=document.createElement('div');
    container.innerHTML='<label style="display:block;font-weight:700;margin-bottom:6px">Vencimento</label><input type="date" id="rec_'+(mode==='new'?'new_':'')+'due" style="width:100%;padding:11px;border:1px solid #d9e0e5;border-radius:7px" />';
    anchor.parentElement?.after(container);
    const input=container.querySelector('input');
    if(input)input.value=mode==='edit'?receiptDue(row):anchor.value;
    return input;
  }
  function getDue(mode){
    return String(document.querySelector(mode==='new'?'#rec_new_due, #rec_new_due_date':'#rec_due, #rec_edit_due')?.value||'').trim();
  }
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
    ensureDueField('new');
    return result;
  };
  const prevSaveNew=window.saveNewReceipt;
  if(typeof prevSaveNew==='function')window.saveNewReceipt=function(){
    const description=String(document.getElementById('rec_reference')?.value||'').trim();
    if(!description)return alert('Informe a que se refere o recibo.');
    const due=getDue('new');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(due))return alert('Informe a data de vencimento do recibo.');
    const before=new Set(receipts.map(r=>r.id));
    const result=prevSaveNew.apply(this,arguments);
    const created=receipts.find(r=>!before.has(r.id));
    if(created){
      created.description=description;
      created.dueDate=due;
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
    ensureDueField('edit',row);
    return result;
  };
  const prevSaveEdit=window.saveReceiptEdit;
  if(typeof prevSaveEdit==='function')window.saveReceiptEdit=function(id){
    const description=String(document.getElementById('rec_reference')?.value||'').trim();
    if(!description)return alert('Informe a que se refere o recibo.');
    const due=getDue('edit');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(due))return alert('Informe a data de vencimento do recibo.');
    const result=prevSaveEdit.apply(this,arguments);
    const row=receipts.find(r=>r.id===id);
    if(row && !document.getElementById('rec_reference')){
      row.description=description;
      row.dueDate=due;
      saveData('receipts',receipts);
      renderAll();
    }
    return result;
  };
  window.receiptPageHtml=function(row){
    const c=receiptClient(row);
    const clientName=String(c?.name||row.client||'-').toUpperCase();
    const address=receiptAddress(c);
    const description=String(row.description||'Honorários administrativos').split(/\r?\n/).map(s=>s.trim().replace(/^[•\-*]\s*/, '')).filter(Boolean).map(s=>'<div style="margin:5px 0;padding-left:20px;text-indent:-14px">• '+esc(s)+'</div>').join('');
    return '<section class="receipt-page">'+
      '<div class="receipt-number">RECIBO Nº '+esc(row.receiptNumber||'-')+'</div>'+
      '<div class="receipt-logo-slot"></div>'+
      '<h1>RECIBO DE PRESTAÇÃO DE SERVIÇO</h1>'+
      '<div class="receipt-text">RECEBEMOS DE <b><u>'+esc(clientName)+'</u></b>, SITO A '+esc(address)+
      ', A IMPORTÂNCIA DE <b>'+money(row.value)+'</b> ('+esc(receiptAmountWords(row.value))+'), REFERENTE A:<div style="margin-top:9mm;line-height:1.5">'+description+'</div>'+
      '</div>'+
      '<div class="receipt-date">São José do Rio Preto/SP, '+esc(receiptDateLong(receiptDue(row)))+'</div>'+
      '<div class="receipt-sign"><div class="receipt-line"></div>'+
      '<div style="font-weight:700">BRCONDOS S. J. RIO PRETO</div>'+
      
      '<div style="font-weight:700">CNPJ 29.941.735/0001-00</div></div></section>';
  };
})();