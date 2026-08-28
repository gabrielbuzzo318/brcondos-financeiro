import PDFDocument from 'pdfkit';

const PAGE = { margin: 42 };
const COLORS = {
  ink: '#26343c',
  muted: '#6f7b84',
  line: '#dde3e7',
  soft: '#f6f8f9',
  group: '#eef2f4',
  green: '#19743a',
  greenSoft: '#edf9f1',
  red: '#b52b2b',
  redSoft: '#fff1f1',
  orange: '#e86d2f'
};

function clean(v){ return String(v ?? '').trim(); }
function moneyNumber(v){
  const raw=clean(v).replace(/R\$/gi,'').replace(/\s/g,'').replace(/\./g,'').replace(',','.').replace(/[^0-9+\-.]/g,'');
  const n=Number(raw);
  return Number.isFinite(n)?n:0;
}
function safeRows(rows){
  return Array.isArray(rows)?rows.slice(0,500).map(row=>({
    kind:['group','total','result','row'].includes(row?.kind)?row.kind:'row',
    label:clean(row?.label).slice(0,180),
    previous:clean(row?.previous).slice(0,60),
    current:clean(row?.current).slice(0,60)
  })).filter(row=>row.label):[];
}

export function gerarDrePdf(payload={}){
  return new Promise((resolve,reject)=>{
    try{
      const period=clean(payload.periodLabel)||clean(payload.period)||'Período';
      const previousLabel=clean(payload.previousLabel)||'Anterior';
      const currentLabel=clean(payload.currentLabel)||period.split('/')[0]||'Atual';
      const status=clean(payload.status)||'Em fechamento';
      const closed=/conclu/i.test(status);
      const rows=safeRows(payload.rows);
      const indicators=Array.isArray(payload.indicators)?payload.indicators.slice(0,6):[];

      const doc=new PDFDocument({size:'A4',margins:{top:PAGE.margin,bottom:PAGE.margin,left:PAGE.margin,right:PAGE.margin},bufferPages:true,info:{Title:`DRE Gerencial - ${period}`,Author:'BRCONDOS'}});
      const chunks=[];
      doc.on('data',c=>chunks.push(c));
      doc.on('error',reject);
      doc.on('end',()=>resolve(Buffer.concat(chunks)));

      const pageWidth=doc.page.width-PAGE.margin*2;
      const colLabel=pageWidth-196;
      const colPrev=98;
      const colCur=98;

      function header(repeat=false){
        doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(repeat?12:18).text('BRCONDOS',PAGE.margin,repeat?32:42);
        if(!repeat){
          doc.fontSize(10).fillColor(COLORS.muted).font('Helvetica').text('DRE Gerencial',PAGE.margin,66);
          doc.fontSize(10).fillColor(COLORS.ink).font('Helvetica-Bold').text(`Competência: ${period}`,PAGE.margin,88);
          doc.font('Helvetica').fillColor(COLORS.muted).text(`Comparativo: ${previousLabel} x ${currentLabel}`,PAGE.margin,104);
          const badgeText=closed?'CONCLUÍDA':'EM FECHAMENTO';
          const badgeW=closed?78:100;
          const bx=doc.page.width-PAGE.margin-badgeW;
          doc.roundedRect(bx,82,badgeW,26,7).fill(closed?COLORS.greenSoft:COLORS.redSoft);
          doc.fillColor(closed?COLORS.green:COLORS.red).font('Helvetica-Bold').fontSize(8).text(badgeText,bx,91,{width:badgeW,align:'center'});
          doc.moveTo(PAGE.margin,126).lineTo(doc.page.width-PAGE.margin,126).strokeColor(COLORS.line).lineWidth(1).stroke();
          doc.y=142;
        }else{
          doc.fontSize(9).fillColor(COLORS.muted).font('Helvetica').text(`DRE Gerencial • ${period}`,PAGE.margin,49);
          doc.moveTo(PAGE.margin,66).lineTo(doc.page.width-PAGE.margin,66).strokeColor(COLORS.line).stroke();
          doc.y=78;
        }
      }

      function tableHeader(){
        const y=doc.y;
        doc.rect(PAGE.margin,y,pageWidth,24).fill(COLORS.soft);
        doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(8);
        doc.text('CONTA',PAGE.margin+8,y+8,{width:colLabel-16});
        doc.text(previousLabel.toUpperCase(),PAGE.margin+colLabel,y+8,{width:colPrev-8,align:'right'});
        doc.text(currentLabel.toUpperCase(),PAGE.margin+colLabel+colPrev,y+8,{width:colCur-8,align:'right'});
        doc.y=y+24;
      }

      function ensureSpace(height=28){
        if(doc.y+height<=doc.page.height-PAGE.margin-22)return;
        doc.addPage();
        header(true);
        tableHeader();
      }

      function drawRow(row){
        const kind=row.kind;
        const labelFont=kind==='group'||kind==='total'||kind==='result'?'Helvetica-Bold':'Helvetica';
        doc.font(labelFont).fontSize(kind==='group'?8.5:9.2);
        const labelHeight=Math.max(16,doc.heightOfString(row.label,{width:colLabel-18,lineGap:1}));
        const h=Math.max(kind==='group'?25:24,labelHeight+10);
        ensureSpace(h);
        const y=doc.y;
        let fill=null;
        let textColor=COLORS.ink;
        if(kind==='group')fill=COLORS.group;
        if(kind==='total')fill='#f3f5f6';
        if(kind==='result'){
          const positive=moneyNumber(row.current)>=0;
          fill=positive?COLORS.greenSoft:COLORS.redSoft;
          textColor=positive?COLORS.green:COLORS.red;
        }
        if(fill)doc.rect(PAGE.margin,y,pageWidth,h).fill(fill);
        doc.fillColor(textColor).font(labelFont).fontSize(kind==='group'?8.5:9.2);
        doc.text(row.label,PAGE.margin+8,y+6,{width:colLabel-16,lineGap:1});
        doc.font(kind==='group'||kind==='total'||kind==='result'?'Helvetica-Bold':'Helvetica').fontSize(9.2);
        doc.text(row.previous||'R$ 0,00',PAGE.margin+colLabel,y+7,{width:colPrev-8,align:'right'});
        doc.text(row.current||'R$ 0,00',PAGE.margin+colLabel+colPrev,y+7,{width:colCur-8,align:'right'});
        doc.moveTo(PAGE.margin,y+h).lineTo(PAGE.margin+pageWidth,y+h).strokeColor(COLORS.line).lineWidth(.5).stroke();
        doc.y=y+h;
      }

      header(false);
      tableHeader();
      rows.forEach(drawRow);

      if(indicators.length){
        ensureSpace(72);
        doc.moveDown(.7);
        doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(10).text('Indicadores do período');
        doc.moveDown(.35);
        indicators.forEach(item=>{
          ensureSpace(20);
          const y=doc.y;
          doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9).text(clean(item?.label)||'-',PAGE.margin,y,{width:pageWidth-150});
          const value=clean(item?.value)||'-';
          const isResult=/resultado/i.test(clean(item?.label));
          const n=moneyNumber(value);
          doc.fillColor(isResult?(n>=0?COLORS.green:COLORS.red):COLORS.ink).font('Helvetica-Bold').text(value,PAGE.margin+pageWidth-150,y,{width:150,align:'right'});
          doc.y=y+18;
        });
      }

      doc.moveDown(.7);
      doc.fillColor(COLORS.muted).font('Helvetica').fontSize(7.5).text(`Gerado em ${new Date().toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}`,PAGE.margin,doc.y,{width:pageWidth,align:'right'});

      const range=doc.bufferedPageRange();
      for(let i=0;i<range.count;i++){
        doc.switchToPage(range.start+i);
        doc.fillColor('#8a949b').font('Helvetica').fontSize(7.5).text(`Página ${i+1} de ${range.count}`,PAGE.margin,doc.page.height-28,{width:pageWidth,align:'center',lineBreak:false});
      }

      doc.end();
    }catch(err){reject(err);}
  });
}
