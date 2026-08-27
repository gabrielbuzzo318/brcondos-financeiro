import PDFDocument from 'pdfkit';
import bwipjs from 'bwip-js';

const txt=v=>String(v??'').trim();
const digits=v=>txt(v).replace(/\D/g,'');
const dateBR=v=>{const m=txt(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:txt(v)||'-';};
const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}).replace(/\s/g,'');
const GREEN='#4b9b48';
const BLACK='#111';
const GREY='#555';

function barcodeFromLinhaDigitavel(linha){
  const d=digits(linha);
  if(d.length!==47)return '';
  return d.slice(0,4)+d.slice(32,33)+d.slice(33,47)+d.slice(4,9)+d.slice(10,20)+d.slice(21,31);
}
function formatLinha(linha){
  const d=digits(linha);
  if(d.length!==47)return txt(linha);
  return `${d.slice(0,5)}.${d.slice(5,10)} ${d.slice(10,15)}.${d.slice(15,21)} ${d.slice(21,26)}.${d.slice(26,32)} ${d.slice(32,33)} ${d.slice(33)}`;
}
function nosso(v){const d=digits(v);return d.length===9?`${d.slice(0,2)}/${d.slice(2,8)}-${d.slice(8)}`:txt(v);}
function docNumero(v){const d=digits(v);return d?d.slice(-4).padStart(4,'0'):(txt(v)||'-');}
async function imageBuffer(opts){try{return await bwipjs.toBuffer(opts);}catch{return null;}}

function line(doc,x1,y1,x2,y2,w=.55,dash=false){
  doc.save().strokeColor(BLACK).lineWidth(w);
  if(dash)doc.dash(4,{space:3});
  doc.moveTo(x1,y1).lineTo(x2,y2).stroke();
  doc.restore();
}
function rect(doc,x,y,w,h){doc.save().strokeColor(BLACK).lineWidth(.5).rect(x,y,w,h).stroke().restore();}
function lab(doc,t,x,y,w){doc.fillColor('#333').font('Helvetica').fontSize(4.9).text(t,x+2,y+1.5,{width:w-4,height:7,lineBreak:false});}
function val(doc,t,x,y,w,h,{bold=true,size=7.1,align='left'}={}){
  doc.fillColor(BLACK).font(bold?'Helvetica-Bold':'Helvetica').fontSize(size).text(txt(t)||'-',x+3,y+8.5,{width:w-6,height:h-9,align,ellipsis:true});
}
function cell(doc,x,y,w,h,l,v,opt={}){rect(doc,x,y,w,h);lab(doc,l,x,y,w);val(doc,v,x,y,w,h,opt);}

function drawSicrediLogo(doc,x,y){
  // símbolo vetorial simples para manter o PDF leve e nítido
  const cx=x+7,cy=y+8;
  doc.save().strokeColor(GREEN).lineWidth(1.8);
  for(let i=0;i<8;i++){
    const a=(Math.PI*2*i)/8;
    doc.moveTo(cx+Math.cos(a)*3,cy+Math.sin(a)*3).lineTo(cx+Math.cos(a)*7,cy+Math.sin(a)*7).stroke();
  }
  doc.restore();
  doc.fillColor(GREEN).font('Helvetica-BoldOblique').fontSize(11).text('Sicredi',x+17,y+2,{width:68});
}
function drawBankHeader(doc,x,y,W,{title='',linha=''}){
  drawSicrediLogo(doc,x,y+2);
  line(doc,x+82,y,x+82,y+25,1.2);
  doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(14).text('748-X',x+89,y+5,{width:53,align:'center'});
  line(doc,x+148,y,x+148,y+25,1.2);
  if(linha){
    doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(9.2).text(formatLinha(linha),x+157,y+7,{width:W-157,align:'center'});
  }else{
    doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(9.4).text(title,x+315,y+7,{width:W-315,align:'right'});
  }
  if(linha && title)doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(8.7).text(title,x+382,y+27,{width:W-382,align:'right'});
  line(doc,x,y+27,x+W,y+27,.8);
}

