(function(){
  const CLOSING_KEY='brcondos_dre_closures_v1';
  const monthNames=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  function periodLabel(prefix){
    const [y,m]=String(prefix||'').split('-').map(Number);
    return `${monthNames[(m||1)-1]||''}/${y||''}`;
  }
  function previousPrefix(prefix){
    const [y,m]=String(prefix||'').split('-').map(Number);
    if(!y||!m)return'';
    const d=new Date(Date.UTC(y,m-2,1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
  }
  function isClosed(prefix){
    try{
      const state=JSON.parse(localStorage.getItem(CLOSING_KEY)||'{}');
      return state?.[prefix]?.closed===true;
    }catch(_){return false;}
  }
  function clean(v){return String(v||'').replace(/\s+/g,' ').trim();}

  function ensureStyle(){
    if(document.getElementById('dre-pdf-style'))return;
    const style=document.createElement('style');
    style.id='dre-pdf-style';
    style.textContent=`
      #view-dre .dre-pdf-btn{
        height:30px;padding:0 10px;border-radius:8px;border:1px solid #d7dee3;background:#fff;color:#33424c;
        font-size:12px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;
        transition:.15s ease;white-space:nowrap;
      }
      #view-dre .dre-pdf-btn:hover{background:#f3f6f8;border-color:#c5cfd6}
      #view-dre .dre-pdf-btn:disabled{opacity:.6;cursor:wait}
    `;
    document.head.appendChild(style);
  }

  function addPdfButton(){
    ensureStyle();
    const actions=document.querySelector('#view-dre .dre-closing-actions');
    if(!actions||actions.querySelector('.dre-pdf-btn'))return;
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='dre-pdf-btn';
    btn.textContent='PDF';
    btn.title='Gerar PDF da DRE desta competência';
    btn.onclick=()=>generateDrePdf();
    const closingBtn=actions.querySelector('.dre-closing-btn');
    if(closingBtn)actions.insertBefore(btn,closingBtn);else actions.appendChild(btn);
  }

  function collectPayload(){
    const prefix=String(document.getElementById('dre_month')?.value||'').trim();
    if(!/^\d{4}-\d{2}$/.test(prefix))throw new Error('Selecione uma competência válida na DRE.');
    const prev=previousPrefix(prefix);
    const demo=document.querySelector('#view-dre .grid.two-cols > .card');
    const indicatorsCard=document.querySelectorAll('#view-dre .grid.two-cols > .card')?.[1];
    if(!demo)throw new Error('Não foi possível localizar o demonstrativo da DRE.');

    const rows=[];
    [...demo.children].forEach(el=>{
      if(el.classList.contains('dre-group-row')){
        const parts=[...el.children];
        rows.push({kind:'group',label:clean(parts[0]?.textContent),previous:clean(parts[1]?.textContent),current:clean(parts[2]?.textContent),percentage:clean(el.querySelector('.dre-percent-group')?.textContent||parts[3]?.textContent)});
        return;
      }
      if(!el.classList.contains('dre-compare-row'))return;
      const label=clean(el.firstElementChild?.textContent);
      const previous=clean(el.querySelector('.dre-compare-prev')?.textContent);
      const current=clean(el.querySelector('.dre-compare-current')?.textContent);
      rows.push({
        kind:el.classList.contains('result')?'result':el.classList.contains('total')?'total':'row',
        label,previous,current,
        percentage:clean(el.querySelector('.dre-percent-current')?.textContent)
      });
    });

    const indicators=[];
    if(indicatorsCard){
      [...indicatorsCard.querySelectorAll(':scope > .dre-row')].slice(0,3).forEach(row=>{
        const children=[...row.children];
        if(children.length>=2)indicators.push({label:clean(children[0]?.textContent),value:clean(children[children.length-1]?.textContent)});
      });
    }

    return{
      period:prefix,
      periodLabel:periodLabel(prefix),
      previousLabel:periodLabel(prev).split('/')[0],
      currentLabel:periodLabel(prefix).split('/')[0],
      status:isClosed(prefix)?'Concluída':'Em fechamento',
      rows,
      indicators
    };
  }

  window.generateDrePdf=async function(){
    const btn=document.querySelector('#view-dre .dre-pdf-btn');
    const oldText=btn?.textContent||'PDF';
    try{
      if(btn){btn.disabled=true;btn.textContent='Gerando…';}
      const payload=collectPayload();
      const response=await fetch('/api/dre/pdf',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(payload)
      });
      if(!response.ok){
        const data=await response.json().catch(()=>({}));
        throw new Error(data.error||'Não foi possível gerar o PDF da DRE.');
      }
      const blob=await response.blob();
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url;
      a.download=`DRE-BRCONDOS-${payload.period}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),30000);
    }catch(err){
      alert(err?.message||'Não foi possível gerar o PDF da DRE.');
    }finally{
      if(btn){btn.disabled=false;btn.textContent=oldText;}
    }
  };

  const oldToggle=window.toggleDreClosing;
  if(typeof oldToggle==='function'){
    window.toggleDreClosing=function(){
      const out=oldToggle.apply(this,arguments);
      setTimeout(addPdfButton,0);
      return out;
    };
  }

  const oldRenderDRE=window.renderDRE;
  if(typeof oldRenderDRE==='function'){
    window.renderDRE=function(){
      const out=oldRenderDRE.apply(this,arguments);
      setTimeout(addPdfButton,0);
      return out;
    };
  }

  setTimeout(addPdfButton,0);
})();
