(function(){
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();

  function parseMoney(text){
    let raw=String(text||'').replace(/R\$/gi,'').replace(/\s/g,'');
    const negative=/^-/.test(raw)||/^\(.*\)$/.test(raw);
    raw=raw.replace(/[()]/g,'').replace(/\./g,'').replace(',','.').replace(/[^0-9.\-]/g,'');
    const n=Number(raw);
    if(!Number.isFinite(n))return 0;
    return negative&&n>0?-n:n;
  }

  function formatPct(value){
    return `${Number(value||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}%`;
  }

  function ensureStyle(){
    if(document.getElementById('br-dre-percent-style'))return;
    const style=document.createElement('style');
    style.id='br-dre-percent-style';
    style.textContent=`
      #view-dre .dre-compare-head,
      #view-dre .dre-compare-row,
      #view-dre .dre-group-row{
        grid-template-columns:minmax(0,1fr) minmax(105px,130px) minmax(105px,130px) minmax(72px,88px)!important;
      }
      #view-dre .dre-percent-head,
      #view-dre .dre-percent-current,
      #view-dre .dre-percent-group{
        text-align:right;
        white-space:nowrap;
      }
      #view-dre .dre-percent-head{color:#75808b;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em}
      #view-dre .dre-percent-current{font-size:11px;font-weight:800;color:#66727d;padding-right:3px}
      #view-dre .dre-percent-group{font-size:11px;font-weight:900;color:#53616b;padding-right:3px}
      #view-dre .dre-compare-row.result .dre-percent-current{font-weight:900}
      @media(max-width:720px){
        #view-dre .dre-compare-head,#view-dre .dre-compare-row,#view-dre .dre-group-row{
          grid-template-columns:minmax(150px,1fr) 105px 105px 78px!important;
          min-width:475px!important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function applyPercentages(){
    ensureStyle();
    const demo=document.querySelector('#view-dre .grid.two-cols > .card');
    if(!demo)return;
    const rows=[...demo.querySelectorAll(':scope > .dre-compare-row')];
    if(!rows.length)return;

    const revenueRow=rows.find(row=>norm(row.firstElementChild?.textContent).includes('receita operacional'));
    const revenue=parseMoney(revenueRow?.querySelector('.dre-compare-current')?.textContent||'');

    const head=demo.querySelector(':scope > .dre-compare-head');
    if(head&&!head.querySelector('.dre-percent-head')){
      const el=document.createElement('span');el.className='dre-percent-head';el.textContent='% Receita';head.appendChild(el);
    }

    rows.forEach(row=>{
      let el=row.querySelector(':scope > .dre-percent-current');
      if(!el){el=document.createElement('span');el.className='dre-percent-current';row.appendChild(el);}
      const current=parseMoney(row.querySelector('.dre-compare-current')?.textContent||'');
      const pct=revenue?current/revenue*100:0;
      el.textContent=formatPct(pct);
      el.title='Percentual desta linha sobre a Receita Operacional do mês selecionado';
    });

    demo.querySelectorAll(':scope > .dre-group-row').forEach(row=>{
      let el=row.querySelector(':scope > .dre-percent-group');
      if(!el){el=document.createElement('span');el.className='dre-percent-group';row.appendChild(el);}
      const values=row.querySelectorAll('.dre-group-value');
      const current=parseMoney(values[values.length-1]?.textContent||'');
      el.textContent=formatPct(revenue?current/revenue*100:0);
      el.title='Percentual do grupo sobre a Receita Operacional do mês selecionado';
    });
  }

  let timer=null;
  function schedule(){clearTimeout(timer);timer=setTimeout(applyPercentages,35);}

  const oldRender=window.renderDRE;
  if(typeof oldRender==='function')window.renderDRE=function(){const out=oldRender.apply(this,arguments);schedule();return out;};

  const obs=new MutationObserver(mutations=>{
    if(mutations.some(m=>m.target?.closest?.('#view-dre')||m.target?.id==='view-dre'))schedule();
  });
  const view=document.getElementById('view-dre');
  if(view)obs.observe(view,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})();
