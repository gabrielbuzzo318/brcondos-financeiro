import PDFDocument from 'pdfkit';

function txt(v){return String(v??'').trim();}
function brl(v){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
function cleanLines(value){
  if(Array.isArray(value))return value.map(txt).filter(Boolean);
  return txt(value).split(/\r?\n/).map(txt).filter(Boolean);
}

export async function gerarReceiptPdf(input={}){
  return await new Promise((resolve,reject)=>{
    const doc=new PDFDocument({size:'A4',margin:70});
    const chunks=[];
    doc.on('data',c=>chunks.push(c));
    doc.on('end',()=>resolve(Buffer.concat(chunks)));
    doc.on('error',reject);

    const client=txt(input.client||'CLIENTE').toUpperCase();
    const address=txt(input.address||'-').toUpperCase();
    const receiptNumber=txt(input.receiptNumber||'-');
    const competence=txt(input.competenceLabel||input.competence||'-').toUpperCase();
    const dateLong=txt(input.issueDateLong||input.issueDate||'');
    const amountWords=txt(input.amountWords||'').toUpperCase();
    const lines=cleanLines(input.description);

    doc.font('Helvetica-Bold').fontSize(9).fillColor('#666666').text('RECIBO Nº '+receiptNumber,{align:'right'});
    doc.moveDown(2);
    doc.fillColor('#111111').font('Helvetica-Bold').fontSize(17).text('RECIBO DE PRESTAÇÃO DE SERVIÇO',{align:'center',underline:true});
    doc.moveDown(4);

    doc.font('Helvetica').fontSize(13).fillColor('#111111');
    const intro='RECEBEMOS DE '+client+', SITO A '+address+', A IMPORTÂNCIA DE '+brl(input.value)
      +(amountWords?' ('+amountWords+')':'')+', REFERENTE AOS SERVIÇOS DA COMPETÊNCIA '+competence+':';
    doc.text(intro,{align:'justify',lineGap:4});
    doc.moveDown(2);

    lines.forEach(line=>{
      doc.font('Helvetica-Bold').fontSize(12.5).text('• '+line,{indent:10,lineGap:3});
      doc.moveDown(0.35);
    });

    doc.moveDown(4);
    doc.font('Helvetica').fontSize(12.5).text('São José do Rio Preto/SP'+(dateLong?', '+dateLong:''),{align:'center'});
    doc.moveDown(5);
    doc.font('Helvetica-Oblique').fontSize(18).text('Marco Antonio Dosualdo',{align:'center'});
    doc.moveDown(0.5);
    const y=doc.y;
    doc.moveTo(155,y).lineTo(440,y).strokeColor('#9eb8d9').stroke();
    doc.moveDown(0.8);
    doc.fillColor('#111111').font('Helvetica-Bold').fontSize(11)
      .text('COMARC ADMINISTRAÇÃO DE CONDOMÍNIOS LTDA',{align:'center'})
      .text('UNIDADE SÃO JOSÉ DO RIO PRETO',{align:'center'})
      .text('CNPJ 29.941.735/0001-00',{align:'center'});

    doc.end();
  });
}
