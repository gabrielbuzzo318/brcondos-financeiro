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
  function drawKpi(doc,x,y,w,label,value,accent){
    doc.setDrawColor(226,231,234);doc.setFillColor(250,251,252);doc.roundedRect(x,y,w,16,2,2,'FD');
    doc.setFillColor(...accent);doc.roundedRect(x,y,2.2,16,1,1,'F');
    doc.setTextColor(112,126,135);doc.setFont('helvetica','bold');doc.setFontSize(6.7);doc.text(label.toUpperCase(),x+5,y+5.2);
    doc.setTextColor(38,54,63);doc.setFontSize(11);doc.text(value,x+5,y+11.9);
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
      const W=doc.internal.pageSize.getWidth();
      const H=doc.internal.pageSize.getHeight();
      const left=14,right=14,contentW=W-left-right;
      const navy=[38,54,63],orange=[242,112,46],red=[190,54,48],green=[54,143,75],amber=[210,147,28];

      doc.setFillColor(...navy);doc.rect(0,0,W,24,'F');
      doc.setFillColor(...orange);doc.rect(0,24,W,2.2,'F');
      doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(18);doc.text('BRCONDOS',left,10.5);
      doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text('Financeiro',left,16.2);
      doc.setFont('helvetica','bold');doc.setFontSize(14);doc.text('RELATÓRIO DE REEMBOLSOS',W-right,11,{align:'right'});
      doc.setFont('helvetica','normal');doc.setFontSize(7.5);doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`,W-right,16.5,{align:'right'});

      doc.setFillColor(247,249,250);doc.setDrawColor(225,230,233);doc.roundedRect(left,31,contentW,15,2,2,'FD');
      const fw=contentW/3;
      [['STATUS',f.status],['CLIENTE / REEMBOLSÁVEL POR',f.client],['PERÍODO',f.period]].forEach((pair,i)=>{
        const x=left+i*fw+5;
        doc.setTextColor(116,129,137);doc.setFont('helvetica','bold');doc.setFontSize(6.5);doc.text(pair[0],x,36);
        doc.setTextColor(...navy);doc.setFontSize(8.5);doc.text(String(pair[1]||'-'),x,41.3,{maxWidth:fw-10});
      });

      const gap=4,cardW=(contentW-gap*3)/4,cardY=51;
      drawKpi(doc,left,cardY,cardW,'Total',fmtMoney(sums.total),navy);
      drawKpi(doc,left+(cardW+gap),cardY,cardW,'A receber',fmtMoney(sums.pending),red);
      drawKpi(doc,left+(cardW+gap)*2,cardY,cardW,'Recebido',fmtMoney(sums.received),green);
      drawKpi(doc,left+(cardW+gap)*3,cardY,cardW,'Em análise',fmtMoney(sums.analysis),amber);

      doc.setTextColor(112,126,135);doc.setFont('helvetica','normal');doc.setFontSize(7);doc.text(`${items.length} registro(s) encontrado(s)`,left,72);

      doc.autoTable({
        startY:76,
        margin:{left,right,bottom:16},
        head:[['Data','Descrição','Recebido em','Reembolsável por','Fornecedor','Valor']],
        body:items.map(x=>[fmtDate(x?.date||''),x?.description||'',statusText(x),x?.reimbursableBy||'',x?.supplier||'',fmtMoney(x?.value||0)]),
        theme:'plain',
        styles:{font:'helvetica',fontSize:7.2,cellPadding:{top:3,bottom:3,left:2.5,right:2.5},textColor:[50,64,72],lineColor:[228,232,235],lineWidth:{bottom:.15},overflow:'linebreak',valign:'middle'},
        headStyles:{fillColor:navy,textColor:[255,255,255],fontStyle:'bold',fontSize:7.3,cellPadding:{top:3.2,bottom:3.2,left:2.5,right:2.5}},
        alternateRowStyles:{fillColor:[248,249,250]},
        columnStyles:{0:{cellWidth:22},1:{cellWidth:60},2:{cellWidth:30},3:{cellWidth:45},4:{cellWidth:80},5:{cellWidth:32,halign:'right',fontStyle:'bold'}},
        didParseCell:function(data){
          if(data.section==='body'&&data.column.index===2){
            const item=items[data.row.index],st=statusValue(item);
            if(st==='recebido')data.cell.styles.textColor=green;
            else if(st==='nao_recebido')data.cell.styles.textColor=red;
            else data.cell.styles.textColor=amber;
            data.cell.styles.fontStyle='bold';
          }
        },
        didDrawPage:function(){
          doc.setDrawColor(...orange);doc.setLineWidth(.5);doc.line(left,H-10,W-right,H-10);
          doc.setTextColor(132,143,150);doc.setFont('helvetica','normal');doc.setFontSize(6.5);
          doc.text('BRCONDOS • Relatório de Reembolsos',left,H-6);
          doc.text(`Página ${doc.internal.getNumberOfPages()}`,W-right,H-6,{align:'right'});
        }
      });

      doc.save(`BRCONDOS_Reembolsos_${new Date().toISOString().slice(0,10)}.pdf`);
      if(typeof closeModal==='function')closeModal();
    }catch(err){console.error('BRCONDOS REEMBOLSOS PDF FIX:',err);alert('Não foi possível gerar o PDF agora.');}
  };
})();