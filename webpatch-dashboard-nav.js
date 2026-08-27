(function(){
  function ensureFavicon(){
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="10" fill="white"/><g fill="#6f7d86"><polygon points="32,7 42,12 32,17 22,12"/><polygon points="20,14 30,19 20,24 10,19"/><polygon points="44,14 54,19 44,24 34,19"/><polygon points="12,23 22,28 12,33 2,28"/><polygon points="52,23 62,28 52,33 42,28"/><polygon points="20,26 30,31 20,36 10,31"/><polygon points="44,26 54,31 44,36 34,31"/><path d="M3 32l9 4v4l-9-4zm0 7l9 4v4l-9-4zm10-3l9 4v4l-9-4zm0 7l9 4v4l-9-4zm22-7l9 4v4l-9-4zm0 7l9 4v4l-9-4zm10-11l9 4v4l-9-4zm0 7l9 4v4l-9-4z"/></g><polygon points="32,19 42,24 32,29 22,24" fill="#f36c2f"/></svg>`;
    const href='data:image/svg+xml,'+encodeURIComponent(svg);
    let link=document.querySelector('link[rel~="icon"]');
    if(!link){link=document.createElement('link');link.rel='icon';document.head.appendChild(link);}
    link.type='image/svg+xml';
    link.href=href;
  }

  window.renderDashboard=function(){
    const entradas=sum(transactions,'entrada',['pago']);
    const saidas=sum(transactions,'saida',['pago']);
    const saldo=entradas-saidas;
    const agendado=sum(transactions,'saida',['agendado','aberto','vencido']);
    const boletoOpen=boletos.filter(x=>x.status!=='recebido').reduce((a,b)=>a+Number(b.value||0),0);
    const recent=[...transactions].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6);
    const dash=document.getElementById('view-dashboard');
    if(!dash)return;

    dash.innerHTML=`
      <div class="cards grid">
        <div class="card accent-blue" role="button" tabindex="0" title="Abrir Boletos" style="cursor:pointer" onclick="showView('boletos')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();showView('boletos')}"><div class="kpi-label">BOLETOS EM ABERTO</div><div class="kpi-value">${money(boletoOpen)}</div><div class="kpi-foot">${boletos.filter(x=>x.status!=='recebido').length} boleto(s)</div></div>
        <div class="card accent-green"><div class="kpi-label">ENTRADAS DO MÊS</div><div class="kpi-value">${money(entradas)}</div><div class="kpi-foot">Valores recebidos</div></div>
        <div class="card accent-orange"><div class="kpi-label">SAÍDAS DO MÊS</div><div class="kpi-value">${money(saidas)}</div><div class="kpi-foot">Valores pagos</div></div>
        <div class="card accent-slate" role="button" tabindex="0" title="Abrir DRE" style="cursor:pointer" onclick="showView('dre')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();showView('dre')}"><div class="kpi-label">SALDO REALIZADO</div><div class="kpi-value">${money(saldo)}</div><div class="kpi-foot">Entradas pagas - saídas pagas</div></div>
      </div>
      <div class="grid two-cols">
        <div class="card">
          <div class="section-title"><div><h2 style="font-size:16px">Movimentações recentes</h2><span>Últimos lançamentos financeiros</span></div><button class="btn small primary" onclick="showView('fluxo')">Ver fluxo</button></div>
          <div class="table-wrap"><table><thead><tr><th>Data</th><th>Descrição</th><th>Parte</th><th>Status</th><th>Valor</th></tr></thead><tbody>
          ${recent.map(x=>`<tr><td>${formatDate(x.date)}</td><td>${x.description}</td><td>${x.party||'-'}</td><td>${statusBadge(x.status)}</td><td class="amount ${x.type==='entrada'?'pos':'neg'}">${x.type==='saida'?'- ':''}${money(x.value)}</td></tr>`).join('')}
          </tbody></table></div>
        </div>
        <div class="card">
          <div class="panel-title">Resumo do caixa</div>
          <div class="dre-row"><span>Recebido</span><b style="color:#278c3a">${money(entradas)}</b></div>
          <div class="dre-row"><span>Pago</span><b style="color:#c94848">${money(saidas)}</b></div>
          <div class="dre-row"><span>Saídas previstas</span><b>${money(agendado)}</b></div>
          <div class="dre-row total"><span>Saldo após previsões</span><span>${money(saldo-agendado)}</span></div>
          <div class="boleto-box" style="margin-top:18px"><h3>Boletos</h3><p>A área já está preparada para integração com API bancária.</p></div>
        </div>
      </div>`;
  };

  ensureFavicon();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureFavicon,{once:true});
})();