function benInfo(){
  const coop=digits(process.env.SICREDI_COOPERATIVA);
  const posto=digits(process.env.SICREDI_POSTO);
  const cod=digits(process.env.SICREDI_CODIGO_BENEFICIARIO);
  return {
    nome:txt(process.env.BRCONDOS_BENEFICIARIO_NOME)||'COMARC RIO PRETO ADM CONDOMINI',
    cnpj:digits(process.env.GISS_CNPJ||'29941735000100'),
    agencia:[coop,posto,cod].filter(Boolean).join('.'),
  };
}
function pagadorLinhas(i){
  const l1=[txt(i.pagador),digits(i.documentoPagador)].filter(Boolean).join(' - ');
  const l2=[txt(i.cidadePagador),txt(i.ufPagador),digits(i.cepPagador)].filter(Boolean).join(' ');
  const l3=txt(i.enderecoPagador);
  return [l1,l2,l3].filter(Boolean);
}
function instrucao(i){
  const arr=[];
  if(txt(i.descricao))arr.push(txt(i.descricao).toUpperCase());
  if(txt(i.detalhes))arr.push(txt(i.detalhes).toUpperCase());
  return arr.length?arr.join('\n'):'COBRANÇA BRCONDOS';
}

function commonGrid(doc,x,y,W,i,ben,{receipt=false}={}){
  const right=162,left=W-right;
  // local + vencimento
  cell(doc,x,y,left,24,'Local de Pagamento','Preferencialmente em canais eletrônicos da sua instituição financeira.',{size:6.6});
  cell(doc,x+left,y,right,24,'Vencimento',dateBR(i.dataVencimento),{size:8.4,align:'right'}); y+=24;
  // beneficiário
  cell(doc,x,y,290,24,'Beneficiário',ben.nome,{size:7.2});
  cell(doc,x+290,y,95,24,'CNPJ/CPF',ben.cnpj,{size:6.8});
  cell(doc,x+385,y,W-385,24,'Agência / Código do Beneficiário',ben.agencia,{size:7.6,align:'right'}); y+=24;
  // documento
  const w1=88,w2=82,w3=65,w4=51,w5=99,w6=W-(w1+w2+w3+w4+w5);
  cell(doc,x,y,w1,24,'Data do Documento',dateBR(i.dataDocumento),{size:6.8});
  cell(doc,x+w1,y,w2,24,'Nº do Documento',docNumero(i.seuNumero||i.documento),{size:6.8});
  cell(doc,x+w1+w2,y,w3,24,'Espécie Doc.','DMI',{size:7});
  cell(doc,x+w1+w2+w3,y,w4,24,'Aceite','N',{size:7.2,align:'center'});
  cell(doc,x+w1+w2+w3+w4,y,w5,24,'Data de Processamento',dateBR(i.dataProcessamento||i.dataDocumento),{size:6.8});
  cell(doc,x+w1+w2+w3+w4+w5,y,w6,24,receipt?'Nosso Número / Cód. do Documento':'Nosso Número',nosso(i.nossoNumero),{size:7.3,align:'right'}); y+=24;
  // moeda / valor
  const a=88,b=100,c=82,d=115,e=W-(a+b+c+d);
  cell(doc,x,y,a,24,'Espécie Moeda','REAL',{size:7});
  cell(doc,x+a,y,b,24,'Quantidade Moeda','',{bold:false});
  cell(doc,x+a+b,y,c,24,'Valor Moeda','',{bold:false});
  cell(doc,x+a+b+c,y,d,24,'','',{bold:false});
  cell(doc,x+a+b+c+d,y,e,24,'(=) Valor do Documento',money(i.valor),{size:8.3,align:'right'}); y+=24;

  // instruções e coluna de totais
  const instrW=W-right;
  rect(doc,x,y,instrW,92); lab(doc,'Instruções',x,y,instrW);
  doc.fillColor(BLACK).font('Helvetica').fontSize(6.3).text(instrucao(i),x+4,y+13,{width:instrW-8,height:72});
  const rx=x+instrW;
  const rh=18.4;
  cell(doc,rx,y,right,rh,'(-) Desconto / Abatimento','',{bold:false});
  cell(doc,rx,y+rh,right,rh,'(-) Outras Deduções','',{bold:false});
  cell(doc,rx,y+rh*2,right,rh,'(+) Mora / Multa','',{bold:false});
  cell(doc,rx,y+rh*3,right,rh,'(+) Outros Acréscimos','',{bold:false});
  cell(doc,rx,y+rh*4,right,92-rh*4,'(=) Valor Cobrado','',{align:'right'}); y+=92;

  // pagador
  rect(doc,x,y,W,54);lab(doc,'Pagador',x,y,W);
  const pl=pagadorLinhas(i);
  let py=y+11;
  pl.forEach((s,idx)=>{doc.fillColor(BLACK).font(idx===0?'Helvetica-Bold':'Helvetica-Bold').fontSize(idx===0?7.1:6.8).text(s.toUpperCase(),x+35,py,{width:W-40,height:12});py+=12;});
  lab(doc,'Beneficiário Final',x,y+43,130); doc.fillColor(BLACK).font('Helvetica').fontSize(6).text('-',x+104,y+44,{width:20});
  lab(doc,'Código de Baixa',x+W-116,y+43,112); y+=54;
  return y;
}

