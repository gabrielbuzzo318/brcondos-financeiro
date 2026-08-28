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

  function downloadPayableAttachment(payable){
    if(!payable)return;
    const a=document.createElement('a');
    if(payable.attachmentRef){
      a.href=`/api/payables/attachments/${encodeURIComponent(payable.attachmentRef)}`;
    }else if(payable.attachmentData){
      a.href=payable.attachmentData;
    }else return;
    a.download=payable.attachmentName||'anexo';
    document.body.appendChild(a);a.click();a.remove();
  }

  function closeAttachmentViewer(){
    document.getElementById('brAttachmentViewerOverlay')?.remove();
  }

  function openAttachmentViewer(payable){
    if(!payable)return;
    closeAttachmentViewer();

    const src=payable.attachmentRef
      ?`/api/payables/attachments/${encodeURIComponent(payable.attachmentRef)}?inline=1`
      :(payable.attachmentData||'');
    if(!src)return alert('Esta conta não possui anexo.');

    const overlay=document.createElement('div');
    overlay.id='brAttachmentViewerOverlay';
    Object.assign(overlay.style,{
      position:'fixed',inset:'0',zIndex:'999999',background:'rgba(15,23,42,.72)',
      display:'flex',alignItems:'center',justifyContent:'center',padding:'18px'
    });

    const panel=document.createElement('div');
    Object.assign(panel.style,{
      width:'min(1220px,97vw)',height:'min(860px,94vh)',background:'#fff',borderRadius:'16px',
      boxShadow:'0 24px 80px rgba(0,0,0,.35)',display:'flex',flexDirection:'column',overflow:'hidden'
    });

    const header=document.createElement('div');
    Object.assign(header.style,{
      display:'flex',alignItems:'center',justifyContent:'space-between',gap:'12px',padding:'14px 16px',
      borderBottom:'1px solid #e5e7eb',background:'#fff'
    });

    const title=document.createElement('div');
    title.textContent=payable.attachmentName||'Anexo';
    Object.assign(title.style,{fontWeight:'800',fontSize:'16px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'});

    const actions=document.createElement('div');
    Object.assign(actions.style,{display:'flex',alignItems:'center',gap:'8px',flexShrink:'0'});

    const download=document.createElement('button');
    download.type='button';download.className='btn primary';download.textContent='⬇ Baixar arquivo';
    download.addEventListener('click',()=>downloadPayableAttachment(payable));

    const close=document.createElement('button');
    close.type='button';close.className='btn';close.textContent='Fechar';
    close.addEventListener('click',closeAttachmentViewer);

    actions.append(download,close);
    header.append(title,actions);

    const frameWrap=document.createElement('div');
    Object.assign(frameWrap.style,{flex:'1',minHeight:'0',background:'#f3f4f6',padding:'10px'});
    const frame=document.createElement('iframe');
    frame.src=src;
    frame.title=payable.attachmentName||'Visualização do anexo';
    Object.assign(frame.style,{width:'100%',height:'100%',border:'0',borderRadius:'10px',background:'#fff'});
    frameWrap.appendChild(frame);

    panel.append(header,frameWrap);
    overlay.appendChild(panel);
    overlay.addEventListener('click',e=>{if(e.target===overlay)closeAttachmentViewer();});
    document.addEventListener('keydown',function escClose(e){
      if(e.key==='Escape'&&document.getElementById('brAttachmentViewerOverlay')){
        closeAttachmentViewer();document.removeEventListener('keydown',escClose);
      }
    });
    document.body.appendChild(overlay);
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
        btn.title=payable.attachmentName||'Visualizar anexo';
        btn.addEventListener('click',e=>{
          e.preventDefault();
          e.stopPropagation();
          openAttachmentViewer(payable);
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
