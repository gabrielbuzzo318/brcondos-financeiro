(function(){
  const STORAGE_KEY='brcondos_reimbursementsV2';
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const fmtDate=v=>{const s=String(v||'');const m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:s};
  const fmtMoney=v=>{const n=Number(v||0);try{if(typeof money==='function')return money(n)}catch(_){ }return n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})};
  function list(){try{const raw=localStorage.getItem(STORAGE_KEY);const parsed=raw?JSON.parse(raw):[];return Array.isArray(parsed)?parsed:[]}catch(_){return []}}
  function statusValue(item){const s=norm(item?.status);if(s==='recebido')return'recebido';if(s.includes('nao recebido')||s==='nao_recebido')return'nao_recebido';return'analise'}
  function statusText(item){const s=statusValue(item);if(s==='recebido')return item?.receivedDate?fmtDate(item.receivedDate):'Recebido';if(s==='nao_recebido')return'Não recebido';return'Em análise'}
  function reportItems(){
    const status=String(document.getElementById('br_r2_rep_status')?.value||'');
    const client=norm(document.getElementById('br_r2_rep_client')?.value||'');
    const from=String(document.getElementById('br_r2_rep_from')?.value||'');
    const to=String(document.getElementById('br_r2_rep_to')?.value||'');
    return list().filter(item=>{const d=String(item?.date||'');return(!status||statusValue(item)===status)&&(!client||norm(item?.reimbursableBy)===client)&&(!from||d>=from)&&(!to||d<=to)}).sort((a,b)=>String(a?.date||'').localeCompare(String(b?.date||''))||Number(a?.id||0)-Number(b?.id||0));
  }
  function filterDescription(){
    const st=String(document.getElementById('br_r2_rep_status')?.value||'');
    const client=String(document.getElementById('br_r2_rep_client')?.value||'');
    const from=String(document.getElementById('br_r2_rep_from')?.value||'');
    const to=String(document.getElementById('br_r2_rep_to')?.value||'');
    return{status:{analise:'Em análise',nao_recebido:'Não recebido',recebido:'Recebido'}[st]||'Todos',client:client||'Todos',period:from||to?`${from?fmtDate(from):'início'} a ${to?fmtDate(to):'hoje'}`:'Todos'};
  }
  function loadLibrary(src,key,ready){
    if(ready())return Promise.resolve();
    const old=document.querySelector(`script[data-br-r2-pdf-fix="${key}"]`);
    if(old)old.remove();
    return new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src=src;s.async=true;s.dataset.brR2PdfFix=key;
      s.onload=()=>ready()?resolve():reject(new Error(`${key} carregou sem inicializar`));
      s.onerror=()=>reject(new Error(`Falha ao carregar ${key}`));
      document.head.appendChild(s);
    });
  }
  window.brR2PdfReport=async function(){
    const items=reportItems();
    if(!items.length)return alert('Nenhum registro encontrado para os filtros selecionados.');
    try{
      await loadLibrary('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js','jspdf',()=>!!window.jspdf?.jsPDF);
      await loadLibrary('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js','autotable',()=>typeof window.jspdf?.jsPDF?.API?.autoTable==='function');
      const {jsPDF}=window.jspdf;
      const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
      if(typeof doc.autoTable!=='function')throw new Error('AutoTable não foi inicializado no documento');
      const f=filterDescription();
      const sums=items.reduce((o,x)=>{const v=Number(x?.value||0),s=statusValue(x);o.total+=v;if(s==='recebido')o.received+=v;else if(s==='nao_recebido')o.pending+=v;else o.analysis+=v;return o},{total:0,pending:0,received:0,analysis:0});
      doc.setFontSize(16);doc.text('BRCONDOS - Relatório de Reembolsos',14,15);
      doc.setFontSize(8.5);doc.text(`Status: ${f.status}   Cliente: ${f.client}   Período: ${f.period}`,14,21);
      doc.text(`Registros: ${items.length}   Total: ${fmtMoney(sums.total)}   A receber: ${fmtMoney(sums.pending)}   Recebido: ${fmtMoney(sums.received)}   Em análise: ${fmtMoney(sums.analysis)}`,14,26);
      doc.autoTable({startY:31,head:[['Data','Descrição','Recebido em','Reembolsável por','Fornecedor','Valor']],body:items.map(x=>[fmtDate(x?.date||''),x?.description||'',statusText(x),x?.reimbursableBy||'',x?.supplier||'',fmtMoney(x?.value||0)]),styles:{fontSize:7,cellPadding:2,overflow:'linebreak'},headStyles:{fontStyle:'bold'},columnStyles:{0:{cellWidth:22},1:{cellWidth:65},2:{cellWidth:28},3:{cellWidth:42},4:{cellWidth:70},5:{cellWidth:28,halign:'right'}}});
      doc.save(`BRCONDOS_Reembolsos_${new Date().toISOString().slice(0,10)}.pdf`);
      if(typeof closeModal==='function')closeModal();
    }catch(err){console.error('BRCONDOS REEMBOLSOS PDF FIX:',err);alert('Não foi possível gerar o PDF agora.');}
  };
})();