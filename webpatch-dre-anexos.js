(function(){
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();

  function isoFromBR(v){
    const m=String(v||'').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return m?`${m[3]}-${m[2]}-${m[1]}`:'';
  }

  function numberFromBR(v){
    const raw=String(v||'').replace(/R\$/gi,'').replace(/\s/g,'').replace(/\./g,'').replace(',','.');
    const n=Number(raw.replace(/[^0-9+\-.]/g,''));
    return Number.isFinite(n)?n:0;
  }

  function feeValue(t){
    return Math.max(0,Number(t?.fine||0))+Math.max(0,Number(t?.interest||0));
  }

  function baseValue(t){
    if(t?.baseValue!==undefined&&t?.baseValue!==null&&t?.baseValue!=='')return Number(t.baseValue||0);
    return Math.max(0,Number(t?.value||0)-feeValue(t));
  }

  function findTransaction(cells){
    const date=isoFromBR(cells[0]?.textContent);
    const description=norm(cells[1]?.textContent);
    const category=norm(cells[2]?.textContent);
    const party=norm(cells[3]?.textContent);
    const amount=Math.abs(numberFromBR(cells[5]?.textContent));
    const isFees=category===norm('Juros e Multas');

    const candidates=transactions.filter(t=>{
      if(String(t.date||'')!==date)return false;
      if(t.status!=='pago')return false;
      if(party&&norm(t.party)!==party)return false;
      if(isFees)return Math.abs(feeValue(t)-amount)<0.011;
      if(category&&norm(t.category)!==category)return false;
      return Math.abs(baseValue(t)-amount)<0.011 || Math.abs(Number(t.value||0)-amount)<0.011;
    });

    if(candidates.length<=1)return candidates[0]||null;
    return candidates.find(t=>description&&norm(t.description)===description)||candidates[0]||null;
  }

  function attachmentForTransaction(t){
    if(!t)return null;
    return payables.find(p=>
      String(p.flowId||'')===String(t.id||'') &&
      (p.attachmentRef||p.attachmentData)
    )||null;
  }

  function decorateDreDetailsAttachments(){
    const modal=document.getElementById('modal')||document.getElementById('modalRoot');
    const table=modal?.querySelector('.table-wrap table');
    if(!table||table.dataset.dreAttachmentsReady==='1')return;

    const header=table.querySelector('thead tr');
    if(!header)return;
    const th=document.createElement('th');
    th.textContent='Anexo';
    const valueHeader=header.lastElementChild;
    header.insertBefore(th,valueHeader);

    table.querySelectorAll('tbody tr').forEach(row=>{
      const cells=[...row.children];
      if(cells.length===1){
        cells[0].colSpan=7;
        return;
      }
      if(cells.length<6)return;

      const tx=findTransaction(cells);
      const payable=attachmentForTransaction(tx);
      const td=document.createElement('td');
      td.style.whiteSpace='nowrap';

      if(payable){
        const btn=document.createElement('button');
        btn.type='button';
        btn.className='btn small';
        btn.textContent='📎 Anexo';
        btn.title=payable.attachmentName||'Baixar anexo';
        btn.addEventListener('click',e=>{
          e.preventDefault();
          e.stopPropagation();
          if(typeof openAttachment==='function')openAttachment(payable.id);
        });
        td.appendChild(btn);
      }else{
        td.innerHTML='<span class="subtle">—</span>';
      }

      row.insertBefore(td,row.lastElementChild);
    });

    table.dataset.dreAttachmentsReady='1';
    table.style.minWidth='1080px';
  }

  const oldOpenDreDetails=window.openDreDetails;
  if(typeof oldOpenDreDetails==='function'){
    window.openDreDetails=function(){
      const out=oldOpenDreDetails.apply(this,arguments);
      setTimeout(decorateDreDetailsAttachments,0);
      return out;
    };
  }
})();
