import PDFDocument from 'pdfkit';
import bwipjs from 'bwip-js';

const txt=v=>String(v??'').trim();
const digits=v=>txt(v).replace(/\D/g,'');
const dateBR=v=>{const m=txt(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:txt(v)||'-';};
const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}).replace(/\s/g,'');
const GREEN='#4b9b48';
const BLACK='#111';
const LOGO=Buffer.from('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','base64');

function barcodeFromLinhaDigitavel(linha){
  const d=digits(linha); if(d.length!==47)return '';
  return d.slice(0,4)+d.slice(32,33)+d.slice(33,47)+d.slice(4,9)+d.slice(10,20)+d.slice(21,31);
}
function formatLinha(linha){
  const d=digits(linha); if(d.length!==47)return txt(linha);
  return `${d.slice(0,5)}.${d.slice(5,10)} ${d.slice(10,15)}.${d.slice(15,21)} ${d.slice(21,26)}.${d.slice(26,32)} ${d.slice(32,33)} ${d.slice(33)}`;
}
function nosso(v){const d=digits(v);return d.length===9?`${d.slice(0,2)}/${d.slice(2,8)}-${d.slice(8)}`:txt(v);}
function docNumero(v){const d=digits(v);return d?d.slice(-4).padStart(4,'0'):(txt(v)||'-');}
async function imageBuffer(opts){try{return await bwipjs.toBuffer(opts);}catch{return null;}}

function line(doc,x1,y1,x2,y2,w=.45,dash=false){
  doc.save().strokeColor(BLACK).lineWidth(w); if(dash)doc.dash(4,{space:3}); doc.moveTo(x1,y1).lineTo(x2,y2).stroke(); doc.restore();
}
function rect(doc,x,y,w,h){doc.save().strokeColor(BLACK).lineWidth(.45).rect(x,y,w,h).stroke().restore();}
function lab(doc,t,x,y,w){doc.fillColor('#222').font('Helvetica').fontSize(4.55).text(t,x+2,y+1.3,{width:w-4,height:6,lineBreak:false});}
function val(doc,t,x,y,w,h,{bold=true,size=7.25,align='left',indent=3}={}){
  doc.fillColor(BLACK).font(bold?'Helvetica-Bold':'Helvetica').fontSize(size).text(txt(t)||'-',x+indent,y+7.1,{width:w-indent-3,height:h-7.6,align,ellipsis:true});
}
function cell(doc,x,y,w,h,l,v,opt={}){rect(doc,x,y,w,h);lab(doc,l,x,y,w);val(doc,v,x,y,w,h,opt);}

function drawBankHeader(doc,x,y,W,{title='',linha=''}){
  doc.image(LOGO,x,y+1,{width:79,height:29});
  line(doc,x+80,y,x+80,y+27,1.0);
  doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(14.4).text('748-X',x+82,y+5,{width:58,align:'center'});
  line(doc,x+140,y,x+140,y+27,1.0);
  if(linha) doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(9.45).text(formatLinha(linha),x+151,y+6.3,{width:W-151,align:'center'});
  else doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(12.2).text(title,x+300,y+5,{width:W-300,align:'right'});
  line(doc,x,y+27,x+W,y+27,.7);
}

function benInfo(){
  const coop=digits(process.env.SICREDI_COOPERATIVA),posto=digits(process.env.SICREDI_POSTO),cod=digits(process.env.SICREDI_CODIGO_BENEFICIARIO);
  return {nome:txt(process.env.BRCONDOS_BENEFICIARIO_NOME)||'COMARC RIO PRETO ADM CONDOMINI',cnpj:digits(process.env.GISS_CNPJ||'29941735000100'),agencia:[coop,posto,cod].filter(Boolean).join('.')};
}
function pagadorLinhas(i){
  const l1=[txt(i.pagador),digits(i.documentoPagador)].filter(Boolean).join(' - ');
  const l2=[txt(i.cidadePagador),txt(i.ufPagador),digits(i.cepPagador)].filter(Boolean).join(' ');
  const l3=txt(i.enderecoPagador); return [l1,l2,l3].filter(Boolean);
}
function instrucao(i){
  const a=[]; if(txt(i.descricao))a.push(txt(i.descricao).toUpperCase()); if(txt(i.detalhes))a.push(txt(i.detalhes).toUpperCase()); return a.length?a.join('\n'):'COBRANÇA BRCONDOS';
}

