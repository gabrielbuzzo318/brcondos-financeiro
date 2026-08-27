import PDFDocument from 'pdfkit';
import bwipjs from 'bwip-js';

const txt=v=>String(v??'').trim();
const digits=v=>txt(v).replace(/\D/g,'');
const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const dateBR=v=>{const m=txt(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:txt(v)||'-';};

function barcodeFromLinhaDigitavel(linha){
  const d=digits(linha);
  if(d.length!==47)return '';
  return d.slice(0,4)+d.slice(32,33)+d.slice(33,47)+d.slice(4,9)+d.slice(10,20)+d.slice(21,31);
}

async function imageBuffer(opts){
  try{return await bwipjs.toBuffer(opts);}catch{return null;}
}

function box(doc,x,y,w,h,label,value,{right=false,bold=false,size=9}={}){
  doc.rect(x,y,w,h).stroke('#000');
  doc.font('Helvetica').fontSize(6).text(label,x+4,y+3,{width:w-8});
  doc.font(bold?'Helvetica-Bold':'Helvetica').fontSize(size).text(txt(value)||'-',x+4,y+12,{width:w-8,align:right?'right':'left',ellipsis:true});
}

export async function gerarBoletoPdf(input={}){
  const linha=txt(input.linhaDigitavel);
  const nossoNumero=digits(input.nossoNumero);
  const barcode=digits(input.codigoBarras)||barcodeFromLinhaDigitavel(linha);
  const qr=txt(input.qrCode);
  if(digits(linha).length!==47){const e=new Error('Linha digitável inválida para gerar o PDF.');e.status=400;throw e;}
  if(nossoNumero.length!==9){const e=new Error('Nosso Número inválido para gerar o PDF.');e.status=400;throw e;}

  const barcodePng=barcode.length===44?await imageBuffer({bcid:'interleaved2of5',text:barcode,scale:2,height:12,includetext:false,padding:0}):null;
  const qrPng=qr?await imageBuffer({bcid:'qrcode',text:qr,scale:4,padding:1}):null;

  return await new Promise((resolve,reject)=>{
    const doc=new PDFDocument({size:'A4',margin:28,info:{Title:`Boleto Sicredi ${nossoNumero}`,Author:'BRCONDOS Financeiro'}});
    const chunks=[];
    doc.on('data',c=>chunks.push(c));
    doc.on('error',reject);
    doc.on('end',()=>resolve(Buffer.concat(chunks)));

    const W=doc.page.width-56;
    let y=28;
    doc.font('Helvetica-Bold').fontSize(18).text('SICREDI',28,y,{width:105});
    doc.fontSize(15).text('748-X',138,y+2,{width:60});
    doc.font('Helvetica-Bold').fontSize(10).text(linha,202,y+4,{width:W-174,align:'right'});
    y+=30;
    doc.moveTo(28,y).lineTo(28+W,y).stroke();
    y+=8;

    box(doc,28,y,W*0.72,36,'Local de pagamento','Pagável em qualquer banco até o vencimento',{bold:true,size:8});
    box(doc,28+W*0.72,y,W*0.28,36,'Vencimento',dateBR(input.dataVencimento),{right:true,bold:true,size:10});
    y+=36;
    box(doc,28,y,W*0.72,40,'Beneficiário',txt(input.beneficiario)||'BRCONDOS',{bold:true,size:9});
    box(doc,28+W*0.72,y,W*0.28,40,'Agência / Código beneficiário',txt(input.codigoBeneficiario)||'-',{right:true,size:8});
    y+=40;
    const c=W/4;
    box(doc,28,y,c,36,'Documento',txt(input.documento)||'-',{size:8});
    box(doc,28+c,y,c,36,'Nosso Número',nossoNumero,{bold:true,size:10});
    box(doc,28+2*c,y,c,36,'Seu Número',txt(input.seuNumero)||'-',{size:8});
    box(doc,28+3*c,y,c,36,'Valor do documento',money(input.valor),{right:true,bold:true,size:10});
    y+=36;
    box(doc,28,y,W,44,'Pagador',`${txt(input.pagador)||'-'}${txt(input.documentoPagador)?` - ${txt(input.documentoPagador)}`:''}`,{bold:true,size:8});
    y+=44;
    box(doc,28,y,W,50,'Descrição / Instruções',txt(input.descricao)||'Cobrança BRCONDOS',{size:8});
    y+=58;

    if(barcodePng){
      doc.image(barcodePng,34,y,{width:W-12,height:58});
      y+=64;
      doc.font('Helvetica').fontSize(7).text(barcode,28,y,{width:W,align:'center'});
      y+=18;
    }

    doc.moveTo(28,y).lineTo(28+W,y).dash(3,{space:3}).stroke().undash();
    y+=14;
    doc.font('Helvetica-Bold').fontSize(9).text('BOLETO HÍBRIDO - PIX',28,y);
    y+=18;
    if(qrPng){
      doc.image(qrPng,28,y,{width:112,height:112});
      doc.font('Helvetica-Bold').fontSize(8).text('PIX copia e cola',154,y,{width:W-126});
      doc.font('Helvetica').fontSize(6.5).text(qr,154,y+15,{width:W-126,height:90});
      y+=120;
    }else{
      doc.font('Helvetica').fontSize(8).text('QR Code Pix não disponível no retorno deste boleto.',28,y,{width:W});
      y+=28;
    }

    doc.font('Helvetica').fontSize(6.5).fillColor('#333').text('Documento gerado pelo BRCONDOS Financeiro com os dados de cobrança registrados no Sicredi. Confira linha digitável, vencimento e valor antes do envio ao pagador.',28,doc.page.height-44,{width:W,align:'center'});
    doc.end();
  });
}
