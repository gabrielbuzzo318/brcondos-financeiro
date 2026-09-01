(function(){
  function parseMoneyText(v){
    const raw=String(v||'').replace(/R\$/gi,'').replace(/\s/g,'').replace(/\./g,'').replace(',','.');
    const n=Number(raw.replace(/[^0-9+\-.]/g,''));
    return Number.isFinite(n)?n:0;
  }

  function colorRow(row){
    if(!row)return;
    const currentEl=row.querySelector('.dre-compare-current')||row.lastElementChild;
    const previousEl=row.querySelector('.dre-compare-prev');
    const percentEl=row.querySelector('.dre-percent-current');
    const labelEl=row.firstElementChild;
    const value=parseMoneyText(currentEl?.textContent||'0');
    const color=value<0?'#c94848':value>0?'#278c3a':'#5f6b76';
    const background=value<0?'#fff3f3':value>0?'#f3faf4':'#f6f7f8';
    const border=value<0?'#f3c8c8':value>0?'#cfe8d3':'#dde2e6';
    row.style.setProperty('color',color,'important');
    row.style.setProperty('background',background,'important');
    row.style.setProperty('border-color',border,'important');
    if(labelEl)labelEl.style.setProperty('color',color,'important');
    if(currentEl)currentEl.style.setProperty('color',color,'important');
    if(percentEl)percentEl.style.setProperty('color',color,'important');
    if(previousEl)previousEl.style.setProperty('color','#7a858f','important');
  }

  function applyDreResultColor(){
    colorRow(document.querySelector('#view-dre .dre-row.result'));
    colorRow(document.querySelector('#view-dre .br-dre-result-after'));
  }

  function schedule(){setTimeout(applyDreResultColor,0);setTimeout(applyDreResultColor,80);}
  const oldRenderDRE=window.renderDRE;
  if(typeof oldRenderDRE==='function')window.renderDRE=function(){const out=oldRenderDRE.apply(this,arguments);schedule();return out;};

  const view=document.getElementById('view-dre');
  if(view)new MutationObserver(()=>schedule()).observe(view,{childList:true,subtree:true,characterData:true});
  schedule();
})();