export async function gerarBoletoPdf(input={}){
  const linha=txt(input.linhaDigitavel),nn=digits(input.nossoNumero),qr=txt(input.qrCode);
  const barcode=digits(input.codigoBarras)||barcodeFromLinhaDigitavel(linha);
  if(digits(linha).length!==47){const e=new Error('Linha digitável inválida para gerar o PDF.');e.status=400;throw e;}
  if(nn.length!==9){const e=new Error('Nosso Número inválido para gerar o PDF.');e.status=400;throw e;}
  const qrPng=qr?await imageBuffer({bcid:'qrcode',text:qr,scale:4,padding:0}):null;
  const barPng=barcode.length===44?await imageBuffer({bcid:'interleaved2of5',text:barcode,scale:2.4,height:13,includetext:false,padding:0}):null;
  const ben=benInfo();

  return await new Promise((resolve,reject)=>{
    const doc=new PDFDocument({size:'A4',margin:0,info:{Title:`Boleto Sicredi ${nn}`,Author:'BRCONDOS Financeiro'}});
    const chunks=[];doc.on('data',c=>chunks.push(c));doc.on('error',reject);doc.on('end',()=>resolve(Buffer.concat(chunks)));
    const x=20,W=555;

    // INFORMATIVO PIX — igual ao modelo de referência
    let y=12;
    rect(doc,x,y,W,135);
    doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(7.3).text('INFORMATIVO',x,y+5,{width:W,align:'center'});
    if(qrPng)doc.image(qrPng,x+W-91,y+13,{width:78,height:78});
    doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(7.2).text('Pague agora via PIX, basta acessar o aplicativo de sua instituição financeira',x+5,y+84,{width:W-105});
    doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(6.5).text('PIX copia e cola',x+5,y+98,{width:110});
    doc.save().fillColor('#e5e5e5').rect(x+1,y+111,W-2,23).fill().restore();
    doc.fillColor(BLACK).font('Helvetica').fontSize(4).text(qr||'-',x+8,y+119,{width:W-16,height:10,ellipsis:true});

    // RECIBO DO PAGADOR
    y=158;
    drawBankHeader(doc,x,y,W,{title:'Recibo do Pagador'}); y+=29;
    y=commonGrid(doc,x,y,W,{...input,nossoNumero:nn},ben,{receipt:true});
    doc.fillColor(BLACK).font('Helvetica').fontSize(4.7).text('Recebimento através do cheque Nº:',x,y+4,{width:170});
    doc.fontSize(4.7).text('Do banco:',x,y+10,{width:100});
    doc.fontSize(4.5).text('Esta quitação só terá validade após o pagamento do cheque pelo banco pagador.',x,y+16,{width:300});
    doc.fontSize(4.5).text('Até o vencimento pagável em qualquer agência bancária.',x,y+22,{width:260});
    doc.font('Helvetica-Bold').fontSize(5).text('Autenticação Mecânica',x+390,y+4,{width:W-390,align:'right'});

    // separação
    y+=34; line(doc,x,y,x+W,y,.8,true);

    // FICHA DE COMPENSAÇÃO
    y+=12;
    drawBankHeader(doc,x,y,W,{title:'',linha}); y+=29;
    y=commonGrid(doc,x,y,W,{...input,nossoNumero:nn},ben,{receipt:false});
    doc.font('Helvetica-Bold').fontSize(5).fillColor(BLACK).text('Autenticação Mecânica',x+390,y+5,{width:W-390,align:'right'});
    if(barPng)doc.image(barPng,x+10,y+12,{width:330,height:42});
    doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(8).text('FICHA DE COMPENSAÇÃO',x+390,y+43,{width:W-390,align:'right'});

    doc.end();
  });
}