function commonGrid(doc,x,y,W,i,ben,{receipt=false}={}){
  const H=19,right=164,left=W-right;
  cell(doc,x,y,left,H,'Local de Pagamento','Preferencialmente em canais eletrônicos da sua instituição financeira.',{size:7.05});
  cell(doc,x+left,y,right,H,'Vencimento',dateBR(i.dataVencimento),{size:8.6,align:'right'}); y+=H;

  cell(doc,x,y,289,H,'Beneficiário',ben.nome,{size:7.25});
  cell(doc,x+289,y,100,H,'CNPJ/CPF',ben.cnpj,{size:7.05});
  cell(doc,x+389,y,W-389,H,'Agência / Código do Beneficiário',ben.agencia,{size:7.5,align:'right'}); y+=H;

  const ws=[90,90,60,59,90,W-389]; let xx=x;
  const data=[
    ['Data do Documento',dateBR(i.dataDocumento),{size:7.0}],
    ['Nº do Documento',docNumero(i.seuNumero||i.documento),{size:7.0}],
    ['Espécie Doc.','DMI',{size:7.1,align:'center'}],
    ['Aceite','N',{size:7.1,align:'center'}],
    ['Data de Processamento',dateBR(i.dataProcessamento||i.dataDocumento),{size:6.95}],
    [receipt?'Nosso Número / Cód. do Documento':'Nosso Número',nosso(i.nossoNumero),{size:7.35,align:'right'}]
  ];
  data.forEach((a,idx)=>{cell(doc,xx,y,ws[idx],H,a[0],a[1],a[2]);xx+=ws[idx];}); y+=H;

  const ms=[129,140,120,W-389];xx=x;
  const moedas=[['Espécie Moeda','REAL',{size:7.1}],['Quantidade Moeda','',{bold:false}],['Valor Moeda','',{bold:false}],['(=) Valor do Documento',money(i.valor),{size:8.5,align:'right'}]];
  moedas.forEach((a,idx)=>{cell(doc,xx,y,ms[idx],H,a[0],a[1],a[2]);xx+=ms[idx];}); y+=H;

  const IH=95,instrW=W-right,rx=x+instrW,rh=19;
  rect(doc,x,y,instrW,IH);lab(doc,'Instruções',x,y,instrW);
  doc.fillColor(BLACK).font('Helvetica').fontSize(6.8).text(instrucao(i),x+4,y+13,{width:instrW-8,height:76,lineGap:0.4});
  cell(doc,rx,y,right,rh,'(-) Desconto / Abatimento','',{bold:false});
  cell(doc,rx,y+rh,right,rh,'(-) Outras Deduções','',{bold:false});
  cell(doc,rx,y+rh*2,right,rh,'(+) Mora / Multa','',{bold:false});
  cell(doc,rx,y+rh*3,right,rh,'(+) Outros Acréscimos','',{bold:false});
  cell(doc,rx,y+rh*4,right,IH-rh*4,'(=) Valor Cobrado','',{bold:false}); y+=IH;

  const PH=54; rect(doc,x,y,W,PH);lab(doc,'Pagador',x,y,W);
  const pl=pagadorLinhas(i); let py=y+10.5;
  pl.forEach((s,idx)=>{doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(idx===0?7.25:7.0).text(s.toUpperCase(),x+35,py,{width:W-40,height:10.5});py+=12.2;});
  lab(doc,'Beneficiário Final',x,y+43,125);doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(6).text('-',x+94,y+43.2,{width:20});
  lab(doc,'Código de Baixa',x+W-105,y+43,100); y+=PH;
  return y;
}

