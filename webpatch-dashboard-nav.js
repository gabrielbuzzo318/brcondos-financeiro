(function(){
  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();

  function ensureFavicon(){
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="10" fill="white"/><g fill="#6f7d86"><polygon points="32,7 42,12 32,17 22,12"/><polygon points="20,14 30,19 20,24 10,19"/><polygon points="44,14 54,19 44,24 34,19"/><polygon points="12,23 22,28 12,33 2,28"/><polygon points="52,23 62,28 52,33 42,28"/><polygon points="20,26 30,31 20,36 10,31"/><polygon points="44,26 54,31 44,36 34,31"/><path d="M3 32l9 4v4l-9-4zm0 7l9 4v4l-9-4zm10-3l9 4v4l-9-4zm0 7l9 4v4l-9-4zm22-7l9 4v4l-9-4zm0 7l9 4v4l-9-4zm10-11l9 4v4l-9-4zm0 7l9 4v4l-9-4z"/></g><polygon points="32,19 42,24 32,29 22,24" fill="#f36c2f"/></svg>`;
    const href='data:image/svg+xml,'+encodeURIComponent(svg);
    let link=document.querySelector('link[rel~="icon"]');
    if(!link){link=document.createElement('link');link.rel='icon';document.head.appendChild(link);}
    link.type='image/svg+xml';link.href=href;
  }

  function goToTab(label){
    const wanted=norm(label);
    const roots=[...document.querySelectorAll('#app nav,#app aside,#app .sidebar,#app [class*="sidebar"],#app [class*="menu"]')];
    const pool=roots.length?roots.flatMap(r=>[...r.querySelectorAll('button,a,[role="button"]')]):[...document.querySelectorAll('#app button,#app a,[role="button"]')];
    let hit=pool.find(el=>norm(el.textContent)===wanted);
    if(!hit)hit=pool.find(el=>norm(el.textContent).includes(wanted));
    if(hit){hit.click();return true;}
    const all=[...document.querySelectorAll('#app button,#app a[onclick],[role="button"]')];
    hit=all.find(el=>norm(el.textContent)===wanted)||all.find(el=>norm(el.getAttribute?.('onclick')).includes(wanted));
    if(hit){hit.click();return true;}
    return false;
  }

  function findDashboardCard(label){
    const wanted=norm(label);
    const scopes=[document.getElementById('view-dashboard'),document.querySelector('[id*="dashboard"]'),document.querySelector('#app main'),document.getElementById('app')].filter(Boolean);
    for(const scope of scopes){
      const nodes=[...scope.querySelectorAll('.card,[class*="card"],.kpi,[class*="kpi"]')];
      const hit=nodes.find(el=>norm(el.textContent).includes(wanted));
      if(hit)return hit.classList.contains('card')?hit:(hit.closest('.card')||hit);
    }
    return null;
  }

  function wireCard(card,target,title){
    if(!card)return;
    card.style.cursor='pointer';
    card.title=title;
    card.setAttribute('role','button');
    card.setAttribute('tabindex','0');
    if(card.dataset.brDashLink===target)return;
    card.dataset.brDashLink=target;
    const activate=e=>{
      if(e.type==='keydown'&&e.key!=='Enter'&&e.key!==' ')return;
      if(e.type==='keydown')e.preventDefault();
      goToTab(target);
    };
    card.addEventListener('click',activate);
    card.addEventListener('keydown',activate);
  }

  function adjustDashboard(){
    const saldo=findDashboardCard('saldo realizado');
    const boletos=findDashboardCard('boletos em aberto');
    if(!saldo||!boletos)return;

    wireCard(boletos,'Boletos','Abrir Boletos');
    wireCard(saldo,'DRE','Abrir DRE');

    if(saldo.parentElement===boletos.parentElement && !saldo.dataset.brDashSwapped && !boletos.dataset.brDashSwapped){
      const parent=saldo.parentElement;
      const marker=document.createComment('br-dashboard-swap');
      parent.insertBefore(marker,saldo);
      parent.insertBefore(saldo,boletos);
      parent.insertBefore(boletos,marker);
      marker.remove();
      saldo.dataset.brDashSwapped='1';
      boletos.dataset.brDashSwapped='1';
    }
  }

  function apply(){ensureFavicon();adjustDashboard();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
  const obs=new MutationObserver(()=>adjustDashboard());
  obs.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(apply,250);
})();
