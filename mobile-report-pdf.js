import PDFDocument from 'pdfkit';

const COLORS={ink:'#26343c',muted:'#6f7b84',line:'#dde3e7',soft:'#f6f8f9',green:'#19743a',red:'#b52b2b',blue:'#2d85aa'};
const clean=v=>String(v??'').trim();

export function gerarMobileReportPdf(payload={}){
  return new Promise((resolve,reject)=>{
    try{
      const title=clean(payload.title)||'Relatório BRCondos';
      const subtitle=clean(payload.subtitle);
      const summary=Array.isArray(payload.summary)?payload.summary.slice(0,12):[];
      const rows=Array.isArray(payload.rows)?payload.rows.slice(0,1200):[];
      const emittedBy=clean(payload.emittedBy)||'Usuário não identificado';
      const emittedAt=new Date(payload.emittedAt||Date.now());

      const doc=new PDFDocument({size:'A4',margins:{top:42,bottom:48,left:42,right:42},bufferPages:true,info:{Title:title,Author:'BRCONDOS'}});
      const chunks=[];doc.on('data',c=>chunks.push(c));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);
      const width=doc.page.width-84,safeBottom=doc.page.height-70;

      function header(repeat=false){
        doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(repeat?12:18).text('BRCONDOS',42,repeat?30:42);
        if(!repeat){
          doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(15).text(title,42,70,{width});
          if(subtitle)doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9).text(subtitle,42,92,{width});
          doc.moveTo(42,116).lineTo(42+width,116).strokeColor(COLORS.line).stroke();
          doc.y=130;
        }else{
          doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8).text(title,42,47,{width});
          doc.moveTo(42,62).lineTo(42+width,62).strokeColor(COLORS.line).stroke();
          doc.y=74;
        }
      }
      function ensure(h=40){if(doc.y+h<=safeBottom)return;doc.addPage();header(true)}
      function drawSummary(){
        if(!summary.length)return;
        const gap=8,cols=2,boxW=(width-gap)/cols,boxH=48;
        summary.forEach((item,i)=>{
          if(i%cols===0)ensure(boxH+gap);
          const row=Math.floor(i/cols),col=i%cols;
          const y=doc.y+(col?0:0),x=42+col*(boxW+gap);
          doc.roundedRect(x,y,boxW,boxH,6).fill(COLORS.soft);
          doc.fillColor(COLORS.muted).font('Helvetica-Bold').fontSize(7).text(clean(item?.label).toUpperCase(),x+10,y+9,{width:boxW-20});
          doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(12).text(clean(item?.value)||'-',x+10,y+23,{width:boxW-20});
          if(col===cols-1||i===summary.length-1)doc.y=y+boxH+gap;
        });
        doc.moveDown(.3);
      }
      function drawRow(row){
        const titleText=clean(row?.title)||'-';
        const valueText=clean(row?.value);
        const meta=clean(row?.meta);
        doc.font('Helvetica-Bold').fontSize(9.5);
        const th=doc.heightOfString(titleText,{width:width-145});
        doc.font('Helvetica').fontSize(8.2);
        const mh=meta?doc.heightOfString(meta,{width:width-16}):0;
        const h=Math.max(32,th+mh+17);
        ensure(h);
        const y=doc.y;
        doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(9.5).text(titleText,50,y+7,{width:width-155});
        if(valueText)doc.fillColor(COLORS.blue).font('Helvetica-Bold').fontSize(9.5).text(valueText,42+width-140,y+7,{width:132,align:'right'});
        if(meta)doc.fillColor(COLORS.muted).font('Helvetica').fontSize(8.2).text(meta,50,y+20,{width:width-16,lineGap:1});
        doc.moveTo(42,y+h).lineTo(42+width,y+h).strokeColor(COLORS.line).lineWidth(.5).stroke();
        doc.y=y+h;
      }

      header(false);drawSummary();
      if(rows.length){doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(10).text('Detalhamento');doc.moveDown(.45);rows.forEach(drawRow)}
      else doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9).text('Nenhum registro encontrado para este relatório.');

      const dateText=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(emittedAt);
      const range=doc.bufferedPageRange();
      for(let i=0;i<range.count;i++){doc.switchToPage(range.start+i);const y=doc.page.height-44;doc.moveTo(42,y-8).lineTo(42+width,y-8).strokeColor(COLORS.line).lineWidth(.5).stroke();doc.fillColor('#7d878e').font('Helvetica').fontSize(7).text('Emitido em '+dateText+' • Emitido por: '+emittedBy,42,y,{width:width-90,lineBreak:false});doc.text('Página '+(i+1)+' de '+range.count,42+width-85,y,{width:85,align:'right',lineBreak:false})}
      doc.end();
    }catch(err){reject(err)}
  })
}
