(function(){
  const oldOpenReimbursement=window.openReimbursement;
  const oldSaveReimbursement=window.saveReimbursement;

  function parseBrValue(v){
    if(typeof parseMoneyBR==='function')return parseMoneyBR(v);
    let s=String(v??'').trim().replace(/R\$/gi,'').replace(/\s/g,'');
    if(!s)return 0;
    if(s.includes(',')&&s.includes('.'))s=s.replace(/\./g,'').replace(',','.');
    else if(s.includes(','))s=s.replace(',','.');
    const n=Number(s);
    return Number.isFinite(n)?n:0;
  }

  function formatBrValue(v){
    const n=typeof v==='number'?v:parseBrValue(v);
    if(!Number.isFinite(n))return '';
    return n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  }

  function prepareField(){
    const input=document.getElementById('rb_value');
    if(!input)return;
    const current=input.value;
    input.type='text';
    input.inputMode='decimal';
    input.autocomplete='off';
    input.placeholder='0,00';
    input.value=current?formatBrValue(current):'';
    input.addEventListener('focus',()=>{input.select();});
    input.addEventListener('blur',()=>{
      const n=parseBrValue(input.value);
      input.value=n?formatBrValue(n):'';
    });
  }

  if(typeof oldOpenReimbursement==='function'){
    window.openReimbursement=function(){
      const out=oldOpenReimbursement.apply(this,arguments);
      prepareField();
      return out;
    };
  }

  if(typeof oldSaveReimbursement==='function'){
    window.saveReimbursement=async function(){
      const input=document.getElementById('rb_value');
      if(input){
        const n=parseBrValue(input.value);
        if(!n)return alert('Informe um valor válido para o reembolso.');
        input.value=String(n);
      }
      return await oldSaveReimbursement.apply(this,arguments);
    };
  }
})();