export async function gerarBoletoPdf(input={}){
  const linha=txt(input.linhaDigitavel),nn=digits(input.nossoNumero),qr=txt(input.qrCode),barcode=digits(input.codigoBarras)||barcodeFromLinhaDigitavel(linha);
  if(digits(linha).length!==47){const e=new Error('Linha digitável inválida para gerar o PDF.');e.status=400;throw e;}
  if(nn.length!==9){const e=new Error('Nosso Número inválido para gerar o PDF.');e.status=400;throw e;}
  const qrPng=qr?await imageBuffer({bcid:'qrcode',text:qr,scale:4,padding:0}):null;
  const barPng=barcode.length===44?await imageBuffer({bcid:'interleaved2of5',text:barcode,scale:2.6,height:13,includetext:false,padding:0}):null;
  const ben=benInfo();

  return await new Promise((resolve,reject)=>{
    const doc=new PDFDocument({size:'A4',margin:0,info:{Title:`Boleto Sicredi ${nn}`,Author:'BRCONDOS Financeiro'}});
    const chunks=[];doc.on('data',c=>chunks.push(c));doc.on('error',reject);doc.on('end',()=>resolve(Buffer.concat(chunks)));
    const x=20,W=553;

    const infoY=18.5,infoH=135.5; rect(doc,x,infoY,W,infoH);
    doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(7.45).text('INFORMATIVO',x,infoY+4,{width:W,align:'center'});
    if(qrPng)doc.image(qrPng,x+394,infoY+10,{width:72,height:72});
    doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(7.05).text('Pague agora via PIX, basta acessar o aplicativo de sua instituição financeira',x+5,infoY+78,{width:370});
    doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(6.55).text('PIX copia e cola',x+5,infoY+91,{width:120});
    doc.save().fillColor('#e6e6e6').rect(x+1,infoY+105,W-2,29.5).fill().restore();
    doc.fillColor(BLACK).font('Helvetica').fontSize(3.85).text(qr||'-',x+9,infoY+116.5,{width:W-18,height:8,ellipsis:true});

    let y=163; drawBankHeader(doc,x,y,W,{title:'Recibo do Pagador'}); y=190;
    y=commonGrid(doc,x,y,W,{...input,nossoNumero:nn},ben,{receipt:true});
    doc.fillColor(BLACK).font('Helvetica').fontSize(4.55).text('Recebimento através do cheque Nº:',x+1,y+3,{width:170});
    doc.fontSize(4.55).text('Do banco:',x+1,y+9,{width:90});
    doc.fontSize(4.3).text('Esta quitação só terá validade após o pagamento do cheque pelo banco pagador.',x+1,y+15,{width:310});
    doc.fontSize(4.3).text('Até o vencimento pagável em qualquer agência bancária.',x+1,y+21,{width:270});
    doc.font('Helvetica-Bold').fontSize(4.7).text('Autenticação Mecânica',x+388,y+3,{width:W-388,align:'right'});
    const dashY=444.5; line(doc,x,dashY,x+W,dashY,.8,true);

    y=451; drawBankHeader(doc,x,y,W,{linha}); y=478;
    y=commonGrid(doc,x,y,W,{...input,nossoNumero:nn},ben,{receipt:false});
    if(barPng)doc.image(barPng,x+9,y+9,{width:320,height:38});
    line(doc,x+342,y+12,x+405,y+12,.9); line(doc,x+477,y+12,x+540,y+12,.9);
    doc.fillColor(BLACK).font('Helvetica').fontSize(4.6).text('Autenticação Mecânica',x+405,y+8,{width:72,align:'center'});
    doc.font('Helvetica-Bold').fontSize(8.2).text('FICHA DE COMPENSAÇÃO',x+388,y+29,{width:W-388,align:'right'});

    doc.end();
  });
}
