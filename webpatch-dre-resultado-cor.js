(function(){
  function parseMoneyText(v){
    const raw=String(v||'')
      .replace(/R\$/gi,'')
      .replace(/\s/g,'')
      .replace(/\./g,'')
      .replace(',','.');
    const n=Number(raw.replace(/[^0-9+\-.]/g,''));
    return Number.isFinite(n)?n:0;
  }

  function applyDreResultColor(){
    const row=document.querySelector('#view-dre .dre-row.result');
    if(!row)return;
    const valueEl=row.lastElementChild;
    const value=parseMoneyText(valueEl?.textContent||'0');
    const color=value<0?'#c94848':value>0?'#278c3a':'#5f6b76';
    const background=value<0?'#fff3f3':value>0?'#f3faf4':'#f6f7f8';
    const border=value<0?'#f3c8c8':value>0?'#cfe8d3':'#dde2e6';

    row.style.setProperty('color',color,'important');
    row.style.setProperty('background',background,'important');
    row.style.setProperty('border-color',border,'important');
    row.querySelectorAll('span,b,strong').forEach(el=>el.style.setProperty('color',color,'important'));
  }

  const oldRenderDRE=window.renderDRE;
  if(typeof oldRenderDRE==='function'){
    window.renderDRE=function(){
      const out=oldRenderDRE.apply(this,arguments);
      setTimeout(applyDreResultColor,0);
      return out;
    };
  }

  setTimeout(applyDreResultColor,0);
})();
