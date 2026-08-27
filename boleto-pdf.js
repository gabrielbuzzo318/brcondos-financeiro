import PDFDocument from 'pdfkit';
import bwipjs from 'bwip-js';

const txt=v=>String(v??'').trim();
const digits=v=>txt(v).replace(/\D/g,'');
const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const dateBR=v=>{const m=txt(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:txt(v)||'-';};
const GREEN='#1f7a3f';
const BLACK='#111111';
const GREY='#555555';
const LIGHT='#f4f6f4';

function barcodeFromLinhaDigitavel(linha){
  const d=digits(linha);
  if(d.length!==47)return '';
  return d.slice(0,4)+d.slice(32,33)+d.slice(33,47)+d.slice(4,9)+d.slice(10,20)+d.slice(21,31);
}

function formatLinhaDigitavel(linha){
  const d=digits(linha);
  if(d.length!==47)return txt(linha);
  return `${d.slice(0,5)}.${d.slice(5,10)} ${d.slice(10,15)}.${d.slice(15,21)} ${d.slice(21,26)}.${d.slice(26,32)} ${d.slice(32,33)} ${d.slice(33)}`;
}

function formatCpfCnpj(v){
  const d=digits(v);
  if(d.length===14)return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
  if(d.length===11)return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
  return txt(v);
}

function formatCep(v){const d=digits(v);return d.length===8?`${d.slice(0,5)}-${d.slice(5)}`:txt(v);}
function formatNossoNumero(v){const d=digits(v);return d.length===9?`${d.slice(0,2)}/${d.slice(2,8)}-${d.slice(8)}`:txt(v);}

async function imageBuffer(opts){try{return await bwipjs.toBuffer(opts);}catch{return null;}}

function line(doc,x1,y1,x2,y2,width=.45,color='#222'){
  doc.save().lineWidth(width).strokeColor(color).moveTo(x1,y1).lineTo(x2,y2).stroke().restore();
}

function label(doc,text,x,y,w){
  doc.fillColor(GREY).font('Helvetica').fontSize(5.6).text(text,x+3,y+2,{width:w-6,lineBreak:false});
}
function value(doc,text,x,y,w,h,{align='left',bold=false,size=8.2}={}){
  doc.fillColor(BLACK).font(bold?'Helvetica-Bold':'Helvetica').fontSize(size).text(txt(text)||'-',x+3,y+11,{width:w-6,height:h-13,align,ellipsis:true});
}
function cell(doc,x,y,w,h,l,v,opt={}){
  doc.rect(x,y,w,h).lineWidth(.45).strokeColor('#222').stroke();
  label(doc,l,x,y,w); value(doc,v,x,y,w,h,opt);
}
function bankHeader(doc,y,W,linhaDigitavel,sectionTitle){
  const x=22;
  doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(18).text('sicredi',x,y+7,{width:95});
  line(doc,x+98,y+2,x+98,y+34,1.1,'#222');
  doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(14).text('748-X',x+106,y+9,{width:62,align:'center'});
  line(doc,x+172,y+2,x+172,y+34,1.1,'#222');
  doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(9.5).text(formatLinhaDigitavel(linhaDigitavel),x+180,y+10,{width:W-180,align:'right'});
  doc.fillColor(GREY).font('Helvetica').fontSize(5.5).text(sectionTitle,x+180,y+25,{width:W-180,align:'right'});
  line(doc,x,y+38,x+W,y+38,.9,'#222');
}

function payerText(input){
  const docPag=formatCpfCnpj(input.documentoPagador);
  const endereco=[txt(input.enderecoPagador),txt(input.cidadePagador),txt(input.ufPagador),formatCep(input.cepPagador)].filter(Boolean).join(' - ');
  return `${txt(input.pagador)||'-'}${docPag?`  •  ${docPag}`:''}${endereco?`\n${endereco}`:''}`;
}

function beneficiaryInfo(){
  const coop=digits(process.env.SICREDI_COOPERATIVA);
  const posto=digits(process.env.SICREDI_POSTO);
  const cod=digits(process.env.SICREDI_CODIGO_BENEFICIARIO);
  return {
    nome:txt(process.env.BRCONDOS_BENEFICIARIO_NOME)||'COMARC RP ADM DE CONDOMINIOS LTDA',
    cnpj:formatCpfCnpj(process.env.GISS_CNPJ||'29941735000100'),
    endereco:txt(process.env.BRCONDOS_BENEFICIARIO_ENDERECO)||'R. São Carlos, 432, Sala 08 - Jardim Europa - São José do Rio Preto/SP - CEP 15014-480',
    agenciaCodigo:[coop,posto,cod].filter(Boolean).join('.')
  };
}

function instructionsText(input){
  return [txt(input.descricao),txt(input.detalhes)].filter(Boolean).join('\n') || 'Cobrança BRCONDOS';
}

export async function gerarBoletoPdf(input={}){
  const linha=txt(input.linhaDigitavel);
  const nossoNumero=digits(input.nossoNumero);
  const barcode=digits(input.codigoBarras)||barcodeFromLinhaDigitavel(linha);
  const qr=txt(input.qrCode);
  if(digits(linha).length!==47){const e=new Error('Linha digitável inválida para gerar o PDF.');e.status=400;throw e;}
  if(nossoNumero.length!==9){const e=new Error('Nosso Número inválido para gerar o PDF.');e.status=400;throw e;}
  const barcodePng=barcode.length===44?await imageBuffer({bcid:'interleaved2of5',text:barcode,scale:2.25,height:13,includetext:false,padding:0}):null;
  const qrPng=qr?await imageBuffer({bcid:'qrcode',text:qr,scale:4,padding:0}):null;
  const ben=beneficiaryInfo();
  const nossoFmt=formatNossoNumero(nossoNumero);
  const valorFmt=money(input.valor);
  const venc=dateBR(input.dataVencimento);
  const dataDoc=dateBR(input.dataDocumento||input.dataEmissao||input.dataVencimento);
  const pagador=payerText(input);
  const instr=instructionsText(input);

  return await new Promise((resolve,reject)=>{
    const doc=new PDFDocument({size:'A4',margin:0,info:{Title:`Boleto Sicredi ${nossoNumero}`,Author:'BRCONDOS Financeiro'}});
    const chunks=[]; doc.on('data',c=>chunks.push(c)); doc.on('error',reject); doc.on('end',()=>resolve(Buffer.concat(chunks)));
    const x=22, W=551;

    // RECIBO DO PAGADOR
    let y=22;
    bankHeader(doc,y,W,linha,'RECIBO DO PAGADOR'); y+=41;
    cell(doc,x,y,385,31,'Local de pagamento','PAGÁVEL PREFERENCIALMENTE EM CANAIS ELETRÔNICOS DA SUA INSTITUIÇÃO FINANCEIRA',{size:7.2});
    cell(doc,x+385,y,166,31,'Vencimento',venc,{align:'right',bold:true,size:10}); y+=31;
    cell(doc,x,y,385,34,'Beneficiário',`${ben.nome}  •  CNPJ ${ben.cnpj}`,{bold:true,size:7.7});
    cell(doc,x+385,y,166,34,'Agência / Código do Beneficiário',ben.agenciaCodigo||'-',{align:'right',bold:true,size:8.5}); y+=34;
    const widths=[96,92,87,90,186]; let xx=x;
    const vals=[
      ['Data do documento',dataDoc],['Nº do documento',txt(input.documento)||'-'],['Espécie Doc.','DMI'],['Aceite','N'],['Nosso Número',nossoFmt]
    ];
    vals.forEach((a,i)=>{cell(doc,xx,y,widths[i],29,a[0],a[1],{bold:i===4,align:i===4?'right':'left',size:i===4?9:7.8});xx+=widths[i];}); y+=29;
    xx=x; const widths2=[96,92,87,90,186];
    const vals2=[['Data Processamento',dataDoc],['Carteira','SIMPLES'],['Espécie','R$'],['Quantidade',''],['Valor do Documento',valorFmt]];
    vals2.forEach((a,i)=>{cell(doc,xx,y,widths2[i],29,a[0],a[1],{bold:i===4,align:i===4?'right':'left',size:i===4?9:7.8});xx+=widths2[i];}); y+=29;

    // Instruções + resumo financeiro + QR Pix
    const leftW=350,rightW=201;
    doc.rect(x,y,leftW,91).lineWidth(.45).strokeColor('#222').stroke(); label(doc,'Instruções (Texto de responsabilidade do beneficiário)',x,y,leftW);
    doc.fillColor(BLACK).font('Helvetica').fontSize(7.2).text(instr,x+4,y+14,{width:leftW-8,height:70});
    const rightX=x+leftW;
    cell(doc,rightX,y,rightW,23,'(-) Desconto / Abatimento','',{align:'right'});
    cell(doc,rightX,y+23,rightW,23,'(+) Mora / Multa','',{align:'right'});
    cell(doc,rightX,y+46,rightW,22,'(=) Valor Cobrado',valorFmt,{align:'right',bold:true,size:9});
    doc.rect(rightX,y+68,rightW,23).lineWidth(.45).strokeColor('#222').stroke(); label(doc,'Pagamento via Pix',rightX,y+68,rightW);
    doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(7.4).text(qr?'QR CODE DISPONÍVEL':'QR CODE NÃO DISPONÍVEL',rightX+4,y+78,{width:rightW-8,align:'right'});
    y+=91;

    doc.rect(x,y,W,54).lineWidth(.45).strokeColor('#222').stroke(); label(doc,'Pagador',x,y,W);
    doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(7.5).text(pagador,x+4,y+13,{width:qrPng?W-108:W-8,height:36});
    if(qrPng){doc.image(qrPng,x+W-93,y+4,{width:46,height:46}); doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(6).text('PIX',x+W-43,y+22,{width:34,align:'center'});}
    y+=54;
    doc.fillColor(GREY).font('Helvetica').fontSize(5.5).text('Sacador / Avalista',x+3,y+2,{width:150});
    doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(6.3).text('Autenticação Mecânica - Recibo do Pagador',x+330,y+2,{width:W-330,align:'right'});
    y+=22;

    // SEPARADOR
    doc.save().dash(3,{space:3}).strokeColor('#777').moveTo(x,y).lineTo(x+W,y).stroke().restore(); y+=14;

    // FICHA DE COMPENSAÇÃO
    bankHeader(doc,y,W,linha,'FICHA DE COMPENSAÇÃO'); y+=41;
    cell(doc,x,y,385,31,'Local de pagamento','PAGÁVEL PREFERENCIALMENTE EM CANAIS ELETRÔNICOS DA SUA INSTITUIÇÃO FINANCEIRA',{size:7.2});
    cell(doc,x+385,y,166,31,'Vencimento',venc,{align:'right',bold:true,size:10}); y+=31;
    cell(doc,x,y,385,34,'Beneficiário',`${ben.nome}  •  CNPJ ${ben.cnpj}\n${ben.endereco}`,{bold:true,size:6.8});
    cell(doc,x+385,y,166,34,'Agência / Código do Beneficiário',ben.agenciaCodigo||'-',{align:'right',bold:true,size:8.5}); y+=34;
    xx=x;
    vals.forEach((a,i)=>{cell(doc,xx,y,widths[i],28,a[0],a[1],{bold:i===4,align:i===4?'right':'left',size:i===4?8.8:7.5});xx+=widths[i];}); y+=28;
    xx=x;
    vals2.forEach((a,i)=>{cell(doc,xx,y,widths2[i],28,a[0],a[1],{bold:i===4,align:i===4?'right':'left',size:i===4?8.8:7.5});xx+=widths2[i];}); y+=28;

    doc.rect(x,y,385,79).lineWidth(.45).strokeColor('#222').stroke(); label(doc,'Instruções (Texto de responsabilidade do beneficiário)',x,y,385);
    doc.fillColor(BLACK).font('Helvetica').fontSize(7).text(instr,x+4,y+14,{width:377,height:58});
    cell(doc,x+385,y,166,20,'(-) Desconto / Abatimento','',{align:'right'});
    cell(doc,x+385,y+20,166,20,'(-) Outras Deduções','',{align:'right'});
    cell(doc,x+385,y+40,166,19,'(+) Mora / Multa','',{align:'right'});
    cell(doc,x+385,y+59,166,20,'(=) Valor Cobrado',valorFmt,{align:'right',bold:true,size:8.8}); y+=79;

    doc.rect(x,y,W,50).lineWidth(.45).strokeColor('#222').stroke(); label(doc,'Pagador',x,y,W);
    doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(7.2).text(pagador,x+4,y+13,{width:W-8,height:32}); y+=50;
    doc.fillColor(GREY).font('Helvetica').fontSize(5.5).text('Sacador / Avalista',x+3,y+2,{width:150});
    doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(6.3).text('Autenticação Mecânica - Ficha de Compensação',x+315,y+2,{width:W-315,align:'right'}); y+=17;

    if(barcodePng){
      doc.image(barcodePng,x+2,y,{width:360,height:49});
      doc.fillColor(GREY).font('Helvetica').fontSize(5.5).text(barcode,x+2,y+51,{width:360,align:'center'});
    }
    if(qrPng){
      doc.image(qrPng,x+W-78,y-2,{width:62,height:62});
      doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(6).text('Pague também via Pix',x+W-130,y+19,{width:48,align:'right'});
    }

    doc.fillColor('#777').font('Helvetica').fontSize(5).text('Boleto híbrido registrado no Sicredi. Documento confeccionado pelo beneficiário conforme dados bancários retornados pela API de Cobrança.',x,818,{width:W,align:'center'});
    doc.end();
  });
}
