import fs from 'node:fs';
import path from 'node:path';

const file=path.join(process.cwd(),'boleto-pdf.js');
if(!fs.existsSync(file))throw new Error('boleto-pdf.js não encontrado.');

let src=fs.readFileSync(file,'utf8');
let changed=false;

function swap(from,to,label){
  if(src.includes(to))return;
  if(!src.includes(from)){
    console.warn(`[boleto-layout] Trecho não encontrado: ${label}`);
    return;
  }
  src=src.replace(from,to);
  changed=true;
}

// Medidas conferidas contra o boleto Sicredi de referência enviado pela BRCONDOS.
// Caixa superior: 20pt x 18.5pt, 553pt de largura. O QR fica encostado à direita,
// e a faixa cinza do PIX ocupa a base do quadro, como no layout original.
swap(
  "if(qrPng)doc.image(qrPng,x+394,infoY+10,{width:72,height:72});",
  "if(qrPng)doc.image(qrPng,x+462,infoY+12.5,{width:83,height:83});",
  'posição do QR PIX'
);
swap(
  "doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(7.05).text('Pague agora via PIX, basta acessar o aplicativo de sua instituição financeira',x+5,infoY+78,{width:370});",
  "doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(7.05).text('Pague agora via PIX, basta acessar o aplicativo de sua instituição financeira',x+5,infoY+86.5,{width:405});",
  'texto PIX'
);
swap(
  "doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(6.55).text('PIX copia e cola',x+5,infoY+91,{width:120});",
  "doc.fillColor(BLACK).font('Helvetica-Bold').fontSize(6.55).text('PIX copia e cola',x+5,infoY+99.5,{width:120});",
  'rótulo PIX copia e cola'
);
swap(
  "doc.save().fillColor('#e6e6e6').rect(x+1,infoY+105,W-2,29.5).fill().restore();",
  "doc.save().fillColor('#e3e3e3').rect(x+1,infoY+111.5,W-2,23).fill().restore();",
  'faixa cinza PIX'
);
swap(
  "doc.fillColor(BLACK).font('Helvetica').fontSize(3.85).text(qr||'-',x+9,infoY+116.5,{width:W-18,height:8,ellipsis:true});",
  "doc.fillColor(BLACK).font('Helvetica').fontSize(3.85).text(qr||'-',x+9,infoY+122.5,{width:W-18,height:8,ellipsis:true});",
  'copia e cola PIX'
);

if(changed){
  fs.writeFileSync(file,src,'utf8');
  console.log('Layout do boleto Sicredi ajustado ao modelo BRCONDOS.');
}else{
  console.log('Layout do boleto Sicredi já está ajustado.');
}
