(function(){
  const XLSX_CDN='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  const MONTHS={
    JANEIRO:1,FEVEREIRO:2,FEV:2,MARCO:3,MARÇO:3,ABRIL:4,MAIO:5,JUNHO:6,JULHO:7,
    AGOSTO:8,SETEMBRO:9,OUTUBRO:10,NOVEMBRO:11,DEZEMBRO:12
  };

  function norm(v){
    return String(v??'')
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
  }
  function n(v){
    if(typeof v==='number' && Number.isFinite(v))return v;
    let s=String(v??'').trim();
    if(!s)return 0;
    s=s.replace(/R\$/gi,'').replace(/\s/g,'');
    if(s.includes(',') && s.includes('.'))s=s.replace(/\./g,'').replace(',','.');
    else if(s.includes(','))s=s.replace(',','.');
    const x=Number(s);
    return Number.isFinite(x)?x:0;
  }
  function brl(v){
    return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  }
  function nextMonth(year,month){
    return month===12?{year:year+1,month:1}:{year,month:month+1};
  }
  function pad2(v){return String(v).padStart(2,'0');}
  function loadXlsx(){
    if(window.XLSX)return Promise.resolve(window.XLSX);
    return new Promise((resolve,reject)=>{
      const existing=document.querySelector('script[data-brcondos-xlsx="1"]');
      if(existing){
        existing.addEventListener('load',()=>resolve(window.XLSX),{once:true});
        existing.addEventListener('error',()=>reject(new Error('Não foi possível carregar o leitor de planilhas.')),{once:true});
        return;
      }
      const s=document.createElement('script');
      s.src=XLSX_CDN;s.async=true;s.dataset.brcondosXlsx='1';
      s.onload=()=>window.XLSX?resolve(window.XLSX):reject(new Error('Leitor de planilhas não iniciou.'));
      s.onerror=()=>reject(new Error('Não foi possível carregar o leitor de planilhas.'));
      document.head.appendChild(s);
    });
  }
  function parseCompetence(title,sheetName){
    const text=norm(`${title||''} ${sheetName||''}`);
    let month=0;
    for(const [name,num] of Object.entries(MONTHS)){
      if(new RegExp(`(?:^| )${name}(?: |$)`).test(text)){month=num;break;}
    }
    const yearMatch=text.match(/\b(20\d{2})\b/);
    const year=yearMatch?Number(yearMatch[1]):0;
    return month&&year?{month,year,ym:`${year}-${pad2(month)}`} : null;
  }
  function headerIndex(headers,aliases){
    const hs=headers.map(norm);
    for(const alias of aliases){
      const target=norm(alias);
      const exact=hs.findIndex(x=>x===target);
      if(exact>=0)return exact;
    }
    for(const alias of aliases){
      const target=norm(alias);
      const partial=hs.findIndex(x=>x.includes(target)||target.includes(x));
      if(partial>=0)return partial;
    }
    return -1;
  }
  function findHeaderRow(matrix){
    for(let r=0;r<Math.min(matrix.length,12);r++){
      const row=(matrix[r]||[]).map(norm);
      if(row.includes('CLIENTE') && row.includes('TOTAL'))return r;
    }
    return -1;
  }
  function buildObservation(row,idx){
    const parts=[];
    const push=(label,col)=>{
      if(col<0)return;
      const value=n(row[col]);
      if(value>0)parts.push(`${label} - ${brl(value)}`);
    };
    push('Honorário Adm',idx.honorario);
    push('Modulo cobrança',idx.cobranca);
    push('Modulo manutenção',idx.manutencao);
    push('Assemb. Extra',idx.assembleia);
    if(idx.rpa>=0){
      const value=n(row[idx.rpa]);
      if(value>0){
        let line=`RPA - ${brl(value)}`;
        const details=idx.detalhes>=0?String(row[idx.detalhes]??'').trim():'';
        if(details)line+=` - ${details}`;
        parts.push(line);
      }
    }
    return parts.join('\n');
  }
  function sheetCandidates(workbook,XLSX){
    const out=[];
    workbook.SheetNames.forEach(name=>{
      const ws=workbook.Sheets[name];
      if(!ws)return;
      const matrix=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:''});
      if(!matrix.length)return;
      const headerRow=findHeaderRow(matrix);
      if(headerRow<0)return;
      const title=matrix[0]?.[0]||'';
      const comp=parseCompetence(title,name);
      if(!comp)return;
      out.push({name,matrix,headerRow,...comp});
    });
    return out.sort((a,b)=>b.ym.localeCompare(a.ym));
  }

  async function importMonthlyBillingXlsx(input){
    const file=input?.files?.[0];
    if(!file)return;
    try{
      const XLSX=await loadXlsx();
      const buffer=await file.arrayBuffer();
      const workbook=XLSX.read(buffer,{type:'array',cellDates:false});
      const candidates=sheetCandidates(workbook,XLSX);
      if(!candidates.length)throw new Error('Não encontrei nenhuma aba mensal com as colunas CLIENTE e TOTAL.');

      const selected=candidates[0];
      const headers=selected.matrix[selected.headerRow]||[];
      const idx={
        cliente:headerIndex(headers,['CLIENTE']),
        honorario:headerIndex(headers,['HONO ADM COND','HONORARIO ADM','HONORÁRIO ADM']),
        cobranca:headerIndex(headers,['MODULO COBANCA','MODULO COBRANCA','MODULO COBANÇA','MOD. COB.','VALOR COBRADO DO CLIENTE']),
        manutencao:headerIndex(headers,['MODULO MANUT','MODULO MANUTENCAO','MODULO MANUTENÇÃO']),
        assembleia:headerIndex(headers,['ASSEM EXTRA','ASSEMB EXTRA','ASSEMBLEIA EXTRA']),
        rpa:headerIndex(headers,['RPA']),
        total:headerIndex(headers,['TOTAL']),
        detalhes:headerIndex(headers,['DETALHES']),
        venc:headerIndex(headers,['VENC'])
      };
      if(idx.cliente<0||idx.total<0)throw new Error('A planilha precisa ter as colunas CLIENTE e TOTAL.');

      const parsed=[];
      for(let r=selected.headerRow+1;r<selected.matrix.length;r++){
        const row=selected.matrix[r]||[];
        const client=String(row[idx.cliente]??'').trim();
        const total=n(row[idx.total]);
        if(!client||total<=0)continue;
        let day=idx.venc>=0?Math.trunc(n(row[idx.venc])):0;
        if(day<1||day>31)day=0;
        const obs=buildObservation(row,idx);
        parsed.push({rowNo:r+1,client,total,day,obs,
          honorario:idx.honorario>=0?n(row[idx.honorario]):0,
          cobranca:idx.cobranca>=0?n(row[idx.cobranca]):0,
          manutencao:idx.manutencao>=0?n(row[idx.manutencao]):0,
          assembleia:idx.assembleia>=0?n(row[idx.assembleia]):0,
          rpa:idx.rpa>=0?n(row[idx.rpa]):0,
          detalhesOriginais:idx.detalhes>=0?String(row[idx.detalhes]??'').trim():''
        });
      }
      if(!parsed.length)throw new Error(`A aba ${selected.name} não possui linhas com CLIENTE e TOTAL preenchidos.`);

      if(!confirm(`Importar ${selected.name} (${pad2(selected.month)}/${selected.year})?\n\nBoletos encontrados: ${parsed.length}\n\nO valor do boleto será exatamente a coluna TOTAL.`))return;

      const dueMonth=nextMonth(selected.year,selected.month);
      const existing=new Set((boletos||[]).map(b=>b.sourceKey).filter(Boolean));
      let added=0,dups=0,noDue=0;
      const historicoEmitidoNoBanco=selected.ym>='2026-01'&&selected.ym<='2026-07';

      parsed.forEach((r,i)=>{
        const due=r.day?`${dueMonth.year}-${pad2(dueMonth.month)}-${pad2(r.day)}`:'';
        if(!due)noDue++;
        const sourceKey=`xlsx-${selected.ym}-ADM-${norm(r.client)}-${r.total.toFixed(2)}-${r.day||'SEM'}-${norm(r.obs)}-${r.rowNo}`;
        if(existing.has(sourceKey)){dups++;return;}
        const c=typeof findClientByLooseName==='function'?findClientByLooseName(r.client):null;
        boletos.push({
          id:Date.now()+i+Math.floor(Math.random()*1000),
          clientId:c?.id||0,
          client:r.client,
          docNumber:`FAT-${pad2(selected.month)}${selected.year}-ADM-${String(r.rowNo-selected.headerRow).padStart(3,'0')}`,
          due,
          value:Number(r.total),
          description:`Faturamento ADM - ${pad2(selected.month)}/${selected.year}`,
          details:r.obs,
          bank:historicoEmitidoNoBanco?'Emitido diretamente no banco':'Integração pendente',
          status:!due?'pendente_vencimento':(historicoEmitidoNoBanco?'emitido_externo':'aguardando_integracao'),
          externalIssued:historicoEmitidoNoBanco&&!!due,
          receiptDate:'',flowId:null,sourceKey,competence:selected.ym,section:'ADM',
          billingBreakdown:{
            honorarioAdm:r.honorario,
            moduloCobranca:r.cobranca,
            moduloManutencao:r.manutencao,
            assembleiaExtra:r.assembleia,
            rpa:r.rpa,
            detalhes:r.detalhesOriginais
          }
        });
        existing.add(sourceKey);added++;
      });

      saveData('boletos',boletos);
      renderAll();
      alert(`IMPORTAÇÃO CONCLUÍDA ✅\n\nCompetência: ${pad2(selected.month)}/${selected.year}\nBoletos criados: ${added}\nDuplicados ignorados: ${dups}\nSem vencimento: ${noDue}\n\nValor: coluna TOTAL.\nObservações: somente os campos que possuem valor.`);
    }catch(e){
      alert(`Não consegui importar a planilha:\n${e?.message||e}`);
    }finally{
      if(input)input.value='';
    }
  }
  window.importMonthlyBillingXlsx=importMonthlyBillingXlsx;

  function enhanceBoletos(){
    const view=document.getElementById('view-boletos');
    if(!view)return;
    const oldInput=document.getElementById('monthlyBillingPdf');
    if(oldInput){
      oldInput.accept='.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';
      oldInput.setAttribute('onchange','importMonthlyBillingXlsx(this)');
    }
    const buttons=[...view.querySelectorAll('button')];
    const importBtn=buttons.find(b=>/Importar PDF mensal/i.test(b.textContent||''));
    if(importBtn){
      importBtn.textContent='⇧ Importar planilha mensal';
      importBtn.setAttribute('onclick',"document.getElementById('monthlyBillingPdf').click()");
    }
    const notice=view.querySelector('.notice');
    if(notice){
      notice.innerHTML='<b>Regra do faturamento:</b> importe a planilha mensal em Excel. O sistema usa <b>TOTAL</b> como valor do boleto e monta a observação com Honorário Adm, Módulo cobrança, Módulo manutenção, Assemb. Extra e RPA somente quando houver valor. Os códigos do RPA são puxados de <b>DETALHES</b>. O vencimento continua no mês seguinte à competência.';
    }
    const ths=[...view.querySelectorAll('thead th')];
    const detailsTh=ths.find(th=>/^Detalhes$/i.test((th.textContent||'').trim()));
    if(detailsTh)detailsTh.textContent='Observação do boleto';
  }

  const originalRender=window.renderBoletos;
  if(typeof originalRender==='function'){
    window.renderBoletos=function(){
      const result=originalRender.apply(this,arguments);
      try{enhanceBoletos();}catch(e){console.error('Ajuste importação planilha',e);}
      return result;
    };
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(enhanceBoletos,0),{once:true});
  else setTimeout(enhanceBoletos,0);
})();
