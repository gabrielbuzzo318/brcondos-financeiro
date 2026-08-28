import PDFDocument from 'pdfkit';
import { DOMParser } from '@xmldom/xmldom';

function els(root,name){
  const out=[];
  if(!root)return out;
  const all=root.getElementsByTagName?.('*')||[];
  for(let i=0;i<all.length;i++){
    const n=all[i];
    const local=n.localName||String(n.nodeName||'').split(':').pop();
    if(local===name)out.push(n);
  }
  return out;
}
function first(root,name){return els(root,name)[0]||null;}
function text(root,name){return first(root,name)?.textContent?.trim()||'';}
function digits(v){return String(v||'').replace(/\D/g,'');}
function money(v){
  const n=Number(String(v??'0').replace(',','.'));
  return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number.isFinite(n)?n:0);
}
function fmtDate(v){
  const s=String(v||'').trim();
  const m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m?`${m[3]}/${m[2]}/${m[1]}`:(s||'-');
}
function fmtDoc(v){
  const d=digits(v);
  if(d.length===14)return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5');
  if(d.length===11)return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/,'$1.$2.$3-$4');
  return v||'-';
}
function fmtCep(v){
  const d=digits(v);
  return d.length===8?d.replace(/^(\d{5})(\d{3})$/,'$1-$2'):(v||'');
}
function partyDoc(root){
  const cc=first(root,'CpfCnpj')||root;
  return text(cc,'Cnpj')||text(cc,'Cpf')||'';
}
function addr(root){
  const e=first(root,'Endereco');
  if(!e)return '-';
  const line1=[text(e,'Endereco'),text(e,'Numero')].filter(Boolean).join(', ');
  const comp=text(e,'Complemento');
  const bairro=text(e,'Bairro');
  const cep=fmtCep(text(e,'Cep'));
  return [line1,comp,bairro,cep].filter(Boolean).join(' • ')||'-';
}
function parseNfse(xml,numeroHint=''){
  const d=new DOMParser().parseFromString(String(xml||''),'text/xml');
  const infos=els(d,'InfNfse');
  let inf=infos.find(n=>text(n,'Numero')===String(numeroHint||''))||infos[0]||null;
  if(!inf)throw new Error('A Giss não retornou os dados completos da NFS-e.');

  const decl=first(inf,'InfDeclaracaoPrestacaoServico')||inf;
  const service=first(decl,'Servico')||decl;
  const prestadorServico=first(inf,'PrestadorServico')||inf;
  const prestador=first(decl,'Prestador')||decl;
  const tomador=first(decl,'TomadorServico')||decl;
  const rps=first(decl,'IdentificacaoRps')||decl;
  const valoresNfse=first(inf,'ValoresNfse')||inf;
  const valoresServico=first(service,'Valores')||service;
  const contatoPrestador=first(prestadorServico,'Contato');
  const contatoTomador=first(tomador,'Contato');
  const cancelada=/NfseCancelamento/i.test(String(xml||''));

  return {
    numero:text(inf,'Numero')||numeroHint||'-',
    codigoVerificacao:text(inf,'CodigoVerificacao')||'-',
    dataEmissao:text(inf,'DataEmissao'),
    cancelada,
    rpsNumero:text(rps,'Numero')||'-',
    rpsSerie:text(rps,'Serie')||'RPS',
    prestador:{
      nome:text(prestadorServico,'RazaoSocial')||'COMARC RIO PRETO ADMINISTRACAO DE CONDOMINIOS LTDA',
      doc:partyDoc(prestador),
      im:text(prestador,'InscricaoMunicipal'),
      endereco:addr(prestadorServico),
      telefone:contatoPrestador?text(contatoPrestador,'Telefone'):'',
      email:contatoPrestador?text(contatoPrestador,'Email'):''
    },
    tomador:{
      nome:text(tomador,'RazaoSocial')||'-',
      doc:partyDoc(first(tomador,'IdentificacaoTomador')||tomador),
      im:text(first(tomador,'IdentificacaoTomador')||tomador,'InscricaoMunicipal'),
      endereco:addr(tomador),
      telefone:contatoTomador?text(contatoTomador,'Telefone'):'',
      email:contatoTomador?text(contatoTomador,'Email'):''
    },
    servico:{
      discriminacao:text(service,'Discriminacao')||'-',
      item:text(service,'ItemListaServico')||'-',
      codigoTrib:text(service,'CodigoTributacaoMunicipio')||'-',
      nbs:text(service,'CodigoNbs')||'-',
      valor:text(valoresServico,'ValorServicos')||text(valoresNfse,'BaseCalculo')||'0',
      deducoes:text(valoresServico,'ValorDeducoes')||'0',
      base:text(valoresNfse,'BaseCalculo')||text(valoresServico,'ValorServicos')||'0',
      aliquota:text(valoresNfse,'Aliquota')||text(valoresServico,'Aliquota')||'0',
      iss:text(valoresNfse,'ValorIss')||text(valoresServico,'ValorIss')||'0',
      liquido:text(valoresNfse,'ValorLiquidoNfse')||text(valoresServico,'ValorServicos')||'0'
    }
  };
}

