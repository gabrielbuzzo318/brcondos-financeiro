(function(){
  function closeNfsePdfViewer(){
    document.getElementById('brNfsePdfViewerOverlay')?.remove();
  }

  function safePdfName(client,numero){
    const nome=String(client||'NFS-e')
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g,' ')
      .replace(/\s+/g,' ')
      .trim()||'NFS-e';
    return `${nome} - NF ${numero}.pdf`;
  }

  window.abrirPdfGiss=function(id){
    const row=(nfse||[]).find(x=>Number(x.id)===Number(id));
    if(!row)return;

    const idInterno=String(row.gissInternalId||'').trim();
    const numero=String(row.nfseNumber||'').trim();
    const rps=String(row.gissRpsNumber||row.rpsNumber||'').trim();
    const verificacao=String(row.verificationCode||'').trim();
    const cliente=String(row.client||'').trim();
    if(!numero){
      return alert('O número da NFS-e ainda não foi carregado. Clique em Atualizar Giss primeiro.');
    }
    if(!rps){
      return alert('O RPS desta NFS-e ainda não foi carregado. Clique em Atualizar Giss primeiro.');
    }

    closeNfsePdfViewer();

    const params=new URLSearchParams({numero,rps});
    if(verificacao)params.set('verificacao',verificacao);
    const base=`/api/nfse/pdf/${encodeURIComponent(idInterno||'0')}?${params.toString()}`;
    const src=base;
    const downloadUrl=`${base}&download=1`;
    const downloadName=safePdfName(cliente,numero);

    const overlay=document.createElement('div');
    overlay.id='brNfsePdfViewerOverlay';
    Object.assign(overlay.style,{
      position:'fixed',inset:'0',zIndex:'999999',background:'rgba(15,23,42,.72)',
      display:'flex',alignItems:'center',justifyContent:'center',padding:'18px'
    });

    const panel=document.createElement('div');
    Object.assign(panel.style,{
      width:'min(1240px,97vw)',height:'min(900px,95vh)',background:'#fff',borderRadius:'16px',
      boxShadow:'0 24px 80px rgba(0,0,0,.35)',display:'flex',flexDirection:'column',overflow:'hidden'
    });

    const header=document.createElement('div');
    Object.assign(header.style,{
      display:'flex',alignItems:'center',justifyContent:'space-between',gap:'12px',padding:'14px 16px',
      borderBottom:'1px solid #e5e7eb',background:'#fff'
    });

    const titleWrap=document.createElement('div');
    titleWrap.style.minWidth='0';
    const title=document.createElement('div');
    title.textContent=`NFS-e ${numero}${cliente?' • '+cliente:''}`.trim();
    Object.assign(title.style,{fontWeight:'800',fontSize:'16px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'});
    const sub=document.createElement('div');
    sub.textContent=`RPS ${rps} • ${typeof money==='function'?money(row.value):row.value||''}`;
    Object.assign(sub.style,{fontSize:'12px',color:'#6b7280',marginTop:'3px'});
    titleWrap.append(title,sub);

    const actions=document.createElement('div');
    Object.assign(actions.style,{display:'flex',alignItems:'center',gap:'8px',flexShrink:'0'});

    const download=document.createElement('a');
    download.className='btn primary';
    download.textContent='⬇ Baixar PDF';
    download.href=downloadUrl;
    download.setAttribute('download',downloadName);
    download.style.textDecoration='none';
    download.addEventListener('click',async e=>{
      e.preventDefault();
      const oldText=download.textContent;
      try{
        download.textContent='Baixando...';
        download.style.pointerEvents='none';
        const resp=await fetch(downloadUrl,{cache:'no-store'});
        if(!resp.ok)throw new Error(`HTTP ${resp.status}`);
        const blob=await resp.blob();
        if(!String(blob.type||'').toLowerCase().includes('pdf'))throw new Error('A resposta não é um PDF.');
        const url=URL.createObjectURL(blob);
        const a=document.createElement('a');
        a.href=url;
        a.download=downloadName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(()=>URL.revokeObjectURL(url),1500);
      }catch(err){
        alert(`Não foi possível baixar o PDF.\n${err?.message||err}`);
      }finally{
        download.textContent=oldText;
        download.style.pointerEvents='';
      }
    });

    const close=document.createElement('button');
    close.type='button';close.className='btn';close.textContent='Fechar';
    close.addEventListener('click',closeNfsePdfViewer);

    actions.append(download,close);
    header.append(titleWrap,actions);

    const frameWrap=document.createElement('div');
    Object.assign(frameWrap.style,{flex:'1',minHeight:'0',background:'#f3f4f6',padding:'10px'});
    const frame=document.createElement('iframe');
    frame.src=src;
    frame.title=`PDF da NFS-e ${numero}`;
    Object.assign(frame.style,{width:'100%',height:'100%',border:'0',borderRadius:'10px',background:'#fff'});
    frameWrap.appendChild(frame);

    panel.append(header,frameWrap);
    overlay.appendChild(panel);
    overlay.addEventListener('click',e=>{if(e.target===overlay)closeNfsePdfViewer();});

    document.addEventListener('keydown',function escClose(e){
      if(e.key==='Escape'&&document.getElementById('brNfsePdfViewerOverlay')){
        closeNfsePdfViewer();
        document.removeEventListener('keydown',escClose);
      }
    });

    document.body.appendChild(overlay);
  };
})();