function drawBox(doc,x,y,w,h,title){
  doc.save().lineWidth(.7).strokeColor('#cfd6dc').roundedRect(x,y,w,h,5).stroke().restore();
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#58636d').text(title.toUpperCase(),x+10,y+8,{width:w-20});
  return y+23;
}
function labelValue(doc,label,value,x,y,w){
  doc.font('Helvetica-Bold').fontSize(7.2).fillColor('#6b7280').text(label,x,y,{width:w});
  doc.font('Helvetica').fontSize(9.2).fillColor('#111827').text(value||'-',x,y+11,{width:w});
}

export async function gerarNfsePdf({xmlRetorno,numero}){
  const n=parseNfse(xmlRetorno,numero);
  const doc=new PDFDocument({size:'A4',margin:34,info:{Title:`NFS-e ${n.numero}`}});
  const chunks=[];
  doc.on('data',c=>chunks.push(c));
  const done=new Promise((resolve,reject)=>{doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);});

  const W=527;
  const X=34;
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#111827').text('PREFEITURA MUNICIPAL DE SÃO JOSÉ DO RIO PRETO',X,34,{width:350});
  doc.font('Helvetica').fontSize(8.5).fillColor('#5f6b76').text('NOTA FISCAL DE SERVIÇOS ELETRÔNICA — NFS-e',X,52,{width:350});
  doc.font('Helvetica-Bold').fontSize(22).fillColor('#111827').text(`NFS-e ${n.numero}`,390,34,{width:171,align:'right'});
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(n.cancelada?'#b42318':'#187a3c').text(n.cancelada?'CANCELADA':'ATIVA',390,61,{width:171,align:'right'});
  doc.moveTo(X,78).lineTo(X+W,78).lineWidth(1).strokeColor('#d7dde2').stroke();

  let y=92;
  drawBox(doc,X,y,W,60,'Identificação da nota');
  labelValue(doc,'Data de emissão',fmtDate(n.dataEmissao),X+12,y+26,120);
  labelValue(doc,'Código de verificação',n.codigoVerificacao,X+150,y+26,150);
  labelValue(doc,'RPS',`${n.rpsSerie} ${n.rpsNumero}`,X+330,y+26,120);
  y+=72;

  drawBox(doc,X,y,W,98,'Prestador de serviços');
  labelValue(doc,'Razão social',n.prestador.nome,X+12,y+26,500);
  labelValue(doc,'CNPJ / CPF',fmtDoc(n.prestador.doc),X+12,y+57,155);
  labelValue(doc,'Inscrição municipal',n.prestador.im||'-',X+185,y+57,135);
  labelValue(doc,'Contato',[n.prestador.telefone,n.prestador.email].filter(Boolean).join(' • ')||'-',X+338,y+57,175);
  doc.font('Helvetica').fontSize(8.5).fillColor('#374151').text(n.prestador.endereco,X+12,y+82,{width:500});
  y+=110;

  drawBox(doc,X,y,W,98,'Tomador de serviços');
  labelValue(doc,'Razão social / Nome',n.tomador.nome,X+12,y+26,500);
  labelValue(doc,'CNPJ / CPF',fmtDoc(n.tomador.doc),X+12,y+57,155);
  labelValue(doc,'Inscrição municipal',n.tomador.im||'-',X+185,y+57,135);
  labelValue(doc,'Contato',[n.tomador.telefone,n.tomador.email].filter(Boolean).join(' • ')||'-',X+338,y+57,175);
  doc.font('Helvetica').fontSize(8.5).fillColor('#374151').text(n.tomador.endereco,X+12,y+82,{width:500});
  y+=110;

  const discHeight=Math.max(72,doc.heightOfString(n.servico.discriminacao,{width:500})+48);
  drawBox(doc,X,y,W,discHeight,'Serviço');
  labelValue(doc,'Item da lista',n.servico.item,X+12,y+26,105);
  labelValue(doc,'Código tributação municipal',n.servico.codigoTrib,X+135,y+26,185);
  labelValue(doc,'NBS',n.servico.nbs,X+340,y+26,170);
  doc.font('Helvetica-Bold').fontSize(7.2).fillColor('#6b7280').text('DISCRIMINAÇÃO',X+12,y+57,{width:500});
  doc.font('Helvetica').fontSize(9).fillColor('#111827').text(n.servico.discriminacao,X+12,y+69,{width:500});
  y+=discHeight+12;

  drawBox(doc,X,y,W,78,'Valores');
  const cols=[
    ['Valor dos serviços',money(n.servico.valor)],
    ['Deduções',money(n.servico.deducoes)],
    ['Base de cálculo',money(n.servico.base)],
    ['Alíquota',`${Number(n.servico.aliquota||0).toLocaleString('pt-BR',{maximumFractionDigits:4})}%`],
    ['ISS',money(n.servico.iss)],
    ['Valor líquido',money(n.servico.liquido)]
  ];
  cols.forEach((c,i)=>{
    const cw=W/6;
    labelValue(doc,c[0],c[1],X+10+i*cw,y+28,cw-16);
  });

  const footY=760;
  doc.font('Helvetica').fontSize(7.5).fillColor('#6b7280').text(
    'Espelho visual gerado pelo BRCONDOS Financeiro a partir dos dados oficiais retornados pela Giss Online. Para validação, utilize o número da NFS-e e o código de verificação acima.',
    X,footY,{width:W,align:'center'}
  );

  doc.end();
  return await done;
}
